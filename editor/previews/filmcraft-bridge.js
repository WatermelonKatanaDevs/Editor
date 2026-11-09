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
    const entries = await api.pickFiles({
      title:options.title || 'Open in FilmCraft',
      accept:options.accept || '',
      extensions:options.extensions || [],
      types:options.types || [],
      multiple:options.multiple === true,
      allowDevice:true,
      maxFileBytes:MAX_OPEN_BYTES
    });
    const handles = [];
    for (const entry of entries || []) {
      if (/\.fcproj$/i.test(entry.name || '')) {
        await api.openProjectFile(entry);
        continue;
      }
      const file = new File([entry.bytes], entry.name, {type:entry.type || 'application/octet-stream'});
      if (entry.path) Object.defineProperties(file, {
        __wkWorkspacePath:{value:entry.path, configurable:true},
        customRelativePath:{value:entry.path, configurable:true}
      });
      handles.push({name:file.name,kind:'file',getFile:async() => file});
    }
    return handles;
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
    }).then(handles => {
      const files = (handles || []).map(handle => {
        let file = null;
        return handle.getFile().then(value => (file = value));
      });
      return Promise.all(files);
    }).then(files => {
      if (!files.length) return;
      const transfer = new DataTransfer();
      for (const file of files) transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', {bubbles:true}));
    }).catch(error => console.error('FilmCraft shared file picker failed:', error));
  };

  window.__WKFilmCraftPickerReady = true;
  console.info('FilmCraft internal file dialogs now use the shared Editor workspace picker.');
})();