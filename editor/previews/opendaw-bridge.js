(() => {
  const params = new URLSearchParams(location.search);
  const bridgeId = params.get('wk_editor_bridge');
  const parentOrigin = params.get('wk_editor_parent_origin');
  let port = null;
  let requestId = 0;
  const pending = new Map();
  let resolvePort;
  const portReady = new Promise(resolve => { resolvePort = resolve; });

  function showIsolationRequired() {
    const show = () => {
      const panel = document.createElement('section');
      panel.style.cssText = 'box-sizing:border-box;position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:28px;background:#101214;color:#e6e9ed;text-align:center;font:13px/1.55 system-ui,sans-serif;';
      const heading = document.createElement('h2');
      heading.textContent = 'openDAW needs per-frame isolation';
      heading.style.cssText = 'margin:0;font-size:18px;font-weight:650;';
      const message = document.createElement('p');
      message.textContent = 'This browser does not support the Document Isolation Policy required by openDAW. The rest of the Editor remains available.';
      message.style.cssText = 'max-width:560px;margin:0;color:#aab2bc;';
      panel.append(heading, message);
      document.body.appendChild(panel);
    };
    if (document.body) show();
    else document.addEventListener('DOMContentLoaded', show, {once:true});
  }

  if (!bridgeId || !parentOrigin || window.parent === window) return;
  try { if (new URL(parentOrigin).origin !== parentOrigin) return; }
  catch (_) { return; }

  if (!window.crossOriginIsolated) {
    window.parent.postMessage({type:'wk-opendaw-unavailable', bridgeId}, parentOrigin);
    showIsolationRequired();
    return;
  }

  const onPort = event => {
    if (event.source !== window.parent || event.origin !== parentOrigin ||
        event.data?.type !== 'wk-opendaw-port' || event.data?.bridgeId !== bridgeId ||
        event.ports?.length !== 1) return;
    window.removeEventListener('message', onPort);
    port = event.ports[0];
    port.addEventListener('message', messageEvent => {
      const message = messageEvent.data;
      if (message?.type !== 'wk-opendaw-result') return;
      const task = pending.get(message.id);
      if (!task) return;
      pending.delete(message.id);
      if (message.ok) task.resolve(message.result);
      else task.reject(new Error(message.error || 'The Editor workspace request failed.'));
    });
    port.start();
    resolvePort(port);
  };
  window.addEventListener('message', onPort);
  window.parent.postMessage({type:'wk-opendaw-connect', bridgeId}, parentOrigin);

  function request(method, ...args) {
    return portReady.then(activePort => new Promise((resolve, reject) => {
      const id = ++requestId, transfer = [];
      if (method === 'writeFile') {
        if (args[1] instanceof Uint8Array) {
          const bytes = args[1].slice();
          args[1] = bytes.buffer;
          transfer.push(bytes.buffer);
        } else if (args[1] instanceof ArrayBuffer) {
          args[1] = args[1].slice(0);
          transfer.push(args[1]);
        }
      }
      pending.set(id, {resolve, reject});
      activePort.postMessage({type:'wk-opendaw-request', id, method, args}, transfer);
    }));
  }

  const bridge = {
    listFiles:() => request('listFiles'),
    exists:path => request('exists', path),
    readFile:path => request('readFile', path),
    mime:path => request('mime', path),
    writeFile:(path, bytes) => request('writeFile', path, bytes)
  };

  const normalize = value => {
    const parts = [];
    for (const part of String(value || '').replace(/\\/g, '/').split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') { parts.pop(); continue; }
      parts.push(part);
    }
    return parts.join('/');
  };
  const basename = path => normalize(path).split('/').pop() || '';
  const extension = path => {
    const name = basename(path), index = name.lastIndexOf('.');
    return index < 0 ? '' : name.slice(index + 1).toLowerCase();
  };
  const toBytes = async value => {
    if (value instanceof Uint8Array) return new Uint8Array(value);
    if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
    if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
    if (typeof value === 'string') return new TextEncoder().encode(value);
    if (value && typeof value === 'object' && 'data' in value) return toBytes(value.data);
    return new Uint8Array(value || []);
  };
  const abortError = () => new DOMException('The user aborted the request.', 'AbortError');
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

  function makeFile(entry) {
    const file = new File([entry.bytes], entry.name, {type:entry.type || 'application/octet-stream'});
    if (entry.path) Object.defineProperties(file, {
      __wkWorkspacePath:{value:normalize(entry.path), configurable:true},
      customRelativePath:{value:normalize(entry.path), configurable:true}
    });
    return file;
  }
  function pickerOptions(options = {}, multiple) {
    return {
      title:options.title || 'Open in openDAW',
      multiple:multiple === undefined ? options.multiple === true : multiple,
      types:options.types || [],
      extensions:options.extensions || [],
      accept:options.accept || '',
      allowDevice:true
    };
  }

  Object.defineProperty(window, 'showOpenFilePicker', {
    configurable:true,
    writable:true,
    value:async options => {
      const results = await request('pickFiles', pickerOptions(options || {}));
      return (results || []).map(entry => {
        const file = makeFile(entry);
        return {name:file.name,kind:'file',getFile:async() => file};
      });
    }
  });

  HTMLInputElement.prototype.click = function () {
    if (this.type !== 'file') return nativeInputClick.call(this);
    const input = this;
    void request('pickFiles', pickerOptions({
      title:input.getAttribute('data-wk-picker-title') || 'Open in openDAW',
      accept:input.accept || '',
      multiple:!!input.multiple
    })).then(entries => {
      if (!entries?.length) return;
      const transfer = new DataTransfer();
      for (const entry of entries) transfer.items.add(makeFile(entry));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', {bubbles:true}));
    }).catch(error => console.error('openDAW shared file picker failed:', error));
  };

  Object.defineProperty(window, 'showSaveFilePicker', {
    configurable:true,
    writable:true,
    value:async options => {
      const settings = options || {};
      const path = await request('pickSavePath', {
        title:'Save from openDAW',
        suggestedName:String(settings.suggestedName || 'untitled'),
        types:settings.types || [],
        extensions:settings.extensions || [],
        accept:settings.accept || ''
      });
      if (!path) throw abortError();
      const name = basename(path);
      return {
        kind:'file',
        name,
        async createWritable() {
          let bytes = new Uint8Array(0), position = 0, aborted = false;
          return {
            async truncate(size = 0) {
              const length = Math.max(0, Number(size) || 0), next = new Uint8Array(length);
              next.set(bytes.subarray(0, length));
              bytes = next;
              position = Math.min(position, length);
            },
            async seek(offset) { position = Math.max(0, Number(offset) || 0); },
            async write(chunk) {
              if (aborted) throw new Error('The file writer was aborted.');
              if (chunk && typeof chunk === 'object' && chunk.type === 'seek') {
                position = Math.max(0, Number(chunk.position) || 0);
                return;
              }
              if (chunk && typeof chunk === 'object' && chunk.type === 'truncate') {
                return this.truncate(chunk.size);
              }
              const data = await toBytes(chunk && typeof chunk === 'object' && chunk.type === 'write' ? chunk.data : chunk);
              const end = position + data.length;
              if (end > bytes.length) {
                const next = new Uint8Array(end);
                next.set(bytes);
                bytes = next;
              }
              bytes.set(data, position);
              position = end;
            },
            async close() {
              if (aborted) throw new Error('The file writer was aborted.');
              await bridge.writeFile(path, bytes);
            },
            async abort() { aborted = true; bytes = new Uint8Array(0); }
          };
        },
        async getFile() {
          const [bytes, mime] = await Promise.all([bridge.readFile(path), bridge.mime(path)]);
          return new File([bytes], name, {type:mime || 'application/octet-stream'});
        }
      };
    }
  });

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
    void blobPromise.then(async blob => {
      const path = await request('pickSavePath', {
        title:'Save from openDAW',
        suggestedName:anchor.download || 'untitled'
      });
      if (!path) return;
      await bridge.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    }).catch(error => console.error('openDAW shared save dialog failed:', error));
  };

  window.__WKOpenDAWWorkspace = {
    listFiles:() => bridge.listFiles(),
    readFile:path => bridge.readFile(path),
    writeFile:(path, bytes) => bridge.writeFile(path, bytes)
  };
  console.info('openDAW is connected to the Editor workspace and shared file picker.');
})();