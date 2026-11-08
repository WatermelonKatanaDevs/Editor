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
      worker.postMessage({ buffer }, [buffer]);
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
      return (label.includes('preview') || id.endsWith('-preview') || id === 'ico-preview' || id === 'audio-player' || id === 'audio-raw') &&
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

  window.EditorPreviewProviders = window.EditorPreviewProviders || [];
  window.EditorPreviewProviders.push({
    id: 'archive',
    match(file) {
      const name = String(file.name || file.path || '');
      const mime = String(file.mime || '').toLowerCase();
      return /\.(?:zip|7z)$/i.test(name) ||
        ['application/zip', 'application/x-zip-compressed', 'application/x-7z-compressed', 'application/x-7z-compressed-tar'].includes(mime);
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
        topbar.append(archiveTitle, archiveStatus);

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
        let innerManager = null;
        const innerTab = {};
        ctx.addCleanup(() => {
          if (innerManager) innerManager.dispose(innerTab);
        });

        try {
          const binary = ctx.readBinary();
          if (!binary || !binary.length) throw new Error('This archive is empty.');
          const isSevenZip = /\.7z$/i.test(ctx.file.name) ||
            ['application/x-7z-compressed', 'application/x-7z-compressed-tar'].includes(String(ctx.file.mime || '').toLowerCase());
          const loaded = isSevenZip
            ? await loadSevenZipArchive(ctx, binary, archiveStatus)
            : await loadZipArchive(ctx, binary, archiveStatus);
          if (!loaded || !ctx.isCurrent()) return;

          const entries = [];
          for (const directory of loaded.directories || []) entries.push({ path: directory, directory: true });
          for (const file of loaded.files || []) entries.push({ path: file.path, directory: false, data: file.data });
          archiveFileSystem = makeArchiveFileSystem(entries);
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
          if (!fileCount) showMessage(viewer, 'This archive does not contain any visible files.');
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