(function () {
  const factories = window.EditorBuiltinFactories = window.EditorBuiltinFactories || {};
  const APP_PATH = 'editor/previews/vendor/soundcraft/';
  const KEY = '__WKSoundCraftBridges';

  function normalizePath(value) {
    const parts = [];
    for (const part of String(value || '').replace(/\\/g, '/').split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') { parts.pop(); continue; }
      parts.push(part);
    }
    return parts.join('/');
  }

  factories.soundcraft = function (ctx) {
    const id = 'wk-soundcraft-' + (window.crypto?.randomUUID?.() ||
      Date.now().toString(36) + Math.random().toString(36).slice(2));
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
    window[KEY] = window[KEY] || Object.create(null);

    const bridge = {
      listFiles() {
        return (ctx.state.fs?.listFilesSync?.() || []).map(normalizePath)
          .filter(path => path && path !== '.editor' && !path.startsWith('.editor/') &&
            path !== '.git' && !path.startsWith('.git/'));
      },
      pickFiles:options => workspacePicker.open(options),
      saveFile:options => workspacePicker.saveFile(options),
      savePath:options => workspacePicker.savePath(options),
      readFile(path) {
        const fs = ctx.state.fs;
        if (!fs) throw new Error('The Editor workspace is not ready.');
        const value = fs.readFileSync(normalizePath(path), 'binary');
        if (value == null) throw new Error('File not found: ' + path);
        return value instanceof Uint8Array ? value : new Uint8Array(value);
      },
      writeFile(path, bytes) {
        const fs = ctx.state.fs;
        if (!fs) throw new Error('The Editor workspace is not ready.');
        if (ctx.state.projectOwner === false) throw new Error('This workspace is read-only.');
        const normalized = normalizePath(path);
        if (!normalized) throw new Error('A workspace path is required.');
        const parent = normalized.includes('/') ? normalized.slice(0, normalized.lastIndexOf('/')) : '';
        if (parent && !fs.existsSync(parent)) fs.mkdirSync(parent);
        fs.writeFileSync(normalized, bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []));
        ctx.markDirty(normalized);
        ctx.updateStatus();
        try { ctx.state.fileManager?.refresh?.(); } catch (_) {}
        return true;
      }
    };

    function render(group) {
      window[KEY][id] = bridge;
      const frame = document.createElement('iframe');
      frame.className = 'builtin-soundcraft-frame';
      frame.title = 'SoundCraft DAW';
      frame.allow = 'autoplay; clipboard-read; clipboard-write';
      frame.referrerPolicy = 'same-origin';
      frame.style.cssText = 'display:block;width:100%;height:100%;min-height:0;border:0;background:#262626;';
      const url = new URL(APP_PATH, location.href);
      url.searchParams.set('wk_editor_bridge', id);
      frame.src = url.href;
      group.viewBody.append(frame);
      return frame;
    }

    function dispose(tab) {
      const view = tab?._viewElement;
      const frame = view?.tagName === 'IFRAME' ? view : view?.querySelector?.('iframe');
      try { frame?.removeAttribute('src'); frame?.remove(); } catch (_) {}
      try { workspacePicker.cancelActive(); } catch (_) {}
      try { delete window[KEY]?.[id]; } catch (_) {}
    }

    return {title:'SoundCraft DAW',icon:"<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3 10h3l2-5 4 14 3-9 2 4h4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",render,dispose};
  };
})();