(function () {
  const FILE_SAVED_EVENT = 'editor-audio-file-saved';
  const MIME_EXTENSION = {
    'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
    'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/vnd.wave': 'wav',
    'audio/flac': 'flac', 'audio/x-flac': 'flac', 'audio/ogg': 'ogg',
    'audio/aac': 'aac', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/webm': 'webm', 'application/x-audiomass-session': 'amss'
  };

  function fileName(file) {
    return String(file?.name || String(file?.path || 'audio').split('/').pop() || 'audio');
  }

  function fileExtension(name) {
    const match = /\.([a-z0-9]{1,10})$/i.exec(String(name || ''));
    return match ? match[1].toLowerCase() : '';
  }

  function fileBase(name) {
    return String(name || 'audio').replace(/\.[^.]+$/, '') || 'audio';
  }

  function toBytes(value, win) {
    if (value == null) throw new Error('The selected audio file is empty.');
    if (typeof value === 'string') {
      const bytes = new win.Uint8Array(value.length);
      for (let i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i) & 255;
      return bytes;
    }
    if (value instanceof ArrayBuffer) return new win.Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
      return new win.Uint8Array(value.buffer, value.byteOffset || 0, value.byteLength);
    }
    if (value.buffer && Number.isFinite(value.byteLength)) {
      return new win.Uint8Array(value.buffer, value.byteOffset || 0, value.byteLength);
    }
    throw new Error('The Editor returned an unsupported audio data format.');
  }

  function contentType(file) {
    const mime = String(file?.mime || '').toLowerCase();
    if (mime.startsWith('audio/')) return mime;
    const ext = fileExtension(fileName(file));
    const byExtension = {
      mp3: 'audio/mpeg', wav: 'audio/wav', wave: 'audio/wav',
      flac: 'audio/flac', ogg: 'audio/ogg', oga: 'audio/ogg',
      opus: 'audio/ogg', aac: 'audio/aac', m4a: 'audio/mp4',
      aif: 'audio/aiff', aiff: 'audio/aiff', webm: 'audio/webm'
    };
    return byExtension[ext] || 'application/octet-stream';
  }

  function exportExtension(downloadName, blob, fallback) {
    const requestedName = String(downloadName || '').replace(/\\/g, '/').split('/').pop().trim();
    const requestedExtension = fileExtension(requestedName);
    const mime = String(blob?.type || '').split(';')[0].toLowerCase();
    return MIME_EXTENSION[mime] || requestedExtension || fallback || 'wav';
  }

  function exportPath(ctx, downloadName, extension) {
    const sourceName = fileName(ctx.file);
    const sourceBase = fileBase(sourceName);
    const sourceExtension = fileExtension(sourceName);
    const requestedName = String(downloadName || '').replace(/\\/g, '/').split('/').pop().trim();
    let outputBase = fileBase(requestedName);
    if (!outputBase || /^(audiomass-output|output)$/i.test(outputBase)) outputBase = sourceBase;
    outputBase = outputBase
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
      .replace(/^\.+/, '')
      .trim() || sourceBase;

    if (outputBase.toLowerCase() === sourceBase.toLowerCase() && extension === sourceExtension) {
      return ctx.file.path;
    }

    const slash = String(ctx.file.path || '').lastIndexOf('/');
    const directory = slash >= 0 ? String(ctx.file.path).slice(0, slash + 1) : '';
    const makePath = stem => directory + stem + '.' + extension;
    let path = makePath(outputBase);
    if (path === ctx.file.path) return path;

    let suffix = 2;
    while (ctx.exists(path) && suffix < 10000) path = makePath(outputBase + ' (' + suffix++ + ')');
    return path;
  }

  async function create(ctx) {
    const shell = document.createElement('div');
    shell.className = 'editor-audiomass-shell';
    shell.style.cssText = 'position:relative;width:100%;height:100%;min-height:0;display:flex;overflow:hidden;background:#101010;';

    const iframe = document.createElement('iframe');
    iframe.className = 'editor-audiomass-frame';
    iframe.title = 'AudioMass audio editor';
    iframe.allow = 'microphone; autoplay';
    iframe.setAttribute('allowfullscreen', '');
    iframe.style.cssText = 'display:block;width:100%;height:100%;min-height:0;flex:1;border:0;background:#101010;';

    const status = document.createElement('div');
    status.className = 'editor-audiomass-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.style.cssText = 'position:absolute;right:12px;bottom:10px;z-index:20;max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:5px 9px;border:1px solid #ffffff20;border-radius:5px;background:#151515d9;color:#ddd;font:12px/1.35 system-ui,sans-serif;pointer-events:none;';

    shell.append(iframe, status);
    ctx.host.appendChild(shell);

    let disposed = false;
    let audioApp = null;
    let onLoaded = null;
    let onUnloaded = null;
    let onFileSaved = null;
    let originalCreateObjectURL = null;
    let originalAnchorClick = null;
    let originalRevokeObjectURL = null;
    let patchedCreateObjectURL = null;
    let patchedAnchorClick = null;
    const objectURLBlobs = new Map();

    function setStatus(message, isError) {
      if (disposed) return;
      status.textContent = String(message || '');
      status.style.color = isError ? '#ff9b9b' : '#ddd';
    }

    function readSourceTags() {
      try {
        const bytes = toBytes(ctx.readBinary(), window);
        const mime = contentType(ctx.file);
        const kind = fileExtension(fileName(ctx.file)) === 'wav' || mime.includes('wav') ? 'wav' : 'mp3';
        return window.EditorAudioTags?.read(bytes, kind) || null;
      } catch (error) {
        console.warn('AudioMass could not read source audio metadata:', error);
        return null;
      }
    }

    let sourceTags = null;

    async function saveExport(blob, downloadName) {
      try {
        const buffer = await blob.arrayBuffer();
        let bytes = new Uint8Array(buffer);
        if (!bytes.length) throw new Error('AudioMass produced an empty export.');
        const extension = exportExtension(downloadName, blob, fileExtension(fileName(ctx.file)));
        if (window.EditorAudioTags && (extension === 'mp3' || extension === 'wav')) {
          sourceTags = sourceTags || readSourceTags();
          bytes = window.EditorAudioTags.preserveMetadata(
            bytes,
            sourceTags,
            extension === 'wav' ? 'wav' : 'mp3'
          );
        }
        const path = exportPath(ctx, downloadName, extension);
        ctx.writeBinary(bytes, path);
        ctx.markDirty(path);
        if (path !== ctx.file.path) {
          ctx.state.fileManager?.refresh?.();
        } else {
          window.dispatchEvent(new CustomEvent(FILE_SAVED_EVENT, {
            detail: { path, source: 'audio-edit' }
          }));
        }
        setStatus((path === ctx.file.path ? 'Saved changes to ' : 'Created ') + path);
      } catch (error) {
        setStatus(error?.message || 'Could not save the AudioMass export.', true);
        console.error('AudioMass export could not be written to the Editor filesystem:', error);
      }
    }

    function installExportBridge(win) {
      const urlAPI = win.URL;
      const anchorPrototype = win.HTMLAnchorElement?.prototype;
      if (!urlAPI?.createObjectURL || !anchorPrototype?.click) {
        throw new Error('This browser does not expose the APIs needed to capture AudioMass exports.');
      }

      originalCreateObjectURL = urlAPI.createObjectURL;
      originalRevokeObjectURL = urlAPI.revokeObjectURL;
      originalAnchorClick = anchorPrototype.click;

      patchedCreateObjectURL = function (object) {
        const url = originalCreateObjectURL.call(urlAPI, object);
        if (object instanceof win.Blob) objectURLBlobs.set(String(url), object);
        return url;
      };

      patchedAnchorClick = function () {
        const url = String(this.href || this.getAttribute('href') || '');
        const blob = this.hasAttribute('download') ? objectURLBlobs.get(url) : null;
        if (blob) {
          objectURLBlobs.delete(url);
          const name = this.download || this.getAttribute('download') || '';
          try { originalRevokeObjectURL?.call(urlAPI, url); } catch (_) {}
          this.remove();
          void saveExport(blob, name);
          return;
        }
        return originalAnchorClick.apply(this, arguments);
      };

      urlAPI.createObjectURL = patchedCreateObjectURL;
      anchorPrototype.click = patchedAnchorClick;
      if (urlAPI.createObjectURL !== patchedCreateObjectURL || anchorPrototype.click !== patchedAnchorClick) {
        throw new Error('AudioMass export interception could not be installed in this browser.');
      }
    }

    function cleanup() {
      if (disposed) return;
      disposed = true;
      if (audioApp?.stopListeningFor && onLoaded) {
        try { audioApp.stopListeningFor('DidLoadFile', onLoaded); } catch (_) {}
      }
      if (audioApp?.stopListeningFor && onUnloaded) {
        try { audioApp.stopListeningFor('DidUnloadFile', onUnloaded); } catch (_) {}
      }
      if (onFileSaved) window.removeEventListener(FILE_SAVED_EVENT, onFileSaved);
      try {
        const win = iframe.contentWindow;
        if (win?.URL?.createObjectURL === patchedCreateObjectURL && originalCreateObjectURL) {
          win.URL.createObjectURL = originalCreateObjectURL;
        }
        if (win?.HTMLAnchorElement?.prototype?.click === patchedAnchorClick && originalAnchorClick) {
          win.HTMLAnchorElement.prototype.click = originalAnchorClick;
        }
      } catch (_) {}
      objectURLBlobs.clear();
      iframe.removeEventListener('load', onFrameLoad);
      iframe.removeEventListener('error', onFrameError);
      iframe.remove();
      shell.remove();
    }

    function onFrameLoad() {
      try {
        const win = iframe.contentWindow;
        audioApp = win?.PKAudioEditor;
        if (!audioApp?.engine?.LoadArrayBuffer) {
          throw new Error('AudioMass loaded, but its audio engine was not available.');
        }

        installExportBridge(win);
        onLoaded = function () { setStatus('Ready · ' + fileName(ctx.file)); };
        onUnloaded = function () { setStatus('Loading audio…'); };
        audioApp.listenFor('DidLoadFile', onLoaded);
        audioApp.listenFor('DidUnloadFile', onUnloaded);
        sourceTags = readSourceTags();
        onFileSaved = function (event) {
          if (disposed || event?.detail?.path !== ctx.file.path ||
            event?.detail?.source === 'audio-edit') return;
          try {
            sourceTags = readSourceTags();
            const updatedBytes = toBytes(ctx.readBinary(), win);
            setStatus('Reloading updated audio…');
            audioApp.engine.LoadArrayBuffer(new win.Blob([updatedBytes], { type: contentType(ctx.file) }));
          } catch (error) {
            setStatus(error?.message || 'Could not reload the updated audio.', true);
          }
        };
        window.addEventListener(FILE_SAVED_EVENT, onFileSaved);

        const bytes = toBytes(ctx.readBinary(), win);
        const blob = new win.Blob([bytes], { type: contentType(ctx.file) });
        setStatus('Loading ' + fileName(ctx.file) + '…');
        audioApp.engine.LoadArrayBuffer(blob);
      } catch (error) {
        setStatus(error?.message || 'Could not initialize AudioMass.', true);
        console.error('AudioMass preview failed:', error);
      }
    }

    function onFrameError() {
      setStatus('AudioMass could not be loaded.', true);
    }

    iframe.addEventListener('load', onFrameLoad);
    iframe.addEventListener('error', onFrameError);
    iframe.src = new URL('editor/previews/vendor/audiomass/src/index.html', location.href).href;
    ctx.addCleanup(cleanup);
  }

  const providers = window.EditorPreviewProviders = window.EditorPreviewProviders || [];
  const audioProvider = providers.find(provider => provider.id === 'audio');
  if (audioProvider) {
    audioProvider.views.push({
      id: 'audio-edit',
      label: 'Edit Audio',
      priority: 90,
      create
    });
  } else {
    providers.push({
      id: 'audio',
      match(file) {
        return String(file?.mime || '').toLowerCase().startsWith('audio/') ||
          /\.(aac|aif|aiff|flac|m4a|mp3|oga|ogg|opus|wav|wave|webm)$/i.test(String(file?.name || file?.path || ''));
      },
      views: [{
        id: 'audio-edit',
        label: 'Edit Audio',
        priority: 90,
        create
      }]
    });
  }
})();
