# Three.js vendor bundle

- Upstream project: https://github.com/mrdoob/three.js
- Upstream release: `r186`
- npm version: `0.186.0`
- License: MIT (see [LICENSE](./LICENSE))

This directory contains the unmodified Three.js core build and the official
`examples/jsm` modules and decoder assets used by the Editor's 3D model preview.
The preview pins its matching version in `editor/previews/model3d.js` and loads
all Three.js files from this local directory; it does not need a Three.js CDN.

Keep the directory structure intact: addon modules use relative imports and the
DRACO/Basis loaders resolve their decoder assets relative to their own URLs.
