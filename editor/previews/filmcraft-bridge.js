(() => {
  if (window.__WKFilmCraftPickerBridgeInstalled) return;
  window.__WKFilmCraftPickerBridgeInstalled = true;

  const id = new URLSearchParams(location.search).get('wk_editor_bridge');
  const api = id && window.parent?.__WKFilmCraftBridges?.[id];
  if (!api) {
    console.error('FilmCraft shared picker bridge could not connect to the Editor.');
    return;
  }

  const MAX_OPEN_BYTES = 512 * 1024 * 1024;
  const nativeInputClick = HTMLInputElement.prototype.click;

  async function choose(options = {}) {
    const files = await api.pickFiles({
      title:options.title || 'Open in FilmCraft',
      accept:options.accept || '',
      extensions:options.extensions || [],
      types:options.types || [],
      multiple:options.multiple === true,
      allowDevice:true,
      maxFileBytes:MAX_OPEN_BYTES
    });
    await api.openFiles(files || []);
    return [];
  }

  Object.defineProperty(window, 'showOpenFilePicker', {
    configurable:true,
    writable:true,
    value:async options => choose(options || {})
  });

  HTMLInputElement.prototype.click = function () {
    if (this.type !== 'file') return nativeInputClick.call(this);
    const input = this;
    void choose({
      title:input.getAttribute('data-wk-picker-title') || 'Open in FilmCraft',
      accept:input.accept || '',
      multiple:!!input.multiple
    }).catch(error => console.error('FilmCraft shared file picker failed:', error));
  };

  window.__WKFilmCraftPickerReady = true;
  console.info('FilmCraft internal file dialogs now use the shared Editor workspace picker.');
})();