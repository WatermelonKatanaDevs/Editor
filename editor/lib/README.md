# Shared workspace picker

The Editor loads `editor/lib/workspace-picker.js` once from `index.html`. It owns the only upload/open/save dialog used by integrated applications. App-specific bridges translate each application's native file API into this common service; they do not render their own picker dialogs.

## Shared API

Create one picker instance from an Editor builtin factory:

```js
const picker = window.EditorWorkspacePicker.create({
  getFs: () => ctx.state.fs,
  getMime: path => ctx.mime(path),
  canWrite: () => ctx.state.projectOwner !== false,
  onWrite: path => {
    ctx.markDirty(path);
    ctx.updateStatus();
    ctx.state.fileManager?.refresh?.();
  }
});
```

- `open(options)` resolves to selected `File[]` (or `null` when cancelled). Workspace files carry `__wkWorkspacePath` and `customRelativePath`.
- `savePath(options)` resolves to a workspace-relative path (or `null`).
- `saveFile(options)` asks for a destination and writes `bytes` or `data`.
- `writeFile(path, bytes)` writes directly to the workspace and runs the configured dirty/refresh callback.
- `cancelActive()` closes or cancels queued dialogs belonging to that picker instance.

Supported options include `title`, `extensions`, `accept`, `types`, `multiple`, `allowDevice`, `startPath`, and `maxFileBytes`.

The picker defaults to **Contained inside the editor tab**. Change this under Settings → File Picker → Picker display to use **Overlay over the entire Editor** instead. The preference is stored locally in the browser. Each integrated builtin supplies its active workbench view body as the contained host, so the picker is clipped to that app tab and does not cover the rest of the Editor.

The picker lists workspace files and folders, supports folder navigation and search, MIME/extension filtering, an All files override, multiple selection, device files, and drag-and-drop from the Editor Explorer or the desktop. Save dialogs support destination folders, suggested names, default extensions, and overwrite confirmation. Read-only workspaces are protected centrally.

Dialogs are serialized across app instances. Closing an app cancels only that instance's active or queued requests; it cannot close another app's picker.

## App adapters

- **Blockbench**: the iframe bridge routes its workspace import/save calls, file inputs, and Blob downloads to the common picker.
- **PhotoCraft / SoundCraft**: their iframe bridges route native file-input activation and Blob downloads to the common picker.
- **FilmCraft**: an injected iframe bridge routes internal Open/import/relink actions to the common picker. Project files continue through FilmCraft's host protocol; media files are returned as normal browser `File` objects so FilmCraft's own import and relink logic remains intact. Host-mode saves and exports use the shared save dialog.
- **openDAW**: its isolated iframe bridge routes File System Access API calls, input fallbacks, and Blob downloads to the common picker. The builtin remains disabled in `index.html` while openDAW is paused.

These bridges only activate when the apps are embedded by the Editor. Standalone applications retain their normal browser behavior.
