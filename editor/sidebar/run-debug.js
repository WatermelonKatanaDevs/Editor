(function() {
  const root = window.EditorSidebar = window.EditorSidebar || {};
  root.RunDebug = function(options) {
    const {state, tree, runConfigured, logError} = options;
    let render = () => {};
    let deployment = {repo:null, branches:[], commits:[], loading:false};
    let commitLoadToken = 0;
    let overrides = {mode:null, branch:null, commit:null, usePeerServer:null, url:null, externalUrl:null, externalMode:null, hookUrl:null};
    const github = window.GitHubService;
    const esc = value => String(value ?? '').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
    function normalizeEditorPath(value) {
      const raw = String(value ?? '').trim();
      if (!raw) return '/';
      try {
        const url = new URL(raw, state.runConfig?.config?.domain || 'http://localhost:3000/');
        let path = url.pathname || '/';
        if (!path.startsWith('/')) path = '/' + path;
        const suffix = (url.search || '') + (url.hash || '');
        return (path === '/' ? '/' : path.replace(/\/+$/, '')) + suffix;
      } catch (_) {
        let path = raw;
        if (!path.startsWith('/')) path = '/' + path;
        return path === '/' ? '/' : path.replace(/\/+$/, '');
      }
    }
    function editorDomain() {
      const raw = String(state.runConfig?.config?.domain || 'http://localhost:3000/').trim();
      try { return new URL(raw).origin; } catch (_) { return raw.replace(/\/+$/, ''); }
    }
    function editorDeploymentURL(path) {
      const normalized = normalizeEditorPath(path);
      const base = editorDomain().replace(/\/+$/, '');
      return base + (normalized === '/' ? '/' : (normalized.startsWith('/') ? normalized : '/' + normalized));
    }

    function syncRemote() {
      if (state.gitRemote?.provider === 'github' && state.gitRemote.owner && state.gitRemote.repo) return state.gitRemote;
      const projectId = String(state.projectId || 'workspace');
      try {
        const value = JSON.parse(localStorage.getItem('editor.github.project.' + encodeURIComponent(projectId)) || 'null');
        if (value?.owner && value?.repo) {
          state.gitRemote = {provider:'github', owner:String(value.owner), repo:String(value.repo), branch:String(value.branch || 'main')};
          state.deploymentSettings = {...(state.deploymentSettings || {}), branch:state.deploymentSettings?.branch || state.gitRemote.branch};
          state.saveProjectMetadata?.();
        }
      } catch (_) {}
      return state.gitRemote?.provider === 'github' && state.gitRemote.owner && state.gitRemote.repo ? state.gitRemote : null;
    }
    function remote() { return syncRemote(); }
    function savedDeployment() {
      const d = state.deploymentSettings || {};
      const runUrl = state.runConfig?.publicUrl?.() || 'http://localhost:3000/';
      return {
        mode: d.mode === 'third-party' ? 'third-party' : 'editor',
        url: normalizeEditorPath(d.url || (state.runConfig?.config?.path || '/')),
        usePeerServer: !!d.usePeerServer,
        branch: String(d.branch || remote()?.branch || ''),
        commit: String(d.commit || ''),
        externalUrl: String(d.externalUrl || ''),
        externalMode: d.externalMode === 'emulate' ? 'emulate' : 'iframe',
        hookUrl: String(d.hookUrl || '')
      };
    }
    function effective() {
      const saved = savedDeployment();
      return {
        mode: overrides.mode === null ? saved.mode : overrides.mode,
        url: overrides.url === null ? saved.url : overrides.url,
        usePeerServer: overrides.usePeerServer === null ? saved.usePeerServer : overrides.usePeerServer,
        branch: overrides.branch === null ? (saved.branch || remote()?.branch || deployment.branches[0] || 'main') : overrides.branch,
        commit: overrides.commit === null ? saved.commit : overrides.commit,
        externalUrl: overrides.externalUrl === null ? saved.externalUrl : overrides.externalUrl,
        externalMode: overrides.externalMode === null ? saved.externalMode : overrides.externalMode,
        hookUrl: overrides.hookUrl === null ? saved.hookUrl : overrides.hookUrl
      };
    }
    function deploymentUrl() {
      const r = remote();
      if (!r) return '';
      const saved = savedDeployment(), e = effective();
      const url = new URL('deployment.html', location.href);
      url.searchParams.set('github', `https://github.com/${r.owner}/${r.repo}`);
      if (overrides.branch !== null && overrides.branch !== saved.branch) url.searchParams.set('branch', e.branch || '');
      if (overrides.commit !== null) url.searchParams.set('commit', overrides.commit || 'latest');
      if (overrides.mode !== null && overrides.mode !== saved.mode) url.searchParams.set('deploymentMode', e.mode);
      if (overrides.url !== null && overrides.url !== saved.url) url.searchParams.set('url', editorDeploymentURL(e.url));
      if (overrides.externalUrl !== null && overrides.externalUrl !== saved.externalUrl) url.searchParams.set('externalUrl', e.externalUrl);
      if (overrides.externalMode !== null && overrides.externalMode !== saved.externalMode) url.searchParams.set('externalMode', e.externalMode);
      if (overrides.hookUrl !== null && overrides.hookUrl !== saved.hookUrl) url.searchParams.set('hookUrl', e.hookUrl);
      if (overrides.usePeerServer !== null && overrides.usePeerServer !== saved.usePeerServer) {
        url.searchParams.set('peerServer', e.usePeerServer ? '1' : '0');
        if (e.usePeerServer) url.searchParams.set('peerLayer', String(state.peerSettings?.layer || 'peer'));
      }
      return url.href;
    }
    function resetOverrides() { overrides = {mode:null, branch:null, commit:null, usePeerServer:null, url:null, externalUrl:null, externalMode:null, hookUrl:null}; }
    function renderDeployment() {
      const section = tree.querySelector('[data-deployment]');
      if (!section) return;
      const r = remote();
      if (!github?.isSignedIn?.() || !r) { section.innerHTML = ''; return; }
      const saved = savedDeployment(), e = effective();
      section.innerHTML = `<div class="run-debug-section-title">Deployment</div>
        <div class="run-debug-field"><label>Deployment</label><select data-deploy-mode><option value="editor" ${e.mode==='editor'?'selected':''}>Editor</option><option value="third-party" ${e.mode==='third-party'?'selected':''}>Third Party</option></select></div>
        <div data-deploy-editor-fields>
          <div class="run-debug-field"><label>Editor URL</label><input data-deploy-url type="text" value="${esc(e.url || '/')}" placeholder="/" /></div>
          <label class="run-debug-toggle"><input data-deploy-peer type="checkbox" ${e.usePeerServer?'checked':''}> Use peerServer</label>
          <div data-deploy-editor-only>
            <div class="run-debug-field"><label>Branch</label><select data-deploy-branch ${deployment.branches.length ? '' : 'disabled'}><option value="" disabled>${deployment.branches.length ? 'Select branch…' : 'Loading branches…'}</option>${deployment.branches.map(b => `<option value="${esc(b)}" ${b===e.branch?'selected':''}>${esc(b)}</option>`).join('')}</select></div>
            <div class="run-debug-field"><label>Commit</label><select data-deploy-commit ${deployment.commits.length || e.commit ? '' : 'disabled'}><option value="" ${!e.commit?'selected':''}>Latest</option>${deployment.commits.map(c => `<option value="${esc(c.sha)}" ${c.sha===e.commit?'selected':''}>${esc(c.message || '(no message)')}</option>`).join('')}</select></div>
          </div>
        </div>
        <div data-deploy-third-fields>
          <div class="run-debug-field"><label>Deployment URL</label><input data-deploy-external-url type="text" value="${esc(e.externalUrl)}" placeholder="https://example.com/" /></div>
          <div class="run-debug-hook-field"><label>Deployment Hook</label><div class="run-debug-hook-row"><input data-deploy-hook type="text" value="${esc(e.hookUrl)}" placeholder="https://example.com/deploy-hook" /><button data-deploy-hook-trigger ${e.hookUrl?'':'disabled'}>Trigger</button></div></div>
        </div>
        <div class="run-debug-deploy-actions"><button data-deploy-save>Save Deployment Settings</button><button data-deploy-open class="primary">Open Deployment</button></div>`;

      const mode=section.querySelector('[data-deploy-mode]');
      const editorFields=section.querySelector('[data-deploy-editor-fields]');
      const thirdFields=section.querySelector('[data-deploy-third-fields]');
      const editorOnly=section.querySelector('[data-deploy-editor-only]');
      const urlInput=section.querySelector('[data-deploy-url]');
      const externalUrl=section.querySelector('[data-deploy-external-url]');
      const branch=section.querySelector('[data-deploy-branch]');
      const commit=section.querySelector('[data-deploy-commit]');
      const peer=section.querySelector('[data-deploy-peer]');
      const hook=section.querySelector('[data-deploy-hook]');
      const trigger=section.querySelector('[data-deploy-hook-trigger]');

      const syncModeUI = () => {
        const third = mode.value === 'third-party';
        editorFields.hidden = third;
        thirdFields.hidden = !third;
      };
      syncModeUI();
      mode.onchange=()=>{overrides.mode=mode.value; syncModeUI();};
      urlInput.oninput=()=>{overrides.url=normalizeEditorPath(urlInput.value);};
      externalUrl.oninput=()=>{overrides.externalUrl=externalUrl.value.trim();};
      branch.onchange=async()=>{overrides.branch=branch.value; overrides.commit=null; await loadCommits(branch.value); renderDeployment();};
      commit.onchange=()=>{overrides.commit=commit.value;};
      if (peer) peer.onchange=()=>{overrides.usePeerServer=peer.checked;};
      hook.oninput=()=>{overrides.hookUrl=hook.value.trim(); trigger.disabled=!hook.value.trim();};
      trigger.onclick=async()=>{
        const href=hook.value.trim();
        if(!href) return;
        trigger.disabled=true;
        try {
          await fetch(href,{method:'GET',mode:'no-cors',cache:'no-store'});
          trigger.textContent='Triggered';
        } catch(e) {
          trigger.textContent='Failed';
          logError(e);
        } finally {
          setTimeout(()=>{trigger.textContent='Trigger'; trigger.disabled=!hook.value.trim();},1200);
        }
      };
      section.querySelector('[data-deploy-save]').onclick=()=>{
        const d=state.deploymentSettings || (state.deploymentSettings={});
        d.mode=mode.value === 'third-party' ? 'third-party' : 'editor';
        d.url=normalizeEditorPath(urlInput.value);
        d.externalUrl=externalUrl.value.trim();
        d.externalMode='iframe';
        d.usePeerServer=peer ? peer.checked : false;
        d.branch=branch.value || e.branch;
        d.commit=commit.value || '';
        d.hookUrl=hook.value.trim();
        state.saveProjectMetadata?.();
        state.markDirty?.('editor/project.json');
        state.markDirty?.('editor/deployment.json');
        resetOverrides();
        renderDeployment();
      };
      section.querySelector('[data-deploy-open]').onclick=()=>{ const href=deploymentUrl(); if (href) window.open(href,'_blank','noopener'); };
      section.querySelector('[data-deploy-save]').title='Save the deployment configuration into .editor/deployment.json';
    }
    async function loadBranches() {
      const r=remote(); if (!r || !github?.isSignedIn?.()) return;
      try { deployment.branches=await github.listBranches(r.owner,r.repo); if (!deployment.branches.length) deployment.branches=[r.branch||'main']; }
      catch(e) { deployment.branches=[r.branch||'main']; }
    }
    async function loadCommits(branch) {
      const r=remote(); const token=++commitLoadToken; if (!r || !branch) { deployment.commits=[]; return; }
      const owner=r.owner, repo=r.repo;
      try { const commits=await github.listCommits(owner,repo,branch,30); if (token !== commitLoadToken || remote()?.owner !== owner || remote()?.repo !== repo) return; deployment.commits=commits; } catch(e) { if (token === commitLoadToken) deployment.commits=[]; }
    }
    async function loadDeployment() {
      if (!github?.isSignedIn?.() || !remote()) { deployment={repo:null,branches:[],commits:[],loading:false}; renderDeployment(); return; }
      deployment.loading=true; renderDeployment();
      await loadBranches();
      const branch=effective().branch || remote().branch || 'main';
      await loadCommits(branch);
      deployment.loading=false; renderDeployment();
    }
    function show() {
      syncRemote();
      tree.classList.remove('activity-collapsed');
      tree.innerHTML = '<div class="run-debug-sidebar"><div class="activity-sidebar-title">Run and Debug</div><div class="run-debug-actions"><button id="sidebar-run" class="primary">Run</button><button id="sidebar-refresh-endpoints">Refresh</button></div><div class="run-debug-section"><div class="run-debug-section-title">Browser Network Endpoints</div><div id="endpoint-list"></div></div><div class="run-debug-section" data-deployment></div></div>';
      const list = tree.querySelector('#endpoint-list');
      render = () => {
        const net = state.browserNetwork;
        const info = net?.getEndpointInfo ? net.getEndpointInfo() : (net?.endpoints || []).map((ep,index)=>({index,name:ep?.constructor?.name||'Endpoint',enabled:ep?.enabled!==false,runtime:!!ep?.__editorRuntimeEndpoint,proxy:ep?.proxy||null,domain:ep?.domain||null}));
        list.innerHTML=info.length ? info.map(ep=>{const detail=ep.runtime?ep.domain||'Runtime':ep.proxy||ep.domain||'';return `<div class="endpoint-row"><div class="endpoint-name"><span>${ep.index+1}. ${ep.name}</span><span class="endpoint-status ${ep.enabled?'enabled':'disabled'}">${ep.enabled?'ON':'OFF'}</span></div><div class="endpoint-detail">${ep.runtime?'Runtime endpoint • ':''}${detail||'Default browser endpoint'}</div></div>`;}).join('') : '<div class="endpoint-empty">Browser network is not ready.</div>';
      };
      render(); renderDeployment(); void loadDeployment();
      const net=state.browserNetwork;
      if(net?.addEventListener&&!tree._endpointListener){const listener=()=>render();net.addEventListener('endpointschange',listener);tree._endpointListener=listener;}
      tree.querySelector('#sidebar-refresh-endpoints').onclick=()=>{render();void loadDeployment();};
      tree.querySelector('#sidebar-run').onclick=()=>runConfigured().catch(logError);
      state.runDebugRefresh=()=>{render();void loadDeployment();};
    }
    return {show,refresh:()=>{render();void loadDeployment();}};
  };
})();
