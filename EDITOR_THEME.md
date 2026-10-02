# Editor theme

The editor exposes one shared theme object at `window.EditorTheme`. Every tab group created by the workbench receives the exact same object as `group.theme`, and builtin factory contexts receive it as `ctx.theme`.

## Runtime changes

```js
EditorTheme.set({
  css: {
    accent: '#dd6d7f',
    status: '#08a372'
  },
  monaco: {
    colors: {
      'editor.background': '#101010'
    }
  }
});

EditorTheme.setTokenColor('keyword', 'dd6d7f');
EditorTheme.setTokenColor('string', '3cdfa9');
EditorTheme.setMonacoColor('editor.selectionBackground', '#3a2140');
```

`EditorTheme.apply()` reapplies the current object. `EditorApp.onThemeChange()` / `EditorApp.on('themeChange', ...)` fires after an update.

The theme drives the shared editor CSS variables and Monaco's named theme. Nested tab groups use the same global object, so changes apply consistently across groups.
