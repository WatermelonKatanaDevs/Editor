(() => {
  const bridgeId = new URLSearchParams(location.search).get('wk_editor_bridge');
  let bridge = null;
  try {
    if (bridgeId && window.parent !== window) {
      bridge = window.parent.__WKBlockbenchBridges?.[bridgeId] || null;
    }
  } catch (_) {}
  if (!bridge) return;

  const normalize = value => {
    const parts = [];
    for (const part of String(value || '').replace(/\\/g, '/').split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') { parts.pop(); continue; }
      parts.push(part);
    }
    return parts.join('/');
  };
  const basename = path => normalize(path).split('/').pop() || '';
  const dirname = path => {
    const value = normalize(path);
    const index = value.lastIndexOf('/');
    return index < 0 ? '' : value.slice(0, index);
  };
  const extension = path => {
    const name = basename(path);
    const index = name.lastIndexOf('.');
    return index < 0 ? '' : name.slice(index + 1).toLowerCase();
  };
  const mimeFor = path => {
    try { return bridge.mime(path) || 'application/octet-stream'; }
    catch (_) { return 'application/octet-stream'; }
  };
  const toArrayBuffer = bytes => {
    if (bytes instanceof ArrayBuffer) return bytes;
    if (ArrayBuffer.isView(bytes)) {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
    return new Uint8Array(bytes || []).buffer;
  };
  const dataURL = (bytes, mime) => {
    const view = new Uint8Array(toArrayBuffer(bytes));
    let binary = '';
    const step = 0x8000;
    for (let i = 0; i < view.length; i += step) {
      binary += String.fromCharCode(...view.subarray(i, Math.min(i + step, view.length)));
    }
    return 'data:' + (mime || 'application/octet-stream') + ';base64,' + btoa(binary);
  };
  const decodeDataURL = value => {
    const match = String(value || '').match(/^data:([^;,]*)(?:;base64)?,([\s\S]*)$/i);
    if (!match) return new TextEncoder().encode(String(value || ''));
    if (/;base64/i.test(value.slice(0, value.indexOf(',')))) {
      const binary = atob(match[2]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    return new TextEncoder().encode(decodeURIComponent(match[2]));
  };
  const notify = message => {
    try {
      if (window.Blockbench?.showQuickMessage) Blockbench.showQuickMessage(message, 2200);
      else console.warn(message);
    } catch (_) { console.warn(message); }
  };

  async function readWorkspaceFile(path, options = {}) {
    path = normalize(path);
    const bytes = bridge.readFile(path);
    if (bytes == null) throw new Error('File no longer exists in the workspace: ' + path);
    const name = basename(path);
    let readtype = options.readtype;
    if (typeof readtype === 'function') readtype = readtype(name);
    // Blockbench's browser reader treats "none" as text, unlike Electron.
    if (readtype === 'none') readtype = 'text';
    let content;
    if (readtype === 'image') {
      content = extension(path) === 'tga'
        ? toArrayBuffer(bytes)
        : dataURL(bytes, mimeFor(path));
    } else if (readtype === 'buffer' || readtype === 'binary') {
      content = toArrayBuffer(bytes);
    } else {
      content = new TextDecoder().decode(bytes);
      if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
    }
    let browserFile;
    try { browserFile = new File([toArrayBuffer(bytes)], name, {type: mimeFor(path)}); } catch (_) {}
    return { name, path, content, browser_file: browserFile };
  }

  async function readDroppedFile(file, options = {}) {
    const name = file.name || 'dropped-file';
    const path = normalize(file.customRelativePath || file.webkitRelativePath || name);
    let readtype = options.readtype;
    if (typeof readtype === 'function') readtype = readtype(name);
    if (readtype === 'none') readtype = 'text';
    const buffer = await file.arrayBuffer();
    let content;
    if (readtype === 'image') {
      content = extension(name) === 'tga'
        ? buffer
        : dataURL(buffer, file.type || 'application/octet-stream');
    } else if (readtype === 'buffer' || readtype === 'binary') {
      content = buffer;
    } else {
      content = new TextDecoder().decode(buffer);
      if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
    }
    return { name, path, content, browser_file: file };
  }

  async function readWorkspaceFiles(paths, options = {}) {
    const list = Array.from(paths || []);
    const results = await Promise.all(list.map(path => typeof path === 'string'
      ? readWorkspaceFile(path, options)
      : readDroppedFile(path, options)));
    return results;
  }

  function allowedExtensions(options) {
    const values = Array.isArray(options?.extensions) ? options.extensions : [];
    return values.map(value => String(value).replace(/^\./, '').toLowerCase());
  }
  function isAllowed(path, extensions) {
    if (!extensions.length) return true;
    const ext = extension(path);
    if (extensions.includes(ext)) return true;
    if (extensions.includes('image/*')) return /^image\//.test(mimeFor(path));
    if (extensions.includes('*')) return true;
    return false;
  }
  function isAllowedFile(file, extensions) {
    if (!extensions.length || extensions.includes('*')) return true;
    const ext = extension(file?.name || '');
    if (extensions.includes(ext)) return true;
    const type = String(file?.type || mimeFor(file?.name || '')).toLowerCase();
    return extensions.includes('image/*') && type.startsWith('image/');
  }

  let activePickerDrop = null;
  let forceSaveDialog = false;
  function showWorkspacePicker(options = {}) {
    return new Promise(resolve => {
      const mode = options.mode === 'save' ? 'save' : 'open';
      const multiple = mode === 'open' && options.multiple === true;
      const extensions = allowedExtensions(options);
      const suggestedName = String(options.name || 'model').trim() || 'model';
      const suggestedExtension = extensions.find(value => value !== '*' && value !== 'image/*') || '';
      const initialPath = normalize(options.startpath || '');
      let allFiles = [];
      try { allFiles = (bridge.listFiles() || []).map(normalize).filter(Boolean); } catch (_) {}
      const startIsFile = !!initialPath && allFiles.some(path => path.toLowerCase() === initialPath.toLowerCase());
      const startLooksLikeMissingFile = !!initialPath && !startIsFile && !bridge.exists(initialPath) && !!extension(initialPath);
      let currentDir = startIsFile || startLooksLikeMissingFile ? dirname(initialPath) : initialPath;
      let selected = new Set();
      let droppedFiles = [];

      const overlay = document.createElement('div');
      overlay.className = 'wk-blockbench-picker-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:1000000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.68);padding:20px;font:14px Assistant,Arial,sans-serif;color:#e8e8e8;';
      const panel = document.createElement('section');
      panel.style.cssText = 'width:min(680px,96vw);max-height:min(760px,90vh);display:flex;flex-direction:column;background:#202326;border:1px solid #454b50;border-radius:9px;box-shadow:0 18px 70px #000b;overflow:hidden;';
      overlay.appendChild(panel);
      const header = document.createElement('header');
      header.style.cssText = 'padding:16px 18px;border-bottom:1px solid #3b4146;display:flex;align-items:center;justify-content:space-between;font-size:16px;font-weight:600;';
      header.textContent = mode === 'save' ? 'Save to Workspace' : (options.title || 'Open from Workspace');
      panel.appendChild(header);

      const toolbar = document.createElement('div');
      toolbar.style.cssText = 'padding:12px 16px;display:flex;gap:8px;align-items:center;border-bottom:1px solid #353b40;';
      const upButton = document.createElement('button');
      upButton.type = 'button';
      upButton.textContent = '↑ Up';
      upButton.title = 'Go to parent folder';
      upButton.style.cssText = 'flex:none;border:1px solid #596168;background:#30363a;color:#e9edf0;border-radius:5px;padding:7px 10px;cursor:pointer;';
      const pathLabel = document.createElement('div');
      pathLabel.style.cssText = 'min-width:0;flex:1;color:#aeb6bd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      const deviceButton = document.createElement('button');
      deviceButton.type = 'button';
      deviceButton.textContent = 'From device…';
      deviceButton.title = 'Choose files from this device';
      deviceButton.style.cssText = 'flex:none;border:1px solid #596168;background:#30363a;color:#e9edf0;border-radius:5px;padding:7px 10px;cursor:pointer;';
      const deviceInput = document.createElement('input');
      deviceInput.type = 'file';
      deviceInput.hidden = true;
      deviceButton.hidden = mode !== 'open';
      deviceInput.multiple = multiple;
      const deviceAccept = extensions.map(value =>
        value === 'image/*' ? 'image/*' : value === '*' ? '*/*' : '.' + value
      ).join(',');
      if (deviceAccept) deviceInput.accept = deviceAccept;
      const search = document.createElement('input');
      search.type = 'search';
      search.placeholder = 'Filter workspace files';
      search.style.cssText = 'width:190px;max-width:32%;min-width:110px;background:#15181a;color:#eee;border:1px solid #50585e;border-radius:5px;padding:7px 9px;outline:none;';
      toolbar.append(upButton, pathLabel, deviceButton, search);
      panel.appendChild(toolbar);

      const list = document.createElement('div');
      list.style.cssText = 'overflow:auto;min-height:190px;max-height:48vh;padding:6px 8px;';
      panel.appendChild(list);
      const dropHint = document.createElement('div');
      dropHint.textContent = 'You can also drag files here from the Editor Explorer or from your device.';
      dropHint.style.cssText = 'margin:0 16px 8px;padding:10px;border:1px dashed #59636b;border-radius:6px;text-align:center;color:#9eabb5;font-size:12px;';
      panel.appendChild(dropHint);
      panel.appendChild(deviceInput);

      const status = document.createElement('div');
      status.style.cssText = 'min-height:18px;padding:0 16px 8px;color:#aeb6bd;font-size:12px;';
      panel.appendChild(status);

      let filename = null;
      if (mode === 'save') {
        const nameWrap = document.createElement('label');
        nameWrap.textContent = 'File name';
        nameWrap.style.cssText = 'display:flex;gap:12px;align-items:center;padding:8px 16px 14px;color:#aeb6bd;';
        filename = document.createElement('input');
        filename.type = 'text';
        filename.value = suggestedName;
        filename.style.cssText = 'flex:1;min-width:0;background:#15181a;color:#eee;border:1px solid #50585e;border-radius:5px;padding:8px 10px;';
        nameWrap.appendChild(filename);
        panel.appendChild(nameWrap);
      }

      const footer = document.createElement('footer');
      footer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid #3b4146;background:#1b1e20;';
      const cancel = document.createElement('button');
      cancel.textContent = 'Cancel';
      const confirm = document.createElement('button');
      confirm.textContent = mode === 'save' ? 'Save' : (multiple ? 'Open selected' : 'Open');
      const styleButton = (button, primary) => {
        button.style.cssText = 'border:1px solid ' + (primary ? '#00a65a' : '#596168') + ';background:' + (primary ? '#087b49' : '#30363a') + ';color:#fff;border-radius:5px;padding:8px 14px;cursor:pointer;';
      };
      styleButton(cancel, false);
      styleButton(confirm, true);
      footer.append(cancel, confirm);
      panel.appendChild(footer);

      let closed = false;
      const finish = value => {
        if (closed) return;
        closed = true;
        if (activePickerDrop?.overlay === overlay) activePickerDrop = null;
        overlay.remove();
        resolve(value);
      };
      cancel.onclick = () => finish(null);

      function childEntries() {
        const prefix = currentDir ? currentDir + '/' : '';
        const dirs = new Set();
        const files = [];
        for (const path of allFiles) {
          if (!path.startsWith(prefix)) continue;
          const remainder = path.slice(prefix.length);
          if (!remainder) continue;
          const slash = remainder.indexOf('/');
          if (slash >= 0) dirs.add(remainder.slice(0, slash));
          else if (isAllowed(path, extensions)) files.push(path);
        }
        return {
          dirs: [...dirs].sort((a, b) => a.localeCompare(b)),
          files: files.sort((a, b) => a.localeCompare(b))
        };
      }

      function renderList() {
        pathLabel.textContent = currentDir ? '/' + currentDir + '/' : '/';
        upButton.disabled = !currentDir;
        upButton.style.opacity = currentDir ? '1' : '.45';
        upButton.style.cursor = currentDir ? 'pointer' : 'default';
        list.replaceChildren();
        const query = search.value.trim().toLowerCase();
        const entries = childEntries();
        const addRow = (label, detail, isDir, path) => {
          const row = document.createElement('button');
          row.type = 'button';
          row.style.cssText = 'width:100%;display:flex;align-items:center;gap:10px;text-align:left;border:0;border-radius:5px;padding:9px 10px;background:' + (selected.has(path) ? '#31513f' : 'transparent') + ';color:#e9edf0;cursor:pointer;';
          const icon = document.createElement('span');
          icon.textContent = isDir ? '▸' : '▧';
          icon.style.cssText = 'width:18px;color:' + (isDir ? '#b8c6a7' : '#aebbc4') + ';';
          const name = document.createElement('span');
          name.textContent = label;
          name.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
          const meta = document.createElement('span');
          meta.textContent = detail || '';
          meta.style.cssText = 'font-size:11px;color:#91a0a8;';
          row.append(icon, name, meta);
          row.onclick = () => {
            if (isDir) {
              currentDir = path;
              droppedFiles = [];
              selected.clear();
              renderList();
              return;
            }
            droppedFiles = [];
            if (mode === 'save') {
              filename.value = label;
              selected = new Set([path]);
            } else if (multiple) {
              if (selected.has(path)) selected.delete(path);
              else selected.add(path);
            } else {
              selected = new Set([path]);
            }
            renderList();
          };
          row.ondblclick = () => {
            if (isDir) return;
            if (mode === 'open') confirm.click();
            else { filename.value = label; confirm.click(); }
          };
          list.appendChild(row);
        };
        if (currentDir) {
          addRow('..', 'Parent folder', true, dirname(currentDir));
        }
        entries.dirs.filter(name => !query || name.toLowerCase().includes(query)).forEach(name => {
          addRow(name + '/', 'Folder', true, normalize(currentDir ? currentDir + '/' + name : name));
        });
        entries.files.filter(path => !query || basename(path).toLowerCase().includes(query) || path.toLowerCase().includes(query)).forEach(path => {
          addRow(basename(path), path, false, path);
        });
        if (!list.children.length) {
          const empty = document.createElement('div');
          empty.textContent = mode === 'save' ? 'This folder is empty. You can still save here.' : 'No matching files in this folder.';
          empty.style.cssText = 'padding:28px 12px;text-align:center;color:#8f9ba2;';
          list.appendChild(empty);
        }
        confirm.disabled = mode === 'open' && selected.size === 0 && droppedFiles.length === 0;
        confirm.style.opacity = confirm.disabled ? '.45' : '1';
      }

      confirm.onclick = async () => {
        if (mode === 'open') {
          if (droppedFiles.length) return finish({droppedFiles});
          return finish([...selected]);
        }
        let name = String(filename.value || '').trim().replace(/[\\/]+/g, '_');
        if (!name) {
          status.textContent = 'Enter a file name.';
          return;
        }
        if (suggestedExtension && extension(name) !== suggestedExtension) name += '.' + suggestedExtension;
        const path = normalize(currentDir ? currentDir + '/' + name : name);
        if (!path) return;
        if (bridge.exists(path) && !window.confirm('Replace "' + path + '"?')) return;
        finish(path);
      };

      activePickerDrop = {
        overlay,
        accept(files) {
          if (mode !== 'open' || !files?.length) return false;
          const incoming = [...files];
          const rejected = incoming.filter(file => !isAllowedFile(file, extensions));
          if (rejected.length) {
            status.textContent = 'Some files do not match the accepted file types.';
            return false;
          }
          droppedFiles = multiple ? incoming : incoming.slice(0, 1);
          selected.clear();
          status.textContent = droppedFiles.length + ' file(s) received. Press Open to continue.';
          confirm.disabled = false;
          confirm.style.opacity = '1';
          return true;
        }
      };
      upButton.addEventListener('click', () => {
        if (!currentDir) return;
        currentDir = dirname(currentDir);
        droppedFiles = [];
        selected.clear();
        search.value = '';
        renderList();
      });
      deviceButton.addEventListener('click', () => deviceInput.click());
      deviceInput.addEventListener('change', () => {
        const incoming = Array.from(deviceInput.files || []);
        deviceInput.value = '';
        if (!incoming.length) return;
        const rejected = incoming.filter(file => !isAllowedFile(file, extensions));
        if (rejected.length) {
          status.textContent = rejected.length + ' file(s) do not match the accepted file types.';
          return;
        }
        droppedFiles = multiple ? incoming : incoming.slice(0, 1);
        selected.clear();
        status.textContent = droppedFiles.length + ' file(s) selected from this device. Press Open to continue.';
        renderList();
      });
      search.addEventListener('input', renderList);
      overlay.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); finish(null); }
        if (event.key === 'Enter' && mode === 'save') { event.preventDefault(); confirm.click(); }
      });
      overlay.addEventListener('dragover', event => {
        if (mode === 'open') event.preventDefault();
      });
      renderList();
      document.body.appendChild(overlay);
      if (filename) {
        filename.focus();
        filename.select();
      } else search.focus();
    });
  }

  function rememberLoadedProject(files) {
    const project = window.Project;
    if (!project || !Array.isArray(files)) return;
    const projectFile = files.find(file => extension(file.path || file.name) === 'bbmodel');
    if (projectFile) {
      project.save_path = normalize(projectFile.path || projectFile.name);
      project.name = basename(project.save_path).replace(/\.[^.]+$/, '');
      project.saved = true;
      return;
    }
    const codec = window.Format?.codec;
    if (codec?.extension) {
      const matching = files.find(file => extension(file.path || file.name) === String(codec.extension).toLowerCase());
      if (matching) {
        project.export_path = normalize(matching.path || matching.name);
        project.export_codec = codec.id;
        project.saved = true;
      }
    }
  }

  async function importFile(options = {}, callback) {
    const paths = await showWorkspacePicker({
      mode: 'open',
      title: options.title || ('Open ' + (options.type || 'File')),
      extensions: options.extensions || [],
      multiple: options.multiple === true,
      startpath: options.startpath || ''
    });
    if (!paths) return;
    try {
      const files = paths.droppedFiles
        ? await Promise.all(paths.droppedFiles.map(file => readDroppedFile(file, options)))
        : await readWorkspaceFiles(paths, options);
      if (typeof callback === 'function') callback(files);
      rememberLoadedProject(files);
      return files;
    } catch (error) {
      console.error('Blockbench workspace import failed:', error);
      notify('Could not open workspace file: ' + (error?.message || error));
      return [];
    }
  }

  async function readFiles(paths, options = {}, callback) {
    if (paths == null) return false;
    const list = typeof paths === 'string' ? [paths] : Array.from(paths);
    const promise = readWorkspaceFiles(list, options).then(files => {
      if (typeof callback === 'function') callback(files);
      return files;
    }).catch(error => {
      console.error('Blockbench workspace read failed:', error);
      notify('Could not read workspace file: ' + (error?.message || error));
      return [];
    });
    return promise;
  }

  async function writeFile(path, options = {}, callback) {
    path = normalize(path);
    if (!path) throw new Error('A workspace file path is required.');
    let content = options.content;
    const savetype = typeof options.savetype === 'function' ? options.savetype(path) : options.savetype;
    let bytes;
    if (content instanceof Blob) {
      bytes = new Uint8Array(await content.arrayBuffer());
    } else if (content instanceof ArrayBuffer || ArrayBuffer.isView(content)) {
      bytes = new Uint8Array(toArrayBuffer(content));
    } else if (typeof content === 'string' && content.startsWith('data:')) {
      bytes = decodeDataURL(content);
    } else if (typeof content === 'string') {
      bytes = new TextEncoder().encode(content);
    } else if (content == null) {
      bytes = new Uint8Array();
    } else {
      bytes = new TextEncoder().encode(String(content));
    }
    const success = bridge.writeFile(path, bytes);
    if (!success) throw new Error('The editor workspace refused to write: ' + path);
    if (typeof callback === 'function') callback(path);
    return path;
  }

  function preferredSavePath(options) {
    const ext = (options.extensions || []).map(value => String(value).replace(/^\./, '').toLowerCase());
    const project = window.Project;
    const projectPath = project?.save_path;
    const exportPath = project?.export_path;
    if (projectPath && (!ext.length || ext.includes(extension(projectPath)))) return normalize(projectPath);
    if (exportPath && (!ext.length || ext.includes(extension(exportPath)))) return normalize(exportPath);
    const start = normalize(options.startpath || '');
    if (start && bridge.exists(start) && (!ext.length || ext.includes(extension(start)))) return start;
    return '';
  }

  async function exportFile(options = {}, callback) {
    const fileName = String(options.name || 'file').trim() || 'file';
    const extensions = Array.isArray(options.extensions) ? options.extensions : [];
    const expectedExt = String(extensions[0] || '').replace(/^\./, '').toLowerCase();
    let suggestedName = fileName;
    if (expectedExt && extension(suggestedName) !== expectedExt) suggestedName += '.' + expectedExt;

    let path = forceSaveDialog ? '' : preferredSavePath(options);
    if (!path) {
      path = await showWorkspacePicker({
        mode: 'save',
        name: suggestedName,
        extensions,
        startpath: options.startpath || ''
      });
    }
    if (!path) return;
    if (options.custom_writer) {
      // Match Blockbench's own web implementation: custom writers may be
      // no-op callbacks used only to choose a path (e.g. save-path form fields).
      try {
        options.custom_writer(options.content, path);
        if (typeof callback === 'function') callback(path);
      } catch (error) {
        console.error('Blockbench workspace custom writer failed:', error);
        notify('Could not save file: ' + (error?.message || error));
        return;
      }
    } else {
      try {
        await writeFile(path, options, savedPath => {
          const project = window.Project;
          const ext = extension(savedPath);
          let representsProject = false;
          if (project) {
            if (ext === 'bbmodel' || /project/i.test(String(options.type || ''))) {
              project.save_path = savedPath;
              project.name = basename(savedPath).replace(/\.[^.]+$/, '');
              representsProject = true;
            } else if (window.Format?.codec && ext === String(window.Format.codec.extension || '').toLowerCase()) {
              project.export_path = savedPath;
              project.export_codec = window.Format.codec.id;
              representsProject = true;
            }
            if (representsProject) project.saved = true;
          }
          if (typeof callback === 'function') callback(savedPath);
        });
      } catch (error) {
        console.error('Blockbench workspace save failed:', error);
        notify('Could not save to the Editor workspace: ' + (error?.message || error));
        return;
      }
    }
    return path;
  }

  function findFileFromContent(baseDirectories, options = {}, checkFile) {
    const roots = (baseDirectories || []).map(normalize);
    const filter = options.filter_regex;
    const priority = options.priority_regex;
    const files = bridge.listFiles().map(normalize).filter(path =>
      roots.some(root => !root || path.startsWith(root + '/') || path === root)
    );
    const ordered = files.filter(path => !priority || priority.test(basename(path)))
      .concat(files.filter(path => priority && !priority.test(basename(path))));
    for (const path of ordered) {
      if (filter && !filter.test(basename(path))) continue;
      let content;
      try {
        content = options.read_file === false ? undefined : bridge.readText(path);
        const value = options.json ? JSON.parse(content || '{}') : content;
        const result = checkFile?.(path, value);
        if (result) return result;
      } catch (_) {}
    }
  }

  function patchFileSystem(api) {
    if (!api || api.__wkWorkspacePatched) return;
    api.__wkWorkspacePatched = true;
    api.importFile = importFile;
    api.readFile = readFiles;
    api.read = readFiles;
    api.exportFile = exportFile;
    api.writeFile = writeFile;
    api.findFileFromContent = findFileFromContent;
  }

  function patchBlockbench(api) {
    if (!api || api.__wkWorkspacePatched) return;
    api.__wkWorkspacePatched = true;
    api.import = importFile;
    api.importFile = importFile;
    api.read = readFiles;
    api.readFile = readFiles;
    api.export = exportFile;
    api.exportFile = exportFile;
    api.writeFile = writeFile;
    api.findFileFromContent = findFileFromContent;
  }

  const fsDescriptor = Object.getOwnPropertyDescriptor(window, 'Filesystem');
  let fileSystemApi = fsDescriptor?.value || window.Filesystem || null;
  if (!fsDescriptor || fsDescriptor.configurable) {
    Object.defineProperty(window, 'Filesystem', {
      configurable: true,
      enumerable: true,
      get: () => fileSystemApi,
      set: value => {
        fileSystemApi = value;
        patchFileSystem(value);
      }
    });
  }
  patchFileSystem(fileSystemApi);

  const bbDescriptor = Object.getOwnPropertyDescriptor(window, 'Blockbench');
  let blockbenchApi = bbDescriptor?.value || window.Blockbench || null;
  if (!bbDescriptor || bbDescriptor.configurable) {
    Object.defineProperty(window, 'Blockbench', {
      configurable: true,
      enumerable: true,
      get: () => blockbenchApi,
      set: value => {
        blockbenchApi = value;
        patchBlockbench(value);
      }
    });
  }
  patchBlockbench(blockbenchApi);

  function installSaveAsHook() {
    const action = window.BarItems?.save_project_as;
    if (!action || action.__wkWorkspaceSaveAsPatched || typeof action.click !== 'function') return;
    action.__wkWorkspaceSaveAsPatched = true;
    const originalClick = action.click;
    action.click = function (...args) {
      forceSaveDialog = true;
      try {
        const result = originalClick.apply(this, args);
        queueMicrotask(() => { forceSaveDialog = false; });
        return result;
      } catch (error) {
        forceSaveDialog = false;
        throw error;
      }
    };
  }

  window.addEventListener('load', installSaveAsHook, {once: true});
  for (const eventName of ['setup_project', 'new_project']) {
    try { blockbenchApi?.on?.(eventName, installSaveAsHook); } catch (_) {}
  }
  setTimeout(installSaveAsHook, 1000);

  async function handleWorkspaceDrop(files, event) {
    const BlockbenchApi = window.Blockbench;
    if (!files?.length || !BlockbenchApi) return false;
    const handlers = Object.values(BlockbenchApi.drag_handlers || {});
    const first = files[0];
    const ext = extension(first.name || '');
    const handler = handlers.find(entry => {
      let allowed = typeof entry.extensions === 'function' ? entry.extensions() : entry.extensions;
      if (!Array.isArray(allowed) || !allowed.map(value => String(value).toLowerCase()).includes(ext)) return false;
      try {
        return typeof window.Condition === 'function' ? window.Condition(entry.condition) : (typeof entry.condition !== 'function' || entry.condition());
      } catch (_) { return false; }
    });
    if (!handler) {
      try { window.unsupportedFileFormatMessage?.(first.name || 'file'); } catch (_) {}
      return false;
    }
    const loaded = await Promise.all(files.map(file => readDroppedFile(file, {readtype: handler.readtype})));
    await handler.cb(loaded, event);
    rememberLoadedProject(loaded);
    return true;
  }

  document.addEventListener('dragover', event => {
    const token = event.dataTransfer?.types?.includes?.('application/x-wk-editor-files');
    if (token) event.preventDefault();
  }, true);
  document.addEventListener('drop', async event => {
    const token = event.dataTransfer?.getData?.('application/x-wk-editor-files');
    const pickerDrop = activePickerDrop && activePickerDrop.overlay.contains(event.target);
    if (!token && !(pickerDrop && event.dataTransfer?.files?.length)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    let files = [];
    try {
      if (token) {
        files = window.parent.__editorFileDropBridge?.take?.(token) || [];
      } else {
        files = Array.from(event.dataTransfer.files || []);
      }
    } catch (error) {
      console.error('Could not receive Editor Explorer files:', error);
    }
    if (!files.length) {
      notify('The dragged workspace files are no longer available. Drag them again from the Explorer.');
      return;
    }
    if (pickerDrop) {
      activePickerDrop.accept(files);
      return;
    }
    // File fields in Blockbench's own dialogs have a dedicated drop listener.
    // Re-dispatch with real File objects so those fields can consume Explorer
    // drops through the same patched Filesystem.read() path as external drops.
    const formInput = event.target?.closest?.('.form_bar_file .input_wrapper');
    if (formInput && typeof DataTransfer === 'function' && typeof DragEvent === 'function') {
      try {
        const transfer = new DataTransfer();
        files.forEach(file => transfer.items.add(file));
        const forwarded = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer
        });
        formInput.dispatchEvent(forwarded);
        return;
      } catch (error) {
        console.warn('Could not forward workspace files to Blockbench dialog field:', error);
      }
    }
    try {
      const handled = await handleWorkspaceDrop(files, event);
      if (!handled) notify('No Blockbench import handler accepts that file type.');
    } catch (error) {
      console.error('Blockbench workspace drop failed:', error);
      notify('Could not open dropped file: ' + (error?.message || error));
    }
  }, true);

  console.info('WatermelonKatana Blockbench workspace integration enabled.');
})();