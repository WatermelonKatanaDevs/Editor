// Editor Browser Proxy — Manifest V3 background service worker.
// Requests run from this extension worker, where <all_urls> host permissions
// allow cross-origin fetches without the page's CORS enforcement.

const activeRequests = new Map();

function isTrustedEditorSender(sender) {
  if (sender?.id !== chrome.runtime.id || !sender.url) return false;
  try {
    const url = new URL(sender.url);
    const host = url.hostname.toLowerCase();
    const editorHost = host === "watermelonkatana.onrender.com" ||
      host === "watermelonkatanatest.onrender.com" ||
      host === "watermelonkatanadevs.github.io" ||
      host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    if (!editorHost) return false;
    if (/(?:^|\/)browser\/browser\.html$/i.test(url.pathname)) return true;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return host === "watermelonkatanadevs.github.io"
      ? path === "/Editor" || path === "/Editor/index.html"
      : path === "/" || path === "/index.html";
  } catch (_) {
    return false;
  }
}

function decodeBase64ToBytes(value) {
  const binary = atob(String(value || ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeBytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function cleanRequestHeaders(entries) {
  const headers = new Headers(Array.isArray(entries) ? entries : []);
  for (const name of Array.from(headers.keys())) {
    const lower = name.toLowerCase();
    if (
      lower === "host" ||
      lower === "origin" ||
      lower === "referer" ||
      lower === "content-length" ||
      lower === "cookie" ||
      lower === "cookie2" ||
      lower === "connection" ||
      lower === "proxy-authorization" ||
      lower.startsWith("sec-")
    ) {
      headers.delete(name);
    }
  }
  return headers;
}

async function handleProxyRequest(message, signal) {
  const target = new URL(String(message.url || ""));
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new TypeError("Only HTTP and HTTPS requests can be proxied.");
  }

  const method = String(message.method || "GET").toUpperCase();
  const headers = cleanRequestHeaders(message.headers);
  const body = method === "GET" || method === "HEAD" || message.body == null
    ? undefined
    : decodeBase64ToBytes(message.body);

  const options = {
    method,
    headers,
    credentials: ["omit", "same-origin", "include"].includes(message.credentials)
      ? message.credentials
      : "same-origin",
    cache: ["default", "no-store", "reload", "no-cache", "force-cache"].includes(message.cache)
      ? message.cache
      : (message.cache === "only-if-cached" ? "force-cache" : "default"),
    redirect: ["follow", "error", "manual"].includes(message.redirect)
      ? message.redirect
      : "follow",
    signal
  };
  if (body !== undefined) options.body = body;
  if (message.referrerPolicy) options.referrerPolicy = message.referrerPolicy;
  if (message.integrity) options.integrity = String(message.integrity);

  const response = await fetch(target.href, options);

  // A manual cross-origin redirect is intentionally not fabricated as a
  // readable response. Fetch's opaque-redirect response cannot be recreated
  // by the page's Response constructor.
  if (response.type === "opaqueredirect") {
    throw new TypeError("Manual cross-origin redirects cannot be exposed by the extension proxy.");
  }

  const responseBody = response.body === null ? null : await response.arrayBuffer();
  const responseHeaders = Array.from(response.headers.entries()).filter(([name]) => {
    return ![
      "content-encoding",
      "content-length",
      "transfer-encoding",
      "connection",
      "set-cookie",
      "set-cookie2"
    ].includes(name.toLowerCase());
  });

  return {
    ok: true,
    status: response.status,
    statusText: response.statusText,
    url: response.url || target.href,
    headers: responseHeaders,
    body: responseBody === null ? null : encodeBytesToBase64(responseBody)
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return undefined;
  if (
    (message.type === "EDITOR_BROWSER_PROXY_FETCH" || message.type === "EDITOR_BROWSER_PROXY_ABORT") &&
    !isTrustedEditorSender(sender)
  ) return undefined;

  if (message.type === "EDITOR_BROWSER_PROXY_ABORT") {
    activeRequests.get(String(message.id || ""))?.abort();
    return undefined;
  }

  if (message.type !== "EDITOR_BROWSER_PROXY_FETCH") return undefined;

  const id = String(message.id || "");
  if (!id) {
    sendResponse({ok: false, error: "Missing request identifier."});
    return undefined;
  }

  const controller = new AbortController();
  activeRequests.set(id, controller);

  handleProxyRequest(message, controller.signal)
    .then(sendResponse)
    .catch(error => {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : String(error || "Proxy request failed"),
        name: error && error.name ? error.name : "Error"
      });
    })
    .finally(() => {
      if (activeRequests.get(id) === controller) activeRequests.delete(id);
    });

  return true;
});
