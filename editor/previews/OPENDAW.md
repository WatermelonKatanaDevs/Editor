# openDAW integration

The Studio application is built locally from the pinned source submodule at `editor/previews/vendor/opendaw-src`.

- Upstream project: https://github.com/andremichelle/openDAW
- License: GNU Affero General Public License, version 3 or later (AGPL-3.0-or-later)
- Source license: `editor/previews/vendor/opendaw-src/LICENSE`
- Build output: `editor/previews/vendor/opendaw/` (generated; intentionally not committed)

`scripts/build-opendaw.mjs` builds the upstream Studio into the Editor's static asset tree. It applies temporary build-time patches for the nested deployment path and client-side routing, then restores the source submodule. The Editor-owned iframe adapter in `editor/previews/opendaw-bridge.js` redirects native open/save file pickers to the current Editor workspace. Native openDAW project bundles (`.odb`), project files (`.od`), audio and soundfont files can therefore be opened from or saved to the workspace.

The application remains the upstream AGPL-licensed program. Its source and license are available in the pinned nested submodule; the Editor bridge and build integration are separate WatermelonKatana files. Review AGPL obligations before redistributing modified versions.
