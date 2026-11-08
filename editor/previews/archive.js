(function () {
  const MAX_FILES = 5000;
  const MAX_FILE_BYTES = 64 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 256 * 1024 * 1024;
  const MAX_TEXT_PREVIEW_BYTES = 2 * 1024 * 1024;

  function safeArchivePath(value) {
    let path = String(value || '').replace(/\\/g, '/');
    if (!path || path.startsWith('/') || /^[a-z]:/i.test(path)) return null;
    const parts = [];
    for (const part of path.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..' || part.includes('\0')) return null;
      parts.push(part);
    }
    return parts.length ? parts.join('/') : null;
  }

  function makeArchiveFileSystem(entries) {
    const cache = new Map();
    const directories = new Set(['']);
    const addDirectory = path => {
      const parts = String(path || '').split('/').filter(Boolean);
      let current = '';
      for (const part of parts) {
        current = current ? current + '/' + part : part;
        directories.add(current);
      }
    };

    for (const entry of entries || []) {
      const path = safeArchivePath(entry.path);
      if (!path) continue;
      if (entry.directory) {
        addDirectory(path);
        continue;
      }
      const bytes = entry.data instanceof Uint8Array
        ? entry.data
        : entry.data instanceof ArrayBuffer
          ? new Uint8Array(entry.data)
          : ArrayBuffer.isView(entry.data)
            ? new Uint8Array(entry.data.buffer, entry.data.byteOffset, entry.data.byteLength)
            : null;
      if (!bytes) continue;
      cache.set(path, bytes);
      const slash = path.lastIndexOf('/');
      if (slash >= 0) addDirectory(path.slice(0, slash));
    }

    const provider = {
      cache,
      directories,
      write() { throw new Error('Archive previews are read-only.'); },
      mkdir() { throw new Error('Archive previews are read-only.'); },
      delete() { return false; },
      removeDirectory() {}
    };
    return new FileSystem(provider, 4, true);
  }

  function formatBytes(value) {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function showMessage(host, message, error = false) {
    host.innerHTML = '';
    const box = document.createElement('div');
    box.className = error ? 'editor-archive-message error' : 'editor-archive-message';
    box.textContent = message;
    host.appendChild(box);
  }

  async function loadZipArchive(ctx, bytes, status) {
    if (typeof JSZip === 'undefined') throw new Error('The ZIP preview library is unavailable.');
    status.textContent = 'Reading ZIP directory…';
    const zip = await JSZip.loadAsync(bytes, { checkCRC32: false });
    const files = [];
    const directories = [];
    let declaredBytes = 0;

    zip.forEach((relativePath, entry) => {
      const path = safeArchivePath(relativePath.replace(/\/$/, ''));
      if (!path) return;
      if (entry.dir) {
        directories.push(path);
        return;
      }
      const rawSize = Number(entry._data?.uncompressedSize);
      if (Number.isFinite(rawSize) && rawSize >= 0) {
        if (rawSize > MAX_FILE_BYTES) throw new Error('A file in this archive exceeds the 64 MB preview limit.');
        declaredBytes += rawSize;
        if (declaredBytes > MAX_TOTAL_BYTES) throw new Error('The extracted archive would exceed the 256 MB preview limit.');
      }
      files.push({ path, entry, size: Number.isFinite(rawSize) ? rawSize : null });
      if (files.length > MAX_FILES) throw new Error('This archive contains more than 5,000 files.');
    });

    const extracted = [];
    let totalBytes = 0;
    for (let i = 0; i < files.length; i++) {
      if (!ctx.isCurrent()) return null;
      const item = files[i];
      status.textContent = 'Extracting ' + (i + 1) + ' of ' + files.length + '…';
      const data = await item.entry.async('uint8array');
      if (data.byteLength > MAX_FILE_BYTES) throw new Error('A file in this archive exceeds the 64 MB preview limit.');
      totalBytes += data.byteLength;
      if (totalBytes > MAX_TOTAL_BYTES) throw new Error('The extracted archive exceeds the 256 MB preview limit.');
      extracted.push({ path: item.path, data });
      if (i % 12 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    return { files: extracted, directories };
  }

  async function loadSevenZipArchive(ctx, bytes, status) {
    status.textContent = 'Starting 7-Zip…';
    const worker = new Worker(new URL('editor/previews/archive-7z-worker.js', document.baseURI));
    let complete = false;
    ctx.addCleanup(() => worker.terminate());

    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const result = await new Promise((resolve, reject) => {
      worker.onmessage = event => {
        const data = event.data || {};
        if (data.type === 'progress') {
          status.textContent = data.message || 'Reading archive…';
          return;
        }
        if (data.type === 'error') {
          complete = true;
          worker.terminate();
          reject(new Error(data.message || '7-Zip could not open this archive.'));
          return;
        }
        if (data.type === 'done') {
          complete = true;
          worker.terminate();
          resolve(data.entries || []);
        }
      };
      worker.onerror = event => {
        complete = true;
        worker.terminate();
        reject(new Error(event.message || 'The 7-Zip archive worker failed.'));
      };
      const extension = String(ctx.file.name || '').split('.').pop().toLowerCase();
      worker.postMessage({ buffer, extension }, [buffer]);
    });

    if (!ctx.isCurrent()) return null;
    return {
      files: result.filter(entry => !entry.directory).map(entry => ({ path: entry.path, data: new Uint8Array(entry.data) })),
      directories: result.filter(entry => entry.directory).map(entry => entry.path)
    };
  }

  function createReadOnlyPreviewManager(fs) {
    const state = {
      fs,
      markDirty() {},
      updateStatus() {}
    };
    const manager = new EditorPreviewManager(state);
    for (const provider of window.EditorPreviewProviders || []) {
      if (provider && provider.id !== 'archive') manager.register(provider);
    }
    return manager;
  }

  function findPreviewView(manager, file) {
    const views = manager.getViews(file).filter(view => {
      const label = String(view.label || '').toLowerCase();
      const id = String(view.id || '').toLowerCase();
      return (label.includes('preview') || id.endsWith('-preview') || id === 'ico-preview' || id === 'audio-player' || id === 'audio-raw' || id === 'wasm-inspect' || id === 'model-3d-viewer') &&
        !id.includes('piskel');
    });
    if (!views.length) return null;
    return views.sort((a, b) =>
      Number(!!b.default) - Number(!!a.default) ||
      (Number(b.priority) || 0) - (Number(a.priority) || 0)
    )[0];
  }

  function renderTextPreview(fs, path, viewer) {
    const bytes = fs.readFileSync(path, 'binary');
    if (!bytes) {
      showMessage(viewer, 'This file is empty.');
      return;
    }
    const text = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const pre = document.createElement('pre');
    pre.className = 'editor-archive-text-preview';
    const visible = text.subarray(0, MAX_TEXT_PREVIEW_BYTES);
    pre.textContent = new TextDecoder().decode(visible);
    viewer.appendChild(pre);
    if (text.byteLength > visible.byteLength) {
      const note = document.createElement('div');
      note.className = 'editor-archive-truncated';
      note.textContent = 'Showing the first 2 MB. Drag the file out to copy the complete file.';
      viewer.appendChild(note);
    }
  }

  function isTextMime(mime) {
    return String(mime || '').startsWith('text/') ||
      ['application/json', 'application/javascript', 'application/typescript', 'application/xml', 'model/gltf+json'].includes(mime);
  }

  async function renderArchiveFile(path, fs, manager, tab, viewer, fileNameEl, fileIconEl, ctx) {
    if (tab._previewInstances) manager.dispose(tab);
    viewer.innerHTML = '';
    const name = path.slice(path.lastIndexOf('/') + 1);
    const file = { path, name, mime: EditorInferMime(name), id: 'archive-file:' + path };
    fileNameEl.textContent = name;
    fileIconEl.innerHTML = EditorRenderIcon(name, false);

    const view = findPreviewView(manager, file);
    if (view) {
      tab.id = file.id;
      tab.view = view.id;
      const group = { tabs: [tab], active: file.id };
      try {
        await manager.render(file, view.id, viewer, group);
      } catch (error) {
        showMessage(viewer, error?.message || 'The file preview failed.', true);
      }
      return;
    }

    if (isTextMime(file.mime)) {
      renderTextPreview(fs, path, viewer);
      return;
    }

    showMessage(viewer, 'No preview is available for this file type. Drag it out of the archive to copy the original file.');
  }

  function inspectModelPackage(fs) {
    const paths = [...fs.provider.cache.keys()];
    const candidates = paths.filter(path => /\.(?:gltf|glb)$/i.test(path));
    if (candidates.length !== 1) return null;
    const modelPath = candidates[0];
    const modelDir = modelPath.includes('/') ? modelPath.slice(0, modelPath.lastIndexOf('/')) : '';
    const modelExt = modelPath.split('.').pop().toLowerCase();
    const modelBytes = fs.readFileSync(modelPath, 'binary');
    const related = paths.filter(path => path !== modelPath);
    const assetExt = /\.(?:bin|png|jpe?g|webp|avif|ktx2|hdr|exr|tif|tiff|dds|basis|ktx)$/i;
    let refs = [];
    if (modelExt === 'gltf') {
      try {
        const json = JSON.parse(new TextDecoder().decode(modelBytes));
        const uris = [...(json.buffers || []).map(item => item.uri), ...(json.images || []).map(item => item.uri)]
          .filter(uri => typeof uri === 'string' && !/^(?:data:|https?:|blob:)/i.test(uri));
        refs = uris.map(uri => {
          let decoded = uri; try { decoded = decodeURIComponent(uri); } catch (_) {}
          const parts = (modelDir ? modelDir + '/' : '').concat(decoded).replace(/\\/g, '/').split('/');
          const clean = [];
          for (const part of parts) { if (!part || part === '.') continue; if (part === '..') clean.pop(); else clean.push(part); }
          return clean.join('/');
        });
      } catch (_) { return null; }
    } else if (modelBytes?.length >= 20) {
      const bytes = modelBytes instanceof Uint8Array ? modelBytes : new Uint8Array(modelBytes);
      if (String.fromCharCode(...bytes.subarray(0,4)) !== 'glTF') return null;
    }
    const resolvedRefs = refs.filter(path => fs.provider.cache.has(path));
    const allRefsResolve = refs.length > 0 && resolvedRefs.length === refs.length;
    const samePackageFolder = related.every(path =>
      (!modelDir || path.startsWith(modelDir + '/')) &&
      (assetExt.test(path) || /\.(?:gltf|glb|json|txt|md|mtl)$/i.test(path))
    );
    const dedicatedGLB = modelExt === 'glb' && related.length <= 8 && samePackageFolder;
    const dedicatedGLTF = modelExt === 'gltf' && related.length === 0;
    const dependencyPackage = modelExt === 'gltf' && allRefsResolve && resolvedRefs.length > 0 &&
      related.every(path => refs.includes(path) || assetExt.test(path));
    const isPackage = dedicatedGLB || dedicatedGLTF || dependencyPackage;
    return { path:modelPath, isPackage, kind:isPackage?'3D model package':'Archive containing a 3D model',
      referencedAssets:resolvedRefs.length, externalReferences:refs.length, fileCount:paths.length };
  }

  window.EditorPreviewProviders = window.EditorPreviewProviders || [];
  window.EditorPreviewProviders.push({
    id: 'archive',
    match(file) {
      const name = String(file.name || file.path || '');
      const mime = String(file.mime || '').toLowerCase();
      return /\.(?:zip|7z|gz|tgz|tar|rar)$/i.test(name) ||
        ['application/zip', 'application/x-zip-compressed', 'application/x-7z-compressed', 'application/x-7z-compressed-tar', 'application/gzip', 'application/x-gzip', 'application/x-tar', 'application/vnd.rar', 'application/x-rar-compressed'].includes(mime);
    },
    views: [{
      id: 'archive-preview',
      label: 'Preview',
      default: true,
      priority: 130,
      async create(ctx) {
        const shell = document.createElement('section');
        shell.className = 'editor-archive-preview';
        const topbar = document.createElement('div');
        topbar.className = 'editor-archive-topbar';
        const archiveTitle = document.createElement('div');
        archiveTitle.className = 'editor-archive-title';
        archiveTitle.textContent = ctx.file.name;
        const archiveStatus = document.createElement('div');
        archiveStatus.className = 'editor-archive-status';
        archiveStatus.textContent = 'Opening archive…';
        const modelButton = document.createElement('button');
        modelButton.className = 'editor-archive-model-button';
        modelButton.type = 'button';
        modelButton.hidden = true;
        modelButton.textContent = 'Open 3D model';
        topbar.append(archiveTitle, archiveStatus, modelButton);

        const workspace = document.createElement('div');
        workspace.className = 'editor-archive-workspace';
        const sidebar = document.createElement('aside');
        sidebar.className = 'editor-archive-sidebar';
        const sidebarTitle = document.createElement('div');
        sidebarTitle.className = 'editor-archive-sidebar-title';
        sidebarTitle.textContent = 'EXPLORER';
        const tree = document.createElement('div');
        tree.className = 'archive-tree';
        sidebar.append(sidebarTitle, tree);

        const main = document.createElement('main');
        main.className = 'editor-archive-main';
        const fileHeader = document.createElement('div');
        fileHeader.className = 'editor-archive-file-header';
        const fileIcon = document.createElement('span');
        fileIcon.className = 'editor-archive-file-icon';
        const fileName = document.createElement('span');
        fileName.className = 'editor-archive-file-name';
        fileName.textContent = 'Select a file to preview it';
        fileHeader.append(fileIcon, fileName);
        const viewer = document.createElement('div');
        viewer.className = 'editor-archive-viewer';
        showMessage(viewer, 'Choose a file from the archive hierarchy.');
        main.append(fileHeader, viewer);

        workspace.append(sidebar, main);
        shell.append(topbar, workspace);
        ctx.host.appendChild(shell);

        let archiveFileSystem = null;
        let modelPackage = null;
        let modelHost = null;
        let modelOpened = false;
        let innerManager = null;
        const innerTab = {};
        ctx.addCleanup(() => {
          if (innerManager) innerManager.dispose(innerTab);
        });
        const showArchiveBrowser = () => {
          if (modelHost) modelHost.style.display = 'none';
          viewer.style.display = '';
          modelButton.textContent = modelPackage?.isPackage ? '3D Model Package' : 'Open embedded model';
          modelButton.classList.remove('active');
        };
        const showModelViewer = async () => {
          if (!modelPackage || !archiveFileSystem) return;
          viewer.style.display = 'none';
          if (!modelHost) {
            modelHost = document.createElement('div');
            modelHost.className = 'editor-archive-model-host';
            shell.appendChild(modelHost);
          }
          modelHost.style.display = 'block';
          modelButton.textContent = 'Browse archive';
          modelButton.classList.add('active');
          if (modelOpened) return;
          modelOpened = true;
          const virtualState = Object.create(ctx.state || null);
          virtualState.fs = archiveFileSystem;
          const modelContext = {
            state: virtualState,
            file: { id:'archive-model:'+modelPackage.path, path:modelPackage.path,
              name:modelPackage.path.split('/').pop(), mime:EditorInferMime(modelPackage.path) },
            host:modelHost,
            readBinary:path=>archiveFileSystem.readFileSync(path || modelPackage.path,'binary'),
            addCleanup:cleanup=>ctx.addCleanup(cleanup),
            isCurrent:()=>ctx.isCurrent()
          };
          const factory = window.Editor3DModelPreview?.create;
          if (typeof factory !== 'function') { modelHost.textContent='The 3D viewer is not available.'; return; }
          await factory(modelContext);
        };
        modelButton.addEventListener('click', () => {
          if (modelHost?.style.display === 'block') showArchiveBrowser();
          else showModelViewer().catch(error => { modelHost.textContent='Could not open the model: '+(error?.message || error); });
        });

        try {
          const binary = ctx.readBinary();
          if (!binary || !binary.length) throw new Error('This archive is empty.');
          const isZip = /\.zip$/i.test(ctx.file.name) || ['application/zip', 'application/x-zip-compressed'].includes(String(ctx.file.mime || '').toLowerCase());
          const loaded = isZip
            ? await loadZipArchive(ctx, binary, archiveStatus)
            : await loadSevenZipArchive(ctx, binary, archiveStatus);
          if (!loaded || !ctx.isCurrent()) return;

          const entries = [];
          for (const directory of loaded.directories || []) entries.push({ path: directory, directory: true });
          for (const file of loaded.files || []) entries.push({ path: file.path, directory: false, data: file.data });
          archiveFileSystem = makeArchiveFileSystem(entries);
          modelPackage = inspectModelPackage(archiveFileSystem);
          if (modelPackage) {
            modelButton.hidden = false;
            modelButton.textContent = modelPackage.isPackage ? '3D Model Package' : 'Open embedded model';
            archiveTitle.textContent = ctx.file.name + (modelPackage.isPackage ? ' · 3D model package' : ' · contains a model');
            modelButton.title = modelPackage.isPackage
              ? 'This ZIP is structured as a 3D model package with resolvable model assets.'
              : 'This archive contains a glTF file but also unrelated content, so it remains an archive.';
          }
          const fileCount = archiveFileSystem.listFilesSync().length;
          const folderCount = archiveFileSystem.listDirectoriesSync().length;
          const totalBytes = [...archiveFileSystem.provider.cache.values()].reduce((sum, data) => sum + data.byteLength, 0);
          archiveStatus.textContent = fileCount + ' files · ' + folderCount + ' folders · ' + formatBytes(totalBytes);

          const fileManager = new FileManager({
            fs: archiveFileSystem,
            tree,
            contextMenu: null,
            fileInput: null,
            projectName: ctx.file.name,
            readOnly: true,
            onOpen: path => {
              renderArchiveFile(path, archiveFileSystem, innerManager, innerTab, viewer, fileName, fileIcon, ctx)
                .catch(error => showMessage(viewer, error?.message || 'Could not preview this file.', true));
            }
          });
          fileManager.setFileSystem(archiveFileSystem);
          fileManager.render();
          innerManager = createReadOnlyPreviewManager(archiveFileSystem);

          // Let archive entries (including whole folders and multi-selection)
          // be dragged directly into the real workspace Explorer. The archive
          // remains read-only: dropping always copies bytes into the workspace.
          const workspaceState = ctx.state;
          const workspaceTree = document.getElementById('tree');
          const dragType = 'application/x-watermelonkatana-archive-items';

          const selectedArchivePaths = node => {
            const selected = [...(fileManager.selectedNodes || [])]
              .filter(path => fileManager.nodeByPath.has(path));
            if (!selected.includes(node.path)) return [node.path];
            // Remove descendants when their parent folder is already selected.
            return selected.filter(path => !selected.some(parent =>
              parent !== path && path.startsWith(parent + '/') &&
              fileManager.nodeByPath.get(parent)?.isDir
            ));
          };

          tree.addEventListener('dragstart', event => {
            const row = event.target.closest('li[data-path]');
            const node = row && fileManager.nodeByPath.get(row.dataset.path);
            if (!node || !event.dataTransfer) return;
            const paths = selectedArchivePaths(node);
            event.dataTransfer.setData(dragType, JSON.stringify(paths));
            event.dataTransfer.setData('text/plain', paths.map(path => path.split('/').pop()).join(', '));
            event.dataTransfer.effectAllowed = 'copy';
            row.classList.add('archive-dragging');
            event.dataTransfer.setDragImage(row, 12, 12);
          });
          tree.addEventListener('dragend', () => {
            tree.querySelectorAll('.archive-dragging').forEach(row => row.classList.remove('archive-dragging'));
          });
          tree.querySelectorAll('li[data-path]').forEach(row => {
            row.draggable = true;
            row.addEventListener('dragstart', () => row.classList.add('archive-dragging'));
          });

          const destinationForDrop = event => {
            const row = event.target.closest('#tree li[data-path]');
            const target = row && workspaceState.fileManager?.nodeByPath?.get(row.dataset.path);
            if (!target) return '';
            return target.isDir ? target.path : target.path.slice(0, Math.max(0, target.path.lastIndexOf('/')));
          };
          const handleArchiveDrop = async event => {
            const raw = event.dataTransfer?.getData(dragType);
            if (!raw) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            let paths;
            try { paths = JSON.parse(raw); } catch (_) { return; }
            if (!Array.isArray(paths) || !workspaceState.fs?.writeFileSync) return;

            const base = destinationForDrop(event);
            const writes = [];
            const directoriesToCreate = new Set();
            for (const sourcePath of paths) {
              const sourceNode = fileManager.nodeByPath.get(sourcePath);
              if (!sourceNode) continue;
              const prefix = sourceNode.isDir ? sourcePath + '/' : null;
              const destinationRoot = [base, sourceNode.isDir ? sourceNode.name : '']
                .filter(Boolean).join('/');
              if (sourceNode.isDir) {
                for (const directory of archiveFileSystem.directories) {
                  if (directory === sourcePath || directory.startsWith(prefix)) {
                    const relativeDirectory = directory === sourcePath ? '' : directory.slice(prefix.length);
                    const destinationDirectory = [destinationRoot, relativeDirectory].filter(Boolean).join('/');
                    if (destinationDirectory) directoriesToCreate.add(destinationDirectory);
                  }
                }
              }
              const filesToCopy = sourceNode.isDir
                ? [...archiveFileSystem.provider.cache.keys()].filter(path => path.startsWith(prefix))
                : [sourcePath];
              for (const archivePath of filesToCopy) {
                const relative = sourceNode.isDir
                  ? archivePath.slice(prefix.length)
                  : sourceNode.name;
                const destination = [destinationRoot, relative].filter(Boolean).join('/');
                const bytes = archiveFileSystem.provider.cache.get(archivePath);
                if (bytes) writes.push({ path: destination, bytes });
              }
            }
            if (!writes.length && !directoriesToCreate.size) return;
            const collisions = writes.filter(item => workspaceState.fs.existsSync?.(item.path));
            if (collisions.length && !confirm('Replace ' + collisions.length + ' existing file' +
              (collisions.length === 1 ? '' : 's') + ' in the workspace?')) return;

            for (const directory of [...directoriesToCreate].sort((a, b) => a.length - b.length)) {
              workspaceState.fs.mkdirSync?.(directory);
            }
            for (const item of writes) {
              const slash = item.path.lastIndexOf('/');
              if (slash > 0) workspaceState.fs.mkdirSync?.(item.path.slice(0, slash));
              workspaceState.fs.writeFileSync(item.path, item.bytes);
              workspaceState.markDirty?.(item.path);
            }
            workspaceState.fileManager?.refresh?.();
            workspaceState.updateStatus?.();
            workspaceTree?.dispatchEvent(new CustomEvent('archive-files-copied', {
              bubbles: true, detail: { paths: writes.map(item => item.path) }
            }));
            archiveStatus.textContent = 'Copied ' + writes.length + ' file' +
              (writes.length === 1 ? '' : 's') + ' into workspace';
          };

          if (workspaceTree) {
            workspaceTree.addEventListener('dragover', event => {
              if (!event.dataTransfer?.types?.includes(dragType)) return;
              event.preventDefault();
              event.stopPropagation();
              event.dataTransfer.dropEffect = 'copy';
            }, true);
            workspaceTree.addEventListener('drop', handleArchiveDrop, true);
          }
          ctx.addCleanup(() => {
            if (workspaceTree) {
              workspaceTree.removeEventListener('drop', handleArchiveDrop, true);
            }
          });
          if (!fileCount) showMessage(viewer, 'This archive does not contain any visible files.');
          if (modelPackage?.isPackage) {
            await showModelViewer();
            archiveStatus.textContent = '3D model package · '+modelPackage.referencedAssets+' referenced assets · '+fileCount+' files';
          } else if (modelPackage) {
            archiveStatus.textContent = 'Archive · includes a glTF model ('+fileCount+' files)';
          }
        } catch (error) {
          if (ctx.isCurrent()) {
            archiveStatus.textContent = 'Could not open archive';
            showMessage(viewer, error?.message || 'The archive could not be opened.', true);
          }
        }
      }
    }]
  });
})();