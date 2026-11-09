(function () {
  const factories = window.EditorBuiltinFactories = window.EditorBuiltinFactories || {};
  const APP_PATH = 'editor/previews/vendor/opendaw/';

  function normalizePath(value) {
    const parts = [];
    for (const part of String(value || '').replace(/\\/g, '/').split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') { parts.pop(); continue; }
      parts.push(part);
    }
    return parts.join('/');
  }

  function showIsolationFallback(group, messageText) {
    const panel = document.createElement('section');
    panel.style.cssText = 'box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;width:100%;height:100%;min-height:0;padding:28px;background:#101214;color:#e6e9ed;text-align:center;font:13px/1.55 system-ui,sans-serif;';
    const heading = document.createElement('h2');
    heading.textContent = 'openDAW could not start';
    heading.style.cssText = 'margin:0;font-size:18px;font-weight:650;';
    const message = document.createElement('p');
    message.textContent = messageText || 'openDAW requires a browser that supports the Document Isolation Policy and a reachable isolation proxy.';
    message.style.cssText = 'max-width:560px;margin:0;color:#aab2bc;';
    panel.append(heading, message);
    group.viewBody.replaceChildren(panel);
    return panel;
  }

  factories.opendaw = function (ctx) {
    const bridgeId = 'wk-opendaw-' + (window.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)));
    let channel = null;
    let connected = false;
    let disposed = false;
    let frame = null;
    let connectHandler = null;

    function listFiles() {
      const fs = ctx.state.fs;
      if (!fs) return [];
      return fs.listFilesSync().map(normalizePath).filter(path =>
        path && path !== '.editor' && !path.startsWith('.editor/') &&
        path !== '.git' && !path.startsWith('.git/')
      );
    }

    function exists(path) {
      return !!ctx.state.fs?.existsSync(normalizePath(path));
    }

    function readFile(path) {
      const fs = ctx.state.fs;
      if (!fs) throw new Error('The Editor workspace is not ready.');
      const value = fs.readFileSync(normalizePath(path), 'binary');
      if (value == null) throw new Error('File not found: ' + path);
      const source = value instanceof Uint8Array ? value : new Uint8Array(value);
      const copy = new Uint8Array(source.byteLength);
      copy.set(source);
      return copy.buffer;
    }

    function mime(path) {
      return ctx.mime(normalizePath(path)) || 'application/octet-stream';
    }

    function writeFile(path, bytes) {
      const fs = ctx.state.fs;
      if (!fs) throw new Error('The Editor workspace is not ready.');
      if (ctx.state.projectOwner === false) throw new Error('This workspace is read-only.');
      const normalized = normalizePath(path);
      if (!normalized) throw new Error('A workspace path is required.');
      const parent = normalized.includes('/') ? normalized.slice(0, normalized.lastIndexOf('/')) : '';
      if (parent) fs.mkdirSync(parent);
      const value = bytes instanceof ArrayBuffer
        ? new Uint8Array(bytes)
        : bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
      fs.writeFileSync(normalized, value);
      ctx.markDirty(normalized);
      ctx.updateStatus();
      try { ctx.state.fileManager?.refresh?.(); } catch (_) {}
      return true;
    }

    async function handleWorkspaceRequest(message, port) {
      const args = Array.isArray(message.args) ? message.args : [];
      let result;
      switch (message.method) {
        case 'listFiles': result = listFiles(); break;
        case 'exists': result = exists(args[0]); break;
        case 'readFile': result = readFile(args[0]); break;
        case 'mime': result = mime(args[0]); break;
        case 'writeFile': result = writeFile(args[0], args[1]); break;
        default: throw new Error('Unsupported Editor workspace operation.');
      }
      const response = {type:'wk-opendaw-result', id:message.id, ok:true, result};
      const transfer = result instanceof ArrayBuffer ? [result] : [];
      port.postMessage(response, transfer);
    }

    function showUnsupportedBrowser() {
      if (!connected) showIsolationFallback(ctx.group || {viewBody:frame?.parentElement || document.body});
    }

    function renderOpenDAW(group) {
      frame = document.createElement('iframe');
      frame.className = 'builtin-opendaw-frame';
      frame.title = 'openDAW Studio';
      frame.allow = 'cross-origin-isolated; autoplay; microphone; midi; clipboard-read; clipboard-write';
      frame.referrerPolicy = 'no-referrer';
      frame.style.cssText = 'display:block;width:100%;height:100%;min-height:0;border:0;background:#17191b;';
      group.viewBody.appendChild(frame);

      connectHandler = event => {
        if (
          disposed ||
          event.source !== frame?.contentWindow ||
          event.origin !== frame?.dataset.proxyOrigin ||
          event.data?.bridgeId !== bridgeId
        ) return;

        if (event.data.type === 'wk-opendaw-unavailable') {
          window.removeEventListener('message', connectHandler);
          showIsolationFallback(group, 'This browser does not support the per-frame Document Isolation Policy required by openDAW. The rest of the Editor remains available.');
          return;
        }
        if (event.data.type !== 'wk-opendaw-connect' || connected) return;

        connected = true;
        window.removeEventListener('message', connectHandler);
        channel = new MessageChannel();
        channel.port1.addEventListener('message', async portEvent => {
          const message = portEvent.data;
          if (message?.type !== 'wk-opendaw-request' || !Number.isSafeInteger(message.id)) return;
          try {
            await handleWorkspaceRequest(message, channel.port1);
          } catch (error) {
            channel.port1.postMessage({
              type:'wk-opendaw-result',
              id:message.id,
              ok:false,
              error:error?.message || String(error)
            });
          }
        });
        channel.port1.start();
        frame.contentWindow.postMessage({type:'wk-opendaw-port', bridgeId}, event.origin, [channel.port2]);
      };
      window.addEventListener('message', connectHandler);

      Promise.resolve(window.__workersConfigReady).then(() => {
        if (disposed) return;
        const config = window.WorkerConfig || {};
        const isolationEndpoint = String(config.isolationProxy || '').trim();
        const source = String(config.opendawUrl || '').trim() || new URL(APP_PATH, location.href).href;
        if (!isolationEndpoint) {
          showIsolationFallback(group, 'The isolation proxy is not configured in workers.json.');
          return;
        }

        const upstreamUrl = new URL(source, location.href);
        upstreamUrl.searchParams.set('wk_editor_bridge', bridgeId);
        upstreamUrl.searchParams.set('wk_editor_parent_origin', location.origin);
        const proxyUrl = new URL(isolationEndpoint);
        proxyUrl.searchParams.set('url', upstreamUrl.href);
        frame.dataset.proxyOrigin = proxyUrl.origin;
        frame.src = proxyUrl.href;
      }).catch(error => {
        console.error('Could not configure the openDAW isolation proxy:', error);
        showIsolationFallback(group, 'The openDAW isolation proxy configuration could not be loaded.');
      });
      return frame;
    }

    function dispose(tab) {
      disposed = true;
      if (connectHandler) window.removeEventListener('message', connectHandler);
      try { channel?.port1?.close(); } catch (_) {}
      try { channel?.port2?.close(); } catch (_) {}
      const view = tab?._viewElement;
      const target = view?.tagName === 'IFRAME' ? view : view?.querySelector?.('iframe');
      try { target?.removeAttribute('src'); } catch (_) {}
      try { target?.remove(); } catch (_) {}
      try { frame?.removeAttribute('src'); } catch (_) {}
      try { frame?.remove(); } catch (_) {}
    }

    return {
      title: 'openDAW Studio',
      icon: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 14V10a8 8 0 0 1 16 0v4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><rect x="3" y="12" width="4" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="17" y="12" width="4" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M19 19c-1 2-3 2-5 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      render: renderOpenDAW,
      dispose
    };
  };
})();
