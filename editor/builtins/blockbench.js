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
    const bridgeId = 'wk-blockbench-' + (window.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)));
    window.__WKBlockbenchBridges = window.__WKBlockbenchBridges || Object.create(null);

    const bridge = {
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

    function renderBlockbench(group) {
      // Builtin instances are cached by EditorApp. Re-register the bridge each
      // time the user opens a fresh Blockbench tab after closing the previous one.
      window.__WKBlockbenchBridges[bridgeId] = bridge;
      const frame = document.createElement('iframe');
      frame.className = 'builtin-blockbench-frame';
      frame.title = 'Blockbench';
      const url = new URL('editor/previews/vendor/blockbench/index.html', location.href);
      url.searchParams.set('wk_editor_bridge', bridgeId);
      frame.src = url.href;
      frame.allow = 'clipboard-read; clipboard-write';
      frame.referrerPolicy = 'same-origin';
      frame.style.cssText = 'display:block;width:100%;height:100%;min-height:0;border:0;background:#121418;';
      group.viewBody.appendChild(frame);
      return frame;
    }

    function dispose(tab) {
      const view = tab?._viewElement;
      const frame = view?.tagName === 'IFRAME' ? view : view?.querySelector?.('iframe');
      try { frame?.removeAttribute('src'); } catch (_) {}
      try { frame?.remove(); } catch (_) {}
      try { delete window.__WKBlockbenchBridges?.[bridgeId]; } catch (_) {}
    }

    return {
      title: 'Blockbench',
      icon: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m12 2 8.5 5v10L12 22l-8.5-5V7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="m3.8 7.2 8.2 4.9 8.2-4.9M12 12.1V22M8 4.4l8.2 4.9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
      render: renderBlockbench,
      dispose
    };
  };
})();