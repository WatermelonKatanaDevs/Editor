(function () {
  const factories = window.EditorBuiltinFactories = window.EditorBuiltinFactories || {};
  factories['ai-asset-studio'] = function (ctx) {
    let page, provider, providerId = 'pixel-sprite', busy = false, abortController = null;
    let modelSelect, loadButton, settingsButton, promptInput, negativeInput, negativeWrap, nameInput;
    let configContainer, promptGrid, results, progressText, progressPercent, progressBar, status, errorBox, emptyState;
    let configFields = [], settingsModal = null, contextMenu = null;
    let galleryButton, galleryPopover = null, galleryContent = null, galleryUrls = [];
    let addToGalleryByDefault = false, activeGeneration = null;
    const GALLERY_DIR = '.editor/gallery';
    const STUDIO_SETTINGS_PATH = '.editor/ai-asset-studio.json';
    const savedGalleryAssets = new WeakMap();
    const generatedAssetNames = new WeakMap();
    let pickerContainer = null, renameModal = null;
    const workspacePicker = window.EditorWorkspacePicker.create({
      getContainer:() => pickerContainer,
      getFs:() => ctx.state.fs,
      getMime:path => ctx.mime(path),
      canWrite:() => ctx.state.projectOwner !== false,
      onWrite:path => {
        ctx.markDirty?.(path);
        ctx.updateStatus?.();
        try { ctx.state.refreshExplorer?.(); ctx.state.fileManager?.refresh?.(); } catch (_) {}
      }
    });
    const assets = [];
    const urls = new Set();
    let imageCount = 1;
    const promptState = { positive:'', negative:'', name:'sprite' };

    const style = [
      '.ai-asset-studio-page{position:absolute;inset:0;display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--editor-surface-2);color:var(--editor-text-secondary);font:12px sans-serif}',
      '.ais-main{flex:1;min-height:0;overflow:auto;padding:0;display:flex;flex-direction:column;gap:0;width:100%;box-sizing:border-box}',
      '.ais-section{min-width:0;border:0;border-bottom:1px solid var(--editor-border);background:transparent;padding:12px 10px;border-radius:0;box-sizing:border-box}',
      '.ais-section-title{font-size:11px;color:#ccc;font-weight:600;margin:0 0 9px}',
      '.ais-prompt-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:9px}.ais-prompt-grid.single{grid-template-columns:minmax(0,1fr)}',
      '.ais-field{display:flex;flex-direction:column;gap:5px;min-width:0;color:#999;font-size:10px}.ais-field[hidden],.ais-config-field[hidden]{display:none!important}',
      '.ais-field input,.ais-field textarea,.ais-field select{width:100%;min-width:0;box-sizing:border-box;background:var(--editor-bg);color:var(--editor-text-secondary);border:1px solid #3a3a3a;border-radius:3px;padding:7px 8px;font:11px/1.4 sans-serif;outline:none}',
      '.ais-field textarea{min-height:66px;resize:vertical}.ais-field input:focus,.ais-field textarea:focus,.ais-field select:focus{border-color:#5a89b5}',
      '.ais-name-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:9px;margin-top:9px}.ais-name-row .ais-toolbar{justify-content:flex-end}.ais-name-row .ais-toolbar button{min-width:100px}',
      '.ais-settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0 12px}.ais-settings-section>summary{list-style:none;cursor:pointer;user-select:none}.ais-settings-section>summary::-webkit-details-marker{display:none}.ais-settings-section>summary::before{content:"▸";display:inline-block;width:14px;color:#888}.ais-settings-section[open]>summary::before{content:"▾"}.ais-settings-section:not([open])>summary{margin-bottom:0}',
      '.ais-config-field{display:flex;flex-direction:column;gap:5px;padding:8px 0;border-top:1px solid #292929;color:#999;font-size:10px;min-width:0}',
      '.ais-config-field input,.ais-config-field select{width:100%;min-width:0;box-sizing:border-box;background:var(--editor-bg);color:var(--editor-text-secondary);border:1px solid #3a3a3a;border-radius:3px;padding:6px 7px;font:11px sans-serif;outline:none}',
      '.ais-config-field input:focus,.ais-config-field select:focus{border-color:#5a89b5}.ais-config-field input[type=range]{padding:0;accent-color:#3794ff}',
      '.ais-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.ais-toolbar button,.ais-image-menu button{background:#292929;color:#bbb;border:1px solid #414141;border-radius:2px;padding:5px 9px;font:10px sans-serif;cursor:pointer}.ais-toolbar button:hover,.ais-image-menu button:hover{background:#343434;color:var(--editor-text)}.ais-toolbar button.primary{background:var(--editor-accent);border-color:var(--editor-accent-strong);color:#fff}.ais-toolbar button:disabled{opacity:.4;cursor:default}',
      '.ais-action-status{display:flex;justify-content:flex-end;min-height:12px;margin-top:5px;color:#888;font:10px monospace}.ais-load-state{color:#888;font:10px monospace}',
      '.ai-head-actions button[data-load]{width:auto;height:27px;padding:0 9px;font-size:10px;white-space:nowrap}',
      '.ai-asset-studio-page>.ai-panel-inner{width:100%;min-width:0;min-height:0;margin:0;padding:0;box-sizing:border-box}',
      '.ais-progress{height:5px;background:#252525;border:1px solid #383838;border-radius:3px;overflow:hidden;margin-top:9px}.ais-progress i{display:block;width:0;height:100%;background:var(--editor-accent);transition:width .12s}',
      '.ais-progress-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:5px;color:#888;font:10px monospace}.ais-progress-percent{color:#bbb}',
      '.ais-status{margin-top:5px;color:#888;font:10px monospace;overflow-wrap:anywhere}.ais-error{margin-top:8px;color:#e18c8c;font-size:10px;white-space:pre-wrap;overflow-wrap:anywhere}',
      '.ais-gallery-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}.ais-gallery-head strong{font-size:11px;font-weight:600;color:#ccc}.ais-gallery-count{color:#777;font:10px monospace}',
      '.ais-results{display:grid;grid-template-columns:repeat(auto-fill,minmax(116px,1fr));gap:8px}',
      '.ais-image-card{min-width:0;padding:6px;border:1px solid #303030;background:#1c1c1c;border-radius:3px;cursor:grab;user-select:none}.ais-image-card:hover,.ais-image-card.selected{border-color:#527493;background:#202a33}.ais-image-card img{display:block;width:100%;aspect-ratio:1;object-fit:contain;image-rendering:pixelated;background-color:#292929;background-image:linear-gradient(45deg,#383838 25%,transparent 25%),linear-gradient(-45deg,#383838 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#383838 75%),linear-gradient(-45deg,transparent 75%,#383838 75%);background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0;pointer-events:none}',
      '.ais-image-name{display:block;margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#aaa;font:10px monospace}',
      '.ais-empty{padding:35px 12px;text-align:center;color:#777;border:1px dashed #383838;font-size:11px}',
      '.ais-image-menu{position:fixed;z-index:2147483000;min-width:150px;padding:3px;background:var(--editor-surface,#222);border:1px solid var(--editor-border-strong,#444);box-shadow:0 4px 14px #0009;border-radius:3px}.ais-image-menu button{display:block;width:100%;border:0;text-align:left;padding:7px 9px;background:transparent;font-size:11px}.ais-image-menu button:hover{background:var(--editor-hover)}.ais-image-menu button:disabled{opacity:.4;cursor:default}',
      '.ais-rename-content{width:min(380px,calc(100vw - 30px));max-width:100%;padding:18px}.ais-rename-field{display:flex;flex-direction:column;gap:6px;margin:12px 0;color:#999;font-size:10px}.ais-rename-field input{width:100%;box-sizing:border-box;background:var(--editor-bg);color:var(--editor-text-secondary);border:1px solid #414141;border-radius:3px;padding:8px;font:12px sans-serif}.ais-rename-field input:focus{border-color:#5a89b5;outline:none}',
      '.ais-settings-content{width:min(650px,calc(100vw - 30px));max-height:min(720px,calc(100vh - 30px));overflow:auto}.ais-auto-gallery{display:flex;align-items:center;gap:7px;margin:8px 0 12px;color:#aaa;font-size:10px}.ais-auto-gallery input{margin:0;accent-color:#3794ff}.ais-gallery-popover{position:fixed;z-index:200001;width:min(430px,calc(100vw - 16px));max-height:min(72vh,680px);display:flex;flex-direction:column;background:var(--editor-surface,#202020);border:1px solid var(--editor-border-strong,#444);box-shadow:0 8px 28px #000a;border-radius:3px;color:var(--editor-text-secondary)}.ais-gallery-popover[hidden]{display:none}.ais-gallery-popover-head{display:flex;align-items:center;gap:8px;padding:9px 10px;border-bottom:1px solid var(--editor-border);background:var(--editor-tabs)}.ais-gallery-popover-head strong{flex:1;font-size:12px;font-weight:500;color:var(--editor-text)}.ais-gallery-popover-head span{color:#777;font:10px monospace}.ais-gallery-popover-head button{width:24px;height:23px;background:transparent;color:#999;border:0;border-radius:2px;cursor:pointer}.ais-gallery-popover-head button:hover{background:#333;color:#fff}.ais-gallery-content{padding:9px;overflow:auto;min-height:60px;flex:1;box-sizing:border-box}.ais-gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:7px}.ais-gallery-card{min-width:0;padding:5px;background:#1b1b1b;border:1px solid #333;border-radius:3px;cursor:pointer;text-align:left}.ais-gallery-card:hover{border-color:#527493;background:#222b34}.ais-gallery-card img{display:block;width:100%;aspect-ratio:1;object-fit:contain;image-rendering:pixelated;background:#292929}.ais-gallery-card span{display:block;margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#aaa;font:9px monospace}.ais-gallery-empty{padding:28px 10px;text-align:center;color:#777;font-size:11px;border:1px dashed #383838}.ais-gallery-detail-title{margin:0 0 8px;color:#ddd;font-size:12px;font-weight:500}.ais-gallery-detail-field{margin:8px 0}.ais-gallery-detail-field strong{display:block;margin-bottom:4px;color:#999;font-size:10px;font-weight:500}.ais-gallery-detail-field pre{max-height:170px;overflow:auto;margin:0;padding:7px;background:#151515;border:1px solid #303030;color:#ccc;font:10px/1.45 monospace;white-space:pre-wrap;overflow-wrap:anywhere}.ais-gallery-detail-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:10px}.ais-gallery-detail-actions button{background:#292929;color:#bbb;border:1px solid #414141;border-radius:2px;padding:6px 9px;font-size:10px;cursor:pointer}.ais-gallery-detail-actions button.primary{background:var(--editor-accent);border-color:var(--editor-accent-strong);color:#fff}.ais-gallery-detail-actions button:hover{filter:brightness(1.15)}.ais-model-list{display:flex;flex-direction:column;gap:4px}.ais-model-row{display:flex;align-items:center;gap:7px;padding:8px;background:#1c1c1c;border:1px solid #303030;border-radius:3px}.ais-model-row.active{border-color:#4a6f91;background:#222b34}.ais-model-main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}.ais-model-main strong{font-size:11px;font-weight:500;color:#ddd}.ais-model-main span{font:9px monospace;color:#777;overflow-wrap:anywhere}.ais-model-row button,.ais-settings-tabs button{background:#2a2a2a;color:#bbb;border:1px solid #414141;padding:5px 8px;border-radius:2px;cursor:pointer;font-size:10px}.ais-settings-tabs{display:flex;gap:4px;margin:10px 0 12px;border-bottom:1px solid var(--editor-border);padding-bottom:5px}.ais-settings-tabs button.active{background:#2b3b49;color:var(--editor-text);border-color:#527493}.ais-cache-list{display:flex;flex-direction:column;gap:5px}.ais-cache-row{padding:8px;background:#1c1c1c;border:1px solid #303030;border-radius:3px}.ais-cache-row strong{display:block;color:#ccc;font-size:10px}.ais-cache-row span{display:block;margin-top:3px;color:#777;font:9px monospace;overflow-wrap:anywhere}.ais-cache-row button{margin-top:6px;background:#292929;color:#c99;border:1px solid #493b3b;padding:4px 7px;font-size:9px;cursor:pointer}.ais-settings-note{color:#777;font-size:10px;line-height:1.45;margin:8px 0}',
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
    function fileName(index, asset = assets[index]) {
      const renamed = asset && generatedAssetNames.get(asset);
      if (renamed) return renamed;
      const base = cleanName(nameInput?.value || promptState.name);
      return base + (imageCount > 1 ? '-' + (index + 1) : '') + '.png';
    }
    function normalizeImageFilename(value) {
      const name = cleanName(value).replace(/\\.[^.]+$/, '');
      return (name || 'sprite') + '.png';
    }
    function closeRenameModal() {
      renameModal?._finish?.(null);
    }
    function askForRename(currentName) {
      return new Promise(resolve => {
        closeRenameModal();
        const modal = document.createElement('div');
        modal.className = 'editor-modal ai-settings-modal';
        modal.innerHTML = '<div class="editor-modal-content ais-rename-content"><button class="editor-modal-close" aria-label="Close">×</button><h2>Rename image</h2><label class="ais-rename-field">File name<input type="text" data-rename-name autocomplete="off" spellcheck="false"></label><div class="ais-gallery-detail-actions"><button type="button" data-rename-cancel>Cancel</button><button type="button" class="primary" data-rename-confirm>Rename</button></div></div>';
        const input = modal.querySelector('[data-rename-name]');
        input.value = stripPng(currentName || 'sprite');
        let finished = false;
        const finish = value => {
          if (finished) return;
          finished = true;
          modal.remove();
          if (renameModal === modal) renameModal = null;
          resolve(value);
        };
        modal._finish = finish;
        renameModal = modal;
        modal.querySelector('.editor-modal-close').onclick = () => finish(null);
        modal.querySelector('[data-rename-cancel]').onclick = () => finish(null);
        modal.querySelector('[data-rename-confirm]').onclick = () => finish(input.value);
        modal.onclick = event => { if (event.target === modal) finish(null); };
        input.addEventListener('keydown', event => {
          if (event.key === 'Enter') { event.preventDefault(); finish(input.value); }
          else if (event.key === 'Escape') { event.preventDefault(); finish(null); }
        });
        document.body.append(modal);
        requestAnimationFrame(() => { modal.classList.add('show'); input.focus(); input.select(); });
      });
    }
    function persistGalleryFilename(entry, filename) {
      const fs = ctx.state?.fs;
      if (!fs) throw new Error('No project filesystem is available.');
      if (ctx.state.projectOwner === false) throw new Error('This workspace is read-only.');
      let metadata = {};
      if (fs.existsSync(entry.jsonPath)) metadata = JSON.parse(fs.readFileSync(entry.jsonPath, 'utf8') || '{}');
      else {
        metadata = { ...entry };
        delete metadata.jsonPath;
        delete metadata.metadataError;
      }
      metadata.filename = filename;
      fs.writeFileSync(entry.jsonPath, JSON.stringify(metadata, null, 2));
      Object.assign(entry, metadata, {filename});
      ctx.markDirty?.(entry.jsonPath);
      assets.forEach((asset, index) => {
        if (asset && savedGalleryAssets.get(asset) === entry) {
          generatedAssetNames.set(asset, filename);
          const card = results?.querySelector('[data-image-index="' + index + '"]');
          const label = card?.querySelector('.ais-image-name');
          if (label) label.textContent = filename;
        }
      });
      if (galleryPopover) refreshGalleryPopover();
      status.textContent = 'Renamed gallery image · ' + filename;
    }
    async function renameGalleryImage(entry) {
      const chosen = await askForRename(entry.filename);
      if (chosen == null) return;
      persistGalleryFilename(entry, normalizeImageFilename(chosen));
    }
    async function renameGeneratedImage(asset, index) {
      if (!asset) return;
      const chosen = await askForRename(fileName(index, asset));
      if (chosen == null) return;
      const filename = normalizeImageFilename(chosen);
      const savedEntry = savedGalleryAssets.get(asset);
      if (savedEntry) persistGalleryFilename(savedEntry, filename);
      generatedAssetNames.set(asset, filename);
      const card = results?.querySelector('[data-image-index="' + index + '"]');
      const label = card?.querySelector('.ais-image-name');
      if (label) label.textContent = filename;
      status.textContent = 'Renamed generated image · ' + filename;
    }
    function hasPath(path) {
      const fs = ctx.state?.fs;
      return !!(fs?.existsSync?.(path) || fs?.isDirectorySync?.(path));
    }
    function ensureEditorDirectory() {
      const fs = ctx.state?.fs;
      if (!fs) throw new Error('No project filesystem is available.');
      if (!hasPath('.editor')) fs.mkdirSync('.editor');
    }
    function loadStudioSettings() {
      try {
        const fs = ctx.state?.fs;
        const raw = fs?.existsSync?.(STUDIO_SETTINGS_PATH) ? fs.readFileSync(STUDIO_SETTINGS_PATH, 'utf8') : null;
        const value = raw ? JSON.parse(raw) : {};
        addToGalleryByDefault = !!value.addToGalleryByDefault;
      } catch (_) { addToGalleryByDefault = false; }
    }
    function saveStudioSettings() {
      const fs = ctx.state?.fs;
      if (!fs) throw new Error('No project filesystem is available.');
      ensureEditorDirectory();
      fs.writeFileSync(STUDIO_SETTINGS_PATH, JSON.stringify({ version:1, addToGalleryByDefault }, null, 2));
      ctx.markDirty?.(STUDIO_SETTINGS_PATH);
    }
    function cloneJson(value) {
      try { return JSON.parse(JSON.stringify(value ?? null)); } catch (_) { return null; }
    }
    function makeRandomSeed() {
      try {
        const seed = new Uint32Array(1);
        window.crypto.getRandomValues(seed);
        return (seed[0] & 0x7fffffff) || 1;
      } catch (_) { return Math.floor(Math.random() * 0x7ffffffe) + 1; }
    }
    function stripPng(value) {
      const text = String(value || '');
      return text.toLowerCase().endsWith('.png') ? text.slice(0, -4) : text;
    }
    function getGalleryPaths() {
      const fs = ctx.state?.fs;
      return (fs?.listFilesSync?.() || []).map(path => {
        let value = String(path);
        while (value.startsWith('/')) value = value.slice(1);
        return value;
      }).filter(path => path.startsWith(GALLERY_DIR + '/') && path.toLowerCase().endsWith('.png')).sort().reverse();
    }
    function readGalleryEntries() {
      const fs = ctx.state?.fs;
      if (!fs) return [];
      return getGalleryPaths().map(imagePath => {
        const jsonPath = stripPng(imagePath) + '.json';
        try {
          const metadata = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8') || '{}') : {};
          return { ...metadata, imagePath, jsonPath, filename:metadata.filename || imagePath.split('/').pop() };
        } catch (_) { return { imagePath, jsonPath, filename:imagePath.split('/').pop(), metadataError:true }; }
      });
    }
    function readBinaryBytes(path) {
      const value = ctx.state.fs.readFileSync(path, 'binary');
      if (value instanceof Uint8Array) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      if (value instanceof ArrayBuffer) return new Uint8Array(value);
      if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      throw new Error('The gallery image could not be read as binary data: ' + path);
    }
    function createGalleryMetadata(asset, imagePath, filename) {
      const generation = activeGeneration || {};
      const assetSeed = asset?.metadata?.seed;
      const resultSeed = generation.resultMetadata?.seed;
      const effectiveSeed = assetSeed != null && Number(assetSeed) >= 0 ? assetSeed : resultSeed != null ? resultSeed : generation.parameters?.seed ?? null;
      return {
        version:1, id:stripPng(imagePath.split('/').pop()), createdAt:Date.now(), filename, imagePath,
        provider:{ id:generation.providerId || providerId, name:generation.providerName || provider?.name || providerId },
        instructions:cloneJson(generation.instructions),
        prompt:cloneJson(generation.prompt || { positive:promptInput.value, negative:negativeInput.value }),
        parameters:cloneJson(generation.parameters || readConfiguration()),
        requestedParameters:cloneJson(generation.requestedParameters || generation.parameters || readConfiguration()),
        seed:effectiveSeed, seedWasRandom:Number(generation.requestedParameters?.seed) === -1,
        output:{ mimeType:asset?.mimeType || 'image/png', width:asset?.width || null, height:asset?.height || null },
        generation:cloneJson(generation.resultMetadata || {}), request:cloneJson(generation.request || null)
      };
    }
    async function saveAssetToGallery(asset, index, options = {}) {
      if (!asset?.blob) throw new Error('The generated image is not available.');
      const saved = savedGalleryAssets.get(asset);
      if (saved) return saved;
      if (busy && !options.allowBusy) throw new Error('Wait for generation to finish before saving the final seed and settings to the gallery.');
      const fs = ctx.state?.fs;
      if (!fs) throw new Error('No project filesystem is available.');
      ensureEditorDirectory();
      if (!hasPath(GALLERY_DIR)) fs.mkdirSync(GALLERY_DIR);
      const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      const imagePath = GALLERY_DIR + '/' + id + '.png';
      const jsonPath = GALLERY_DIR + '/' + id + '.json';
      const filename = fileName(index);
      const bytes = new Uint8Array(await asset.blob.arrayBuffer());
      const metadata = createGalleryMetadata(asset, imagePath, filename);
      try {
        fs.writeFileSync(imagePath, bytes);
        fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));
      } catch (error) {
        try { if (fs.existsSync(imagePath)) fs.deleteFileSync(imagePath); } catch (_) {}
        throw error;
      }
      const entry = { ...metadata, imagePath, jsonPath, filename };
      savedGalleryAssets.set(asset, entry);
      ctx.markDirty?.(imagePath);
      if (!options.quiet) status.textContent = 'Added to gallery · ' + filename;
      if (galleryPopover) refreshGalleryPopover();
      return entry;
    }
    async function saveGalleryEntryAs(entry) {
      const bytes = readBinaryBytes(entry.imagePath);
      const blob = new Blob([bytes], {type:'image/png'});
      const savedPath = await workspacePicker.saveFile({
        title:'Save image from AI Gallery',
        suggestedName:entry.filename || 'sprite.png',
        accept:{'image/png':['.png']},
        bytes:blob
      });
      if (savedPath) status.textContent = 'Saved to project · ' + savedPath;
      return savedPath;
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
      const supportsNegativePrompt = !!caps.negativePrompt;
      negativeWrap.hidden = !supportsNegativePrompt;
      promptGrid.classList.toggle('single', !supportsNegativePrompt);
      negativeInput.disabled = !supportsNegativePrompt;
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
      return new File([asset.blob],fileName(index,asset),{type:'image/png',lastModified:Date.now()});
    }
    async function saveAs(asset,index) {
      if (!asset?.blob) throw new Error('The generated image is not available.');
      const savedPath = await workspacePicker.saveFile({
        title:'Save image from AI Asset Studio',
        suggestedName:fileName(index,asset),
        accept:{'image/png':['.png']},
        bytes:asset.blob
      });
      if (savedPath) status.textContent = 'Saved to project · ' + savedPath;
      return savedPath;
    }
    function releaseGalleryUrls() {
      for (const url of galleryUrls) { URL.revokeObjectURL(url); urls.delete(url); }
      galleryUrls = [];
    }
    function closeGalleryPopover() {
      galleryPopover?.remove(); galleryPopover = null; galleryContent = null; releaseGalleryUrls();
      document.removeEventListener('pointerdown', closeGalleryOutside, true);
      document.removeEventListener('keydown', galleryEscape);
    }
    function closeGalleryOutside(event) {
      if (galleryPopover && !galleryPopover.contains(event.target) && event.target !== galleryButton && !contextMenu?.contains(event.target)) closeGalleryPopover();
    }
    function galleryEscape(event) { if (event.key === 'Escape') closeGalleryPopover(); }
    function showGalleryDetails(entry) {
      if (!galleryContent) return;
      galleryContent.replaceChildren();
      const back = document.createElement('button'); back.textContent = '← Gallery'; back.className = 'ais-toolbar'; back.style.marginBottom = '9px'; back.onclick = refreshGalleryPopover;
      const title = document.createElement('h3'); title.className = 'ais-gallery-detail-title'; title.textContent = entry.filename || 'Generated image';
      galleryContent.append(back, title);
      const addField = (label, value) => {
        if (value == null || value === '') return;
        const wrap = document.createElement('div'); wrap.className = 'ais-gallery-detail-field';
        const heading = document.createElement('strong'); heading.textContent = label;
        const pre = document.createElement('pre'); pre.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        wrap.append(heading, pre); galleryContent.append(wrap);
      };
      addField('Provider', entry.provider?.name || entry.provider?.id || 'Unknown provider');
      addField('Positive prompt', entry.prompt?.positive || entry.request?.prompt || '');
      addField('Negative prompt', entry.prompt?.negative || entry.request?.negativePrompt || '');
      addField('Resolved seed', entry.seed);
      addField('Provider instructions', entry.instructions);
      addField('Exact generation request', entry.request);
      addField('Original settings', entry.requestedParameters);
      addField('Resolved settings', { ...(entry.parameters || {}), resolvedSeed:entry.seed, ...(entry.seedWasRandom ? { seedWasRandom:true } : {}) });
      const actions = document.createElement('div'); actions.className = 'ais-gallery-detail-actions';
      const use = document.createElement('button'); use.className = 'primary'; use.textContent = 'Use these settings';
      use.onclick = async () => { try { await applyGallerySettings(entry); closeGalleryPopover(); } catch (error) { showError(error); } };
      const save = document.createElement('button'); save.textContent = 'Save As…';
      save.onclick = async () => { try { await saveGalleryEntryAs(entry); } catch (error) { showError(error); } };
      const rename = document.createElement('button'); rename.textContent = 'Rename…';
      rename.onclick = async () => { try { await renameGalleryImage(entry); } catch (error) { showError(error); } };
      actions.append(save, rename, use); galleryContent.append(actions);
    }
    async function applyGallerySettings(entry) {
      const id = entry.provider?.id || providerId;
      await prepareProvider(id);
      if (modelSelect) modelSelect.value = id;
      const caps = provider?.getCapabilities?.() || {}, parameters = entry.parameters || {};
      for (const wrap of configFields) {
        const key = wrap.dataset.key;
        if (Object.prototype.hasOwnProperty.call(parameters, key)) wrap._input.value = String(parameters[key]);
      }
      updateConfigurationVisibility();
      const positive = entry.prompt?.positive || entry.request?.prompt || '';
      promptInput.value = positive; promptState.positive = positive;
      const negative = caps.negativePrompt ? (entry.prompt?.negative || entry.request?.negativePrompt || '') : '';
      negativeInput.value = negative; promptState.negative = negative;
      const storedName = stripPng(entry.filename || 'sprite');
      nameInput.value = storedName; promptState.name = storedName;
      updatePromptCapabilities(); updateModelState();
      status.textContent = 'Prompt settings restored · ' + (entry.provider?.name || id);
    }
    function showGalleryContextMenu(event, entry) {
      closeContextMenu(); event.preventDefault();
      contextMenu = document.createElement('div'); contextMenu.className = 'ais-image-menu';
      const save = document.createElement('button'); save.textContent = 'Save As…';
      save.onclick = async () => { closeContextMenu(); try { await saveGalleryEntryAs(entry); } catch (error) { showError(error); } };
      const rename = document.createElement('button'); rename.textContent = 'Rename…';
      rename.onclick = async () => { closeContextMenu(); try { await renameGalleryImage(entry); } catch (error) { showError(error); } };
      const details = document.createElement('button'); details.textContent = 'View prompt & settings';
      details.onclick = () => { closeContextMenu(); showGalleryDetails(entry); };
      const remove = document.createElement('button'); remove.textContent = 'Remove from gallery';
      remove.onclick = () => {
        closeContextMenu();
        try {
          ctx.state.fs.deleteFileSync(entry.imagePath);
          if (ctx.state.fs.existsSync(entry.jsonPath)) ctx.state.fs.deleteFileSync(entry.jsonPath);
          ctx.markDirty?.(entry.imagePath); refreshGalleryPopover();
        } catch (error) { showError(error); }
      };
      contextMenu.append(save, rename, details, remove); document.body.append(contextMenu);
      const x = Math.min(event.clientX,window.innerWidth - 190), y = Math.min(event.clientY,window.innerHeight - 150);
      contextMenu.style.left = Math.max(4,x) + 'px'; contextMenu.style.top = Math.max(4,y) + 'px';
      setTimeout(() => document.addEventListener('pointerdown',closeContextMenuOutside,true),0);
      document.addEventListener('keydown',contextMenuKey);
    }
    async function refreshGalleryPopover() {
      if (!galleryContent) return;
      releaseGalleryUrls(); galleryContent.replaceChildren();
      const entries = readGalleryEntries(), count = galleryPopover?.querySelector('[data-gallery-total]');
      if (count) count.textContent = entries.length + ' images';
      if (!entries.length) {
        const empty = document.createElement('div'); empty.className = 'ais-gallery-empty';
        empty.textContent = 'Your saved images will appear here. Right-click a generated image and choose Add to Gallery.';
        galleryContent.append(empty); return;
      }
      const grid = document.createElement('div'); grid.className = 'ais-gallery-grid';
      for (const entry of entries) {
        try {
          const blob = new Blob([readBinaryBytes(entry.imagePath)], {type:'image/png'});
          const url = URL.createObjectURL(blob); galleryUrls.push(url);
          const card = document.createElement('button'); card.type = 'button'; card.className = 'ais-gallery-card';
          const image = document.createElement('img'); image.src = url; image.alt = entry.filename || 'Gallery image';
          const label = document.createElement('span'); label.textContent = entry.filename || 'sprite.png';
          card.append(image, label); card.addEventListener('click', () => showGalleryDetails(entry));
          card.addEventListener('contextmenu', event => showGalleryContextMenu(event, entry)); grid.append(card);
        } catch (error) { console.warn('Could not load StudioAI gallery image:', entry.imagePath, error); }
      }
      galleryContent.append(grid);
    }
    function openGalleryPopover() {
      if (galleryPopover) { closeGalleryPopover(); return; }
      closeContextMenu();
      const popover = document.createElement('div'); popover.className = 'ais-gallery-popover';
      popover.innerHTML = '<div class="ais-gallery-popover-head"><strong>Image Gallery</strong><span data-gallery-total>0 images</span><button type="button" data-close-gallery aria-label="Close gallery">×</button></div><div class="ais-gallery-content" data-gallery-content></div>';
      galleryPopover = popover; galleryContent = popover.querySelector('[data-gallery-content]'); document.body.append(popover);
      popover.querySelector('[data-close-gallery]').onclick = closeGalleryPopover;
      const rect = galleryButton.getBoundingClientRect(), width = Math.min(430, window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
      const top = Math.max(8, Math.min(rect.bottom + 5, window.innerHeight - 100));
      popover.style.left = left + 'px'; popover.style.top = top + 'px';
      refreshGalleryPopover();
      setTimeout(() => document.addEventListener('pointerdown',closeGalleryOutside,true),0);
      document.addEventListener('keydown',galleryEscape);
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
      const rename = document.createElement('button'); rename.textContent = 'Rename…';
      rename.onclick = async () => { closeContextMenu(); try { await renameGeneratedImage(asset,index); } catch (error) { showError(error); } };
      const addToGallery = document.createElement('button');
      addToGallery.textContent = savedGalleryAssets.has(asset) ? 'Already in Gallery' : 'Add to Gallery';
      addToGallery.disabled = busy || savedGalleryAssets.has(asset);
      addToGallery.onclick = async () => { closeContextMenu(); try { await saveAssetToGallery(asset,index); } catch (error) { showError(error); } };
      contextMenu.append(save, rename, addToGallery);
      document.body.append(contextMenu);
      const x = Math.min(event.clientX,window.innerWidth - 170), y = Math.min(event.clientY,window.innerHeight - 115);
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
        card.addEventListener('contextmenu',event => showContextMenu(event,card._asset,index));
        card.addEventListener('dragstart',event => {
          const file = createFile(asset,index);
          const token = window.__editorFileDropBridge?.register?.(file);
          if (token) event.dataTransfer.setData('application/x-wk-editor-files',token);
          event.dataTransfer.setData('text/plain',file.name);
          event.dataTransfer.effectAllowed = 'copy';
        });
        results.append(card);
      }
      card._asset = asset;
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
      const supportsNegativePrompt = !!provider?.getCapabilities?.().negativePrompt;
      if (supportsNegativePrompt) promptState.negative = negativeInput.value.trim();
      promptState.name = nameInput.value;
      abortController = new AbortController(); busy = true; updateModelState();
      clearResults();
      status.textContent = 'Generating…'; progressText.textContent = 'Preparing prompt…';
      progressPercent.textContent = ''; progressBar.style.width = '0%';
      const selectedProvider = provider;
      const requestedParameters = readConfiguration();
      const parameters = { ...requestedParameters };
      if (selectedProvider?.getCapabilities?.().seed && Number(parameters.seed) === -1) parameters.seed = makeRandomSeed();
      imageCount = Math.max(1,Number(parameters.count)||1);
      if (supportsNegativePrompt) parameters.negativePrompt = promptState.negative;
      const request = {
        prompt,
        name:cleanName(promptState.name),
        parameters,
        onAsset:renderAsset,
        onResetAssets:resetGeneratedImages
      };
      if (supportsNegativePrompt) request.negativePrompt = promptState.negative;
      const providerInfo = window.StudioAI.listProviders('image').find(item => item.id === providerId);
      let providerInstructions = null;
      try { providerInstructions = typeof selectedProvider.getInstructions === 'function' ? selectedProvider.getInstructions() : selectedProvider.instructions ?? null; } catch (_) {}
      activeGeneration = {
        providerId, providerName:providerInfo?.name || selectedProvider?.name || providerId,
        instructions:providerInstructions,
        prompt:{ positive:prompt, ...(supportsNegativePrompt ? { negative:promptState.negative } : {}) },
        requestedParameters:cloneJson(requestedParameters), parameters:cloneJson(parameters),
        request:cloneJson({ prompt, ...(supportsNegativePrompt ? {negativePrompt:promptState.negative} : {}), name:request.name, parameters }),
        resultMetadata:null
      };
      selectedProvider.generateImage(request,{signal:abortController.signal,onProgress:setProgress}).then(async result => {
        const seconds = Math.max(Number(result?.metadata?.elapsedMs || 0)/1000,0.001);
        if (activeGeneration) activeGeneration.resultMetadata = cloneJson(result?.metadata || {});
        for (const asset of assets) if (asset?.metadata && (asset.metadata.seed == null || Number(asset.metadata.seed) === -1) && result?.metadata?.seed != null) asset.metadata.seed = result.metadata.seed;
        status.textContent = 'Finished · ' + result.assets.length + ' images · ' + seconds.toFixed(1) + 's · ' + String(result.metadata?.backend || 'local').toUpperCase();
        progressText.textContent = 'Complete'; progressPercent.textContent = '100%'; progressBar.style.width = '100%';
        if (addToGalleryByDefault) {
          try {
            let savedCount = 0;
            for (let index = 0; index < assets.length; index++) if (assets[index]) { await saveAssetToGallery(assets[index], index, {quiet:true,allowBusy:true}); savedCount++; }
            if (savedCount) status.textContent += ' · ' + savedCount + ' added to gallery';
          } catch (error) { showError(error); }
        }
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
      loadStudioSettings();
      try { await prepareProvider(providerId); }
      catch (error) { showError(error); return; }
      if (settingsModal) { settingsModal.remove(); settingsModal = null; }
      const modal = document.createElement('div'); modal.className = 'editor-modal ai-settings-modal';
      settingsModal = modal;
      modal.innerHTML = '<div class="editor-modal-content ais-settings-content"><button class="editor-modal-close" aria-label="Close">×</button><h2>Studio AI Settings</h2><p>Available image models and browser-cached model files.</p><div class="ais-settings-tabs"><button class="active" data-tab="models">Models</button><button data-tab="cache">Cached models</button></div><section data-panel="models"><label class="ais-auto-gallery"><input type="checkbox" data-auto-gallery> Add generated images to gallery by default</label><div class="ai-section-title">Available models</div><div class="ais-model-list" data-model-list></div><p class="ais-settings-note">Models are currently provided by local StudioAI integrations. Remote model APIs can be added through the provider registry later.</p></section><section data-panel="cache" hidden><div class="ai-section-title">Browser model &amp; runtime cache</div><div class="ais-toolbar" style="margin-bottom:8px"><button data-refresh-cache>Refresh</button></div><div class="ais-cache-list" data-cache-list>Reading browser caches…</div><p class="ais-settings-note">Deleting a cache removes its stored downloads. Runtime assets may be downloaded again when needed.</p></section></div>';
      document.body.append(modal);
      const close = () => { modal.remove(); if (settingsModal === modal) settingsModal = null; };
      modal.querySelector('.editor-modal-close').onclick = close;
      modal.onclick = event => { if (event.target === modal) close(); };
      const autoGalleryToggle = modal.querySelector('[data-auto-gallery]');
      autoGalleryToggle.checked = addToGalleryByDefault;
      autoGalleryToggle.onchange = () => {
        const previous = addToGalleryByDefault;
        addToGalleryByDefault = autoGalleryToggle.checked;
        try { saveStudioSettings(); }
        catch (error) { addToGalleryByDefault = previous; autoGalleryToggle.checked = previous; showError(error); }
      };
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
      pickerContainer = group.viewBody;
      addStyle();
      page = document.createElement('div'); page.className = 'ai-asset-studio-page builtin-ai';
      page.innerHTML = '<div class="ai-panel-inner"><header class="ai-header"><div class="ai-header-left"><strong class="ais-header-title">AI Asset Studio</strong><select class="ai-chat-select" data-model-select title="Select image model"></select></div><div class="ai-header-right"><div class="ai-head-actions"><button data-load title="Load model">Load model</button><button data-gallery title="Image Gallery" aria-label="Image Gallery"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="13" height="13" rx="1.8"></rect><path d="m5.5 14 3.2-3.4 2.4 2.3 1.7-1.7 3.2 3.3"></path><path d="M8 20h11a2 2 0 0 0 2-2V8"></path></svg></button><button data-settings title="Studio AI Settings" aria-label="Studio AI Settings">⚙</button></div></div></header><main class="ais-main"><section class="ais-section"><div class="ais-section-title">Prompt</div><div class="ais-prompt-grid" data-prompt-grid><label class="ais-field">Positive prompt<textarea data-positive placeholder="A tiny red dragon with cream horns and a curled tail" maxlength="200"></textarea></label><label class="ais-field" data-negative-wrap>Negative prompt<textarea data-negative placeholder="Things to avoid…" maxlength="200"></textarea></label></div><div class="ais-name-row"><label class="ais-field">Image name<input data-image-name type="text" value="sprite" placeholder="sprite"></label><div class="ais-toolbar"><button class="primary" data-generate disabled>Generate</button></div></div><div class="ais-action-status"><span class="ais-load-state" data-status>Model not loaded</span></div><div class="ais-progress"><i data-progress-bar></i></div><div class="ais-progress-meta"><span data-progress-text>Load a model to begin.</span><span class="ais-progress-percent" data-progress-percent></span></div><div class="ais-error" data-error hidden></div></section><details class="ais-section ais-settings-section" open><summary class="ais-section-title">Settings</summary><div class="ais-settings-grid" data-config></div></details><section class="ais-section"><div class="ais-gallery-head"><strong>Generated images</strong><span class="ais-gallery-count" data-gallery-count>0 images</span></div><div class="ais-results" data-results><div class="ais-empty">Generated images will appear here. Drag an image into the project explorer or right-click it to Save As.</div></div></section></main></div>';
      group.viewBody.append(page);
      modelSelect = page.querySelector('[data-model-select]');
      loadButton = page.querySelector('[data-load]');
      settingsButton = page.querySelector('[data-settings]');
      galleryButton = page.querySelector('[data-gallery]');
      promptInput = page.querySelector('[data-positive]');
      negativeInput = page.querySelector('[data-negative]');
      negativeWrap = page.querySelector('[data-negative-wrap]');
      promptGrid = page.querySelector('[data-prompt-grid]');
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
      galleryButton.onclick = openGalleryPopover;
      loadStudioSettings();
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
      title:'AI Studio',
      icon:'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3zM19 16 L19.9 18.1 L22 19 L19.9 19.9 L19 22 L18.1 19.9 L16 19 L18.1 18.1 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
      render(group) { render(group); },
      dispose() { abortController?.abort(); workspacePicker.cancelActive(); closeRenameModal(); pickerContainer = null; releaseUrls(); releaseGalleryUrls(); closeContextMenu(); closeGalleryPopover(); provider?.dispose?.(); }
    };
  };
})();