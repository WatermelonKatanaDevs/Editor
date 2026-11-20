// Main-world fetch replacement for the parent Editor page and Browser document.
// It deliberately does not inspect or modify pages opened inside the Browser.
(() => {
  // Only activate on the deployed Editor origins (or a local development server).
  function isEditorHost(hostname) {
    const host = String(hostname || "").toLowerCase();
    return host === "watermelonkatana.onrender.com" ||
      host === "watermelonkatanatest.onrender.com" ||
      host === "watermelonkatanadevs.github.io" ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]";
  }

  function isEditorBrowserDocument(url) {
    return isEditorHost(url.hostname) && /(?:^|\/)browser\/browser\.html$/i.test(url.pathname);
  }

  function isEditorParentDocument(url) {
    if (!isEditorHost(url.hostname)) return false;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (url.hostname.toLowerCase() === "watermelonkatanadevs.github.io") {
      return path === "/Editor" || path === "/Editor/index.html";
    }
    return path === "/" || path === "/index.html";
  }

  const currentUrl = new URL(window.location.href);
  const isBrowserDocument = isEditorBrowserDocument(currentUrl);
  const isParentDocument = isEditorParentDocument(currentUrl);
  if (!isBrowserDocument && !isParentDocument) return;

  if (window.__editorBrowserProxyPageBootstrap) return;
  Object.defineProperty(window, "__editorBrowserProxyPageBootstrap", {
    configurable: false,
    value: true
  });

  const CHANNEL = "editor-browser-proxy:v1";
  const pending = new Map();
  const browserOrigin = window.location.origin;
  const browserBaseUrl = window.location.href;

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
      let request;
      try {
        request = new Request(input, init);
      } catch (_) {
        return original.apply(this, arguments);
      }

      let target;
      try {
        target = new URL(request.url, browserBaseUrl);
      } catch (_) {
        return original.apply(this, arguments);
      }

      if (
        (target.protocol !== "http:" && target.protocol !== "https:") ||
        target.origin === browserOrigin
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

  // Patch the Browser document or parent Editor page once, at document_start.
  // The parent's network.js captures fetch as soon as its script loads.
  if (typeof window.fetch === "function") {
    window.fetch = makeFetchWrapper(window.fetch);
  }
})();
