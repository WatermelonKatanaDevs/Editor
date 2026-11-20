# Editor Browser Proxy

This is a Manifest V3 browser extension for Chromium-based browsers.

## Install

1. Download and extract the **Editor Browser Proxy** ZIP from the Editor Browser's Proxy Configuration panel.
2. Open `chrome://extensions` (or the equivalent extensions page in your browser).
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the extracted `editor-browser-proxy` folder.
5. Open or reload the Editor Browser and browse as usual.

The extension requests access to all websites because its background service worker must fetch cross-origin resources on behalf of pages. The proxy is used only for fetch calls from frames identified as Editor Browser PageEmulator pages.

## Design

- `proxy.js` is the extension's Manifest V3 background service worker. It performs direct fetch requests with the extension's `<all_urls>` host permission.
- `page.js` runs in the main world and replaces `window.fetch` only in Editor Browser-emulated pages.
- `bridge.js` runs in the isolated content-script world and relays messages between the page wrapper and the service worker.
- The extension does not use the Editor Browser's configured proxy gateways or alter its Network endpoint chain.

Same-origin, `data:`, and `blob:` fetches retain the Editor Browser's existing behavior. Cross-origin HTTP(S) fetches are handled by the extension service worker.
