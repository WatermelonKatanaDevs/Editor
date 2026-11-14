# Hosting the Editor

The Editor can be embedded by any website that wants to provide its own project,
authentication, storage, publishing, navigation, or UI integration. The bridge is
intentionally a trusted host interface, not a sandbox.

## Host page

Load `editor/remote-bridge.js` on the embedding page, then connect after the
Editor iframe loads:

```js
const frame = document.querySelector('#editor');
const editorOrigin = new URL(frame.src).origin;

const bridge = await EditorRemoteBridge.connect(frame.contentWindow, {
  targetOrigin: editorOrigin,
  localObjects: {
    EditorHost: {
      async getCurrentUser() {
        // Resolve identity using the host's own session.
      },
      async saveProject(project) {
        // Persist through the host's own API.
      }
    }
  },
  config: {
    origin: location.origin,
    hostUrl: location.href,
    integrationUrl: new URL('/editor-integration.js', location.origin).href
  }
});

// The host can also control the Editor runtime directly.
const editor = bridge.remote.Editor;
```

The `EditorHost` object is exposed inside the Editor as `window.EditorHost`.
Its methods and nested objects are available through the asynchronous bridge.
The host receives the Editor window as `bridge.remote.Editor`.

## Integration script

If `config.integrationUrl` is supplied, the Editor loads that script after the
bridge is established. Inside it:

```js
const editor = window;
const host = window.EditorHost;
const hostConfig = window.EditorHostConfig;

// Use the Editor's public APIs and, where needed, its full runtime surface.
editor.EditorExtensionAPI?.register({
  id: 'my-host',
  name: 'My Host',
  open() {
    editor.EditorApp?.openBuiltin('my-host-panel');
  }
});
```

The script URL must use HTTP(S) and share the embedding host's origin. The Editor
fires `editorhostready` when the bridge is connected and
`editorintegrationloaded` after the integration script loads.

The host config is passed through as `window.EditorHostConfig`; the bridge
normalizes its `origin` to the actual message origin. Additional host-specific
configuration fields can be supplied freely.

## Origin trust

Configure `editor/remote-bridge-config.json` on the Editor deployment:

```json
{
  "allowedParentOrigins": ["*"]
}
```

Use `"*"` to allow any embedding origin, or replace it with an explicit list
such as `["https://example.com", "https://studio.example.org"]`. An empty list
rejects all parent origins. If the config cannot be loaded, parent connections are rejected. Keep the
config file deployed; the checked-in default already allows any parent.

## Trust model

A connected host is trusted code. The bridge exposes the Editor runtime to the
host, and the integration script executes in the Editor page with that page's
privileges. Do not embed an untrusted host or point `integrationUrl` at
untrusted code. The origin list controls who may establish the bridge; it is not
a capability sandbox.
