// Isolated-world bridge between the page fetch wrapper and proxy.js.
(() => {
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
