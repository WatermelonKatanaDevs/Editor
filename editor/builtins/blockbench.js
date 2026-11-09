(function () {
  const factories = window.EditorBuiltinFactories = window.EditorBuiltinFactories || {};

  factories.blockbench = function () {
    return {
      title: 'Blockbench',
      icon: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m12 2 9 5v10l-9 5-9-5V7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="m3.5 7.2 8.5 5 8.5-5M12 22V12.2M7.5 4.5l9 5.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
      render(group) {
        group.viewBody.innerHTML = '';
        const root = document.createElement('div');
        root.className = 'builtin-blockbench';
        root.style.cssText = 'position:relative;width:100%;height:100%;min-height:0;display:flex;flex-direction:column;background:#121418;overflow:hidden;';
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'height:36px;flex:0 0 36px;display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:0 10px;background:#202328;border-bottom:1px solid #34383f;box-sizing:border-box;';
        const status = document.createElement('span');
        status.textContent = 'Blockbench · Web';
        status.style.cssText = 'margin-right:auto;color:#aeb4bd;font-size:12px;';
        const reload = document.createElement('button');
        reload.type = 'button';
        reload.textContent = 'Reload';
        reload.style.cssText = 'padding:4px 10px;border:1px solid #454b54;border-radius:4px;background:#292e35;color:#e7eaf0;cursor:pointer;';
        const fullscreen = document.createElement('button');
        fullscreen.type = 'button';
        fullscreen.textContent = 'Fullscreen';
        fullscreen.style.cssText = reload.style.cssText;
        const frame = document.createElement('iframe');
        frame.title = 'Blockbench 3D Model Editor';
        frame.allow = 'clipboard-read; clipboard-write';
        frame.referrerPolicy = 'same-origin';
        frame.style.cssText = 'width:100%;height:100%;min-height:0;flex:1;border:0;background:#121418;';
        frame.src = new URL('vendor/blockbench/index.html', window.location.href).href;
        reload.addEventListener('click', () => frame.contentWindow?.location.reload());
        fullscreen.addEventListener('click', () => {
          if (document.fullscreenElement === root) {
            document.exitFullscreen?.();
          } else {
            root.requestFullscreen?.();
          }
        });
        root.append(toolbar, frame);
        toolbar.append(status, reload, fullscreen);
        group.viewBody.appendChild(root);
      }
    };
  };
})();
