(function () {
  const factories = window.EditorBuiltinFactories = window.EditorBuiltinFactories || {};
  const APP_PATH = 'editor/previews/vendor/opendaw/';
  const BRIDGE_KEY = '__WKOpenDAWBridges';

  function normalizePath(value) {
    const parts = [];
    for (const part of String(value || '').replace(/\\/g, '/').split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') { parts.pop(); continue; }
      parts.push(part);
    }
    return parts.join('/');
  }

  function showIsolationFallback(group) {
    const panel = document.createElement('section');
    panel.style.cssText = 'box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;width:100%;height:100%;min-height:0;padding:28px;background:#101214;color:#e6e9ed;text-align:center;font:13px/1.55 system-ui,sans-serif;';
    const heading = document.createElement('h2');
    heading.textContent = 'openDAW needs an isolated Editor page';
    heading.style.cssText = 'margin:0;font-size:18px;font-weight:650;';
    const message = document.createElement('p');
    message.textContent = 'The local studio requires cross-origin isolation for its audio engine. Open the Editor from its normal /editor page so the required security headers are applied.';
    message.style.cssText = 'max-width:560px;margin:0;color:#aab2bc;';
    panel.append(heading, message);
    group.viewBody.appendChild(panel);
    return panel;
  }

  factories.opendaw = function (ctx) {
    const bridgeId = 'wk-opendaw-' + (window.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)));
    window[BRIDGE_KEY] = window[BRIDGE_KEY] || Object.create(null);

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
      mime(path) {
        return ctx.mime(normalizePath(path)) || 'application/octet-stream';
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

    function renderOpenDAW(group) {
      if (!window.crossOriginIsolated) return showIsolationFallback(group);
      window[BRIDGE_KEY][bridgeId] = bridge;

      const frame = document.createElement('iframe');
      frame.className = 'builtin-opendaw-frame';
      frame.title = 'openDAW Studio';
      const url = new URL(APP_PATH, location.href);
      url.searchParams.set('wk_editor_bridge', bridgeId);
      frame.allow = 'cross-origin-isolated; autoplay; microphone; midi; clipboard-read; clipboard-write';
      frame.referrerPolicy = 'same-origin';
      frame.style.cssText = 'display:block;width:100%;height:100%;min-height:0;border:0;background:#17191b;';
      frame.addEventListener('load', () => {
        try {
          const script = frame.contentDocument.createElement('script');
          const bridgeUrl = new URL('editor/previews/opendaw-bridge.js', location.href);
          bridgeUrl.searchParams.set('wk_editor_bridge', bridgeId);
          script.src = bridgeUrl.href;
          script.onerror = () => console.error('Could not load the openDAW workspace bridge.');
          frame.contentDocument.head.appendChild(script);
        } catch (error) {
          console.error('Could not inject the openDAW workspace bridge:', error);
        }
      });
      frame.src = url.href;
      group.viewBody.appendChild(frame);
      return frame;
    }

    function dispose(tab) {
      const view = tab?._viewElement;
      const frame = view?.tagName === 'IFRAME' ? view : view?.querySelector?.('iframe');
      try { frame?.removeAttribute('src'); } catch (_) {}
      try { frame?.remove(); } catch (_) {}
      try { delete window[BRIDGE_KEY]?.[bridgeId]; } catch (_) {}
    }

    return {
      title: 'openDAW Studio',
      icon: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 14V10a8 8 0 0 1 16 0v4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><rect x="3" y="12" width="4" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="17" y="12" width="4" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M19 19c-1 2-3 2-5 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      render: renderOpenDAW,
      dispose
    };
  };
})();
