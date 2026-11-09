(function () {
  const factories = window.EditorBuiltinFactories = window.EditorBuiltinFactories || {};
  const APP_PATH = 'editor/previews/vendor/filmcraft/';
  const MAX_OPEN_BYTES = 512 * 1024 * 1024;

  function normalizePath(value) {
    const parts = [];
    for (const part of String(value || '').replace(/\\/g, '/').split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') { parts.pop(); continue; }
      parts.push(part);
    }
    return parts.join('/');
  }
  function baseName(value) {
    return normalizePath(value).split('/').pop() || 'Untitled';
  }
  function safeName(value) {
    return baseName(value).replace(/[\u0000-\u001f<>:"|?*]/g, '_') || 'Untitled';
  }
  function isProject(name) {
    return /\.fcproj$/i.test(name);
  }
  function fileBytes(value) {
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new Error('FilmCraft returned an invalid file payload.');
  }

  factories.filmcraft = function (ctx) {
    let frame = null;
    let shell = null;
    let disposed = false;
    let ready = false;
    let documentPath = null;
    let picker = null;
    let style = null;
    let status = null;
    let openWorkspaceButton = null;
    let openDeviceButton = null;

    function setStatus(message, isError) {
      if (!status) return;
      status.textContent = message;
      status.style.color = isError ? '#ff9b9b' : '#aeb8c1';
    }
    function workspaceFiles() {
      return (ctx.state.fs?.listFilesSync?.() || [])
        .map(normalizePath)
        .filter(path => path && path !== '.editor' && !path.startsWith('.editor/') &&
          path !== '.git' && !path.startsWith('.git/'));
    }
    function currentFs() {
      const fs = ctx.state.fs;
      if (!fs) throw new Error('The Editor workspace is not ready.');
      return fs;
    }
    function readWorkspaceFile(path) {
      const value = currentFs().readFileSync(normalizePath(path), 'binary');
      if (value == null) throw new Error('File not found: ' + path);
      const bytes = value instanceof Uint8Array ? value.slice() : new Uint8Array(value).slice();
      if (bytes.byteLength > MAX_OPEN_BYTES) {
        throw new Error('FilmCraft can open workspace files up to 512 MiB through the Editor bridge.');
      }
      return bytes.buffer;
    }
    function postOpen(name, bytes, sourcePath) {
      if (!ready || !frame?.contentWindow) throw new Error('FilmCraft is not ready yet.');
      const payload = bytes instanceof ArrayBuffer
        ? bytes
        : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      frame.contentWindow.postMessage(
        { type: 'filmcraft:open', name: safeName(name), bytes: payload },
        location.origin,
        [payload]
      );
      if (sourcePath && isProject(name)) documentPath = normalizePath(sourcePath);
      else if (!sourcePath && isProject(name)) documentPath = null;
      setStatus('Opened ' + safeName(name), false);
    }
    function ensureParent(path) {
      const fs = currentFs();
      const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      if (parent && !fs.existsSync(parent)) fs.mkdirSync(parent);
    }
    function availablePath(path, overwritePath) {
      const fs = currentFs();
      if (!fs.existsSync(path) || path === overwritePath) return path;
      const dot = path.lastIndexOf('.');
      const slash = path.lastIndexOf('/');
      const stem = dot > slash ? path.slice(0, dot) : path;
      const ext = dot > slash ? path.slice(dot) : '';
      for (let n = 2; n < 10000; n++) {
        const candidate = stem + ' (' + n + ')' + ext;
        if (!fs.existsSync(candidate)) return candidate;
      }
      throw new Error('Could not find an unused workspace filename for ' + path);
    }
    function receiveSave(message) {
      try {
        if (ctx.state.projectOwner === false) {
          throw new Error('This Editor workspace is read-only. FilmCraft cannot save into it.');
        }
        const name = safeName(message.name || 'FilmCraft Export');
        const bytes = fileBytes(message.bytes);
        let path;
        if (message.saveAs === true) {
          path = availablePath(name, documentPath);
          documentPath = path;
        } else if (documentPath && baseName(documentPath) === name) {
          path = documentPath;
        } else if (isProject(name) && !documentPath) {
          path = availablePath(name, null);
          documentPath = path;
        } else {
          path = availablePath('FilmCraft Exports/' + name, null);
        }
        ensureParent(path);
        currentFs().writeFileSync(path, bytes.slice());
        ctx.markDirty(path);
        ctx.updateStatus();
        try { ctx.state.fileManager?.refresh?.(); } catch (_) {}
        setStatus('Saved to workspace: ' + path, false);
      } catch (error) {
        console.error('[FilmCraft workspace save]', error);
        setStatus('Save failed: ' + (error?.message || String(error)), true);
      }
    }
    function showPicker() {
      if (picker) return;
      const overlay = document.createElement('div');
      overlay.className = 'wk-filmcraft-picker';
      const dialog = document.createElement('section');
      const header = document.createElement('header');
      header.textContent = 'Open a file from the Editor workspace';
      const nav = document.createElement('nav');
      const up = document.createElement('button');
      up.textContent = '↑ Up';
      const pathLabel = document.createElement('div');
      pathLabel.className = 'path';
      const search = document.createElement('input');
      search.placeholder = 'Filter files';
      nav.append(up, pathLabel, search);
      const list = document.createElement('div');
      list.className = 'list';
      const footer = document.createElement('footer');
      const cancel = document.createElement('button');
      cancel.textContent = 'Cancel';
      const open = document.createElement('button');
      open.className = 'primary';
      open.textContent = 'Open';
      footer.append(cancel, open);
      dialog.append(header, nav, list, footer);
      overlay.append(dialog);
      let current = '';
      let selected = '';
      const close = () => {
        document.removeEventListener('keydown', keydown);
        overlay.remove();
        picker = null;
      };
      const keydown = event => {
        if (event.key === 'Escape') close();
      };
      function draw() {
        list.replaceChildren();
        const all = workspaceFiles();
        const prefix = current ? current + '/' : '';
        const directories = new Set();
        const files = [];
        for (const item of all) {
          if (!item.startsWith(prefix)) continue;
          const rest = item.slice(prefix.length);
          if (!rest) continue;
          const slash = rest.indexOf('/');
          if (slash >= 0) directories.add(rest.slice(0, slash));
          else files.push(item);
        }
        const query = search.value.trim().toLowerCase();
        const rows = [
          ...[...directories].sort().map(name => ({ directory: true, name })),
          ...files.sort().map(path => ({ path, name: baseName(path) }))
        ].filter(row => row.name.toLowerCase().includes(query));
        if (!rows.length) {
          const empty = document.createElement('div');
          empty.className = 'empty';
          empty.textContent = 'No files in this folder.';
          list.append(empty);
        }
        for (const row of rows) {
          const button = document.createElement('button');
          button.className = (row.directory ? 'folder ' : '') + (row.path === selected ? 'selected' : '');
          button.textContent = (row.directory ? '▸ ' : '▧ ') + row.name;
          button.onclick = () => {
            if (row.directory) {
              current = normalizePath((current ? current + '/' : '') + row.name);
              selected = '';
            } else selected = row.path;
            draw();
          };
          button.ondblclick = () => {
            if (!row.directory) {
              try {
                postOpen(row.name, readWorkspaceFile(row.path), row.path);
                close();
              } catch (error) {
                setStatus(error?.message || String(error), true);
              }
            }
          };
          list.append(button);
        }
        pathLabel.textContent = current ? '/' + current : '/';
        up.disabled = !current;
        open.disabled = !selected;
      }
      up.onclick = () => {
        const parts = current.split('/');
        parts.pop();
        current = parts.join('/');
        selected = '';
        draw();
      };
      search.oninput = draw;
      cancel.onclick = close;
      open.onclick = () => {
        if (!selected) return;
        try {
          postOpen(baseName(selected), readWorkspaceFile(selected), selected);
          close();
        } catch (error) {
          setStatus(error?.message || String(error), true);
        }
      };
      overlay.addEventListener('mousedown', event => {
        if (event.target === overlay) close();
      });
      document.addEventListener('keydown', keydown);
      shell.append(overlay);
      picker = { close };
      draw();
    }
    function handleDeviceFiles(files) {
      const items = [...(files || [])];
      if (!items.length) return;
      void (async () => {
        for (const file of items) {
          try {
            if (file.size > MAX_OPEN_BYTES) throw new Error(file.name + ' exceeds the 512 MiB Editor bridge limit.');
            postOpen(file.name, await file.arrayBuffer(), null);
          } catch (error) {
            setStatus(error?.message || String(error), true);
          }
        }
      })();
    }
    function onMessage(event) {
      if (disposed || event.source !== frame?.contentWindow || event.origin !== location.origin) return;
      const message = event.data;
      if (!message || typeof message.type !== 'string') return;
      switch (message.type) {
        case 'filmcraft:ready':
          if (ready) return;
          ready = true;
          frame.contentWindow.postMessage({ type: 'filmcraft:host', version: '1' }, location.origin);
          if (openWorkspaceButton) openWorkspaceButton.disabled = false;
          if (openDeviceButton) openDeviceButton.disabled = false;
          setStatus(ctx.state.projectOwner === false
            ? 'Read-only workspace — saves are disabled'
            : 'Ready — open a workspace file or choose one from your device', false);
          break;
        case 'filmcraft:save':
          receiveSave(message);
          break;
        case 'filmcraft:dirty':
          setStatus(message.dirty ? 'Unsaved FilmCraft changes' : 'FilmCraft changes saved', false);
          break;
        case 'filmcraft:failed':
          setStatus('FilmCraft could not start: ' + (message.error || 'Unknown startup error'), true);
          break;
      }
    }
    function render(group) {
      disposed = false;
      ready = false;
      shell = document.createElement('div');
      shell.className = 'wk-filmcraft-shell';
      style = document.createElement('style');
      style.textContent = '.wk-filmcraft-shell{display:flex;flex-direction:column;width:100%;height:100%;min-height:0;background:#17191d;color:#e7eaf0;font:13px system-ui,sans-serif}.wk-filmcraft-toolbar{height:38px;flex:0 0 38px;box-sizing:border-box;display:flex;align-items:center;gap:7px;padding:4px 9px;background:#202329;border-bottom:1px solid #353a42}.wk-filmcraft-toolbar button,.wk-filmcraft-picker button{border:1px solid #454c56;background:#2b3038;color:#e7eaf0;border-radius:4px;padding:6px 10px;font:inherit;cursor:pointer}.wk-filmcraft-toolbar button:disabled{opacity:.45;cursor:default}.wk-filmcraft-toolbar .status{margin-left:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#aeb8c1}.wk-filmcraft-frame-wrap{flex:1;min-height:0;position:relative}.wk-filmcraft-frame{display:block;width:100%;height:100%;min-height:0;border:0;background:#17191d}.wk-filmcraft-picker{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:18px;background:#000a}.wk-filmcraft-picker section{display:flex;flex-direction:column;width:min(680px,95%);max-height:88%;overflow:hidden;background:#202329;border:1px solid #454c56;border-radius:8px;box-shadow:0 16px 55px #0009}.wk-filmcraft-picker header,.wk-filmcraft-picker nav,.wk-filmcraft-picker footer{display:flex;gap:8px;align-items:center;padding:11px 13px;border-bottom:1px solid #383e47}.wk-filmcraft-picker nav .path{flex:1;color:#aeb8c1;overflow:hidden;text-overflow:ellipsis}.wk-filmcraft-picker nav input{width:180px;max-width:35%;box-sizing:border-box;background:#15171b;border:1px solid #454c56;border-radius:4px;color:#fff;padding:7px}.wk-filmcraft-picker .list{min-height:160px;overflow:auto;padding:8px}.wk-filmcraft-picker .list button{display:block;width:100%;text-align:left;border:0;background:transparent}.wk-filmcraft-picker .list button.folder{color:#c5d8cb}.wk-filmcraft-picker .list button.selected{background:#28513e}.wk-filmcraft-picker .list .empty{padding:20px;color:#9fa8b3;text-align:center}.wk-filmcraft-picker footer{justify-content:flex-end;border:0;border-top:1px solid #383e47}.wk-filmcraft-picker button.primary{background:#087c4a;border-color:#0b9b60}';
      document.head.append(style);
      const toolbar = document.createElement('div');
      toolbar.className = 'wk-filmcraft-toolbar';
      openWorkspaceButton = document.createElement('button');
      openWorkspaceButton.textContent = 'Open Workspace File…';
      openWorkspaceButton.disabled = true;
      openWorkspaceButton.onclick = showPicker;
      openDeviceButton = document.createElement('button');
      openDeviceButton.textContent = 'Open Device File…';
      openDeviceButton.disabled = true;
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      const acceptedDeviceTypes = 'video/*,audio/*,image/*,.fcproj,.mxf,.aaf,.omf,.edl,.srt,.vtt';
      input.accept = acceptedDeviceTypes;
      input.hidden = true;
      input.onchange = () => {
        handleDeviceFiles(input.files);
        input.value = '';
      };
      openDeviceButton.onclick = () => input.click();
      let showAllDeviceFiles = false;
      const allDeviceFilesButton = document.createElement('button');
      allDeviceFilesButton.type = 'button';
      allDeviceFilesButton.textContent = 'All file types: Off';
      allDeviceFilesButton.title = 'Show every file in the device picker, including types FilmCraft may not recognize.';
      allDeviceFilesButton.setAttribute('aria-pressed', 'false');
      allDeviceFilesButton.onclick = () => {
        showAllDeviceFiles = !showAllDeviceFiles;
        if (showAllDeviceFiles) input.removeAttribute('accept');
        else input.accept = acceptedDeviceTypes;
        allDeviceFilesButton.textContent = 'All file types: ' + (showAllDeviceFiles ? 'On' : 'Off');
        allDeviceFilesButton.setAttribute('aria-pressed', String(showAllDeviceFiles));
        allDeviceFilesButton.style.background = showAllDeviceFiles ? '#31513f' : '#2b3038';
      };
      status = document.createElement('div');
      status.className = 'status';
      status.textContent = 'Loading FilmCraft…';
      toolbar.append(openWorkspaceButton, openDeviceButton, allDeviceFilesButton, status);
      const frameWrap = document.createElement('div');
      frameWrap.className = 'wk-filmcraft-frame-wrap';
      frame = document.createElement('iframe');
      frame.className = 'wk-filmcraft-frame';
      frame.title = 'FilmCraft Video Editor';
      frame.allow = 'autoplay; fullscreen; clipboard-read; clipboard-write';
      frame.referrerPolicy = 'same-origin';
      window.addEventListener('message', onMessage);
      const url = new URL(APP_PATH, location.href);
      url.searchParams.set('host', 'parent');
      frame.src = url.href;
      frameWrap.append(frame, input);
      shell.append(toolbar, frameWrap);
      group.viewBody.append(shell);
      return shell;
    }
    function dispose(tab) {
      disposed = true;
      ready = false;
      window.removeEventListener('message', onMessage);
      try { picker?.close?.(); } catch (_) {}
      const view = tab?._viewElement;
      const target = view?.tagName === 'IFRAME' ? view : view?.querySelector?.('iframe');
      try { target?.removeAttribute('src'); target?.remove(); } catch (_) {}
      try { frame?.removeAttribute('src'); frame?.remove(); } catch (_) {}
      try { shell?.remove(); } catch (_) {}
      try { style?.remove(); } catch (_) {}
      frame = null;
      shell = null;
      status = null;
      openWorkspaceButton = null;
      openDeviceButton = null;
      documentPath = null;
    }
    return {
      title: 'FilmCraft Video Editor',
      icon: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 5v14M16 5v14M3 9h5M16 9h5M3 15h5M16 15h5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="m10 9 5 3-5 3z" fill="currentColor"/></svg>',
      render,
      dispose
    };
  };
})();
