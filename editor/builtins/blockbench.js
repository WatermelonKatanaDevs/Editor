(function () {
  const factories = window.EditorBuiltinFactories = window.EditorBuiltinFactories || {};

  factories.blockbench = function () {
    function renderBlockbench(group) {
      const frame = document.createElement('iframe');
      frame.className = 'builtin-blockbench-frame';
      frame.title = 'Blockbench';
      frame.src = new URL('editor/previews/vendor/blockbench/index.html', location.href).href;
      frame.allow = 'clipboard-read; clipboard-write';
      frame.style.cssText = 'display:block;width:100%;height:100%;min-height:0;border:0;background:#121418;';
      group.viewBody.appendChild(frame);
      return frame;
    }

    function dispose(tab) {
      const frame = tab?._viewElement?.querySelector?.('iframe');
      try { frame?.removeAttribute('src'); } catch (_) {}
      try { frame?.remove(); } catch (_) {}
    }

    return {
      title: 'Blockbench',
      icon: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m12 2 8.5 5v10L12 22l-8.5-5V7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="m3.8 7.2 8.2 4.9 8.2-4.9M12 12.1V22M8 4.4l8.2 4.9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
      render: renderBlockbench,
      dispose
    };
  };
})();
