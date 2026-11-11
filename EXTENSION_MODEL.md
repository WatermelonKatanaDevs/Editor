# Extension model

The editor deliberately uses a small, non-installing extension API.

## Embedding page owns loading

Third-party extensions are not installed into the editor. An embedding page loads an extension script into the editor iframe, for example with `frame.contentWindow.document.createElement('script')` and a script `src` or source string.

## Global extension API

The editor exposes `window.EditorExtensionAPI`:

```js
const handle = EditorExtensionAPI.register({
  id: 'example',
  name: 'Example Extension',
  description: '...',
  icon: '<img ...>',
  open({ group, editor, api }) {
    // the extension owns what opens here
  }
});

handle.update({ description: '...' });
handle.open();

EditorExtensionAPI.list();
EditorExtensionAPI.get('example');
EditorExtensionAPI.open('example');
EditorExtensionAPI.onChange(...);
```

There is intentionally no installation/removal API yet.

## Extension-owned pages

The extension API does **not** define a generic extension details page. When the user clicks an extension in the Extensions sidebar, the API invokes that extension's own `open` callback.

For custom editor pages, the extension/embedding host can use the existing global builtin registry:

```js
editor.EditorBuiltinFactories.test = function(ctx) {
  return {
    title: 'Test',
    icon: '...',
    render(group) { /* render the extension's page */ }
  };
};
```

The embedding host can also add a Welcome action with `EditorApp.addWelcomeAction(...)`. Neither mechanism is part of `EditorExtensionAPI`.

## `extension.html` test

`extension.html` embeds `index.html`, waits for the iframe's load/init, loads `test-extension.js` into the child page, registers the `test` builtin from the parent page, and adds that builtin to Welcome. It also lets the parent upload arbitrary extension scripts and project ZIP files.

## AI tools and hooks

Extensions can add trusted tools to the built-in AI without modifying the AI implementation:

```js
EditorExtensionAPI.register({
  id: 'example',
  name: 'Example',
  ai: {
    tools: [{
      name: 'example_action',
      description: 'Do an example action.',
      permission: 'extensionActions',
      parameters: {
        type: 'object',
        properties: { value: { type: 'string' } },
        required: ['value']
      },
      async execute(args) {
        return { ok: true, value: args.value };
      }
    }],
    hooks: {
      'ai.beforeRun': async payload => payload,
      'ai.afterRun': async payload => payload,
      'ai.beforeTool': async payload => payload,
      'ai.afterTool': async payload => payload
    }
  }
});
```

AI tools are exposed to the built-in agent as normal function tools and go through the normal AI permission system. Extensions should use a specific permission such as `extensionActions` for actions that can change external state.

Hook payloads are ordinary JavaScript objects. `ai.beforeRun` can return a replacement payload (for example, with additional messages); `ai.afterRun` receives the completed result. `ai.beforeTool` can return a replacement `{args}` object, and `ai.afterTool` can return a replacement `{result}`. Hook failures are isolated so an extension cannot silently take down the AI agent.

The editor also exposes built-in GitHub AI tools. They use the existing GitHub sign-in from the Editor Profile and are separately permissioned as `githubRead` and `githubWrite`. GitHub write actions remain disabled until the user grants permission.

An extension can also register tools directly with `EditorExtensionAPI.registerAITool(extensionId, tool)` and remove one with `unregisterAITool(name)`.

## Cross-origin embedding bridge

The Editor can be embedded by a different origin without exposing its window or DOM to the embedding page. Load `editor/remote-bridge.js` in the Editor document and connect from the embedding page with a dedicated `MessageChannel`:

```js
const bridge = await EditorRemoteBridge.connect(frame.contentWindow, {
  targetOrigin: new URL(frame.src).origin,
  localObjects: { host: hostServices },
  config: { integrationUrl: 'https://host.example/editor-integration.js' }
});

// The entire Editor window is available as a remote object graph.
await bridge.remote.Editor.EditorApp.openBuiltin('example');

// Primitive values are read asynchronously because a JavaScript Proxy
// cannot synchronously fetch a property from another browsing context.
const info = await bridge.remote.Editor.EditorApp.getWorkspaceInfo();
const theme = await bridge.remote.Editor.EditorTheme.$get('monaco');

// Confirmed property writes and introspection are explicit asynchronous calls.
await bridge.remote.Editor.EditorTheme.$set('id', 'example-theme');
const keys = await bridge.remote.Editor.EditorTheme.$keys();
```

The bridge is a general object-reference RPC layer rather than an API-method allowlist. It supports nested property paths, method calls with the correct receiver, constructors, callbacks passed as arguments, returned callbacks and object references, promises, property assignment/deletion, key enumeration, structured-clone values (including files, blobs, and buffers), and serialized errors. Remote object references are released when proxy handles are collected where `FinalizationRegistry` is available; closing the bridge rejects pending operations and closes its port.

There are two JavaScript boundaries that cannot be erased by `postMessage`: primitive remote property reads and DOM operations are asynchronous, and DOM methods cannot synchronously return live nodes to another origin. Code that needs the Editor's DOM or synchronous Editor APIs should therefore execute in the Editor document itself and call the embedding page through the bridge. The WatermelonKatana integration follows that model: it runs in the Editor origin, while authentication, same-origin WK API requests, and host navigation are provided by the embedding page.

Always pass an exact `targetOrigin`; never use `*` for the connection. The receiver also verifies that the initial connection message came from its own parent window. Treat every exposed host method as a capability and expose only the operations that the embedded application needs.
