(function () {
  const factories = window.EditorBuiltinFactories = window.EditorBuiltinFactories || {};

  function normalizePath(value) {
    const parts = [];
    for (const part of String(value || '').replace(/\\/g, '/').split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') { parts.pop(); continue; }
      parts.push(part);
    }
    return parts.join('/');
  }

  factories.blockbench = function (ctx) {
    let pickerContainer = null;
    const workspacePicker = window.EditorWorkspacePicker.create({
      getContainer:() => pickerContainer,
      getFs:() => ctx.state.fs,
      getMime:path => ctx.mime(path),
      canWrite:() => ctx.state.projectOwner !== false,
      onWrite:path => {
        ctx.markDirty(path);
        ctx.updateStatus();
        try { ctx.state.fileManager?.refresh?.(); } catch (_) {}
      }
    });
    const bridgeId = 'wk-blockbench-' + (window.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)));
    window.__WKBlockbenchBridges = window.__WKBlockbenchBridges || Object.create(null);

    const bridge = {
      pickFiles:options => workspacePicker.open(options),
      savePath:options => workspacePicker.savePath(options),
      saveFile:options => workspacePicker.saveFile(options),
      listFiles() {
        const fs = ctx.state.fs;
        if (!fs) return [];
        return fs.listFilesSync().map(normalizePath).filter(path =>
          path && path !== '.editor' && !path.startsWith('.editor/') &&
          path !== '.git' && !path.startsWith('.git/')
        );
      },
      exists(path) {
        return !!ctx.state.fs?.existsSync(normalizePath(path));
      },
      readFile(path) {
        const fs = ctx.state.fs;
        if (!fs) throw new Error('The Editor workspace is not ready.');
        const value = fs.readFileSync(normalizePath(path), 'binary');
        if (value == null) throw new Error('File not found: ' + path);
        return value instanceof Uint8Array ? value : new Uint8Array(value);
      },
      readText(path) {
        const fs = ctx.state.fs;
        if (!fs) throw new Error('The Editor workspace is not ready.');
        return fs.readFileSync(normalizePath(path), 'utf8');
      },
      mime(path) {
        return ctx.mime(normalizePath(path));
      },
      writeFile(path, bytes) {
        const fs = ctx.state.fs;
        if (!fs) throw new Error('The Editor workspace is not ready.');
        if (ctx.state.projectOwner === false) throw new Error('This workspace is read-only.');
        const normalized = normalizePath(path);
        if (!normalized) throw new Error('A workspace path is required.');
        const parent = normalized.includes('/') ? normalized.slice(0, normalized.lastIndexOf('/')) : '';
        if (parent) fs.mkdirSync(parent);
        const value = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
        fs.writeFileSync(normalized, value);
        ctx.markDirty(normalized);
        ctx.updateStatus();
        try { ctx.state.fileManager?.refresh?.(); } catch (_) {}
        return true;
      }
    };

    let activeFrame = null;
    let bridgeReadyHandler = null;

    function renderBlockbench(group) {
      pickerContainer = group.viewBody;
      // Builtin instances are cached by EditorApp. Re-register the bridge each
      // time the user opens a fresh Blockbench tab after closing the previous one.
      window.__WKBlockbenchBridges[bridgeId] = bridge;
      const frame = document.createElement('iframe');
      activeFrame = frame;
      frame.className = 'builtin-blockbench-frame';
      frame.title = 'Blockbench';
      const url = new URL('editor/previews/vendor/blockbench/index.html', location.href);
      url.searchParams.set('wk_editor_bridge', bridgeId);
      const bridgeUrl = new URL('editor/previews/blockbench-bridge.js', location.href);
      bridgeUrl.searchParams.set('wk_editor_bridge', bridgeId);
      const injectedDocuments = new WeakSet();

      // Ignore the iframe's initial about:blank document. Keep listening for
      // load events and inject only into the actual Blockbench page.
      frame.addEventListener('load', () => {
        try {
          const childWindow = frame.contentWindow;
          const childDocument = frame.contentDocument;
          if (!childWindow || !childDocument?.head) return;
          if (childWindow.location.origin !== location.origin || childWindow.location.pathname !== url.pathname) return;
          if (injectedDocuments.has(childDocument)) return;
          injectedDocuments.add(childDocument);

          const script = childDocument.createElement('script');
          script.src = bridgeUrl.href;
          script.onload = () => console.info('Blockbench workspace bridge script loaded.');
          script.onerror = () => console.error('Could not load the Blockbench workspace bridge:', bridgeUrl.href);
          childDocument.head.appendChild(script);
        } catch (error) {
          console.error('Could not inject the Blockbench workspace bridge:', error);
        }
      });

      bridgeReadyHandler = event => {
        if (
          event.source !== frame.contentWindow ||
          event.origin !== location.origin ||
          !['wk-blockbench-bridge-ready', 'wk-blockbench-bridge-error'].includes(event.data?.type) ||
          event.data?.bridgeId !== bridgeId
        ) return;
        if (event.data.type === 'wk-blockbench-bridge-ready') {
          console.info('Blockbench workspace integration connected.');
        } else {
          console.error('Blockbench workspace bridge could not connect to the Editor workspace.');
        }
      };
      window.addEventListener('message', bridgeReadyHandler);

      frame.allow = 'clipboard-read; clipboard-write';
      frame.src = url.href;
      frame.referrerPolicy = 'same-origin';
      frame.style.cssText = 'display:block;width:100%;height:100%;min-height:0;border:0;background:#121418;';
      group.viewBody.appendChild(frame);
      return frame;
    }

    function dispose(tab) {
      pickerContainer = null;
      const view = tab?._viewElement;
      const frame = view?.tagName === 'IFRAME' ? view : view?.querySelector?.('iframe');
      if (bridgeReadyHandler) window.removeEventListener('message', bridgeReadyHandler);
      bridgeReadyHandler = null;
      try { frame?.removeAttribute('src'); } catch (_) {}
      try { frame?.remove(); } catch (_) {}
      if (activeFrame === frame) activeFrame = null;
      try { delete window.__WKBlockbenchBridges?.[bridgeId]; } catch (_) {}
    }

    return {
      title: 'Blockbench',
      icon: '<img src="editor/previews/vendor/blockbench/assets/logo_cutout.svg" alt="" style="width:18px;height:18px;object-fit:contain;vertical-align:middle;">',
      render: renderBlockbench,
      dispose
    };
  };
})();