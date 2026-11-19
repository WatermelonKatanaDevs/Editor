(function () {
  const factories = window.EditorBuiltinFactories = window.EditorBuiltinFactories || {};
  factories['ai-asset-studio'] = function (ctx) {
    let page, provider, providerId = 'pixel-sprite', busy = false, abortController = null;
    let modelSelect, loadButton, settingsButton, promptInput, negativeInput, negativeWrap, nameInput;
    let configContainer, results, progressText, progressPercent, progressBar, status, errorBox, emptyState;
    let configFields = [], settingsModal = null, contextMenu = null;
    const assets = [];
    const urls = new Set();
    let imageCount = 1;
    const promptState = { positive:'', negative:'', name:'sprite' };

    const style = [
      '.ai-asset-studio-page{position:absolute;inset:0;display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--editor-surface-2);color:var(--editor-text-secondary);font:12px sans-serif}',
      '.ais-main{flex:1;min-height:0;overflow:auto;padding:14px 16px 24px;display:flex;flex-direction:column;gap:12px}',
      '.ais-section{min-width:0;border:1px solid var(--editor-border);background:#1b1b1b;padding:11px;border-radius:3px}',
      '.ais-section-title{font-size:11px;color:#ccc;font-weight:600;margin:0 0 9px}',
      '.ais-prompt-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:9px}',
      '.ais-field{display:flex;flex-direction:column;gap:5px;min-width:0;color:#999;font-size:10px}',
      '.ais-field input,.ais-field textarea,.ais-field select{width:100%;min-width:0;box-sizing:border-box;background:var(--editor-bg);color:var(--editor-text-secondary);border:1px solid #3a3a3a;border-radius:3px;padding:7px 8px;font:11px/1.4 sans-serif;outline:none}',
      '.ais-field textarea{min-height:66px;resize:vertical}.ais-field input:focus,.ais-field textarea:focus,.ais-field select:focus{border-color:#5a89b5}',
      '.ais-name-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,260px);gap:9px;margin-top:9px}',
      '.ais-settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0 12px}',
      '.ais-config-field{display:flex;flex-direction:column;gap:5px;padding:8px 0;border-top:1px solid #292929;color:#999;font-size:10px;min-width:0}',
      '.ais-config-field input,.ais-config-field select{width:100%;min-width:0;box-sizing:border-box;background:var(--editor-bg);color:var(--editor-text-secondary);border:1px solid #3a3a3a;border-radius:3px;padding:6px 7px;font:11px sans-serif;outline:none}',
      '.ais-config-field input:focus,.ais-config-field select:focus{border-color:#5a89b5}.ais-config-field input[type=range]{padding:0;accent-color:#3794ff}',
      '.ais-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.ais-toolbar button,.ais-image-menu button{background:#292929;color:#bbb;border:1px solid #414141;border-radius:2px;padding:5px 9px;font:10px sans-serif;cursor:pointer}.ais-toolbar button:hover,.ais-image-menu button:hover{background:#343434;color:var(--editor-text)}.ais-toolbar button.primary{background:var(--editor-accent);border-color:var(--editor-accent-strong);color:#fff}.ais-toolbar button:disabled{opacity:.4;cursor:default}',
      '.ais-load-state{margin-left:auto;color:#888;font:10px monospace}',
      '.ai-head-actions button[data-load]{width:auto;height:27px;padding:0 9px;font-size:10px;white-space:nowrap}',
      '.ais-progress{height:5px;background:#252525;border:1px solid #383838;border-radius:3px;overflow:hidden;margin-top:9px}.ais-progress i{display:block;width:0;height:100%;background:var(--editor-accent);transition:width .12s}',
      '.ais-progress-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:5px;color:#888;font:10px monospace}.ais-progress-percent{color:#bbb}',
      '.ais-status{margin-top:5px;color:#888;font:10px monospace;overflow-wrap:anywhere}.ais-error{margin-top:8px;color:#e18c8c;font-size:10px;white-space:pre-wrap;overflow-wrap:anywhere}',
      '.ais-gallery-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}.ais-gallery-head strong{font-size:11px;font-weight:600;color:#ccc}.ais-gallery-count{color:#777;font:10px monospace}',
      '.ais-results{display:grid;grid-template-columns:repeat(auto-fill,minmax(116px,1fr));gap:8px}',
      '.ais-image-card{min-width:0;padding:6px;border:1px solid #303030;background:#1c1c1c;border-radius:3px;cursor:grab;user-select:none}.ais-image-card:hover,.ais-image-card.selected{border-color:#527493;background:#202a33}.ais-image-card img{display:block;width:100%;aspect-ratio:1;object-fit:contain;image-rendering:pixelated;background-color:#292929;background-image:linear-gradient(45deg,#383838 25%,transparent 25%),linear-gradient(-45deg,#383838 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#383838 75%),linear-gradient(-45deg,transparent 75%,#383838 75%);background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0;pointer-events:none}',
      '.ais-image-name{display:block;margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#aaa;font:10px monospace}',
      '.ais-empty{padding:35px 12px;text-align:center;color:#777;border:1px dashed #383838;font-size:11px}',
      '.ais-image-menu{position:fixed;z-index:2147483000;min-width:150px;padding:3px;background:var(--editor-surface,#222);border:1px solid var(--editor-border-strong,#444);box-shadow:0 4px 14px #0009;border-radius:3px}.ais-image-menu button{display:block;width:100%;border:0;text-align:left;padding:7px 9px;background:transparent;font-size:11px}.ais-image-menu button:hover{background:var(--editor-hover)}',
      '.ais-settings-content{width:min(650px,calc(100vw - 30px));max-height:min(720px,calc(100vh - 30px));overflow:auto}.ais-model-list{display:flex;flex-direction:column;gap:4px}.ais-model-row{display:flex;align-items:center;gap:7px;padding:8px;background:#1c1c1c;border:1px solid #303030;border-radius:3px}.ais-model-row.active{border-color:#4a6f91;background:#222b34}.ais-model-main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}.ais-model-main strong{font-size:11px;font-weight:500;color:#ddd}.ais-model-main span{font:9px monospace;color:#777;overflow-wrap:anywhere}.ais-model-row button,.ais-settings-tabs button{background:#2a2a2a;color:#bbb;border:1px solid #414141;padding:5px 8px;border-radius:2px;cursor:pointer;font-size:10px}.ais-settings-tabs{display:flex;gap:4px;margin:10px 0 12px;border-bottom:1px solid var(--editor-border);padding-bottom:5px}.ais-settings-tabs button.active{background:#2b3b49;color:var(--editor-text);border-color:#527493}.ais-cache-list{display:flex;flex-direction:column;gap:5px}.ais-cache-row{padding:8px;background:#1c1c1c;border:1px solid #303030;border-radius:3px}.ais-cache-row strong{display:block;color:#ccc;font-size:10px}.ais-cache-row span{display:block;margin-top:3px;color:#777;font:9px monospace;overflow-wrap:anywhere}.ais-cache-row button{margin-top:6px;background:#292929;color:#c99;border:1px solid #493b3b;padding:4px 7px;font-size:9px;cursor:pointer}.ais-settings-note{color:#777;font-size:10px;line-height:1.45;margin:8px 0}',
      '@media(max-width:650px){.ais-main{padding:9px}.ais-prompt-grid{grid-template-columns:1fr}.ais-name-row{grid-template-columns:1fr}.ais-header-title{display:none}}'
    ].join('');

    function addStyle() {
      if (document.getElementById('ais-styles')) return;
      const el = document.createElement('style'); el.id = 'ais-styles'; el.textContent = style; document.head.appendChild(el);
    }
    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }
    function cleanName(value) {
      const name = String(value || 'sprite').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'-').replace(/^-+|-+$/g,'');
      return (name || 'sprite').replace(/\.png$/i,'');
    }
    function fileName(index) {
      const base = cleanName(nameInput?.value || promptState.name);
      return base + (imageCount > 1 ? '-' + (index + 1) : '') + '.png';
    }
    function setProgress(info) {
      const raw = info?.progress, n = raw == null || raw === '' ? NaN : Number(raw);
      const percent = Number.isFinite(n) ? Math.round(Math.max(0,Math.min(1,n))*100) : null;
      progressBar.style.width = percent == null ? '0%' : percent + '%';
      progressPercent.textContent = percent == null ? '' : percent + '%';
      progressText.textContent = info?.message || 'Working…';
    }
    function showError(error) {
      errorBox.textContent = error?.stack || error?.message || String(error);
      errorBox.hidden = false;
    }
    function clearError() { errorBox.textContent = ''; errorBox.hidden = true; }
    function updateModelState() {
      const loaded = !!provider?.initialized;
      loadButton.textContent = loaded ? 'Loaded' : 'Load model';
      loadButton.disabled = busy || loaded;
      generateButton.disabled = busy || !loaded;
      generateButton.textContent = abortController ? 'Stop' : 'Generate';
      if (modelSelect) modelSelect.disabled = busy;
      const info = window.StudioAI.listProviders('image').find(item => item.id === providerId);
      loadButton.title = loaded ? 'Model is ready' : 'Load ' + (info?.name || providerId);
      document.querySelectorAll('.ais-model-row').forEach(row => row.classList.toggle('active', row.dataset.model === providerId));
    }
    async function prepareProvider(id) {
      id = String(id || providerId);
      if (provider && providerId === id) return provider;
      if (provider) { await provider.dispose(); provider = null; }
      providerId = id;
      if (id === 'pixel-sprite') {
        const mod = await import('../studio-ai/providers/pixel-sprite/provider.js');
        mod.registerPixelSpriteProvider(window.StudioAI);
      }
      provider = window.StudioAI.createImageProvider(id);
      buildConfiguration();
      updatePromptCapabilities();
      return provider;
    }
    function updatePromptCapabilities() {
      const caps = provider?.getCapabilities?.() || {};
      negativeWrap.hidden = !caps.negativePrompt;
      negativeInput.disabled = !caps.negativePrompt;
      if (!caps.negativePrompt) negativeInput.value = '';
    }
    function buildConfiguration() {
      configContainer.replaceChildren();
      configFields = [];
      const schema = provider?.getConfigurationSchema?.() || {};
      for (const field of schema.fields || []) {
        const wrap = document.createElement('label'); wrap.className = 'ais-config-field'; wrap.dataset.key = field.key;
        const title = document.createElement('span'); title.textContent = field.label || field.key;
        let input;
        if (field.type === 'select') {
          input = document.createElement('select');
          for (const option of field.options || []) {
            const opt = document.createElement('option'); opt.value = String(option.value); opt.textContent = option.label ?? String(option.value); input.append(opt);
          }
        } else {
          input = document.createElement('input'); input.type = field.type === 'range' ? 'range' : 'number';
          if (field.min != null) input.min = field.min;
          if (field.max != null) input.max = field.max;
          if (field.step != null) input.step = field.step;
        }
        input.value = String(field.default ?? '');
        input.addEventListener('input', () => {
          if (field.type === 'range') title.textContent = (field.label || field.key) + ' · ' + input.value;
          updateConfigurationVisibility();
        });
        wrap.append(title,input); wrap._input = input; wrap._schema = field;
        configFields.push(wrap); configContainer.append(wrap);
      }
      updateConfigurationVisibility();
    }
    function updateConfigurationVisibility() {
      const config = readConfiguration();
      for (const wrap of configFields) {
        const rule = wrap._schema.visibleWhen;
        wrap.hidden = !!rule && config[rule.key] !== rule.equals;
      }
    }
    function readConfiguration() {
      const result = {};
      for (const wrap of configFields) {
        const field = wrap._schema, raw = wrap._input.value;
        result[field.key] = field.type === 'number' || field.type === 'range' ? Number(raw) : raw;
      }
      return result;
    }
    async function loadModel() {
      clearError(); busy = true; updateModelState();
      status.textContent = 'Loading model…'; setProgress({message:'Starting model load',progress:null});
      try {
        await prepareProvider(providerId);
        const result = await provider.initialize({configuration:readConfiguration(),onProgress:setProgress});
        status.textContent = 'Ready · ' + String(result?.backend || 'local').toUpperCase() + ' · cached in this browser';
        progressBar.style.width = '100%'; progressPercent.textContent = '100%';
        progressText.textContent = 'Model ready';
      } catch (error) {
        showError(error); status.textContent = 'Model could not be loaded';
      } finally { busy = false; updateModelState(); }
    }
    function releaseUrls() {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    }
    function clearResults() {
      releaseUrls(); assets.length = 0; results.replaceChildren(); results.append(emptyState);
      updateGalleryCount();
    }
    function updateGalleryCount() {
      const count = assets.length;
      const label = page.querySelector('[data-gallery-count]');
      const completed = assets.filter(Boolean).length;
      if (label) label.textContent = completed + ' image' + (completed === 1 ? '' : 's');
    }
    function createFile(asset,index) {
      return new File([asset.blob],fileName(index),{type:'image/png',lastModified:Date.now()});
    }
    async function saveAs(asset,index) {
      const name = fileName(index);
      if (typeof window.showSaveFilePicker === 'function') {
        const handle = await window.showSaveFilePicker({
          suggestedName:name,
          types:[{description:'PNG image',accept:{'image/png':['.png']}}]
        });
        const writable = await handle.createWritable();
        await writable.write(asset.blob);
        await writable.close();
        status.textContent = 'Saved ' + handle.name;
      } else {
        const url = URL.createObjectURL(asset.blob), a = document.createElement('a');
        a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url),1000);
        status.textContent = 'Saving ' + name;
      }
    }
    function closeContextMenu() {
      contextMenu?.remove(); contextMenu = null;
      document.removeEventListener('pointerdown', closeContextMenuOutside, true);
      document.removeEventListener('keydown', contextMenuKey);
    }
    function closeContextMenuOutside(event) {
      if (contextMenu && !contextMenu.contains(event.target)) closeContextMenu();
    }
    function contextMenuKey(event) { if (event.key === 'Escape') closeContextMenu(); }
    function showContextMenu(event, asset, index) {
      closeContextMenu();
      event.preventDefault();
      contextMenu = document.createElement('div'); contextMenu.className = 'ais-image-menu';
      const save = document.createElement('button'); save.textContent = 'Save As…';
      save.onclick = async () => { closeContextMenu(); try { await saveAs(asset,index); } catch (error) { if (error?.name !== 'AbortError') showError(error); } };
      contextMenu.append(save);
      document.body.append(contextMenu);
      const x = Math.min(event.clientX,window.innerWidth - 170), y = Math.min(event.clientY,window.innerHeight - 55);
      contextMenu.style.left = Math.max(4,x) + 'px'; contextMenu.style.top = Math.max(4,y) + 'px';
      setTimeout(() => document.addEventListener('pointerdown',closeContextMenuOutside,true),0);
      document.addEventListener('keydown',contextMenuKey);
    }
    function renderAsset(asset,index) {
      assets[index] = asset;
      if (emptyState?.parentNode) emptyState.remove();
      let card = results.querySelector('[data-image-index="' + index + '"]');
      if (card) {
        const oldUrl = card.dataset.url; if (oldUrl) { URL.revokeObjectURL(oldUrl); urls.delete(oldUrl); }
      } else {
        card = document.createElement('article'); card.className = 'ais-image-card'; card.dataset.imageIndex = String(index);
        card.draggable = true;
        const image = document.createElement('img'); image.alt = 'Generated pixel art image'; card.append(image);
        const label = document.createElement('span'); label.className = 'ais-image-name'; card.append(label);
        card.addEventListener('click',() => {
          results.querySelectorAll('.ais-image-card').forEach(item => item.classList.toggle('selected',item === card));
        });
        card.addEventListener('contextmenu',event => showContextMenu(event,asset,index));
        card.addEventListener('dragstart',event => {
          const file = createFile(asset,index);
          const token = window.__editorFileDropBridge?.register?.(file);
          if (token) event.dataTransfer.setData('application/x-wk-editor-files',token);
          event.dataTransfer.setData('text/plain',file.name);
          event.dataTransfer.effectAllowed = 'copy';
        });
        results.append(card);
      }
      const url = URL.createObjectURL(asset.blob); urls.add(url); card.dataset.url = url;
      card.querySelector('img').src = url;
      card.querySelector('.ais-image-name').textContent = fileName(index);
      card.title = 'Drag into the project file explorer or right-click to Save As';
      updateGalleryCount();
    }
    function resetGeneratedImages() {
      clearResults();
    }
    function generate() {
      if (abortController) { abortController.abort(); return; }
      clearError();
      const prompt = promptInput.value.trim();
      if (!prompt) { promptInput.focus(); return; }
      promptState.positive = prompt;
      promptState.negative = negativeInput.value.trim();
      promptState.name = nameInput.value;
      abortController = new AbortController(); busy = true; updateModelState();
      clearResults();
      status.textContent = 'Generating…'; progressText.textContent = 'Preparing prompt…';
      progressPercent.textContent = ''; progressBar.style.width = '0%';
      const selectedProvider = provider;
      const parameters = readConfiguration();
      imageCount = Math.max(1,Number(parameters.count)||1);
      if (provider?.getCapabilities?.().negativePrompt) parameters.negativePrompt = promptState.negative;
      selectedProvider.generateImage({
        prompt,
        negativePrompt:promptState.negative,
        name:cleanName(promptState.name),
        parameters,
        onAsset:renderAsset,
        onResetAssets:resetGeneratedImages
      },{signal:abortController.signal,onProgress:setProgress}).then(result => {
        const seconds = Math.max(Number(result?.metadata?.elapsedMs || 0)/1000,0.001);
        status.textContent = 'Finished · ' + result.assets.length + ' images · ' + seconds.toFixed(1) + 's · ' + String(result.metadata?.backend || 'local').toUpperCase();
        progressText.textContent = 'Complete'; progressPercent.textContent = '100%'; progressBar.style.width = '100%';
      }).catch(error => {
        if (error?.name === 'AbortError') status.textContent = 'Generation stopped';
        else { showError(error); status.textContent = 'Generation failed'; }
      }).finally(() => {
        abortController = null; busy = false; generateButton.textContent = 'Generate'; updateModelState();
      });
    }
    function setBusyUi() {
      loadButton.disabled = busy || !!provider?.initialized;
      generateButton.disabled = busy || !provider?.initialized;
      generateButton.textContent = abortController ? 'Stop' : 'Generate';
      modelSelect.disabled = busy;
    }
    async function openSettings() {
      try { await prepareProvider(providerId); }
      catch (error) { showError(error); return; }
      if (settingsModal) { settingsModal.remove(); settingsModal = null; }
      const modal = document.createElement('div'); modal.className = 'editor-modal ai-settings-modal';
      settingsModal = modal;
      modal.innerHTML = '<div class="editor-modal-content ais-settings-content"><button class="editor-modal-close" aria-label="Close">×</button><h2>Studio AI Settings</h2><p>Available image models and browser-cached model files.</p><div class="ais-settings-tabs"><button class="active" data-tab="models">Models</button><button data-tab="cache">Cached models</button></div><section data-panel="models"><div class="ai-section-title">Available models</div><div class="ais-model-list" data-model-list></div><p class="ais-settings-note">Models are currently provided by local StudioAI integrations. Remote model APIs can be added through the provider registry later.</p></section><section data-panel="cache" hidden><div class="ai-section-title">Browser model &amp; runtime cache</div><div class="ais-toolbar" style="margin-bottom:8px"><button data-refresh-cache>Refresh</button></div><div class="ais-cache-list" data-cache-list>Reading browser caches…</div><p class="ais-settings-note">Deleting a cache removes its stored downloads. Runtime assets may be downloaded again when needed.</p></section></div>';
      document.body.append(modal);
      const close = () => { modal.remove(); if (settingsModal === modal) settingsModal = null; };
      modal.querySelector('.editor-modal-close').onclick = close;
      modal.onclick = event => { if (event.target === modal) close(); };
      const models = window.StudioAI.listProviders('image');
      const list = modal.querySelector('[data-model-list]');
      list.innerHTML = models.map(item => '<div class="ais-model-row ' + (item.id === providerId ? 'active' : '') + '" data-model="' + escapeHtml(item.id) + '"><div class="ais-model-main"><strong>' + escapeHtml(item.name) + '</strong><span>' + escapeHtml(item.description || item.id) + ' · ' + escapeHtml(item.type) + '</span></div><button data-use="' + escapeHtml(item.id) + '">' + (item.id === providerId ? 'Selected' : 'Select') + '</button></div>').join('') || '<div class="ai-settings-note-inline">No image models are registered.</div>';
      list.querySelectorAll('[data-use]').forEach(button => button.onclick = async () => {
        const id = button.dataset.use;
        try { await prepareProvider(id); modelSelect.value = id; updateModelState(); close(); status.textContent = 'Selected ' + provider.name; }
        catch (error) { showError(error); }
      });
      const tabs = [...modal.querySelectorAll('[data-tab]')], panels = [...modal.querySelectorAll('[data-panel]')];
      tabs.forEach(tab => tab.onclick = () => {
        tabs.forEach(item => item.classList.toggle('active',item === tab));
        panels.forEach(panel => panel.hidden = panel.dataset.panel !== tab.dataset.tab);
        if (tab.dataset.tab === 'cache') refreshCache();
      });
      modal.querySelector('[data-refresh-cache]').onclick = refreshCache;
      async function refreshCache() {
        const cacheList = modal.querySelector('[data-cache-list]');
        cacheList.textContent = 'Reading browser caches…';
        try {
          const names = (await caches.keys()).filter(name => name.startsWith('studio-ai-'));
          if (!names.length) { cacheList.textContent = 'No StudioAI model caches found.'; return; }
          cacheList.replaceChildren();
          for (const cacheName of names) {
            const cache = await caches.open(cacheName), keys = await cache.keys();
            let bytes = 0;
            for (const request of keys) {
              const response = await cache.match(request);
              bytes += Number(response?.headers?.get('content-length')) || 0;
            }
            const row = document.createElement('div'); row.className = 'ais-cache-row';
            const title = document.createElement('strong'); title.textContent = cacheName;
            const detail = document.createElement('span'); detail.textContent = keys.length + ' cached files · ' + (bytes ? (bytes/1048576).toFixed(1) + ' MB reported' : 'size unavailable');
            const remove = document.createElement('button'); remove.textContent = 'Delete cache';
            remove.onclick = async () => {
              if (!confirm('Delete browser cache "' + cacheName + '"?')) return;
              await caches.delete(cacheName); await refreshCache();
            };
            row.append(title,detail,remove); cacheList.append(row);
          }
        } catch (error) { cacheList.textContent = 'Could not inspect browser caches: ' + (error?.message || String(error)); }
      }
      requestAnimationFrame(() => modal.classList.add('show'));
    }
    function render(group) {
      addStyle();
      page = document.createElement('div'); page.className = 'ai-asset-studio-page builtin-ai';
      page.innerHTML = '<div class="ai-panel-inner"><header class="ai-header"><div class="ai-header-left"><strong class="ais-header-title">AI Asset Studio</strong><select class="ai-chat-select" data-model-select title="Select image model"></select></div><div class="ai-header-right"><div class="ai-head-actions"><button data-load title="Load model">Load model</button><button data-settings title="Studio AI Settings" aria-label="Studio AI Settings">⚙</button></div></div></header><main class="ais-main"><section class="ais-section"><div class="ais-section-title">Prompt</div><div class="ais-prompt-grid"><label class="ais-field">Positive prompt<textarea data-positive placeholder="A tiny red dragon with cream horns and a curled tail" maxlength="200"></textarea></label><label class="ais-field" data-negative-wrap>Negative prompt<textarea data-negative placeholder="Things to avoid…" maxlength="200"></textarea></label></div><div class="ais-name-row"><label class="ais-field">Image name<input data-image-name type="text" value="sprite" placeholder="sprite"></label><div class="ais-toolbar" style="align-self:end"><button class="primary" data-generate disabled>Generate</button><span class="ais-load-state" data-status>Model not loaded</span></div></div><div class="ais-progress"><i data-progress-bar></i></div><div class="ais-progress-meta"><span data-progress-text>Load a model to begin.</span><span class="ais-progress-percent" data-progress-percent></span></div><div class="ais-error" data-error hidden></div></section><section class="ais-section"><div class="ais-section-title">Settings</div><div class="ais-settings-grid" data-config></div></section><section class="ais-section"><div class="ais-gallery-head"><strong>Generated images</strong><span class="ais-gallery-count" data-gallery-count>0 images</span></div><div class="ais-results" data-results><div class="ais-empty">Generated images will appear here. Drag an image into the project explorer or right-click it to Save As.</div></div></section></main></div>';
      group.viewBody.append(page);
      modelSelect = page.querySelector('[data-model-select]');
      loadButton = page.querySelector('[data-load]');
      settingsButton = page.querySelector('[data-settings]');
      promptInput = page.querySelector('[data-positive]');
      negativeInput = page.querySelector('[data-negative]');
      negativeWrap = page.querySelector('[data-negative-wrap]');
      nameInput = page.querySelector('[data-image-name]');
      configContainer = page.querySelector('[data-config]');
      results = page.querySelector('[data-results]');
      emptyState = results.querySelector('.ais-empty');
      progressText = page.querySelector('[data-progress-text]');
      progressPercent = page.querySelector('[data-progress-percent]');
      progressBar = page.querySelector('[data-progress-bar]');
      status = page.querySelector('[data-status]');
      errorBox = page.querySelector('[data-error]');
      const providers = window.StudioAI.listProviders('image');
      if (!window.StudioAI.providers.has('pixel-sprite')) {
        import('../studio-ai/providers/pixel-sprite/provider.js').then(mod => {
          mod.registerPixelSpriteProvider(window.StudioAI);
          populateModels();
          prepareProvider(providerId).catch(showError);
        }).catch(showError);
      } else {
        populateModels();
        prepareProvider(providerId).catch(showError);
      }
      function populateModels() {
        const items = window.StudioAI.listProviders('image');
        modelSelect.replaceChildren();
        for (const item of items) {
          const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; modelSelect.append(option);
        }
        if (!items.some(item => item.id === providerId)) providerId = items[0]?.id || '';
        modelSelect.value = providerId;
      }
      modelSelect.onchange = async () => {
        try {
          busy = true; updateModelState();
          await prepareProvider(modelSelect.value);
          status.textContent = 'Selected ' + provider.name + ' · load to begin';
        } catch (error) { showError(error); }
        finally { busy = false; updateModelState(); }
      };
      loadButton.onclick = loadModel;
      settingsButton.onclick = openSettings;
      page.querySelector('[data-generate]').onclick = generate;
      generateButton = page.querySelector('[data-generate]');
      promptInput.value = promptState.positive;
      negativeInput.value = promptState.negative;
      nameInput.value = promptState.name;
      promptInput.addEventListener('input',() => promptState.positive = promptInput.value);
      negativeInput.addEventListener('input',() => promptState.negative = negativeInput.value);
      nameInput.addEventListener('input',() => { promptState.name = nameInput.value; results.querySelectorAll('.ais-image-card').forEach((card,index) => card.querySelector('.ais-image-name').textContent = fileName(index)); });
      page.querySelectorAll('button').forEach(button => button.addEventListener('click',() => { if (button.dataset.generate !== undefined || button.dataset.load !== undefined) setBusyUi(); }));
      window.addEventListener('beforeunload',releaseUrls,{once:true});
    }
    return {
      title:'AI Asset Studio',
      icon:'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v16H4zM8 8h8v8H8z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2 9V2h7M15 2h7v7M22 15v7h-7M9 22H2v-7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
      render(group) { render(group); },
      dispose() { abortController?.abort(); releaseUrls(); closeContextMenu(); provider?.dispose?.(); }
    };
  };
})();