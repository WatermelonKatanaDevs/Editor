# PhotoCraft integration

PhotoCraft source is pinned as a Git submodule at `editor/previews/vendor/photocraft-src` from https://github.com/storytold/photocraft.

The browser build is generated locally into `editor/previews/vendor/photocraft/` by `scripts/build-photocraft.mjs`; generated output is ignored by Git and built during the parent application's install step. It is served from the Editor origin, not loaded from the hosted PhotoCraft website.

The bridge adapts PhotoCraft's browser file picker and download-based save flow. Open browses workspace files or chooses files from the device. Save/export writes directly into the Editor workspace, marks the project dirty, and refreshes Explorer. Read-only workspaces cannot be written.

PhotoCraft is MIT OR Apache-2.0 licensed; its license files remain in the source submodule.
