(function () {
  const factories = window.EditorBuiltinFactories = window.EditorBuiltinFactories || {};
  const OPENDAW_URL = 'https://opendaw.studio/';

  function showIsolationFallback(group) {
    const panel = document.createElement('section');
    panel.className = 'builtin-opendaw-fallback';
    panel.style.cssText = 'box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;width:100%;height:100%;min-height:0;padding:28px;background:#101214;color:#e6e9ed;text-align:center;font:13px/1.55 system-ui,sans-serif;';
    const heading = document.createElement('h2');
    heading.textContent = 'openDAW needs cross-origin isolation';
    heading.style.cssText = 'margin:0;font-size:18px;font-weight:650;';
    const message = document.createElement('p');
    message.textContent = 'This Editor page was not opened with the isolation headers required for SharedArrayBuffer and the audio engine. OpenDAW can still run in its own tab.';
    message.style.cssText = 'max-width:520px;margin:0;color:#aab2bc;';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Open openDAW in a new tab';
    button.style.cssText = 'padding:9px 14px;border:1px solid #53616d;border-radius:4px;background:#27313a;color:#fff;font:inherit;cursor:pointer;';
    button.addEventListener('click', () => window.open(OPENDAW_URL, '_blank', 'noopener,noreferrer'));
    panel.append(heading, message, button);
    group.viewBody.appendChild(panel);
    return panel;
  }

  factories.opendaw = function () {
    function renderOpenDAW(group) {
      if (!window.crossOriginIsolated) return showIsolationFallback(group);

      const frame = document.createElement('iframe');
      frame.className = 'builtin-opendaw-frame';
      frame.title = 'openDAW Studio';
      frame.src = OPENDAW_URL;
      frame.allow = 'cross-origin-isolated; autoplay; microphone; clipboard-read; clipboard-write';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.style.cssText = 'display:block;width:100%;height:100%;min-height:0;border:0;background:#17191b;';
      group.viewBody.appendChild(frame);
      return frame;
    }

    function dispose(tab) {
      const view = tab?._viewElement;
      const frame = view?.tagName === 'IFRAME' ? view : view?.querySelector?.('iframe');
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
