(function () {
  const factories = window.EditorBuiltinFactories = window.EditorBuiltinFactories || {};
  const APP_PATH = 'editor/previews/vendor/filmcraft/';
  const MAX_OPEN_BYTES = 512 * 1024 * 1024;
  const ACCEPT = 'video/*,audio/*,image/*,.fcproj,.mxf,.aaf,.omf,.edl,.srt,.vtt';

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
  function isProject(name) { return /\.fcproj$/i.test(name); }
  function fileBytes(value) {
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new Error('FilmCraft returned an invalid file payload.');
  }

  factories.filmcraft = function (ctx) {
    let frame = null, shell = null, style = null, status = null, openButton = null;
    let disposed = false, ready = false, documentPath = null;

    const workspacePicker = window.EditorWorkspacePicker.create({
      getFs:() => ctx.state.fs,
      getMime:path => ctx.mime(path),
      canWrite:() => ctx.state.projectOwner !== false,
      onWrite:path => {
        ctx.markDirty(path);
        ctx.updateStatus();
        try { ctx.state.fileManager?.refresh?.(); } catch (_) {}
      }
    });

    function setStatus(message, isError) {
      if (!status) return;
      status.textContent = message;
      status.style.color = isError ? '#ff9b9b' : '#aeb8c1';
    }
    function currentFs() {
      if (!ctx.state.fs) throw new Error('The Editor workspace is not ready.');
      return ctx.state.fs;
    }
    function availablePath(path, overwritePath) {
      const fs = currentFs();
      if (!fs.existsSync(path) || path === overwritePath) return path;
      const dot = path.lastIndexOf('.'), slash = path.lastIndexOf('/');
      const stem = dot > slash ? path.slice(0, dot) : path;
      const ext = dot > slash ? path.slice(dot) : '';
      for (let n = 2; n < 10000; n++) {
        const candidate = stem + ' (' + n + ')' + ext;
        if (!fs.existsSync(candidate)) return candidate;
      }
      throw new Error('Could not find an unused workspace filename for ' + path);
    }
    function postOpen(name, bytes, sourcePath) {
      if (!ready || !frame?.contentWindow) throw new Error('FilmCraft is not ready yet.');
      const payload = bytes instanceof ArrayBuffer
        ? bytes
        : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      frame.contentWindow.postMessage(
        {type:'filmcraft:open', name:safeName(name), bytes:payload},
        location.origin,
        [payload]
      );
      if (sourcePath && isProject(name)) documentPath = normalizePath(sourcePath);
      else if (!sourcePath && isProject(name)) documentPath = null;
      setStatus('Opened ' + safeName(name), false);
    }
    async function openFiles(files) {
      const items = [...(files || [])];
      for (const file of items) {
        try {
          if (file.size > MAX_OPEN_BYTES) {
            throw new Error(file.name + ' exceeds the 512 MiB Editor bridge limit.');
          }
          postOpen(file.name, await file.arrayBuffer(), file.__wkWorkspacePath || file.customRelativePath || null);
        } catch (error) {
          setStatus(error?.message || String(error), true);
        }
      }
    }
    async function receiveSave(message) {
      try {
        if (ctx.state.projectOwner === false) {
          throw new Error('This Editor workspace is read-only. FilmCraft cannot save into it.');
        }
        const name = safeName(message.name || 'FilmCraft Export');
        const bytes = fileBytes(message.bytes);
        let path;
        if (message.saveAs === true) {
          path = await workspacePicker.savePath({
            title:'Save from FilmCraft',
            suggestedName:name
          });
          if (!path) return;
          if (isProject(name)) documentPath = path;
        } else if (documentPath && baseName(documentPath) === name) {
          path = documentPath;
        } else if (isProject(name) && !documentPath) {
          path = availablePath(name, null);
          documentPath = path;
        } else {
          path = availablePath('FilmCraft Exports/' + name, null);
        }
        workspacePicker.writeFile(path, bytes);
        setStatus('Saved to workspace: ' + path, false);
      } catch (error) {
        console.error('[FilmCraft workspace save]', error);
        setStatus('Save failed: ' + (error?.message || String(error)), true);
      }
    }
    function onMessage(event) {
      if (disposed || event.source !== frame?.contentWindow || event.origin !== location.origin) return;
      const message = event.data;
      if (!message || typeof message.type !== 'string') return;
      switch (message.type) {
        case 'filmcraft:ready':
          if (ready) return;
          ready = true;
          frame.contentWindow.postMessage({type:'filmcraft:host', version:'1'}, location.origin);
          if (openButton) openButton.disabled = false;
          setStatus(ctx.state.projectOwner === false
            ? 'Read-only workspace — saves are disabled'
            : 'Ready — open files from the workspace or this device', false);
          break;
        case 'filmcraft:save':
          void receiveSave(message);
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
      style.textContent = '.wk-filmcraft-shell{display:flex;flex-direction:column;width:100%;height:100%;min-height:0;background:#17191d;color:#e7eaf0;font:13px system-ui,sans-serif}.wk-filmcraft-toolbar{height:38px;flex:0 0 38px;box-sizing:border-box;display:flex;align-items:center;gap:7px;padding:4px 9px;background:#202329;border-bottom:1px solid #353a42}.wk-filmcraft-toolbar button{border:1px solid #454c56;background:#2b3038;color:#e7eaf0;border-radius:4px;padding:6px 10px;font:inherit;cursor:pointer}.wk-filmcraft-toolbar button:disabled{opacity:.45;cursor:default}.wk-filmcraft-toolbar .status{margin-left:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#aeb8c1}.wk-filmcraft-frame-wrap{flex:1;min-height:0;position:relative}.wk-filmcraft-frame{display:block;width:100%;height:100%;min-height:0;border:0;background:#17191d}';
      document.head.append(style);

      const toolbar = document.createElement('div');
      toolbar.className = 'wk-filmcraft-toolbar';
      openButton = document.createElement('button');
      openButton.textContent = 'Open File…';
      openButton.disabled = true;
      openButton.onclick = () => {
        void workspacePicker.open({
          title:'Open in FilmCraft',
          accept:ACCEPT,
          multiple:true,
          allowDevice:true,
          maxFileBytes:MAX_OPEN_BYTES
        }).then(openFiles).catch(error => setStatus(error?.message || String(error), true));
      };
      status = document.createElement('div');
      status.className = 'status';
      status.textContent = 'Loading FilmCraft…';
      toolbar.append(openButton, status);

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
      frameWrap.append(frame);
      shell.append(toolbar, frameWrap);
      group.viewBody.append(shell);
      return shell;
    }
    function dispose(tab) {
      disposed = true;
      ready = false;
      window.removeEventListener('message', onMessage);
      try { workspacePicker.cancelActive(); } catch (_) {}
      const view = tab?._viewElement;
      const target = view?.tagName === 'IFRAME' ? view : view?.querySelector?.('iframe');
      try { target?.removeAttribute('src'); target?.remove(); } catch (_) {}
      try { frame?.removeAttribute('src'); frame?.remove(); } catch (_) {}
      try { shell?.remove(); } catch (_) {}
      try { style?.remove(); } catch (_) {}
      frame = null; shell = null; status = null; openButton = null; documentPath = null;
    }
    return {
      title:'FilmCraft Video Editor',
      icon:'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 5v14M16 5v14M3 9h5M16 9h5M3 15h5M16 15h5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="m10 9 5 3-5 3z" fill="currentColor"/></svg>',
      render, dispose
    };
  };
})();