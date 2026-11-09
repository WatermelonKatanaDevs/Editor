(function () {
  'use strict';

  let activeDialog = null;
  let dialogQueue = [];
  const PRIVATE_PATHS = ['.editor', '.git'];

  function normalizePath(value) {
    const parts = [];
    for (const part of String(value || '').replace(/\\/g, '/').split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') { if (parts.length) parts.pop(); continue; }
      parts.push(part);
    }
    return parts.join('/');
  }
  function basename(path) { return normalizePath(path).split('/').pop() || ''; }
  function dirname(path) {
    const value = normalizePath(path), index = value.lastIndexOf('/');
    return index < 0 ? '' : value.slice(0, index);
  }
  function extension(path) {
    const name = basename(path), index = name.lastIndexOf('.');
    return index < 0 ? '' : name.slice(index + 1).toLowerCase();
  }
  function isPrivatePath(path) {
    return PRIVATE_PATHS.some(part => path === part || path.startsWith(part + '/'));
  }
  function normalizeAccept(options) {
    const values = [];
    const add = value => {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized && !values.includes(normalized)) values.push(normalized);
    };
    for (const value of Array.isArray(options.extensions) ? options.extensions : []) {
      add(String(value).replace(/^\./, ''));
    }
    for (const value of String(options.accept || '').split(',')) add(value);
    for (const type of options.types || []) {
      for (const [mime, extensions] of Object.entries(type?.accept || {})) {
        add(mime);
        for (const value of extensions || []) add(String(value).replace(/^\./, ''));
      }
    }
    return values;
  }
  function matchesFilter(path, type, filters) {
    if (!filters.length || filters.includes('*') || filters.includes('*/*')) return true;
    const ext = extension(path), mime = String(type || '').toLowerCase();
    return filters.some(filter => {
      if (filter.startsWith('.')) return ext === filter.slice(1);
      if (filter.includes('/')) return filter.endsWith('/*')
        ? mime.startsWith(filter.slice(0, -1)) : mime === filter;
      return ext === filter;
    });
  }
  function asBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (typeof value === 'string') return new TextEncoder().encode(value);
    return new Uint8Array(value || []);
  }

  function create(config = {}) {
    const owner = {};
    function fs() {
      const value = typeof config.getFs === 'function' ? config.getFs() : config.fs;
      if (!value) throw new Error('The Editor workspace is not ready.');
      return value;
    }
    function listFiles() {
      return (fs().listFilesSync?.() || []).map(normalizePath)
        .filter(path => path && !isPrivatePath(path));
    }
    function listDirectories(filesystem, files) {
      const result = new Set(['']);
      for (const path of filesystem.listDirectoriesSync?.() || []) {
        const value = normalizePath(path);
        if (value && !isPrivatePath(value)) result.add(value);
      }
      for (const path of files) {
        let parent = dirname(path);
        while (parent) { result.add(parent); parent = dirname(parent); }
      }
      return result;
    }
    function fileType(path) {
      try { return String(config.getMime?.(path) || '').toLowerCase(); }
      catch (_) { return ''; }
    }
    function canWrite() {
      return typeof config.canWrite === 'function' ? config.canWrite() !== false : config.canWrite !== false;
    }
    function writeFile(path, value) {
      const normalized = normalizePath(path);
      if (!normalized) throw new Error('A workspace file path is required.');
      if (!canWrite()) throw new Error('This Editor workspace is read-only.');
      const filesystem = fs(), parent = dirname(normalized);
      if (parent && !filesystem.existsSync(parent)) filesystem.mkdirSync(parent);
      filesystem.writeFileSync(normalized, asBytes(value).slice());
      try { config.onWrite?.(normalized); }
      catch (error) { console.warn('Workspace picker write notification failed:', error); }
      return normalized;
    }
    function makeWorkspaceFile(path, maxFileBytes) {
      const normalized = normalizePath(path);
      const value = fs().readFileSync(normalized, 'binary');
      if (value == null) throw new Error('File no longer exists in the workspace: ' + normalized);
      const bytes = asBytes(value).slice();
      if (Number.isFinite(maxFileBytes) && bytes.byteLength > maxFileBytes) {
        throw new Error(normalized + ' exceeds the ' + Math.round(maxFileBytes / (1024 * 1024)) + ' MiB file-picker limit.');
      }
      const file = new File([bytes], basename(normalized), {
        type:fileType(normalized) || 'application/octet-stream'
      });
      Object.defineProperties(file, {
        __wkWorkspacePath:{value:normalized, configurable:true},
        customRelativePath:{value:normalized, configurable:true}
      });
      return file;
    }
    function open(options = {}) {
      const filters = normalizeAccept(options), files = listFiles();
      const directories = listDirectories(fs(), files);
      let startPath = normalizePath(options.startPath || options.startpath || '');
      if (startPath && (files.includes(startPath) || !directories.has(startPath))) startPath = dirname(startPath);
      return showDialog({
        mode:'open', title:options.title || 'Open from Editor Workspace',
        files, directories, filters,
        multiple:options.multiple === true, allowDevice:options.allowDevice !== false,
        startPath, allFiles:!filters.length, maxFileBytes:options.maxFileBytes
      });
    }
    function savePath(options = {}) {
      if (!canWrite()) return Promise.reject(new Error('This Editor workspace is read-only.'));
      const files = listFiles();
      const directories = listDirectories(fs(), files);
      let startPath = normalizePath(options.startPath || options.startpath || '');
      if (startPath && (files.includes(startPath) || !directories.has(startPath))) startPath = dirname(startPath);
      return showDialog({
        mode:'save', title:options.title || 'Save to Editor Workspace',
        files, directories, filters:normalizeAccept(options),
        multiple:false, allowDevice:false,
        startPath,
        suggestedName:options.suggestedName || options.name || 'untitled',
        allFiles:true
      });
    }
    async function saveFile(options = {}) {
      const path = await savePath(options);
      if (!path) return null;
      const value = options.bytes ?? options.data ?? new Uint8Array();
      writeFile(path, value instanceof Blob ? new Uint8Array(await value.arrayBuffer()) : value);
      return path;
    }

    function showDialog(options) {
      return new Promise((resolve, reject) => {
        dialogQueue.push({options, owner, resolve, reject});
        openNextDialog();
      });
    }

    function openNextDialog() {
      if (activeDialog || !dialogQueue.length) return;
      const next = dialogQueue.shift();
      showDialogNow(next.options, next.owner).then(
        value => { next.resolve(value); openNextDialog(); },
        error => { next.reject(error); openNextDialog(); }
      );
    }

    function showDialogNow(options, dialogOwner) {
      return new Promise(resolve => {
        const mode = options.mode, multiple = mode === 'open' && options.multiple;
        const filters = options.filters, selected = new Set();
        let selectedDeviceFiles = [], currentPath = normalizePath(options.startPath);
        let showAllFiles = !!options.allFiles, closed = false;

        const overlay = document.createElement('div');
        overlay.className = 'wk-workspace-picker-overlay';
        const panel = document.createElement('section');
        panel.className = 'wk-workspace-picker';
        overlay.append(panel);

        const header = document.createElement('header');
        header.className = 'wk-workspace-picker-header';
        header.textContent = options.title;
        panel.append(header);

        const toolbar = document.createElement('div');
        toolbar.className = 'wk-workspace-picker-toolbar';
        const up = document.createElement('button');
        up.type = 'button'; up.textContent = '↑ Up'; up.title = 'Go to the parent folder';
        const pathLabel = document.createElement('div');
        pathLabel.className = 'wk-workspace-picker-path';
        const search = document.createElement('input');
        search.type = 'search'; search.placeholder = 'Search this folder';
        search.setAttribute('aria-label', 'Search this folder');
        toolbar.append(up, pathLabel, search);

        const allFilesButton = document.createElement('button');
        allFilesButton.type = 'button';
        allFilesButton.className = 'wk-workspace-picker-secondary';
        allFilesButton.textContent = 'All files: ' + (showAllFiles ? 'On' : 'Off');
        allFilesButton.setAttribute('aria-pressed', String(showAllFiles));
        allFilesButton.hidden = mode !== 'open' || !filters.length;
        toolbar.append(allFilesButton);
        panel.append(toolbar);

        const list = document.createElement('div');
        list.className = 'wk-workspace-picker-list';
        panel.append(list);
        const status = document.createElement('div');
        status.className = 'wk-workspace-picker-status';
        panel.append(status);

        let filename = null;
        if (mode === 'save') {
          const nameRow = document.createElement('label');
          nameRow.className = 'wk-workspace-picker-name';
          const nameLabel = document.createElement('span');
          nameLabel.textContent = 'File name';
          filename = document.createElement('input');
          filename.type = 'text';
          filename.value = String(options.suggestedName || 'untitled');
          nameRow.append(nameLabel, filename);
          panel.append(nameRow);
        }

        const footer = document.createElement('footer');
        footer.className = 'wk-workspace-picker-footer';
        const footerLeft = document.createElement('div');
        footerLeft.className = 'wk-workspace-picker-footer-left';
        let deviceInput = null;
        if (mode === 'open' && options.allowDevice) {
          const deviceButton = document.createElement('button');
          deviceButton.type = 'button';
          deviceButton.className = 'wk-workspace-picker-secondary';
          deviceButton.textContent = 'From this device…';
          deviceInput = document.createElement('input');
          deviceInput.type = 'file';
          deviceInput.hidden = true;
          deviceInput.multiple = multiple;
          footerLeft.append(deviceButton, deviceInput);
          deviceButton.addEventListener('click', () => deviceInput.click());
        }
        const footerRight = document.createElement('div');
        footerRight.className = 'wk-workspace-picker-footer-right';
        const cancel = document.createElement('button');
        cancel.type = 'button'; cancel.className = 'wk-workspace-picker-secondary';
        cancel.textContent = 'Cancel';
        const confirm = document.createElement('button');
        confirm.type = 'button'; confirm.className = 'wk-workspace-picker-primary';
        confirm.textContent = mode === 'save' ? 'Save' : (multiple ? 'Open selected' : 'Open');
        footerRight.append(cancel, confirm);
        footer.append(footerLeft, footerRight);
        panel.append(footer);

        const nativeAccept = filters.map(value => {
          if (value === '*' || value === '*/*' || value.includes('/')) return value;
          return '.' + value.replace(/^\./, '');
        }).join(',');
        const updateNativeAccept = () => {
          if (!deviceInput) return;
          if (showAllFiles || !nativeAccept) deviceInput.removeAttribute('accept');
          else deviceInput.accept = nativeAccept;
        };
        updateNativeAccept();

        const close = value => {
          if (closed) return;
          closed = true;
          document.removeEventListener('keydown', keydown, true);
          overlay.remove();
          activeDialog = null;
          resolve(value);
          openNextDialog();
        };
        const addDeviceFiles = incoming => {
          const items = Array.from(incoming || []);
          if (!items.length) return;
          const tooLarge = Number.isFinite(options.maxFileBytes) && items.find(file => file.size > options.maxFileBytes);
          if (tooLarge) {
            status.textContent = tooLarge.name + ' exceeds the ' + Math.round(options.maxFileBytes / (1024 * 1024)) + ' MiB file-picker limit.';
            return;
          }
          const rejected = showAllFiles ? [] : items.filter(file => !matchesFilter(file.name, file.type, filters));
          if (rejected.length) {
            status.textContent = 'Some selected files do not match this file filter. Turn on All files to include them.';
            return;
          }
          selected.clear();
          selectedDeviceFiles = multiple ? items : items.slice(0, 1);
          status.textContent = selectedDeviceFiles.length + ' device file(s) selected';
          draw();
        };
        const readExplorerDrop = event => {
          const token = event.dataTransfer?.getData?.('application/x-wk-editor-files');
          if (token) {
            try { return window.__editorFileDropBridge?.take?.(token) || []; }
            catch (error) { console.warn('Could not receive files dragged from Explorer:', error); }
          }
          return Array.from(event.dataTransfer?.files || []);
        };
        const finishOpen = async () => {
          if (!selected.size && !selectedDeviceFiles.length) return;
          confirm.disabled = true;
          status.textContent = 'Preparing selected files…';
          try {
            const output = selectedDeviceFiles.slice();
            for (const path of selected) output.push(makeWorkspaceFile(path, options.maxFileBytes));
            close(output);
          } catch (error) {
            status.textContent = error?.message || String(error);
            confirm.disabled = false;
          }
        };
        function draw() {
          list.replaceChildren();
          const all = listFiles(), directories = listDirectories(fs(), all);
          const prefix = currentPath ? currentPath + '/' : '';
          pathLabel.textContent = currentPath ? '/' + currentPath + '/' : '/';
          up.disabled = !currentPath;
          const query = search.value.trim().toLowerCase();
          const directoryRows = new Set(), fileRows = [];
          for (const directory of directories) {
            if (!directory.startsWith(prefix) || directory === currentPath) continue;
            const rest = directory.slice(prefix.length);
            if (rest && !rest.includes('/')) directoryRows.add(rest);
          }
          for (const path of all) {
            if (!path.startsWith(prefix)) continue;
            const rest = path.slice(prefix.length);
            if (!rest || rest.includes('/')) continue;
            if (mode === 'open' && !showAllFiles && !matchesFilter(path, fileType(path), filters)) continue;
            fileRows.push(path);
          }
          const rows = [
            ...[...directoryRows].sort((a,b)=>a.localeCompare(b)).map(name=>({kind:'directory',name})),
            ...fileRows.sort((a,b)=>a.localeCompare(b)).map(path=>({kind:'file',name:basename(path),path}))
          ].filter(row => !query || row.name.toLowerCase().includes(query) || row.path?.toLowerCase().includes(query));
          if (!rows.length) {
            const empty = document.createElement('div');
            empty.className = 'wk-workspace-picker-empty';
            empty.textContent = query ? 'No matching files in this folder.' : 'This folder is empty.';
            list.append(empty);
          }
          for (const row of rows) {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'wk-workspace-picker-row';
            if (row.kind === 'directory') button.classList.add('is-directory');
            if (row.path && selected.has(row.path)) button.classList.add('is-selected');
            const icon = document.createElement('span');
            icon.className = 'wk-workspace-picker-row-icon'; icon.textContent = row.kind === 'directory' ? '▸' : '▧';
            const name = document.createElement('span');
            name.className = 'wk-workspace-picker-row-name'; name.textContent = row.name;
            const detail = document.createElement('span');
            detail.className = 'wk-workspace-picker-row-detail';
            detail.textContent = row.kind === 'directory' ? 'Folder' : row.path;
            button.append(icon, name, detail);
            button.addEventListener('click', () => {
              if (row.kind === 'directory') {
                currentPath = normalizePath((currentPath ? currentPath + '/' : '') + row.name);
                selected.clear(); selectedDeviceFiles = [];
              } else if (mode === 'save') {
                filename.value = row.name;
              } else {
                selectedDeviceFiles = [];
                if (multiple && selected.has(row.path)) selected.delete(row.path);
                else { if (!multiple) selected.clear(); selected.add(row.path); }
              }
              draw();
            });
            button.addEventListener('dblclick', () => {
              if (row.kind === 'file' && mode === 'open') {
                selectedDeviceFiles = []; selected.clear(); selected.add(row.path);
                void finishOpen();
              } else if (row.kind === 'file' && mode === 'save') {
                filename.value = row.name; finishSave();
              }
            });
            list.append(button);
          }
          allFilesButton.textContent = 'All files: ' + (showAllFiles ? 'On' : 'Off');
          allFilesButton.setAttribute('aria-pressed', String(showAllFiles));
          allFilesButton.classList.toggle('is-active', showAllFiles);
          up.disabled = !currentPath;
          if (mode === 'open') {
            const count = selected.size + selectedDeviceFiles.length;
            status.textContent = count ? count + ' file(s) selected' : '';
            confirm.disabled = count === 0;
          } else {
            status.textContent = canWrite() ? '' : 'This workspace is read-only.';
            confirm.disabled = !String(filename.value || '').trim() || !canWrite();
          }
        }
        function finishSave() {
          let name = String(filename.value || '').trim();
          if (!name || name === '.' || name === '..' || /[\\/]/.test(name)) {
            status.textContent = 'Enter a valid file name.';
            filename.focus(); return;
          }
          const preferredExtension = filters.find(value => !value.includes('/') && value !== '*' && value !== '*/*');
          if (preferredExtension && !extension(name)) name += '.' + preferredExtension.replace(/^\./, '');
          const path = normalizePath((currentPath ? currentPath + '/' : '') + name);
          if (!path) return;
          if (fs().existsSync(path) && !window.confirm('"' + path + '" already exists. Replace it?')) return;
          close(path);
        }
        function keydown(event) {
          if (event.key === 'Escape' && !closed) { event.preventDefault(); close(null); }
          else if (event.key === 'Enter' && mode === 'save' && !closed) { event.preventDefault(); finishSave(); }
        }
        up.addEventListener('click', () => {
          if (!currentPath) return;
          currentPath = dirname(currentPath);
          selected.clear(); selectedDeviceFiles = []; search.value = ''; draw();
        });
        search.addEventListener('input', draw);
        filename?.addEventListener('input', draw);
        allFilesButton.addEventListener('click', () => {
          showAllFiles = !showAllFiles;
          selected.clear(); selectedDeviceFiles = [];
          updateNativeAccept(); draw();
        });
        cancel.addEventListener('click', () => close(null));
        confirm.addEventListener('click', () => mode === 'save' ? finishSave() : void finishOpen());
        deviceInput?.addEventListener('change', () => {
          addDeviceFiles(deviceInput.files); deviceInput.value = '';
        });
        overlay.addEventListener('dragover', event => { if (mode === 'open') event.preventDefault(); });
        overlay.addEventListener('drop', event => {
          if (mode !== 'open') return;
          event.preventDefault(); event.stopPropagation();
          const dropped = readExplorerDrop(event);
          if (dropped.length) addDeviceFiles(dropped);
        });
        overlay.addEventListener('mousedown', event => { if (event.target === overlay) close(null); });
        document.addEventListener('keydown', keydown, true);
        activeDialog = {owner:dialogOwner, close:() => close(null), overlay};
        document.body.append(overlay);
        draw();
        if (mode === 'save') { filename.focus(); filename.select(); }
        else search.focus();
      });
    }

    return {
      open, savePath, saveFile, writeFile, listFiles,
      cancelActive:() => {
        const waiting = [];
        for (const item of dialogQueue) {
          if (item.owner === owner) item.resolve(null);
          else waiting.push(item);
        }
        dialogQueue = waiting;
        if (activeDialog?.owner === owner) activeDialog.close();
      }
    };
  }

  function installStyles() {
    if (document.getElementById('wk-workspace-picker-style')) return;
    const style = document.createElement('style');
    style.id = 'wk-workspace-picker-style';
    style.textContent = [
      '.wk-workspace-picker-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:#000b;color:#e8edf0;font:13px/1.45 system-ui,sans-serif;}',
      '.wk-workspace-picker{box-sizing:border-box;display:flex;flex-direction:column;width:min(760px,96vw);max-height:90vh;overflow:hidden;background:#202326;border:1px solid #485057;border-radius:9px;box-shadow:0 18px 70px #000b;}',
      '.wk-workspace-picker button,.wk-workspace-picker input{font:inherit;}',
      '.wk-workspace-picker button{border:1px solid #596168;background:#30363a;color:#fff;border-radius:5px;padding:7px 11px;cursor:pointer;}',
      '.wk-workspace-picker button:disabled{opacity:.42;cursor:default;}',
      '.wk-workspace-picker input{min-width:0;background:#15181a;color:#eee;border:1px solid #50585e;border-radius:5px;padding:7px 9px;}',
      '.wk-workspace-picker-header{padding:15px 17px;border-bottom:1px solid #3b4146;font-size:15px;font-weight:650;}',
      '.wk-workspace-picker-toolbar{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #353b40;}',
      '.wk-workspace-picker-path{flex:1;min-width:0;color:#aeb6bd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.wk-workspace-picker-toolbar input{width:190px;max-width:32%;}',
      '.wk-workspace-picker-secondary.is-active{background:#31513f;border-color:#438363;}',
      '.wk-workspace-picker-list{box-sizing:border-box;overflow:auto;min-height:180px;max-height:56vh;padding:7px 9px;}',
      '.wk-workspace-picker-row{display:flex;width:100%;align-items:center;gap:10px;text-align:left;border:0!important;border-radius:4px!important;background:transparent!important;padding:8px 10px!important;}',
      '.wk-workspace-picker-row:hover{background:#ffffff0d!important;}',
      '.wk-workspace-picker-row.is-selected{background:#28523f!important;}',
      '.wk-workspace-picker-row.is-directory{color:#c8d9ce;}',
      '.wk-workspace-picker-row-icon{width:18px;flex:none;color:#aebbc4;}',
      '.wk-workspace-picker-row-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.wk-workspace-picker-row-detail{max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#91a0a8;}',
      '.wk-workspace-picker-empty{padding:28px 10px;text-align:center;color:#89939b;}',
      '.wk-workspace-picker-status{min-height:18px;padding:3px 14px 8px;color:#aeb6bd;font-size:12px;}',
      '.wk-workspace-picker-name{display:flex;gap:12px;align-items:center;padding:10px 14px;color:#aeb6bd;}',
      '.wk-workspace-picker-name input{flex:1;}',
      '.wk-workspace-picker-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 13px;border-top:1px solid #3b4146;background:#1b1e20;}',
      '.wk-workspace-picker-footer-left,.wk-workspace-picker-footer-right{display:flex;gap:8px;align-items:center;}',
      '.wk-workspace-picker-primary{border-color:#00a65a!important;background:#087b49!important;}',
      '@media(max-width:620px){.wk-workspace-picker-toolbar{flex-wrap:wrap}.wk-workspace-picker-toolbar input{flex:1;max-width:none}.wk-workspace-picker-row-detail{display:none}.wk-workspace-picker-footer{align-items:stretch;flex-direction:column}.wk-workspace-picker-footer-left,.wk-workspace-picker-footer-right{justify-content:flex-end}}'
    ].join('');
    document.head.append(style);
  }

  window.EditorWorkspacePicker = {create, normalizePath, basename, dirname, extension};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installStyles, {once:true});
  else installStyles();
})();