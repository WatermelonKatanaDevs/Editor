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
  const nativeCreateObjectURL = URL.createObjectURL.bind(URL);
  const nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL);
  const downloadBlobs = new Map();
  URL.createObjectURL = blob => {
    const url = nativeCreateObjectURL(blob);
    if (blob instanceof Blob) downloadBlobs.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = url => {
    downloadBlobs.delete(String(url));
    return nativeRevokeObjectURL(url);
  };


  function dispatchFiles(input, files) {
    if (!files?.length) return;
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
    }).then(files => {
      if (!files?.length) {
        input.dispatchEvent(new Event('cancel'));
        return;
      }
      dispatchFiles(input, files);
    }).catch(error => {
      if (error?.name === 'AbortError') input.dispatchEvent(new Event('cancel'));
      else console.error('PhotoCraft shared file picker failed:', error);
    });
  };

  HTMLAnchorElement.prototype.click = function () {
    if (!this.download || !String(this.href).startsWith('blob:')) {
      return nativeAnchorClick.call(this);
    }
    const anchor = this;
    const storedBlob = downloadBlobs.get(anchor.href);
    const blobPromise = storedBlob
      ? Promise.resolve(storedBlob)
      : fetch(anchor.href).then(response => {
          if (!response.ok) throw new Error('Could not read the exported file (' + response.status + ').');
          return response.blob();
        });
    void blobPromise.then(blob => {
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