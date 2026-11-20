// Main-world fetch replacement. It activates only inside an Editor
// Browser PageEmulator; ordinary tabs and unrelated iframes are untouched.
(() => {
  // The extension is globally declared for related frames, but only an Editor
  // Browser-created PageEmulator iframe should install a fetch wrapper.
  try {
    const frame = window.frameElement;
    if (!frame || !frame.getAttribute("data-page-id")) return;
  } catch (_) {
    return;
  }

  if (window.__editorBrowserProxyPageBootstrap) return;
  Object.defineProperty(window, "__editorBrowserProxyPageBootstrap", {
    configurable: false,
    value: true
  });

  const CHANNEL = "editor-browser-proxy:v1";
  const pending = new Map();
  let rawFetch = window.fetch;
  let wrappedFetch = null;
  let accessorInstalled = false;

  function getEditorPage() {
    try {
      const page = window.__pageEmulator;
      const frame = window.frameElement;
      if (
        !page ||
        !frame ||
        page.iframe !== frame ||
        frame.getAttribute("data-page-id") !== String(page.id) ||
        window.__frameElement !== frame ||
        typeof page.location?.url !== "string" ||
        typeof page.location?.origin !== "string"
      ) return null;
      return page;
    } catch (_) {
      return null;
    }
  }

  function bytesToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(String(value || ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function makeAbortError() {
    try { return new DOMException("The operation was aborted.", "AbortError"); }
    catch (_) {
      const error = new Error("The operation was aborted.");
      error.name = "AbortError";
      return error;
    }
  }

  function sendExtensionRequest(request, targetUrl) {
    const id = (crypto.randomUUID && crypto.randomUUID()) ||
      ("ebp-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2));

    return new Promise((resolve, reject) => {
      if (request.signal.aborted) {
        reject(makeAbortError());
        return;
      }

      const finish = (callback, value) => {
        if (!pending.has(id)) return;
        pending.delete(id);
        request.signal.removeEventListener("abort", onAbort);
        callback(value);
      };

      const onAbort = () => {
        window.postMessage({channel: CHANNEL, type: "ABORT", id}, "*");
        finish(reject, makeAbortError());
      };

      pending.set(id, result => {
        if (!result || result.ok !== true) {
          const error = new TypeError(result?.error || "The Editor Browser Proxy request failed.");
          if (result?.name) error.name = result.name;
          finish(reject, error);
          return;
        }

        try {
          const status = Number(result.status);
          if (!Number.isInteger(status) || status < 200 || status > 599) {
            throw new TypeError("The extension returned an invalid HTTP status.");
          }

          const noBody = request.method === "HEAD" || [204, 205, 304].includes(status);
          const bytes = noBody || result.body == null ? null : base64ToBytes(result.body);
          const response = new Response(bytes, {
            status,
            statusText: String(result.statusText || ""),
            headers: Array.isArray(result.headers) ? result.headers : []
          });
          try {
            Object.defineProperty(response, "url", {
              configurable: true,
              value: String(result.url || targetUrl)
            });
          } catch (_) {}
          finish(resolve, response);
        } catch (error) {
          finish(reject, error);
        }
      });

      request.signal.addEventListener("abort", onAbort, {once: true});
      // The body is serialized separately so it can cross the isolated-world
      // message bridge without relying on browser-specific ArrayBuffer cloning.
      Promise.resolve().then(async () => {
        let body = null;
        if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
          body = bytesToBase64(await request.clone().arrayBuffer());
        }
        if (!pending.has(id)) return;

        const headers = Array.from(request.headers.entries()).filter(([name]) => {
          const lower = name.toLowerCase();
          return !(
            lower === "host" ||
            lower === "origin" ||
            lower === "referer" ||
            lower === "content-length" ||
            lower === "cookie" ||
            lower.startsWith("sec-")
          );
        });

        window.postMessage({
          channel: CHANNEL,
          type: "FETCH",
          id,
          request: {
            url: targetUrl,
            method: request.method,
            headers,
            body,
            credentials: request.credentials,
            cache: request.cache,
            redirect: request.redirect,
            referrerPolicy: request.referrerPolicy,
            integrity: request.integrity
          }
        }, "*");
      }).catch(error => finish(reject, error));
    });
  }

  window.addEventListener("message", event => {
    if (event.source !== window || event.data?.channel !== CHANNEL || event.data.type !== "RESULT") return;
    const callback = pending.get(String(event.data.id || ""));
    if (callback) callback(event.data.result || {});
  });

  function makeFetchWrapper(original) {
    if (typeof original !== "function") return original;
    if (original.__editorBrowserProxyWrapped) return original;

    const wrapped = function(input, init) {
      const page = getEditorPage();
      if (!page) return original.apply(this, arguments);

      let request;
      try {
        request = new Request(input, init);
      } catch (_) {
        return original.apply(this, arguments);
      }

      let target;
      try {
        target = new URL(request.url, page.location.url);
      } catch (_) {
        return original.apply(this, arguments);
      }

      if (
        (target.protocol !== "http:" && target.protocol !== "https:") ||
        target.origin === page.location.origin
      ) {
        return original.apply(this, arguments);
      }

      return sendExtensionRequest(request, target.href);
    };

    try {
      Object.defineProperty(wrapped, "__editorBrowserProxyWrapped", {value: true});
      Object.defineProperty(wrapped, "name", {value: "fetch"});
    } catch (_) {}
    return wrapped;
  }

  function installFetchReplacement() {
    if (!getEditorPage() || typeof window.fetch !== "function") return false;

    if (!accessorInstalled) {
      rawFetch = window.fetch;
      wrappedFetch = makeFetchWrapper(rawFetch);
      try {
        Object.defineProperty(window, "fetch", {
          configurable: true,
          enumerable: true,
          get() { return wrappedFetch || rawFetch; },
          set(value) {
            rawFetch = value;
            wrappedFetch = makeFetchWrapper(value);
          }
        });
        accessorInstalled = true;
        return true;
      } catch (_) {
        // Some page runtimes may define fetch as non-configurable. The
        // periodic check below still wraps later replacements.
      }
    }

    if (!accessorInstalled) {
      const current = window.fetch;
      if (!current?.__editorBrowserProxyWrapped) {
        rawFetch = current;
        wrappedFetch = makeFetchWrapper(current);
        try { window.fetch = wrappedFetch; } catch (_) {}
      }
    }
    return true;
  }

  // The emulator installs its own fetch during its runtime bootstrap. Wait
  // for the PageEmulator identity and wrap that final fetch implementation.
  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    const installed = installFetchReplacement();
    if ((installed && accessorInstalled) || attempts >= 800) clearInterval(timer);
  }, 25);

  if (installFetchReplacement() && accessorInstalled) clearInterval(timer);
  window.addEventListener("pagehide", () => clearInterval(timer), {once: true});
})();
