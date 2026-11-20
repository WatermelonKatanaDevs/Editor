# Editor Browser Proxy

This is a Manifest V3 browser extension for Chromium-based browsers.

## Install

1. Download and extract the **Editor Browser Proxy** ZIP from the Editor Browser's Proxy Configuration panel.
2. Open `chrome://extensions` (or the equivalent extensions page in your browser).
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the extracted `editor-browser-proxy` folder.
5. Open or reload the Editor Browser and browse as usual.

The extension requests access to all websites so its background service worker can fetch cross-origin resources. It installs the fetch replacement in two Editor contexts: the parent Editor page and the Browser document (`browser/browser.html`). It does not patch pages opened inside the Browser.

## Design

- `proxy.js` is the extension's Manifest V3 background service worker. It performs direct fetch requests with the extension's `<all_urls>` host permission.
- `page.js` runs in the main world at `document_start` and replaces `window.fetch` in both the parent Editor page and `browser/browser.html`. This matters because the parent page loads `browser/lib/network.js`, which captures its current `window.fetch` for the shared `Network` endpoints. Patching only the Browser iframe misses requests made through that shared parent-context network.
- The extension recognizes the WatermelonKatana Render deployments, the `WatermelonKatanaDevs.github.io/Editor/` test deployment, and localhost development URLs. Add any custom deployment hosts to the allowlist in `page.js`, `bridge.js`, and `proxy.js`.
- The background worker validates the sender's Editor URL before accepting fetch or abort messages; unrelated websites cannot use the extension bridge.
- `bridge.js` runs in the isolated content-script world and relays messages between the page wrapper and the service worker.
- The extension does not add or replace Network endpoints. It patches the native fetch captured by the existing endpoints, preserving the normal endpoint order and fallback behavior while cross-origin fetches are performed by the extension worker.

Same-origin, `data:`, and `blob:` fetches retain the Editor Browser's existing behavior. Cross-origin HTTP(S) fetches are handled by the extension service worker.
