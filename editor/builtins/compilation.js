(function() {
  const factories = window.EditorBuiltinFactories = window.EditorBuiltinFactories || {};

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    })[character]);
  }

  factories.compilation = function(ctx) {
    const state = ctx.state;

    function renderCompilation(group) {
      const root = document.createElement('div');
      root.className = 'compilation-page';
      root.innerHTML = `
        <header class="compilation-header">
          <h2>Compilation</h2>
          <p>Configure and build a portable standalone HTML version of this project.</p>
        </header>
        <div class="compilation-content">
          <section class="compilation-section">
            <h3>Standalone HTML</h3>
            <p>These options affect the downloaded single-file page. They do not modify your workspace files.</p>
            <label class="compilation-check">
              <input type="checkbox" data-minify>
              <span><strong>Minify project files</strong><small>Minify HTML, CSS, and JavaScript before packaging. Files that cannot be processed safely are kept unchanged.</small></span>
            </label>
            <label class="compilation-check">
              <input type="checkbox" data-raw-binary>
              <span><strong>Compact raw archive encoding</strong><small>Embeds ZIP bytes directly using the legacy ISO-8859-2 encoding. Some upload services may reject this format; turn it off for Base64.</small></span>
            </label>
            <label class="compilation-field">
              <span>ZIP compression</span>
              <select data-compression>
                <option value="6">Standard · DEFLATE level 6</option>
                <option value="9">Maximum · DEFLATE level 9</option>
              </select>
            </label>
            <div class="compilation-actions">
              <button class="compilation-primary" data-compile>Compile Page</button>
              <span class="compilation-status" data-status aria-live="polite"></span>
            </div>
          </section>
          <section class="compilation-section">
            <h3>Deployment settings</h3>
            <p>Uses the same deployment configuration fields as WatermelonKatana project publishing.</p>
            <label class="compilation-field">
              <span>Deployment mode</span>
              <select data-mode>
                <option value="editor">Editor</option>
                <option value="third-party">Third Party</option>
              </select>
            </label>
            <div data-editor-fields>
              <label class="compilation-field">
                <span>Branch</span>
                <select data-branch></select>
              </label>
              <label class="compilation-field">
                <span>Commit</span>
                <select data-commit></select>
              </label>
              <label class="compilation-field">
                <span>Deployment path</span>
                <input data-path type="text" placeholder="/">
              </label>
              <label class="compilation-check">
                <input type="checkbox" data-peer>
                <span><strong>Use peer server</strong><small>Enable the project's peer-server layer in its deployment configuration.</small></span>
              </label>
              <p class="compilation-note" data-repository-note></p>
            </div>
            <div data-third-party-fields hidden>
              <label class="compilation-field">
                <span>External URL</span>
                <input data-external-url type="url" placeholder="https://example.com/">
              </label>
            </div>
            <p class="compilation-note">Deployment settings are saved with this project. The standalone HTML itself still embeds the current workspace.</p>
          </section>
        </div>`;
      group.viewBody.appendChild(root);

      const $ = selector => root.querySelector(selector);
      const minify = $('[data-minify]');
      const rawBinary = $('[data-raw-binary]');
      const compression = $('[data-compression]');
      const compileButton = $('[data-compile]');
      const status = $('[data-status]');
      const mode = $('[data-mode]');
      const editorFields = $('[data-editor-fields]');
      const thirdPartyFields = $('[data-third-party-fields]');
      const branch = $('[data-branch]');
      const commit = $('[data-commit]');
      const path = $('[data-path]');
      const peer = $('[data-peer]');
      const externalUrl = $('[data-external-url]');
      const repositoryNote = $('[data-repository-note]');

      try {
        const value = localStorage.getItem('node-editor.compile.minify');
        minify.checked = value === null ? true : value === 'true';
      } catch (_) { minify.checked = true; }
      try {
        const value = localStorage.getItem('node-editor.compile.raw-binary');
        rawBinary.checked = value === null ? true : value === 'true';
      } catch (_) { rawBinary.checked = true; }
      try {
        compression.value = localStorage.getItem('node-editor.compile.compression') === '6' ? '6' : '9';
      } catch (_) { compression.value = '9'; }

      minify.onchange = () => {
        try { localStorage.setItem('node-editor.compile.minify', minify.checked ? 'true' : 'false'); } catch (_) {}
      };
      rawBinary.onchange = () => {
        try { localStorage.setItem('node-editor.compile.raw-binary', rawBinary.checked ? 'true' : 'false'); } catch (_) {}
      };
      compression.onchange = () => {
        try { localStorage.setItem('node-editor.compile.compression', compression.value === '6' ? '6' : '9'); } catch (_) {}
      };

      const settings = state.deploymentSettings = {
        thirdParty: state.deploymentSettings?.thirdParty === true || state.deploymentSettings?.mode === 'third-party',
        externalUrl: String(state.deploymentSettings?.externalUrl || ''),
        branch: String(state.deploymentSettings?.branch || state.gitRemote?.branch || 'main'),
        commit: String(state.deploymentSettings?.commit || 'latest'),
        path: String(state.deploymentSettings?.path || '/'),
        usePeerServer: state.deploymentSettings?.usePeerServer === true || state.runConfig?.config?.usePeerServer === true
      };
      mode.value = settings.thirdParty ? 'third-party' : 'editor';
      path.value = settings.path;
      externalUrl.value = settings.externalUrl;
      peer.checked = settings.usePeerServer;

      function persistDeploymentSettings() {
        settings.thirdParty = mode.value === 'third-party';
        settings.externalUrl = externalUrl.value.trim();
        settings.branch = branch.value || settings.branch || 'main';
        settings.commit = commit.value || settings.commit || 'latest';
        settings.path = path.value.trim() || '/';
        settings.usePeerServer = peer.checked;
        if (state.runConfig?.config) {
          state.runConfig.config.usePeerServer = peer.checked;
        }
        ctx.saveProjectMetadata?.();
        syncMode();
      }

      function syncMode() {
        settings.thirdParty = mode.value === 'third-party';
        editorFields.hidden = settings.thirdParty;
        thirdPartyFields.hidden = !settings.thirdParty;
      }

      async function loadCommits(preferredCommit) {
        const remote = state.gitRemote;
        const service = window.GitHubService;
        commit.disabled = true;
        commit.innerHTML = '<option value="latest">Latest</option>';
        if (!remote?.owner || !remote?.repo || typeof service?.listCommits !== 'function') {
          commit.value = 'latest';
          return;
        }
        try {
          const commits = await service.listCommits(remote.owner, remote.repo, branch.value || settings.branch, 30);
          const options = ['<option value="latest">Latest</option>'].concat(
            (Array.isArray(commits) ? commits : []).map(item =>
              '<option value="' + escapeHTML(item.sha) + '">' +
              escapeHTML(item.message || String(item.sha || '').slice(0, 12)) +
              '</option>'
            )
          );
          const desired = String(preferredCommit || 'latest');
          if (desired !== 'latest' && !commits.some(item => item.sha === desired)) {
            options.push('<option value="' + escapeHTML(desired) + '">Pinned ' + escapeHTML(desired.slice(0, 12)) + '</option>');
          }
          commit.innerHTML = options.join('');
          commit.value = desired;
          if (commit.value !== desired) commit.value = 'latest';
        } catch (error) {
          commit.innerHTML = '<option value="latest">Latest</option>';
          commit.value = 'latest';
          status.textContent = 'Could not load GitHub commits: ' + (error?.message || error);
        } finally {
          commit.disabled = false;
        }
      }

      async function loadBranches(preferredBranch, preferredCommit) {
        const remote = state.gitRemote;
        const service = window.GitHubService;
        const selected = String(preferredBranch || settings.branch || remote?.branch || 'main');
        branch.disabled = true;
        branch.innerHTML = '<option value="' + escapeHTML(selected) + '">' + escapeHTML(selected) + '</option>';
        if (!remote?.owner || !remote?.repo || typeof service?.listBranches !== 'function') {
          branch.disabled = true;
          commit.disabled = true;
          repositoryNote.textContent = 'Connect this workspace to a GitHub repository to select deployment branches and commits.';
          await loadCommits(preferredCommit);
          return;
        }
        repositoryNote.textContent = 'Repository: ' + remote.owner + '/' + remote.repo;
        try {
          const branches = await service.listBranches(remote.owner, remote.repo);
          const values = Array.isArray(branches) ? [...branches] : [];
          if (!values.includes(selected)) values.unshift(selected);
          branch.innerHTML = values.map(value =>
            '<option value="' + escapeHTML(value) + '">' + escapeHTML(value) + '</option>'
          ).join('');
          branch.value = selected;
          branch.disabled = false;
        } catch (error) {
          branch.disabled = false;
          repositoryNote.textContent = 'Could not refresh branches. Showing the saved branch: ' + (error?.message || error);
        }
        await loadCommits(preferredCommit);
      }

      mode.onchange = () => { persistDeploymentSettings(); };
      branch.onchange = async () => {
        settings.branch = branch.value;
        settings.commit = 'latest';
        await loadCommits('latest');
        persistDeploymentSettings();
      };
      commit.onchange = persistDeploymentSettings;
      path.onchange = persistDeploymentSettings;
      peer.onchange = persistDeploymentSettings;
      externalUrl.onchange = persistDeploymentSettings;

      syncMode();
      void loadBranches(settings.branch, settings.commit);

      compileButton.disabled = !state.fs;
      compileButton.title = state.fs ? '' : 'Open a project before compiling.';
      compileButton.onclick = async () => {
        if (!state.fs || compileButton.dataset.busy === '1') return;
        if (mode.value === 'third-party' && !externalUrl.value.trim()) {
          status.textContent = 'Enter an external deployment URL first.';
          externalUrl.focus();
          return;
        }
        const exporter = window.StandalonePageExporter;
        const editor = window.EditorApp;
        if (!exporter?.compile || typeof editor?.getSinglePageSnapshot !== 'function') {
          status.textContent = 'The standalone compiler is not available.';
          return;
        }
        compileButton.dataset.busy = '1';
        compileButton.disabled = true;
        const originalText = compileButton.textContent;
        compileButton.textContent = 'Compiling…';
        status.textContent = 'Preparing project…';
        try {
          persistDeploymentSettings();
          const compressionLevel = compression.value === '6' ? 6 : 9;
          const snapshot = await editor.getSinglePageSnapshot({compressionLevel});
          const output = await exporter.compile(snapshot, {
            editorUrl: window.location.href,
            compressionLevel,
            archiveEncoding: rawBinary.checked ? 'iso8859-2' : 'base64',
            onProgress: message => { status.textContent = message; }
          });
          exporter.download(output, snapshot.projectName);
          status.textContent = 'Standalone page downloaded.';
          compileButton.textContent = 'Downloaded';
        } catch (error) {
          status.textContent = 'Compilation failed: ' + (error?.message || String(error));
          console.error('[Compilation]', error);
          compileButton.textContent = 'Compile Failed';
        } finally {
          delete compileButton.dataset.busy;
          setTimeout(() => {
            compileButton.disabled = !state.fs;
            compileButton.textContent = originalText;
          }, 1800);
        }
      };
    }

    return {
      title: 'Compilation',
      icon: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 3.5h9l5 5v12H5z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M14 3.5v5h5M8 13h8M8 16.5h8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      render: renderCompilation
    };
  };
})();