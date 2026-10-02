# Editor bug fixes

- Nested workbench groups now publish their active group before activation/render callbacks. Explorer/search/AI file opens therefore target the nested group the user is viewing.
- Monaco waits for a connected, laid-out host before creating an editor, preventing zero-size startup initialization.
- Monaco startup language is explicitly applied with `monaco.editor.setModelLanguage`.
- Monaco initialization timeout increased to 10 seconds and failures keep the textarea fallback visible.
- A post-create animation-frame layout call handles delayed tab-group sizing.
