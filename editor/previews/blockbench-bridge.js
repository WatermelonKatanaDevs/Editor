(() => {
  const bridgeId = new URLSearchParams(location.search).get('wk_editor_bridge');
  let bridge = null;
  try {
    if (bridgeId && window.parent !== window) {
      bridge = window.parent.__WKBlockbenchBridges?.[bridgeId] || null;
    }
  } catch (_) {}
  if (!bridge) {
    console.error('Blockbench workspace bridge could not find its parent workspace bridge.', {
      bridgeId,
      parentOrigin: (() => { try { return window.parent.location.origin; } catch (_) { return 'inaccessible'; } })()
    });
    try {
      window.parent.postMessage({type:'wk-blockbench-bridge-error', bridgeId}, location.origin);
    } catch (_) {}
    return;
  }

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

  const nativeInputClick = HTMLInputElement.prototype.click;
  const nativeAnchorClick = HTMLAnchorElement.prototype.click;
  function dispatchSelectedFiles(input, files) {
    if (!files?.length) return;
    try {
      const transfer = new DataTransfer();
      for (const file of files || []) transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', {bubbles:true}));
    } catch (error) {
      console.error('Blockbench could not receive selected workspace files:', error);
    }
  }
  HTMLInputElement.prototype.click = function () {
    if (this.type !== 'file') return nativeInputClick.call(this);
    const input = this;
    void bridge.pickFiles({
      title:input.getAttribute('data-wk-picker-title') || 'Open in Blockbench',
      accept:input.accept || '',
      multiple:!!input.multiple,
      allowDevice:true
    }).then(files => dispatchSelectedFiles(input, files || []))
      .catch(error => {
        console.error('Blockbench shared file picker failed:', error);
      });
  };
  HTMLAnchorElement.prototype.click = function () {
    if (!this.download || !String(this.href).startsWith('blob:')) {
      return nativeAnchorClick.call(this);
    }
    const anchor = this;
    void fetch(anchor.href).then(response => {
      if (!response.ok) throw new Error('Could not read the exported file (' + response.status + ').');
      return response.blob();
    }).then(blob => bridge.saveFile({
      title:'Save from Blockbench',
      suggestedName:anchor.download || 'model',
      bytes:blob
    })).catch(error => {
      console.error('Blockbench shared save dialog failed:', error);
      notify('Could not save file: ' + (error?.message || error));
    });
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
    if (!extensions.length || extensions.includes('*')) return true;
    const ext = extension(path);
    if (extensions.includes(ext)) return true;
    const type = String(mimeFor(path) || '').toLowerCase();
    return extensions.includes(type) || extensions.some(value => value.endsWith('/*') && type.startsWith(value.slice(0, -1)));
  }
  function isAllowedFile(file, extensions) {
    if (!extensions.length || extensions.includes('*')) return true;
    const ext = extension(file?.name || '');
    if (extensions.includes(ext)) return true;
    const type = String(file?.type || mimeFor(file?.name || '')).toLowerCase();
    return extensions.includes(type) || extensions.some(value => value.endsWith('/*') && type.startsWith(value.slice(0, -1)));
  }

  let forceSaveDialog = false;
  async function showWorkspacePicker(options = {}) {
    if (options.mode === 'save') {
      return bridge.savePath({
        title:options.title || 'Save to Editor Workspace',
        suggestedName:options.name || 'file',
        extensions:options.extensions || [],
        startPath:options.startpath || ''
      });
    }
    return bridge.pickFiles({
      title:options.title || ('Open ' + (options.type || 'File')),
      extensions:options.extensions || [],
      multiple:options.multiple === true,
      startPath:options.startpath || '',
      allowDevice:true
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
    const selected = await showWorkspacePicker({
      mode: 'open',
      title: options.title || ('Open ' + (options.type || 'File')),
      extensions: options.extensions || [],
      multiple: options.multiple === true,
      startpath: options.startpath || ''
    });
    if (!selected?.length) return;
    try {
      const files = await Promise.all(selected.map(file => readDroppedFile(file, options)));
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
    if (!token) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    let files = [];
    try {
      if (token) {
        files = window.parent.__editorFileDropBridge?.take?.(token) || [];
      }
    } catch (error) {
      console.error('Could not receive Editor Explorer files:', error);
    }
    if (!files.length) {
      notify('The dragged workspace files are no longer available. Drag them again from the Explorer.');
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

  console.info('WatermelonKatana Blockbench workspace integration enabled.', {
    bridgeId,
    filesystemApiReady: !!fileSystemApi,
    blockbenchApiReady: !!blockbenchApi
  });
  try {
    window.parent.postMessage({type:'wk-blockbench-bridge-ready', bridgeId}, location.origin);
  } catch (_) {}
})();