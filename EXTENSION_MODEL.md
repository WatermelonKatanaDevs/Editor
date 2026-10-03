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
