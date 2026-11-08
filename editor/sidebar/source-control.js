(function() {
  window.EditorBuiltinFactories = window.EditorBuiltinFactories || {};
  window.EditorBuiltinFactories['source-control-diff'] = ctx => ({
    title: 'Diff Viewer',
    icon: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 4h14v16H5zM8 8h3m-3 4h3m2-4h3m-3 4h3M8 16h3m2 0h3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    async render(g, tab) {
      const data = tab.diffData || {};
      const wrap = document.createElement('div');
      wrap.className = 'source-control-diff-tab';
      const head = document.createElement('div');
      head.className = 'source-control-diff-tab-head';
      const heading = document.createElement('strong');
      heading.textContent = data.path || 'File diff';
      const status = document.createElement('span');
      status.textContent = 'Read only';
      head.append(heading, status);
      const host = document.createElement('div');
      host.className = 'source-control-diff-tab-editor';
      wrap.append(head, host);
      g.viewBody.appendChild(wrap);

      let disposed = false;
      tab._diffCleanup = () => { disposed = true; };
      const toBytes = value => {
        if (value instanceof Uint8Array) return value;
        if (value instanceof ArrayBuffer) return new Uint8Array(value);
        if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        if (typeof value === 'string') {
          const bytes = new Uint8Array(value.length);
          for (let i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i) & 255;
          return bytes;
        }
        if (Array.isArray(value)) return Uint8Array.from(value);
        return new Uint8Array(value || []);
      };
      const decode = value => new TextDecoder('utf-8', {fatal:false}).decode(toBytes(value));
      try {
        if (data.type === 'modified' && !data.oldSha) {
          throw new Error('The previous GitHub version could not be matched to this file. Refresh Source Control and try again.');
        }
        const oldBytes = data.type === 'added'
          ? new Uint8Array()
          : data.oldSha
            ? await window.GitHubService.readBlob(data.owner, data.repo, data.oldSha)
            : new Uint8Array();
        if (disposed || !host.isConnected) return wrap;

        let workingBytes = data.newBytes || new Uint8Array();
        if (data.type !== 'deleted' && ctx.state.fs?.readFileSync && (data.fsPath || data.path)) {
          const liveBytes = ctx.state.fs.readFileSync(data.fsPath || data.path, 'binary');
          if (liveBytes != null) workingBytes = liveBytes;
        }
        const oldText = decode(oldBytes);
        const newText = data.type === 'deleted' ? '' : decode(workingBytes);
        if (data.type === 'modified' && !oldText.length && !newText.length) {
          throw new Error('Both versions were read as empty. The diff was stopped rather than showing a misleading blank comparison.');
        }
        if (oldText.includes('\\0') || newText.includes('\\0')) {
          throw new Error('This file appears to be binary and cannot be shown as a text diff.');
        }

        // Render the comparison directly in the workbench instead of relying
        // on Monaco's diff widget. Monaco was mounting (overview markers were
        // visible) but leaving both text panes black in this workbench layout.
        const oldLines = oldText.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n').split('\\n');
        const newLines = newText.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n').split('\\n');
        const pairs = [];
        const n = oldLines.length, m = newLines.length;
        if (n * m <= 1200000) {
          const dp = Array.from({length:n + 1}, () => new Uint32Array(m + 1));
          for (let i = n - 1; i >= 0; i--) {
            for (let j = m - 1; j >= 0; j--) {
              dp[i][j] = oldLines[i] === newLines[j]
                ? dp[i + 1][j + 1] + 1
                : Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
          }
          let i = 0, j = 0;
          while (i < n || j < m) {
            if (i < n && j < m && oldLines[i] === newLines[j]) {
              pairs.push({oldLine:oldLines[i], newLine:newLines[j], oldNo:i + 1, newNo:j + 1, kind:'same'}); i++; j++;
            } else if (i < n && (j >= m || dp[i + 1][j] >= dp[i][j + 1])) {
              pairs.push({oldLine:oldLines[i], newLine:null, oldNo:i + 1, newNo:null, kind:'removed'}); i++;
            } else {
              pairs.push({oldLine:null, newLine:newLines[j], oldNo:null, newNo:j + 1, kind:'added'}); j++;
            }
          }
        } else {
          const count = Math.max(n, m);
          for (let i = 0; i < count; i++) {
            const a = oldLines[i] ?? null, b = newLines[i] ?? null;
            pairs.push({oldLine:a,newLine:b,oldNo:a === null ? null : i + 1,newNo:b === null ? null : i + 1,kind:a === b ? 'same' : a === null ? 'added' : b === null ? 'removed' : 'changed'});
          }
        }

        const grid = document.createElement('div');
        grid.className = 'source-control-diff-grid';
        const makePane = label => {
          const pane = document.createElement('section');
          pane.className = 'source-control-diff-pane';
          const bar = document.createElement('div');
          bar.className = 'source-control-diff-pane-title';
          bar.textContent = label;
          const body = document.createElement('div');
          body.className = 'source-control-diff-lines';
          pane.append(bar, body);
          return {pane, body};
        };
        const left = makePane('Previous version');
        const right = makePane('Working tree');
        const makeLine = (number, value, kind) => {
          const row = document.createElement('div');
          row.className = 'source-control-diff-line' + (kind && kind !== 'same' ? ' is-' + kind : '');
          const lineNo = document.createElement('span');
          lineNo.className = 'source-control-diff-line-number';
          lineNo.textContent = number == null ? '' : String(number);
          const code = document.createElement('pre');
          code.className = 'source-control-diff-line-text';
          code.textContent = value == null ? '' : value;
          row.append(lineNo, code);
          return row;
        };
        for (const pair of pairs) {
          left.body.appendChild(makeLine(pair.oldNo, pair.oldLine, pair.kind === 'added' ? 'empty' : pair.kind));
          right.body.appendChild(makeLine(pair.newNo, pair.newLine, pair.kind === 'removed' ? 'empty' : pair.kind));
        }
        grid.append(left.pane, right.pane);
        host.replaceChildren(grid);
        const sync = (source, target) => {
          if (target.scrollTop !== source.scrollTop) target.scrollTop = source.scrollTop;
          if (target.scrollLeft !== source.scrollLeft) target.scrollLeft = source.scrollLeft;
        };
        left.body.addEventListener('scroll', () => sync(left.body, right.body), {passive:true});
        right.body.addEventListener('scroll', () => sync(right.body, left.body), {passive:true});
      } catch (error) {
        if (!disposed) {
          const message = document.createElement('div');
          message.className = 'source-control-diff-error';
          message.textContent = error?.message || String(error);
          host.appendChild(message);
        }
      }
      return wrap;
    },
    dispose(tab) { tab._diffCleanup?.(); }
  });
})();
(function() {
  const root = window.EditorSidebar = window.EditorSidebar || {};
  root.SourceControl = function(options) {
    const {tree, state} = options;
    const github = window.GitHubService;
    const configKey = () => 'editor.github.project.' + encodeURIComponent(state.projectId || 'workspace');
    let repos = [];
    let branches = [];
    let selected = loadConfig();
    let refreshToken = 0;
    let branchLoadToken = 0;
    let statusToken = 0;
    let historyToken = 0;
    let commitBusy = false;
    let currentDiffState = null;
    let selectionProjectId = null;
    function esc(value) { return String(value ?? '').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\':'&#39;'}[ch])); }
    function loadConfig() {
      try { const value = JSON.parse(localStorage.getItem(configKey()) || 'null'); if (value?.owner && value?.repo) return {...value}; } catch (_) {}
      return {owner:'', repo:'', branch:'main'};
    }
    function saveConfig() { try { localStorage.setItem(configKey(), JSON.stringify(selected)); } catch (_) {} }
    function syncSelection() {
      const currentProjectId = String(state.projectId || 'workspace');
      if (selectionProjectId === currentProjectId) return;
      selectionProjectId = currentProjectId;
      const remote = state.gitRemote?.provider === 'github' ? state.gitRemote : null;
      if (remote?.owner && remote?.repo) {
        selected = {owner:String(remote.owner), repo:String(remote.repo), branch:String(remote.branch || 'main')};
        saveConfig();
        branches = [];
        return;
      }
      const id = String(state.projectId || '');
      const match = id.match(/^github:([^/]+)\/([^@]+)@(.+)$/);
      if (match) {
        selected = {owner:match[1], repo:match[2], branch:match[3] || 'main'};
        saveConfig();
        branches = [];
        return;
      }
      selected = loadConfig();
      if (selected.owner && selected.repo) {
        state.gitRemote = {provider:'github', owner:String(selected.owner), repo:String(selected.repo), branch:String(selected.branch || 'main')};
        state.deploymentSettings = {...(state.deploymentSettings || {}), branch: state.deploymentSettings?.branch || String(selected.branch || 'main')};
        try { state.saveProjectMetadata?.(); } catch (_) {}
      }
    }
    function show() { syncSelection(); renderShell(); void refresh(); }
    function isLocalProject() { return !state.gitRemote?.provider; }
    function setLocalGitRemote(owner, repo, branch = 'main') {
      state.gitSubmodules = [];
      state.gitRemote = {provider:'github', owner:String(owner), repo:String(repo), branch:String(branch || 'main')};
      try { state.saveProjectMetadata?.(); } catch (_) {}
      selected = {owner:String(owner), repo:String(repo), branch:String(branch || 'main')};
      selectionProjectId = String(state.projectId || 'workspace');
      saveConfig();
    }
    function renderShell() {
      tree.classList.remove('activity-collapsed');
      if (!github?.isSignedIn?.()) {
        tree.innerHTML = `<div class="source-control-sidebar"><div class="activity-sidebar-title">Source Control</div><div class="source-control-empty"><strong>Sign in to GitHub</strong><span>Source Control uses your GitHub account to load repositories and push commits.</span><button data-open-profile>Open Profile</button></div></div>`;
        tree.querySelector('[data-open-profile]')?.addEventListener('click', () => state.sidebarController?.show('Profile'));
        return;
      }
      const localProject = isLocalProject();
      tree.innerHTML = `<div class="source-control-sidebar">
        <div class="source-control-head"><div class="activity-sidebar-title">Source Control</div><button data-refresh title="Refresh">↻</button></div>
        ${!selected.repo ? `<section class="source-control-section"><div class="source-control-section-title">GitHub repository</div><div class="source-control-local-hint">No repository is selected. Connect this workspace to a new GitHub repository to start tracking and pushing changes.</div><button data-create-local-repo class="source-control-create-repo">Create GitHub Repository</button><div class="source-control-create-panel" data-create-panel hidden><label>Repository name<input data-create-name type="text" placeholder="my-game" spellcheck="false"></label><label>Description<input data-create-description type="text" placeholder="Optional"></label><label class="source-control-private"><input data-create-private type="checkbox"> Private repository</label><div class="source-control-create-actions"><button data-create-cancel>Cancel</button><button data-create-confirm class="primary">Create Repository</button></div></div></section>` : ''}
        <section class="source-control-section">
          <div class="source-control-label">Repository</div>
          <div class="source-control-select-row"><select data-repo ${repos.length ? '' : 'disabled'}><option value="">${repos.length ? 'Select repository…' : 'Loading repositories…'}</option>${repos.map(r => `<option value="${esc(r.fullName)}" ${r.fullName === `${selected.owner}/${selected.repo}` ? 'selected' : ''}>${esc(r.fullName)}${r.private ? ' · private' : ''}</option>`).join('')}</select><button data-repo-refresh title="Refresh repositories">↻</button></div>
          <div class="source-control-select-row"><select data-branch ${branches.length ? '' : 'disabled'}><option value="">${branches.length ? 'Select branch…' : (selected.repo ? 'Loading branches…' : 'Select repository first')}</option>${branches.map(branch => `<option value="${esc(branch)}" ${branch === selected.branch ? 'selected' : ''}>${esc(branch)}</option>`).join('')}</select><button data-branch-refresh title="Refresh branches">↻</button></div>
        </section>
        ${selected.repo ? `<section class="source-control-section"><div class="source-control-section-title">Changes</div><div data-changes class="source-control-changes"><div class="source-control-loading">Checking working tree…</div></div><div class="source-control-submodule-section"><div class="source-control-submodule-heading"><div class="source-control-section-title">Submodules</div><button type="button" data-submodule-add>Add</button></div><div data-submodules class="source-control-submodules"><div class="source-control-loading">Checking submodules…</div></div><div class="source-control-submodule-form" data-submodule-form hidden><label>GitHub repository URL<input data-submodule-url type="text" placeholder="https://github.com/owner/repository" spellcheck="false"></label><div class="source-control-submodule-form-row"><label>Path<input data-submodule-path type="text" placeholder="vendor/repository" spellcheck="false"></label><label>Parent<select data-submodule-parent><option value="">Workspace root</option></select></label></div><label>Branch<input data-submodule-branch type="text" placeholder="Default branch, or . to follow parent"></label><div class="source-control-submodule-form-actions"><button type="button" data-submodule-cancel>Cancel</button><button type="button" data-submodule-confirm class="primary">Add Submodule</button></div></div></div><textarea data-commit-message placeholder="Commit message" rows="3"></textarea><button class="source-control-commit" data-commit disabled>Commit & Push</button><div data-status class="source-control-status"></div></section><section class="source-control-section"><div class="source-control-section-title">History</div><div data-history class="source-control-history"><div class="source-control-loading">Loading commits…</div></div></section>` : `<div class="source-control-empty"><strong>Select a repository</strong><span>Once a repository is selected, the editor compares this workspace against the selected branch.</span></div>`}
      </div>`;
      const parentSelect = tree.querySelector('[data-submodule-parent]');
      if (parentSelect) parentSelect.innerHTML = '<option value="">Workspace root</option>' + (state.gitSubmodules || []).filter(module => !module.removed).map(module => '<option value="' + esc(module.path) + '">' + esc(module.path) + '</option>').join('');
      tree.querySelector('[data-refresh]')?.addEventListener('click', () => refresh());
      const createLocalButton = tree.querySelector('[data-create-local-repo]');
      const createPanel = tree.querySelector('[data-create-panel]');
      createLocalButton?.addEventListener('click', () => { createPanel.hidden = !createPanel.hidden; if (!createPanel.hidden) createPanel.querySelector('[data-create-name]')?.focus(); });
      createPanel?.querySelector('[data-create-cancel]')?.addEventListener('click', () => { createPanel.hidden = true; });
      createPanel?.querySelector('[data-create-confirm]')?.addEventListener('click', async () => {
        const name = createPanel.querySelector('[data-create-name]')?.value.trim();
        const description = createPanel.querySelector('[data-create-description]')?.value.trim();
        const privateRepo = !!createPanel.querySelector('[data-create-private]')?.checked;
        const button = createPanel.querySelector('[data-create-confirm]');
        if (!name) { createPanel.querySelector('[data-create-name]')?.focus(); return; }
        button.disabled = true; button.textContent = 'Creating…';
        try {
          const created = await github.createRepository({name, description, privateRepo, autoInit:false});
          const owner = created?.owner?.login || github.getUser()?.login;
          const repo = created?.name || name;
          const branch = created?.default_branch || 'main';
          if (!owner || !repo) throw new Error('GitHub did not return the new repository details.');
          // Bind the workspace to the newly-created repository immediately.
          // Do not make the user select the repo/branch again.
          setLocalGitRemote(owner, repo, branch);
          state.runDebugRefresh?.();
          selected = {owner:String(owner), repo:String(repo), branch:String(branch)};
          branches = [String(branch)];
          // The repository was created after the repository list was loaded.
          // Add it to the in-memory list immediately so the UI stays selected
          // on the new repo instead of falling back to "Select repository…".
          const fullName = String(owner) + '/' + String(repo);
          if (!repos.some(item => item.fullName === fullName)) {
            repos = [...repos, {
              id: created?.id,
              name: String(repo),
              fullName,
              owner: String(owner),
              private: !!created?.private,
              defaultBranch: String(branch),
              permissions: {push:true}
            }];
          }
          saveConfig();

          // GitHub may take a moment to provision the Git database after the
          // repository itself has been created. commitAndPush waits through
          // that transient 409 state before creating the initial commit.
          button.textContent = 'Initializing…';
          showStatus('Waiting for GitHub to initialize the repository…');
          const initialCommit = await github.commitAndPush({
            owner:String(owner),
            repo:String(repo),
            branch:String(branch),
            message:'Initialized Repository',
            fs:state.fs
          });
          if (!initialCommit.changed) {
            throw new Error('The new GitHub repository could not be initialized because the workspace has no files.');
          }

          // The repository is already selected. Refresh only the state that
          // changed instead of rebuilding the entire sidebar and racing
          // several independent repository/branch requests.
          selected = {owner:String(owner), repo:String(repo), branch:String(branch)};
          branches = [String(branch)];
          saveConfig();
          renderShell();
          await refreshStatus();
          await loadHistory();
        } catch (e) {
          button.disabled = false; button.textContent = 'Create Repository';
          showStatus(e.message || String(e), true);
        }
      });
      tree.querySelector('[data-repo-refresh]')?.addEventListener('click', () => loadRepositories(true));
      tree.querySelector('[data-branch-refresh]')?.addEventListener('click', () => selected.repo && loadBranches(true));
      tree.querySelector('[data-repo]')?.addEventListener('change', async e => {
        const fullName = e.target.value;
        if (!fullName) { ++branchLoadToken; ++refreshToken; selected = {owner:'', repo:'', branch:'main'}; branches = []; state.gitRemote = null; state.deploymentSettings = {...(state.deploymentSettings || {}), branch:'', commit:''}; state.saveProjectMetadata?.(); saveConfig(); state.runDebugRefresh?.(); renderShell(); return; }
        const [owner, ...repoParts] = fullName.split('/');
        selected = {owner, repo:repoParts.join('/'), branch:repos.find(r => r.fullName === fullName)?.defaultBranch || 'main'};
        state.gitSubmodules = [];
        state.gitRemote = {provider:'github', owner, repo:selected.repo, branch:selected.branch};
        state.deploymentSettings = {...(state.deploymentSettings || {}), branch: state.deploymentSettings?.branch || selected.branch};
        state.saveProjectMetadata?.(); state.markDirty?.('editor/project.json');
        saveConfig();
        ++branchLoadToken;
        branches = [];
        renderShell();
        await loadBranches(false);
        await refreshStatus();
      });
      tree.querySelector('[data-branch]')?.addEventListener('change', e => {
        selected.branch = e.target.value || 'main';
        state.gitRemote = {provider:'github', owner:selected.owner, repo:selected.repo, branch:selected.branch};
        state.saveProjectMetadata?.(); state.markDirty?.('editor/project.json');
        saveConfig(); state.runDebugRefresh?.(); void refreshStatus(); void loadHistory();
      });
      tree.querySelector('[data-commit]')?.addEventListener('click', () => void commit());
      const submoduleForm = tree.querySelector('[data-submodule-form]');
      tree.querySelector('[data-submodule-add]')?.addEventListener('click', () => {
        submoduleForm.hidden = !submoduleForm.hidden;
        if (!submoduleForm.hidden) submoduleForm.querySelector('[data-submodule-url]')?.focus();
      });
      submoduleForm?.querySelector('[data-submodule-cancel]')?.addEventListener('click', () => { submoduleForm.hidden = true; });
      submoduleForm?.querySelector('[data-submodule-confirm]')?.addEventListener('click', async () => {
        const url = submoduleForm.querySelector('[data-submodule-url]')?.value.trim();
        const path = submoduleForm.querySelector('[data-submodule-path]')?.value.trim();
        const parentPath = submoduleForm.querySelector('[data-submodule-parent]')?.value || '';
        const branch = submoduleForm.querySelector('[data-submodule-branch]')?.value.trim() || '';
        const button = submoduleForm.querySelector('[data-submodule-confirm]');
        if (!url || !path) { showStatus('Enter a repository URL and submodule path.', true); return; }
        button.disabled = true;
        button.textContent = 'Downloading…';
        try {
          const module = await state.addGitSubmodule({url, path, parentPath, branch});
          showStatus('Added ' + module.path + '. Review the changes and commit to push the gitlink.');
          renderShell();
          await refreshStatus();
        } catch (error) { showStatus(error.message || String(error), true); }
        finally {
          if (button.isConnected) { button.disabled = false; button.textContent = 'Add Submodule'; }
        }
      });
    }
    async function loadRepositories(force = false) {
      if (!github.isSignedIn()) return;
      try {
        syncSelection();
        if (!force && repos.length) return;
        repos = await github.listRepositories();
        if (selected.repo && !repos.some(r => r.fullName === `${selected.owner}/${selected.repo}`)) selected = {owner:'', repo:'', branch:'main'};
        saveConfig();
        renderShell();
        if (selected.repo) await loadBranches(false);
      } catch (e) { showStatus(e.message || String(e), true); }
    }
    async function loadBranches(force = false) {
      if (!selected.repo || !selected.owner) return;
      if (!force && branches.length) return;
      const token = ++branchLoadToken;
      const owner = selected.owner, repo = selected.repo, branch = selected.branch;
      try {
        const loaded = await github.listBranches(owner, repo);
        if (token !== branchLoadToken || selected.owner !== owner || selected.repo !== repo) return;
        branches = loaded.length ? loaded : [branch || 'main'];
        if (!branches.includes(selected.branch)) selected.branch = branches[0];
        saveConfig();
        renderShell();
        await refreshStatus();
        await loadHistory();
      } catch (e) {
        if (token !== branchLoadToken || selected.owner !== owner || selected.repo !== repo) return;
        if (e?.status === 409 || e?.status === 404) {
          branches = [selected.branch || 'main'];
          renderShell();
          await refreshStatus();
          await loadHistory();
          return;
        }
        showStatus(e.message || String(e), true);
      }
    }
    async function refresh() {
      const token = ++refreshToken;
      try {
        if (!github.isSignedIn()) { renderShell(); return; }
        await loadRepositories(true);
        if (token !== refreshToken || !selected.repo) return;
        if (!branches.length) await loadBranches(false);
        await refreshStatus();
        await loadHistory();
      } catch (e) { if (token === refreshToken) showStatus(e.message || String(e), true); }
    }
    async function refreshStatus() {
      const token = ++statusToken;
      const changesEl = tree.querySelector('[data-changes]');
      if (!changesEl || !selected.repo || !state.fs) return;
      changesEl.innerHTML = '<div class="source-control-loading">Checking working tree…</div>';
      try {
        const repoInfo = repos.find(r => r.fullName === `${selected.owner}/${selected.repo}`);
        const canPush = repoInfo ? repoInfo.permissions?.push !== false : true;
        const remote = await github.getRemoteState(selected.owner, selected.repo, selected.branch || 'main');
        if (token !== statusToken) return;
        if (remote.unavailable) {
          changesEl.innerHTML = '<div class="source-control-loading">GitHub is still initializing this repository…</div>';
          const button = tree.querySelector('[data-commit]');
          if (button) button.disabled = true;
          showStatus('GitHub is still initializing this repository…');
          return;
        }
        if (remote.truncated) {
          currentDiffState = null;
          changesEl.innerHTML = '<div class="source-control-error">GitHub returned an incomplete repository tree. Changes are hidden because showing a partial comparison can produce false additions and deletions.</div>';
          const button = tree.querySelector('[data-commit]');
          if (button) button.disabled = true;
          showStatus('GitHub truncated the remote tree; Source Control cannot safely compare or commit this repository.', true);
          return;
        }
        const submoduleRoots = (state.gitSubmodules || []).filter(module => !module.removed && !module.parentPath);
        const changes = await github.compareWorkingTree(state.fs, remote.tree, {excludePaths:submoduleRoots.map(module => module.path)});
        currentDiffState = {remote, changes};
        const submoduleStatuses = await github.getSubmoduleStatuses(state.fs, state.gitSubmodules || []);
        if (token !== statusToken) return;
        const renderSubmodules = (items, depth = 0, parentBranch = selected.branch || 'main') => (items || []).map(module => {
          const label = module.pendingCommitSha ? 'Pushed · parent pending' : module.dirty ? 'Modified' : 'Clean';
          const statusClass = module.pendingCommitSha ? 'pending' : module.dirty ? 'modified' : 'clean';
          const targetBranch = module.configuredBranch === '.' ? parentBranch : module.branch || 'main';
          return `<div class="source-control-submodule ${statusClass}" style="padding-left:${Math.min(depth, 8) * 12}px"><span class="source-control-submodule-dot"></span><div><strong>${esc(module.path)}</strong><span>${esc(module.owner + '/' + module.repo)} · ${esc(targetBranch)}</span></div><em>${label}</em></div>${renderSubmodules(module.children, depth + 1, targetBranch)}`;
        }).join('');
        const allSubmodules = [];
        const collectSubmodules = items => (items || []).forEach(module => { allSubmodules.push(module); collectSubmodules(module.children); });
        collectSubmodules(submoduleStatuses);
        const submoduleDirty = allSubmodules.some(module => module.dirty);
        const submoduleBlocked = allSubmodules.some(module => !module.canPush && (!!module.changes?.length || (module.children || []).some(child => child.dirty)));
        const submoduleElement = tree.querySelector('[data-submodules]');
        if (submoduleElement) {
          submoduleElement.innerHTML = submoduleStatuses.length ? renderSubmodules(submoduleStatuses) : '<div class="source-control-clean">No submodules</div>';
          submoduleElement.querySelectorAll('.source-control-submodule').forEach(row => {
            const path = row.querySelector('strong')?.textContent || '';
            if (!path) return;
            const actions = document.createElement('div');
            actions.className = 'source-control-submodule-actions';
            for (const [action, label] of [['rename','Rename'],['update','Update'],['remove','Remove']]) {
              const button = document.createElement('button');
              button.type = 'button';
              button.textContent = label;
              button.dataset.submoduleAction = action;
              button.dataset.submodulePath = path;
              actions.appendChild(button);
            }
            row.appendChild(actions);
          });
          submoduleElement.querySelectorAll('[data-submodule-action]').forEach(button => button.addEventListener('click', async () => {
            const action = button.dataset.submoduleAction;
            const path = button.dataset.submodulePath;
            const module = (state.gitSubmodules || []).find(item => !item.removed && item.path === path);
            if (!module) return;
            button.disabled = true;
            try {
              if (action === 'remove') {
                if (!window.confirm('Remove submodule "' + path + '" and discard its local contents? This is staged locally until you commit.')) return;
                state.removeGitSubmodule(path);
                showStatus('Removed ' + path + '. Commit to remove its gitlink from GitHub.');
              } else if (action === 'rename') {
                const prefix = module.parentPath ? module.parentPath + '/' : '';
                const current = module.path.slice(prefix.length);
                const nextPath = window.prompt('New submodule path (relative to its parent)', current);
                if (nextPath == null || !nextPath.trim()) return;
                state.renameGitSubmodule(path, nextPath.trim());
                showStatus('Renamed ' + path + '. Commit to update its gitlink path.');
              } else if (action === 'update') {
                const url = window.prompt('GitHub repository URL', module.url || 'https://github.com/' + module.owner + '/' + module.repo);
                if (url == null || !url.trim()) return;
                const branch = window.prompt('Branch (blank keeps the current/default branch; use . to follow parent)', module.configuredBranch || module.branch || '');
                if (branch == null) return;
                if (!window.confirm('Updating replaces the submodule contents at the selected revision and discards local edits inside it. Continue?')) return;
                await state.updateGitSubmodule({path, url:url.trim(), branch});
                showStatus('Updated ' + path + '. Commit to push the new pinned revision.');
              }
              renderShell();
              await refreshStatus();
            } catch (error) { showStatus(error.message || String(error), true); }
            finally { if (button.isConnected) button.disabled = false; }
          }));
        }

        const showHidden = !!state.behavior?.showHiddenFolders;
        const visibleChanges = [];
        let settingsChanged = false;
        for (const change of changes) {
          const path = String(change.path || '').replace(/^\/+/, '');
          if (path === '.editor' || path.startsWith('.editor/')) {
            settingsChanged = true;
            if (showHidden) visibleChanges.push(change);
          } else visibleChanges.push(change);
        }
        if (!showHidden && settingsChanged) visibleChanges.push({path:'.editor', type:'modified', settings:true});
        changesEl.innerHTML = visibleChanges.length ? visibleChanges.map(c => {
          if (c.settings) return `<div class="source-control-change"><span class="source-control-change-type source-modified">M</span><span>Settings changed</span></div>`;
          return `<button type="button" class="source-control-change source-control-change-open" data-diff-path="${esc(c.path)}" title="View changes in ${esc(c.path)}"><span class="source-control-change-type source-${c.type}">${c.type === 'modified' ? 'M' : c.type === 'added' ? 'A' : 'D'}</span><span>${esc(c.path)}</span><span class="source-control-diff-indicator">Diff</span></button>`;
        }).join('') : '<div class="source-control-clean">No changes</div>';
        changesEl.dataset.count = String(changes.length);
        changesEl.querySelectorAll('[data-diff-path]').forEach(row => row.addEventListener('click', () => openFileDiff(row.dataset.diffPath)));
        const button = tree.querySelector('[data-commit]');
        const isInitialCommit = !!remote.empty || !remote.commitSha;
        if (button) {
          button.disabled = commitBusy || (!changes.length && !submoduleDirty) || !canPush || submoduleBlocked;
          button.textContent = isInitialCommit ? 'Initial Commit & Push' : 'Commit & Push';
          button.title = canPush ? (isInitialCommit ? 'Create the first commit on this empty GitHub repository.' : '') : 'You do not have push permission for this repository.';
        }
        if (!canPush) showStatus('This repository is read-only for your GitHub account.', true);
        else if (submoduleBlocked) showStatus('A modified submodule is read-only. Grant push access to its repository or discard its changes.', true);
        else if (remote.truncated) showStatus('GitHub truncated the remote tree; large repositories may need a more focused sync later.', true);
        else if (isInitialCommit && changes.length) showStatus('This GitHub repository has no commits yet. Your next commit will become its initial commit.');
        else clearStatus();
      } catch (e) {
        if (token !== statusToken) return;
        changesEl.innerHTML = `<div class="source-control-error">${esc(e.message || String(e))}</div>`;
        const button = tree.querySelector('[data-commit]');
        if (button) button.disabled = true;
      }
    }

    async function openFileDiff(path) {
      const snapshot = currentDiffState;
      if (!snapshot || !state.fs || !selected.repo) return;
      const change = snapshot.changes.find(item => item.path === path);
      if (!change) return;
      const oldEntry = (snapshot.remote.tree || []).find(entry => entry.path === path && entry.type === 'blob');
      const fsPath = change.fsPath || path;
      const tab = state.openDiffTab?.({
        title:'Diff: ' + path.split('/').pop(),
        diffData:{
          path,
          fsPath,
          type:change.type,
          owner:selected.owner,
          repo:selected.repo,
          oldSha:oldEntry?.sha || null,
          // Read the file again here and normalize the filesystem's binary
          // representation instead of carrying compareWorkingTree's buffer
          // through the Workbench tab object.
          newBytes: (() => {
            try {
              const raw = state.fs.readFileSync(fsPath, 'binary');
              if (raw == null) throw new Error('Workspace file is unavailable: ' + fsPath);
              if (raw instanceof Uint8Array) return raw;
              if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
              if (ArrayBuffer.isView(raw)) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
              if (typeof raw === 'string') {
                const bytes = new Uint8Array(raw.length);
                for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 255;
                return bytes;
              }
              return new Uint8Array(raw || []);
            } catch (_) { return change.data || new Uint8Array(); }
          })()
        }
      });
      if (!tab) showStatus('Could not open the diff viewer.', true);
    }

    async function loadHistory() {
      const token = ++historyToken;
      const historyEl = tree.querySelector('[data-history]');
      if (!historyEl || !selected.repo) return;
      historyEl.innerHTML = '<div class="source-control-loading">Loading commits…</div>';
      try {
        const commits = await github.listCommits(selected.owner, selected.repo, selected.branch || 'main', 20);
        if (token !== historyToken) return;
        historyEl.innerHTML = commits.length ? commits.map(commit => `<button type="button" class="source-control-commit-row" data-commit-sha="${esc(commit.sha)}"><div><strong>${esc(commit.message || '(no message)')}</strong><span>${esc(commit.author)} · ${commit.date ? new Date(commit.date).toLocaleString() : ''}</span></div><code>${esc(commit.sha.slice(0, 7))}</code></button>`).join('') : '<div class="source-control-empty-inline">No commits on this branch.</div>';
        historyEl.querySelectorAll('[data-commit-sha]').forEach(row => row.addEventListener('click', () => openCommitRestore(row.dataset.commitSha)));
      } catch (e) {
        if (token === historyToken) historyEl.innerHTML = `<div class="source-control-error">${esc(e.message || String(e))}</div>`;
      }
    }

    async function openCommitRestore(commitSha) {
      if (!selected.repo || !commitSha) return;
      let commit = null;
      try {
        const commits = await github.listCommits(selected.owner, selected.repo, selected.branch || 'main', 100);
        commit = commits.find(item => item.sha === commitSha) || {sha:commitSha, message:'Selected commit', author:'Unknown', date:''};
      } catch (_) {
        commit = {sha:commitSha, message:'Selected commit', author:'Unknown', date:''};
      }

      const existing = document.querySelector('.source-control-restore-modal');
      existing?.remove();
      const modal = document.createElement('div');
      modal.className = 'source-control-restore-modal';
      modal.innerHTML = `<div class="source-control-restore-dialog" role="dialog" aria-modal="true">
        <div class="source-control-restore-title">Return workspace to this commit?</div>
        <div class="source-control-restore-info"><strong>${esc(commit.message || '(no message)')}</strong><span>${esc(commit.author || 'Unknown')} · ${commit.date ? new Date(commit.date).toLocaleString() : ''}</span><code>${esc(commit.sha.slice(0, 7))}</code></div>
        <p>This changes the local workspace to exactly match this commit. Nothing is pushed yet. You can review the changes and make a new commit to create an undo/revert commit on the branch.</p>
        <div class="source-control-restore-actions"><button data-restore-cancel>Cancel</button><button data-restore-confirm class="primary">Restore Workspace</button></div>
        <div data-restore-status class="source-control-restore-status"></div>
      </div>`;
      document.body.appendChild(modal);
      const close = () => modal.remove();
      modal.querySelector('[data-restore-cancel]').onclick = close;
      modal.addEventListener('click', e => { if (e.target === modal) close(); });
      const confirmButton = modal.querySelector('[data-restore-confirm]');
      const status = modal.querySelector('[data-restore-status]');
      confirmButton.onclick = async () => {
        confirmButton.disabled = true;
        confirmButton.textContent = 'Restoring…';
        status.textContent = '';
        try {
          if (typeof JSZip === 'undefined') throw new Error('JSZip is unavailable, so the commit archive cannot be restored.');
          const ignoreNodeModules = state.behavior?.ignoreNodeModules !== false;
          const isNodeModulesPath = path => ignoreNodeModules && String(path || '').replace(/^\/+/, '').split('/').includes('node_modules');
          const formatBytes = value => {
            const size = Number(value) || 0;
            if (size < 1024) return size + ' B';
            if (size < 1024 * 1024) return (size / 1024).toFixed(size < 10240 ? 1 : 0) + ' KB';
            return (size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0) + ' MB';
          };

          // A ZIP archive replaces thousands of serial Git blob requests with
          // one streamed download. GitHub accepts a commit SHA as the archive ref.
          const archive = await github.downloadArchive(selected.owner, selected.repo, commitSha, {
            onProgress(received, total) {
              status.textContent = total
                ? `Downloading commit archive… ${formatBytes(received)} / ${formatBytes(total)}`
                : `Downloading commit archive… ${formatBytes(received)} received`;
            }
          });
          if (!archive?.size) throw new Error('GitHub returned an empty commit archive.');

          status.textContent = 'Inspecting commit archive…';
          const zip = await JSZip.loadAsync(archive, {
            onUpdate(meta) {
              status.textContent = `Inspecting commit archive… ${Math.round(Number(meta?.percent) || 0)}%`;
            }
          });
          const archiveEntries = [];
          const topLevels = new Set();
          let hasRootFile = false;
          zip.forEach((relativePath, entry) => {
            const path = String(relativePath || '').replace(/^\/+|\/+$/g, '');
            if (!path) return;
            const parts = path.split('/');
            if (parts.length === 1) {
              if (!entry.dir) hasRootFile = true;
              return;
            }
            topLevels.add(parts[0]);
            archiveEntries.push({path, entry});
          });

          // GitHub wraps repository archives in a single <repo>-<sha> folder.
          const wrapper = !hasRootFile && topLevels.size === 1 && archiveEntries.length ? [...topLevels][0] : '';
          const files = archiveEntries
            .filter(item => !item.entry.dir)
            .map(item => ({
              path: wrapper && item.path.startsWith(wrapper + '/') ? item.path.slice(wrapper.length + 1) : item.path,
              entry: item.entry
            }))
            .filter(item => item.path && item.path !== '.git' && !item.path.startsWith('.git/') && !isNodeModulesPath(item.path));

          // Extract a few files at a time. This keeps the UI responsive without
          // creating thousands of concurrent decompression jobs.
          const restoredFiles = new Array(files.length);
          let cursor = 0;
          let extracted = 0;
          const workers = Array.from({length:Math.min(8, files.length)}, async () => {
            while (cursor < files.length) {
              const index = cursor++;
              const item = files[index];
              restoredFiles[index] = {path:item.path, bytes:await item.entry.async('uint8array')};
              extracted++;
              if (extracted % 20 === 0 || extracted === files.length) {
                status.textContent = `Extracting files… ${extracted}/${files.length}`;
              }
            }
          });
          await Promise.all(workers);

          // Replace the workspace while preserving node_modules when the
          // editor's ignoreNodeModules setting is enabled.
          status.textContent = 'Removing files from the current workspace…';
          const localPaths = state.fs.listFilesSync().map(path => String(path).replace(/^\/+/, '')).filter(Boolean);
          for (const path of localPaths) {
            if (!isNodeModulesPath(path)) state.fs.deleteFileSync(path);
          }
          const localDirs = typeof state.fs.listDirectoriesSync === 'function'
            ? state.fs.listDirectoriesSync().map(path => String(path).replace(/^\/+/, '')).filter(Boolean)
            : [];
          const preservedNodeModulesDirs = ignoreNodeModules ? localDirs.filter(isNodeModulesPath) : [];
          for (const dir of localDirs.sort((a,b) => b.split('/').length - a.split('/').length)) {
            if (isNodeModulesPath(dir) || preservedNodeModulesDirs.some(path => path.startsWith(dir + '/'))) continue;
            state.fs.deleteDirectorySync?.(dir);
          }

          for (let index = 0; index < restoredFiles.length; index++) {
            const file = restoredFiles[index];
            state.fs.writeFileSync(file.path, file.bytes);
            if ((index + 1) % 20 === 0 || index + 1 === restoredFiles.length) {
              status.textContent = `Writing files… ${index + 1}/${restoredFiles.length}`;
            }
          }
          if (state.loadGitSubmodules) {
            status.textContent = 'Loading submodules from restored commit…';
            await state.loadGitSubmodules(selected.owner, selected.repo, commitSha, selected.branch || 'main');
          }
          state.markDirty?.();
          state.runDebugRefresh?.();
          state.refreshExplorer?.();
          close();
          await refreshStatus();
          showStatus(`Workspace restored to ${commitSha.slice(0, 7)}. Review the changes and commit them to create a new revert point.`);
        } catch (e) {
          status.textContent = e.message || String(e);
          confirmButton.disabled = false;
          confirmButton.textContent = 'Restore Workspace';
        }
      };
    }

    async function commit() {
      const button = tree.querySelector('[data-commit]');
      const message = tree.querySelector('[data-commit-message]')?.value || '';
      if (!button || button.disabled || commitBusy) return;
      commitBusy = true;
      button.disabled = true;
      button.textContent = 'Pushing…';
      clearStatus();
      try {
        const result = await github.commitWorkspaceAndPush({owner:selected.owner, repo:selected.repo, branch:selected.branch || 'main', message, fs:state.fs, submodules:state.gitSubmodules || []});
        if (!result.changed) {
          showStatus('Nothing to commit.');
          return;
        }
        if (state.gitRemote?.provider === 'github') state.gitRemote.revision = result.commitSha;
        state.saveProjectMetadata?.();
        state.saveGitSubmodules?.();
        tree.querySelector('[data-commit-message]').value = '';
        showStatus(`Committed ${result.commitSha.slice(0, 7)} and pushed to ${selected.branch || 'main'}.`);
        // GitHub can briefly lag when the branch ref is read immediately after
        // a push. Wait for the new head before repainting the sidebar so the
        // changes/history view does not require leaving and reopening it.
        for (let attempt = 0; attempt < 8; attempt++) {
          const remote = await github.getRemoteState(selected.owner, selected.repo, selected.branch || 'main').catch(() => null);
          if (remote?.commitSha === result.commitSha) break;
          await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
        }
        await refreshStatus();
        await loadHistory();
      } catch (e) {
        state.saveGitSubmodules?.();
        showStatus(e.message || String(e), true);
        await refreshStatus();
      } finally {
        commitBusy = false;
        const currentButton = tree.querySelector('[data-commit]');
        if (currentButton) currentButton.textContent = 'Commit & Push';
        await refreshStatus();
      }
    }

    function showStatus(message, error = false) {
      const el = tree.querySelector('[data-status]');
      if (!el) return;
      el.textContent = message || '';
      el.classList.toggle('error', !!error);
    }
    function clearStatus() { showStatus(''); }
    return {show};
  };
})();
