(function () {
  const factories = window.EditorBuiltinFactories = window.EditorBuiltinFactories || {};

  factories['ai-asset-studio'] = function (ctx) {
    let page = null, provider = null, providerPromise = null, abortController = null;
    const objectUrls = new Set();
    let configContainer = null;
    const values = {};
    let fields = [];
    let status = null, progress = null, progressPercent = null, progressBar = null, loadButton = null, generateButton = null;
    let results = null, errorBox = null, caption = null;

    const style = `
      .ai-asset-studio-page{height:100%;overflow:auto;box-sizing:border-box;padding:22px;color:var(--text,#eee);background:var(--background,#1e1e1e);font:13px system-ui,sans-serif}
      .ai-asset-studio-page *{box-sizing:border-box}.ais-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}
      .ais-head h2{font-size:20px;margin:0 0 5px}.ais-muted{color:var(--muted,#999);font-size:12px;line-height:1.5}
      .ais-layout{display:grid;grid-template-columns:minmax(260px,340px) minmax(280px,1fr);gap:18px;align-items:start}
      .ais-panel{background:var(--panel,#252525);border:1px solid var(--border,#444);border-radius:9px;padding:16px;min-width:0}
      .ais-panel h3{font-size:14px;margin:0 0 12px}.ais-field{display:block;margin:13px 0}.ais-field>span{display:block;font-size:11px;font-weight:700;margin-bottom:6px;color:var(--muted,#aaa)}
      .ais-field input,.ais-field select,.ais-field textarea{width:100%;background:var(--input-bg,#171717);color:inherit;border:1px solid var(--border,#4a4a4a);border-radius:5px;padding:8px;font:inherit}
      .ais-field input[type=range]{padding:0}.ais-field textarea{min-height:100px;resize:vertical}
      .ais-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.ais-actions button,.ais-card button{border:1px solid var(--border,#555);background:var(--button-bg,#333);color:inherit;border-radius:5px;padding:8px 11px;cursor:pointer}
      .ais-actions button.primary{background:var(--accent,#c5f36b);color:#171717;border-color:transparent;font-weight:700}.ais-actions button:disabled{opacity:.5;cursor:default}
      .ais-progress{height:5px;background:#444;border-radius:9px;overflow:hidden;margin-top:8px}.ais-progress i{display:block;width:0;height:100%;background:var(--accent,#c5f36b);transition:width .12s}
      .ais-progress-meta{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:7px;font-size:12px;color:var(--muted,#aaa);min-height:18px}.ais-progress-percent{font-variant-numeric:tabular-nums;color:var(--text,#eee);font-weight:600}
      .ais-status{margin-top:8px;font-size:12px;color:var(--muted,#aaa);min-height:18px}
      .ais-error{white-space:pre-wrap;color:#ff8585;font-size:12px;margin-top:10px}.ais-notice{font-size:11px;line-height:1.55;color:var(--muted,#aaa);border:1px solid var(--border,#444);border-radius:6px;padding:10px;margin-top:14px}
      .ais-results-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:12px}.ais-results-head h3{margin:0}.ais-results{display:grid;grid-template-columns:repeat(auto-fill,minmax(116px,1fr));gap:10px}
      .ais-card{min-width:0;padding:8px;border:1px solid var(--border,#444);border-radius:7px;background:var(--panel,#252525)}
      .ais-card img{display:block;width:100%;aspect-ratio:1;object-fit:contain;image-rendering:pixelated;background-color:#303030;background-image:linear-gradient(45deg,#414141 25%,transparent 25%),linear-gradient(-45deg,#414141 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#414141 75%),linear-gradient(-45deg,transparent 75%,#414141 75%);background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0}
      .ais-card .ais-card-actions{display:grid;gap:5px;margin-top:7px}.ais-card button{font-size:11px;padding:6px}.ais-empty{min-height:220px;border:1px dashed var(--border,#555);border-radius:7px;display:grid;place-items:center;text-align:center;padding:20px;color:var(--muted,#999)}
      @media(max-width:760px){.ais-layout{grid-template-columns:1fr}.ai-asset-studio-page{padding:14px}}
    `;
    function addStyle() {
      if (document.getElementById('ais-styles')) return;
      const el = document.createElement('style'); el.id = 'ais-styles'; el.textContent = style; document.head.appendChild(el);
    }
    async function prepareProvider() {
      if (provider) return provider;
      if (providerPromise) return providerPromise;
      providerPromise = (async () => {
        const mod = await import('../studio-ai/providers/pixel-sprite/provider.js');
        mod.registerPixelSpriteProvider(window.StudioAI);
        provider = window.StudioAI.createImageProvider('pixel-sprite');
        const schema = provider.getConfigurationSchema();
        fields = [];
        configContainer.replaceChildren();
        for (const field of schema.fields || []) configContainer.append(makeField(field));
        updateFieldVisibility();
        return provider;
      })();
      try { return await providerPromise; }
      catch (error) { providerPromise = null; throw error; }
    }
    function setProgress(info) {
      const raw = info?.progress;
      const value = raw == null || raw === "" ? NaN : Number(raw);
      const percent = Number.isFinite(value) ? Math.round(Math.max(0,Math.min(1,value))*100) : null;
      progressBar.style.width = percent == null ? '0%' : percent + '%';
      progressPercent.textContent = percent == null ? '' : percent + '%';
      // Providers own the wording and progress calculation. The Editor only
      // renders the common message + normalized progress contract.
      progress.textContent = info?.message || 'Working…';
    }
    function makeField(field) {
      const wrap = document.createElement('label'); wrap.className = 'ais-field'; wrap.dataset.key = field.key;
      const label = document.createElement('span'); label.textContent = field.label || field.key; wrap.append(label);
      let input;
      if (field.type === 'select') {
        input = document.createElement('select');
        for (const option of field.options || []) {
          const item = document.createElement('option'); item.value = String(option.value); item.textContent = option.label ?? String(option.value); input.append(item);
        }
      } else {
        input = document.createElement('input'); input.type = field.type === 'range' ? 'range' : 'number';
        if (field.min != null) input.min = field.min;
        if (field.max != null) input.max = field.max;
        if (field.step != null) input.step = field.step;
      }
      input.value = String(field.default ?? '');
      values[field.key] = field.default;
      input.addEventListener('input', () => {
        values[field.key] = field.type === 'number' || field.type === 'range' ? Number(input.value) : input.value;
        if (field.type === 'range') label.textContent = (field.label || field.key) + ' · ' + input.value;
        updateFieldVisibility();
      });
      wrap.append(input);
      wrap._input = input; wrap._label = label; wrap._schema = field;
      fields.push(wrap);
      return wrap;
    }
    function updateFieldVisibility() {
      for (const wrap of fields) {
        const rule = wrap._schema.visibleWhen;
        wrap.hidden = !!rule && values[rule.key] !== rule.equals;
      }
    }
    function readConfiguration() {
      const config = {};
      for (const wrap of fields) {
        const { key, type } = wrap._schema;
        const raw = wrap._input.value;
        config[key] = type === 'number' || type === 'range' ? Number(raw) : raw;
      }
      return config;
    }
    function setBusy(busy) {
      loadButton.disabled = busy || !!provider?.initialized;
      generateButton.disabled = busy || !provider?.initialized;
    }
    function showError(error) { errorBox.textContent = error?.stack || error?.message || String(error); errorBox.hidden = false; }
    function clearError() { errorBox.textContent = ''; errorBox.hidden = true; }
    function saveToProject(asset, index) {
      if (!ctx?.state?.fs || ctx.state.projectOwner === false) throw new Error('This workspace is read-only or unavailable.');
      const path = 'assets/generated/pixel-sprite-' + Date.now() + '-' + (index+1) + '.png';
      const fs = ctx.state.fs;
      if (!fs.existsSync('assets')) fs.mkdirSync('assets');
      if (!fs.existsSync('assets/generated')) fs.mkdirSync('assets/generated');
      asset.blob.arrayBuffer().then(buffer => {
        fs.writeFileSync(path,new Uint8Array(buffer));
        ctx.markDirty?.(path); ctx.updateStatus?.();
        try { ctx.state.fileManager?.refresh?.(); } catch (_) {}
        status.textContent = 'Saved ' + path;
      }).catch(showError);
    }
    function renderAsset(asset, index) {
      const url = URL.createObjectURL(asset.blob); objectUrls.add(url);
      const card = document.createElement('article'); card.className = 'ais-card';
      const image = document.createElement('img'); image.src = url; image.alt = 'Generated pixel sprite ' + (index+1); card.append(image);
      const actions = document.createElement('div'); actions.className = 'ais-card-actions';
      const download = document.createElement('a'); download.href = url; download.download = 'pixel-sprite-' + (index+1) + '.png'; download.textContent = 'Download PNG';
      download.style.cssText = 'display:block;text-align:center;color:var(--accent,#c5f36b);font-size:11px;text-decoration:none;padding:5px';
      actions.append(download);
      const save = document.createElement('button'); save.textContent = 'Add to project'; save.disabled = ctx?.state?.projectOwner === false;
      save.addEventListener('click', () => { try { saveToProject(asset,index); } catch (error) { showError(error); } });
      actions.append(save); card.append(actions); results.append(card);
    }
    async function loadModel() {
      clearError(); setBusy(true); status.textContent = 'Loading model…'; progressBar.style.width = '0%';
      try {
        await prepareProvider();
        const result = await provider.initialize({configuration:readConfiguration(),onProgress:setProgress});
        status.textContent = 'Ready · ' + result.backend.toUpperCase() + ' · model cached in this browser';
        generateButton.disabled = false; loadButton.disabled = true; loadButton.textContent = 'Model loaded';
        progressBar.style.width = '100%';
      } catch (error) { showError(error); status.textContent = 'Model could not be loaded'; loadButton.disabled = false; }
    }
    async function generate() {
      clearError();
      const prompt = promptInput.value.trim();
      if (!prompt) { promptInput.focus(); return; }
      abortController = new AbortController(); generateButton.textContent = 'Stop generation'; loadButton.disabled = true;
      generateButton.disabled = false;
      for (const url of objectUrls) URL.revokeObjectURL(url);
      objectUrls.clear(); results.replaceChildren(); caption.textContent = prompt;
      status.textContent = 'Generating…'; progressBar.style.width = '0%';
      progress.textContent = 'Preparing prompt…'; progressPercent.textContent = '0%';
      const resetResults = () => {
        for (const url of objectUrls) URL.revokeObjectURL(url);
        objectUrls.clear(); results.replaceChildren();
      };
      try {
        const result = await provider.generateImage({
          prompt, parameters:readConfiguration(),
          onAsset:renderAsset,
          onResetAssets:resetResults
        }, {
          signal:abortController.signal, onProgress:setProgress
        });
        const seconds = Math.max(result.metadata.elapsedMs/1000, 0.001);
        status.textContent = 'Finished · ' + result.assets.length + ' sprites · seed ' + result.metadata.seed + ' · ' +
          seconds.toFixed(1) + 's · ' + (result.assets.length/seconds).toFixed(2) + ' sprites/s · ' + result.metadata.backend.toUpperCase() +
          ' · prompt ' + Number(result.metadata.encodingMs || 0).toFixed(0) + ' ms';
        progress.textContent = 'Complete'; progressPercent.textContent = '100%';
        progressBar.style.width = '100%';
      } catch (error) {
        if (error?.name === 'AbortError') status.textContent = 'Generation stopped';
        else { showError(error); status.textContent = 'Generation failed'; }
      } finally {
        abortController = null; generateButton.textContent = 'Generate sprites'; generateButton.disabled = false; loadButton.disabled = true;
      }
    }
    function render(group) {
      addStyle();
      page = document.createElement('div'); page.className = 'ai-asset-studio-page';
      const header = document.createElement('div'); header.className = 'ais-head';
      const heading = document.createElement('div'); heading.innerHTML = '<h2>AI Asset Studio</h2><div class="ais-muted">Generate image assets locally in your browser.</div>'; header.append(heading);
      page.append(header);
      const layout = document.createElement('div'); layout.className = 'ais-layout';
      const panel = document.createElement('section'); panel.className = 'ais-panel';
      panel.innerHTML = '<h3>Pixel art generator</h3>';
      const promptLabel = document.createElement('label'); promptLabel.className = 'ais-field';
      const promptTitle = document.createElement('span'); promptTitle.textContent = 'Prompt'; promptInput = document.createElement('textarea'); promptInput.maxLength = 200; promptInput.placeholder = 'A tiny red dragon with cream horns and a curled tail';
      promptLabel.append(promptTitle,promptInput); panel.append(promptLabel);
      const config = document.createElement('div'); config.className = 'ais-config'; configContainer = config; panel.append(config);
      loadButton = document.createElement('button'); loadButton.textContent = 'Load model';
      generateButton = document.createElement('button'); generateButton.className = 'primary'; generateButton.textContent = 'Generate sprites'; generateButton.disabled = true;
      const actions = document.createElement('div'); actions.className = 'ais-actions'; actions.append(loadButton,generateButton); panel.append(actions);
      const progressWrap = document.createElement('div'); progressWrap.className = 'ais-progress'; progressBar = document.createElement('i'); progressWrap.append(progressBar); panel.append(progressWrap);
      const progressMeta = document.createElement('div'); progressMeta.className = 'ais-progress-meta';
      progress = document.createElement('span'); progress.textContent = 'Load the model to begin.';
      progressPercent = document.createElement('span'); progressPercent.className = 'ais-progress-percent';
      progressMeta.append(progress,progressPercent); panel.append(progressMeta);
      status = document.createElement('div'); status.className = 'ais-status'; status.textContent = 'Model not loaded'; panel.append(status);
      errorBox = document.createElement('div'); errorBox.className = 'ais-error'; errorBox.hidden = true; panel.append(errorBox);
      const notice = document.createElement('div'); notice.className = 'ais-notice';
      notice.innerHTML = '<b>Local inference:</b> prompts and generated images stay on this device. Model weights, text encoder files, and jsDelivr runtime assets are cached in browser storage after loading. The first load requires an internet connection; later sessions can reuse the cached runtime and model files offline. WebGPU is preferred, with a slower CPU fallback.<br><br><b>License:</b> PixelSprite Canvas v2 model weights are <a href="https://huggingface.co/ihor-umanets/pixelsprite-canvas-v2" target="_blank" rel="noopener">CC BY-NC 4.0 (non-commercial use only)</a>. The inference implementation is Apache-2.0. Review the model and dependency licenses before using generated assets commercially.';
      panel.append(notice);
      prepareProvider().catch(showError);
      const output = document.createElement('section'); output.className = 'ais-panel';
      const outputHead = document.createElement('div'); outputHead.className = 'ais-results-head';
      const outputTitle = document.createElement('h3'); outputTitle.textContent = 'Generated sprites';
      caption = document.createElement('span'); caption.className = 'ais-muted'; caption.textContent = 'Nothing generated yet';
      outputHead.append(outputTitle,caption); output.append(outputHead);
      results = document.createElement('div'); results.className = 'ais-results';
      const empty = document.createElement('div'); empty.className = 'ais-empty'; empty.textContent = 'Your generated sprites will appear here.'; results.append(empty); output.append(results);
      layout.append(panel,output); page.append(layout); group.viewBody.append(page);
      loadButton.addEventListener('click',loadModel);
      generateButton.addEventListener('click',() => {
        if (abortController) { abortController.abort(); generateButton.disabled = true; generateButton.textContent = 'Stopping…'; }
        else generate();
      });
      promptInput.addEventListener('keydown',event => { if ((event.metaKey||event.ctrlKey)&&event.key==='Enter'&&!generateButton.disabled) generate(); });
      return page;
    }
    let promptInput = null;
    async function dispose() {
      try { abortController?.abort(); } catch (_) {}
      try { await provider?.dispose?.(); } catch (_) {}
      provider = null; providerPromise = null;
      for (const url of objectUrls) URL.revokeObjectURL(url);
      objectUrls.clear();
      page?.remove(); page = null;
    }
    return {
      title:'AI Asset Studio',
      icon:'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3zM19 16l.8 2.2L22 19l-.8-2.2L16 19l2.2.8z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
      render, dispose
    };
  };
})();