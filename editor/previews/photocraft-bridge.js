(() => {
  if (window.__WKPhotoCraftBridgeInstalled) return;
  window.__WKPhotoCraftBridgeInstalled = true;

  const id = new URLSearchParams(location.search).get('wk_editor_bridge');
  const api = id && window.parent?.__WKPhotoCraftBridges?.[id];
  if (!api) {
    console.error('PhotoCraft workspace bridge could not connect to the Editor.');
    return;
  }

  const nativeInputClick = HTMLInputElement.prototype.click;
  const nativeAnchorClick = HTMLAnchorElement.prototype.click;

  function dispatchFiles(input, files) {
    try {
      const transfer = new DataTransfer();
      for (const file of files || []) transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', {bubbles:true}));
    } catch (error) {
      console.error('PhotoCraft could not receive the selected files:', error);
    }
  }

  HTMLInputElement.prototype.click = function () {
    if (this.type !== 'file') return nativeInputClick.call(this);
    const input = this;
    void api.pickFiles({
      title:input.getAttribute('data-wk-picker-title') || 'Open in PhotoCraft',
      accept:input.accept || '',
      multiple:!!input.multiple,
      allowDevice:true
    }).then(files => dispatchFiles(input, files || []))
      .catch(error => {
        console.error('PhotoCraft shared file picker failed:', error);
        dispatchFiles(input, []);
      });
  };

  HTMLAnchorElement.prototype.click = function () {
    if (!this.download || !String(this.href).startsWith('blob:')) {
      return nativeAnchorClick.call(this);
    }
    const anchor = this;
    void fetch(anchor.href).then(response => {
      if (!response.ok) throw new Error('Could not read the exported file (' + response.status + ').');
      return response.blob();
    }).then(blob => {
      const match = /\.([^.]+)$/.exec(anchor.download || '');
      return api.saveFile({
        title:'Save from PhotoCraft',
        suggestedName:anchor.download || 'image.png',
        extensions:match ? [match[1].toLowerCase()] : [],
        bytes:blob
      });
    }).catch(error => {
      console.error('PhotoCraft shared save dialog failed:', error);
    });
  };

  window.__WKPhotoCraftWorkspaceReady = true;
  console.info('PhotoCraft is using the shared Editor workspace picker.');
})();