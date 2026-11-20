// Isolated-world bridge between the page fetch wrapper and proxy.js.
(() => {
  const url = new URL(window.location.href);
  const host = url.hostname.toLowerCase();
  const editorHost = host === "watermelonkatana.onrender.com" ||
    host === "watermelonkatanatest.onrender.com" ||
    host === "watermelonkatanadevs.github.io" ||
    host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const browserPage = /(?:^|\/)browser\/browser\.html$/i.test(url.pathname);
  const parentPage = editorHost && (
    host === "watermelonkatanadevs.github.io"
      ? path === "/Editor" || path === "/Editor/index.html"
      : path === "/" || path === "/index.html"
  );
  if (!editorHost || (!browserPage && !parentPage)) return;

  const CHANNEL = "editor-browser-proxy:v1";

  window.addEventListener("message", event => {
    if (event.source !== window || event.data?.channel !== CHANNEL) return;
    const message = event.data;

    if (message.type === "ABORT") {
      chrome.runtime.sendMessage({
        type: "EDITOR_BROWSER_PROXY_ABORT",
        id: String(message.id || "")
      }).catch(() => {});
      return;
    }

    if (message.type !== "FETCH" || !message.id || !message.request) return;

    chrome.runtime.sendMessage({
      type: "EDITOR_BROWSER_PROXY_FETCH",
      id: String(message.id),
      ...message.request
    }).then(
      result => {
        window.postMessage({
          channel: CHANNEL,
          type: "RESULT",
          id: String(message.id),
          result
        }, "*");
      },
      error => {
        window.postMessage({
          channel: CHANNEL,
          type: "RESULT",
          id: String(message.id),
          result: {
            ok: false,
            error: error && error.message ? error.message : String(error || "Extension request failed"),
            name: "Error"
          }
        }, "*");
      }
    );
  });
})();
