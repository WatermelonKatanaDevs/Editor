(() => {
  const bridgeId = new URLSearchParams(location.search).get('wk_editor_bridge');
  let bridge = null;
  try {
    if (bridgeId && window.parent !== window) bridge = window.parent.__WKOpenDAWBridges?.[bridgeId] || null;
  } catch (_) {}
  if (!bridge) {
    console.warn('openDAW workspace bridge was not found.');
    return;
  }

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
  const dirname = path => {
    const value = normalize(path);
    const index = value.lastIndexOf('/');
    return index < 0 ? '' : value.slice(0, index);
  };
  const extension = path => {
    const name = basename(path);
    const index = name.lastIndexOf('.');
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
  const acceptedExtensions = options => {
    const result = new Set();
    for (const type of options?.types || []) {
      for (const values of Object.values(type?.accept || {})) {
        for (const value of values || []) {
          const normalized = String(value).replace(/^\./, '').toLowerCase();
          if (normalized && normalized !== '*') result.add(normalized);
        }
      }
    }
    return result;
  };
  const allowed = (path, extensions) => !extensions.size || extensions.has(extension(path));
  const makeFile = async path => {
    const file = new File([bridge.readFile(path)], basename(path), {type:bridge.mime(path) || 'application/octet-stream'});
    Object.defineProperty(file, '__wkWorkspacePath', {value:normalize(path), configurable:true});
    return file;
  };

  function styleButton(button) {
    button.style.cssText = 'border:1px solid #596168;background:#30363a;color:#fff;border-radius:5px;padding:7px 11px;cursor:pointer;font:inherit;';
  }

  function openPicker(options = {}) {
    return new Promise((resolve, reject) => {
      const multiple = options.multiple === true;
      const extensions = acceptedExtensions(options);
      const allFiles = (bridge.listFiles() || []).map(normalize).filter(Boolean);
      const selected = new Set();
      let currentDir = '';
      let finished = false;

      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.72);font:13px/1.45 system-ui,sans-serif;color:#e8edf0;';
      const panel = document.createElement('section');
      panel.style.cssText = 'display:flex;flex-direction:column;width:min(720px,96vw);max-height:88vh;overflow:hidden;background:#202326;border:1px solid #485057;border-radius:9px;box-shadow:0 18px 70px #000b;';
      overlay.appendChild(panel);

      const header = document.createElement('header');
      header.textContent = 'Open from Editor Workspace';
      header.style.cssText = 'padding:15px 17px;border-bottom:1px solid #3b4146;font-size:15px;font-weight:650;';
      panel.appendChild(header);

      const toolbar = document.createElement('div');
      toolbar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #353b40;';
      const up = document.createElement('button');
      up.textContent = '↑ Up';
      styleButton(up);
      const pathLabel = document.createElement('div');
      pathLabel.style.cssText = 'flex:1;min-width:0;color:#aeb6bd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      const search = document.createElement('input');
      search.type = 'search';
      search.placeholder = 'Filter files';
      search.style.cssText = 'width:190px;max-width:32%;min-width:100px;background:#15181a;color:#eee;border:1px solid #50585e;border-radius:5px;padding:7px 9px;';
      toolbar.append(up, pathLabel, search);
      panel.appendChild(toolbar);

      const list = document.createElement('div');
      list.style.cssText = 'overflow:auto;min-height:190px;max-height:54vh;padding:7px 9px;';
      panel.appendChild(list);
      const status = document.createElement('div');
      status.style.cssText = 'min-height:18px;padding:2px 14px 8px;color:#aeb6bd;font-size:12px;';
      panel.appendChild(status);

      const footer = document.createElement('footer');
      footer.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 13px;border-top:1px solid #3b4146;background:#1b1e20;';
      const deviceButton = document.createElement('button');
      deviceButton.textContent = 'From this device…';
      styleButton(deviceButton);
      const deviceInput = document.createElement('input');
      deviceInput.type = 'file';
      deviceInput.hidden = true;
      deviceInput.multiple = multiple;
      const accept = [...extensions].map(value => '.' + value).join(',');
      if (accept) deviceInput.accept = accept;
      const right = document.createElement('div');
      right.style.cssText = 'display:flex;gap:8px;';
      const cancel = document.createElement('button');
      cancel.textContent = 'Cancel';
      styleButton(cancel);
      const confirm = document.createElement('button');
      confirm.textContent = multiple ? 'Open selected' : 'Open';
      styleButton(confirm);
      confirm.style.borderColor = '#00a65a';
      confirm.style.background = '#087b49';
      right.append(cancel, confirm);
      footer.append(deviceButton, deviceInput, right);
      panel.appendChild(footer);

      const finish = value => {
        if (finished) return;
        finished = true;
        overlay.remove();
        value === undefined ? reject(abortError()) : resolve(value);
      };
      const render = () => {
        list.replaceChildren();
        const query = search.value.trim().toLowerCase();
        pathLabel.textContent = currentDir ? '/' + currentDir : '/';
        up.disabled = !currentDir;
        up.style.opacity = currentDir ? '1' : '.4';
        const prefix = currentDir ? currentDir + '/' : '';
        const directories = new Set();
        const files = [];
        for (const path of allFiles) {
          if (!path.startsWith(prefix)) continue;
          const relative = path.slice(prefix.length);
          if (!relative) continue;
          const slash = relative.indexOf('/');
          if (slash >= 0) directories.add(relative.slice(0, slash));
          else if (allowed(path, extensions)) files.push(path);
        }
        const rows = [
          ...[...directories].sort((a,b)=>a.localeCompare(b)).map(name=>({type:'folder',name})),
          ...files.sort((a,b)=>a.localeCompare(b)).map(path=>({type:'file',name:basename(path),path}))
        ].filter(row=>row.name.toLowerCase().includes(query));
        if (!rows.length) {
          const empty = document.createElement('div');
          empty.textContent = query ? 'No matching files.' : 'This folder is empty.';
          empty.style.cssText = 'padding:28px 10px;text-align:center;color:#89939b;';
          list.appendChild(empty);
        }
        for (const row of rows) {
          const item = document.createElement('button');
          item.type = 'button';
          item.textContent = (row.type === 'folder' ? '▸  ' : '♫  ') + row.name;
          item.style.cssText = 'display:block;width:100%;padding:8px 10px;text-align:left;border:0;border-radius:4px;background:' + (row.path && selected.has(row.path) ? '#28523f' : 'transparent') + ';color:' + (row.type === 'folder' ? '#c8d9ce' : '#e5e9ec') + ';cursor:pointer;font:inherit;';
          item.addEventListener('click', () => {
            if (row.type === 'folder') {
              currentDir = normalize(prefix + row.name);
              selected.clear();
            } else if (multiple && selected.has(row.path)) {
              selected.delete(row.path);
            } else {
              if (!multiple) selected.clear();
              selected.add(row.path);
            }
            render();
          });
          item.addEventListener('dblclick', () => {
            if (row.type === 'file') finish([row.path]);
          });
          list.appendChild(item);
        }
        confirm.disabled = selected.size === 0;
        confirm.style.opacity = confirm.disabled ? '.45' : '1';
        status.textContent = selected.size ? selected.size + ' file(s) selected' : '';
      };

      up.addEventListener('click', () => {
        currentDir = dirname(currentDir);
        selected.clear();
        render();
      });
      search.addEventListener('input', render);
      cancel.addEventListener('click', () => finish(undefined));
      overlay.addEventListener('mousedown', event => {if (event.target === overlay) finish(undefined);});
      confirm.addEventListener('click', () => finish([...selected]));
      deviceButton.addEventListener('click', () => deviceInput.click());
      deviceInput.addEventListener('change', () => {
        const files = [...(deviceInput.files || [])];
        if (files.length) finish(files);
      });
      const onKey = event => {
        if (finished) {
          document.removeEventListener('keydown', onKey);
          return;
        }
        if (event.key === 'Escape') {
          document.removeEventListener('keydown', onKey);
          finish(undefined);
        }
      };
      document.addEventListener('keydown', onKey);
      document.body.appendChild(overlay);
      render();
    });
  }

  Object.defineProperty(window, 'showOpenFilePicker', {
    configurable:true,
    writable:true,
    value:async options => {
      const results = await openPicker(options || {});
      return results.map(value => value instanceof File
        ? {name:value.name,kind:'file',getFile:async()=>value}
        : {name:basename(value),kind:'file',getFile:()=>makeFile(value)});
    }
  });

  Object.defineProperty(window, 'showSaveFilePicker', {
    configurable:true,
    writable:true,
    value:async options => {
      const suggestedName = String(options?.suggestedName || 'untitled').trim() || 'untitled';
      const extensions = acceptedExtensions(options);
      const allFiles = (bridge.listFiles() || []).map(normalize).filter(Boolean);
      const dirs = new Set(['']);
      for (const path of allFiles) {
        const parts = path.split('/');
        for (let i=1;i<parts.length;i++) dirs.add(parts.slice(0,i).join('/'));
      }
      const path = await new Promise((resolve,reject) => {
        let currentDir = '';
        let closed = false;
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.72);font:13px/1.45 system-ui,sans-serif;color:#e8edf0;';
        const panel = document.createElement('section');
        panel.style.cssText = 'display:flex;flex-direction:column;width:min(600px,96vw);max-height:88vh;overflow:hidden;background:#202326;border:1px solid #485057;border-radius:9px;box-shadow:0 18px 70px #000b;';
        overlay.appendChild(panel);
        const header = document.createElement('header');
        header.textContent = 'Save to Editor Workspace';
        header.style.cssText = 'padding:15px 17px;border-bottom:1px solid #3b4146;font-size:15px;font-weight:650;';
        panel.appendChild(header);
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #353b40;';
        const up = document.createElement('button');
        up.textContent = '↑ Up';
        styleButton(up);
        const pathLabel = document.createElement('div');
        pathLabel.style.cssText = 'flex:1;min-width:0;color:#aeb6bd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        toolbar.append(up,pathLabel);
        panel.appendChild(toolbar);
        const list = document.createElement('div');
        list.style.cssText = 'overflow:auto;min-height:90px;max-height:34vh;padding:7px 9px;';
        panel.appendChild(list);
        const nameWrap = document.createElement('label');
        nameWrap.textContent = 'File name';
        nameWrap.style.cssText = 'display:flex;gap:12px;align-items:center;padding:10px 14px;color:#aeb6bd;';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = suggestedName;
        nameInput.style.cssText = 'flex:1;min-width:0;background:#15181a;color:#eee;border:1px solid #50585e;border-radius:5px;padding:8px 10px;font:inherit;';
        nameWrap.appendChild(nameInput);
        panel.appendChild(nameWrap);
        const status = document.createElement('div');
        status.style.cssText = 'min-height:16px;padding:0 14px 8px;color:#e2b98c;font-size:12px;';
        panel.appendChild(status);
        const footer = document.createElement('footer');
        footer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;padding:11px 13px;border-top:1px solid #3b4146;background:#1b1e20;';
        const cancel = document.createElement('button');
        cancel.textContent = 'Cancel';
        styleButton(cancel);
        const save = document.createElement('button');
        save.textContent = 'Save';
        styleButton(save);
        save.style.borderColor = '#00a65a';
        save.style.background = '#087b49';
        footer.append(cancel,save);
        panel.appendChild(footer);
        const finish = value => {
          if (closed) return;
          closed = true;
          overlay.remove();
          value ? resolve(value) : reject(abortError());
        };
        const render = () => {
          pathLabel.textContent = currentDir ? '/' + currentDir : '/';
          up.disabled = !currentDir;
          list.replaceChildren();
          const prefix = currentDir ? currentDir + '/' : '';
          const children = new Set();
          for (const dir of dirs) {
            if (!dir || dir === currentDir || !dir.startsWith(prefix)) continue;
            const rest = dir.slice(prefix.length);
            if (rest && !rest.includes('/')) children.add(rest);
          }
          for (const name of [...children].sort((a,b)=>a.localeCompare(b))) {
            const item = document.createElement('button');
            item.textContent = '▸  ' + name;
            item.style.cssText = 'display:block;width:100%;padding:8px 10px;text-align:left;border:0;border-radius:4px;background:transparent;color:#c8d9ce;cursor:pointer;font:inherit;';
            item.addEventListener('click',()=>{currentDir=normalize(prefix+name);render();});
            list.appendChild(item);
          }
        };
        up.addEventListener('click',()=>{currentDir=dirname(currentDir);render();});
        cancel.addEventListener('click',()=>finish(null));
        overlay.addEventListener('mousedown',event=>{if(event.target===overlay)finish(null);});
        save.addEventListener('click',()=>{
          const name=nameInput.value.trim();
          if (!name || name==='.' || name==='..' || /[\\/]/.test(name)) {
            nameInput.focus();
            return;
          }
          if (extensions.size) {
            const ext=name.includes('.')?name.split('.').pop().toLowerCase():'';
            if (!extensions.has(ext)) {
              const first=[...extensions][0];
              status.textContent='Choose a supported type: '+[...extensions].join(', ');
              if (first && !name.includes('.')) nameInput.value=name+'.'+first;
              return;
            }
          }
          finish(normalize(currentDir?currentDir+'/'+name:name));
        });
        const onKey=event=>{
          if(closed){document.removeEventListener('keydown',onKey);return;}
          if(event.key==='Escape'){document.removeEventListener('keydown',onKey);finish(null);}
          else if(event.key==='Enter'){event.preventDefault();save.click();}
        };
        document.addEventListener('keydown',onKey);
        document.body.appendChild(overlay);
        render();
        nameInput.focus();
        nameInput.select();
      });

      if (bridge.exists(path) && !window.confirm('"' + path + '" already exists. Replace it?')) throw abortError();
      return {
        kind:'file',
        name:basename(path),
        async createWritable() {
          let bytes=new Uint8Array(0);
          let position=0;
          let aborted=false;
          return {
            async truncate(size=0) {
              const length=Math.max(0,Number(size)||0);
              const next=new Uint8Array(length);
              next.set(bytes.subarray(0,length));
              bytes=next;
              position=Math.min(position,length);
            },
            async seek(offset) {position=Math.max(0,Number(offset)||0);},
            async write(chunk) {
              if(aborted) throw new Error('The file writer was aborted.');
              if(chunk && typeof chunk==='object' && chunk.type==='seek') {position=Math.max(0,Number(chunk.position)||0);return;}
              if(chunk && typeof chunk==='object' && chunk.type==='truncate') {return this.truncate(chunk.size);}
              const data=await toBytes(chunk && typeof chunk==='object' && chunk.type==='write'?chunk.data:chunk);
              const end=position+data.length;
              if(end>bytes.length){const next=new Uint8Array(end);next.set(bytes);bytes=next;}
              bytes.set(data,position);
              position=end;
            },
            async close() {
              if(aborted) throw new Error('The file writer was aborted.');
              bridge.writeFile(path,bytes);
            },
            async abort() {aborted=true;bytes=new Uint8Array(0);}
          };
        },
        async getFile() {
          return new File([bridge.readFile(path)],basename(path),{type:bridge.mime(path)});
        }
      };
    }
  });

  window.__WKOpenDAWWorkspace = {
    listFiles:() => bridge.listFiles(),
    readFile:path => bridge.readFile(path),
    writeFile:(path,bytes) => bridge.writeFile(path,bytes)
  };
    console.info('openDAW is connected to the Editor workspace file system.');
})();
