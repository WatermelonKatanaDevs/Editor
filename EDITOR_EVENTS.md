# Editor DOM / lifecycle events

The editor exposes `EditorApp.on(event, callback)` and convenience methods for embedding pages and extensions.

```js
editor.EditorApp.on('sidebarChange', ({ sidebar, previous, collapsed, tree, button }) => {});
editor.EditorApp.on('tabOpen', ({ tab, group, workbench, tabElement, viewElement }) => {});
editor.EditorApp.on('tabActivate', ({ tab, group, workbench, tabElement, viewElement }) => {});
editor.EditorApp.on('tabClose', ({ tab, group, workbench }) => {});
editor.EditorApp.on('builtinRender', ({ tab, group, element, builtin }) => {});
editor.EditorApp.on('viewRender', ({ tab, group, element, path, view }) => {});
editor.EditorApp.on('domAdded', ({ records, nodes, elements, targets }) => {});
editor.EditorApp.on('workbenchRebuild', ({ workbench, root, groups }) => {});
```

All lifecycle callbacks are scheduled after the related DOM work has been applied. `domAdded` is backed by a document-wide `MutationObserver` and catches dynamically inserted editor DOM that is not covered by a semantic event.

Convenience aliases are available on `EditorApp` and `EditorEvents`, e.g. `EditorApp.onTabOpen(fn)` and `EditorEvents.onSidebarChange(fn)`.

Use the returned function from `on(...)` to unsubscribe.
