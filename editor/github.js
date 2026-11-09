(function() {
  const root = window.GitHubService = window.GitHubService || {};
  const API = 'https://api.github.com';
  const API_VERSION = '2026-03-10';
  const GITHUB_APP_SLUG = 'watermelonkatana-editor';
  const TOKEN_SESSION_KEY = 'editor.github.token.session';
  const TOKEN_LOCAL_KEY = 'editor.github.token';
  const USER_SESSION_KEY = 'editor.github.user.session';
  const USER_LOCAL_KEY = 'editor.github.user';
  const REMEMBER_KEY = 'editor.github.remember';
  const PENDING_KEY = 'editor.github.oauth.pending';
  const listeners = new Set();
  let user = null;

  function b64url(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  function randomString(bytes = 32) {
    const data = new Uint8Array(bytes);
    crypto.getRandomValues(data);
    return b64url(data);
  }
  async function sha256Base64Url(text) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return b64url(new Uint8Array(hash));
  }
  function getConfig() {
    const workerUrl = String(window.WorkerConfig?.github || '').trim();
    return {workerUrl: workerUrl.replace(/\/$/, '')};
  }
  function setConfig() {
    return getConfig();
  }
  function getRemember() {
    try { return localStorage.getItem(REMEMBER_KEY) === '1'; } catch (_) { return false; }
  }
  function setRemember(value) {
    const next = !!value;
    const currentRemember = getRemember();
    try {
      const from = currentRemember ? localStorage : sessionStorage;
      const to = next ? localStorage : sessionStorage;
      const fromTokenKey = currentRemember ? TOKEN_LOCAL_KEY : TOKEN_SESSION_KEY;
      const fromUserKey = currentRemember ? USER_LOCAL_KEY : USER_SESSION_KEY;
      const toTokenKey = next ? TOKEN_LOCAL_KEY : TOKEN_SESSION_KEY;
      const toUserKey = next ? USER_LOCAL_KEY : USER_SESSION_KEY;
      const token = from.getItem(fromTokenKey);
      const profile = from.getItem(fromUserKey);
      localStorage.setItem(REMEMBER_KEY, next ? '1' : '0');
      if (token) to.setItem(toTokenKey, token);
      if (profile) to.setItem(toUserKey, profile);
      if (from !== to) { from.removeItem(fromTokenKey); from.removeItem(fromUserKey); }
      user = profile ? JSON.parse(profile) : user;
    } catch (_) {}
    notify();
  }
  function loadStoredAuth() {
    const remember = getRemember();
    const storage = remember ? localStorage : sessionStorage;
    const token = storage.getItem(remember ? TOKEN_LOCAL_KEY : TOKEN_SESSION_KEY);
    if (!token) return false;
    try { user = JSON.parse(storage.getItem(remember ? USER_LOCAL_KEY : USER_SESSION_KEY) || 'null'); } catch (_) { user = null; }
    return !!token;
  }
  function clearStoredAuth() {
    try { localStorage.removeItem(TOKEN_LOCAL_KEY); localStorage.removeItem(USER_LOCAL_KEY); sessionStorage.removeItem(TOKEN_SESSION_KEY); sessionStorage.removeItem(USER_SESSION_KEY); } catch (_) {}
    user = null;
  }
  function getToken() {
    const remember = getRemember();
    return (remember ? localStorage.getItem(TOKEN_LOCAL_KEY) : sessionStorage.getItem(TOKEN_SESSION_KEY)) || '';
  }
  function storeAuth(token, profile, remember) {
    clearStoredAuth();
    setRemember(remember);
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(remember ? TOKEN_LOCAL_KEY : TOKEN_SESSION_KEY, token);
    storage.setItem(remember ? USER_LOCAL_KEY : USER_SESSION_KEY, JSON.stringify(profile || null));
    user = profile || null;
    notify();
  }
  function notify() { for (const listener of [...listeners]) { try { listener(user); } catch (_) {} } }
  function onChange(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
  function isSignedIn() { return !!getToken(); }
  function getUser() { return user; }
  function workerUrl() { return getConfig().workerUrl; }
  function getInstallUrl() { return `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`; }
  async function waitForInstallation(timeout = 60000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try {
        if (await isAppInstalled()) { notify(); return true; }
      } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    return false;
  }
  function installApp() {
    const url = getInstallUrl();
    const popup = window.open(url, 'github-app-install', 'popup,width=520,height=720,resizable=yes,scrollbars=yes');
    if (!popup) { location.href = url; return url; }
    const watch = setInterval(async () => {
      if (!popup.closed) return;
      clearInterval(watch);
      await waitForInstallation();
    }, 500);
    return url;
  }
  async function getInstallations() {
    const data = await request('/user/installations?per_page=100');
    return Array.isArray(data?.installations) ? data.installations : [];
  }
  async function isAppInstalled() {
    if (!getToken()) return false;
    try { return (await getInstallations()).some(item => String(item?.app_slug || item?.app?.slug || '').toLowerCase() === GITHUB_APP_SLUG); }
    catch (_) { return false; }
  }
  async function startLogin() {
    const worker = workerUrl();
    if (!worker) throw new Error('Set the GitHub authentication Worker URL in Profile first.');
    const verifier = randomString(48);
    const state = randomString(24);
    const challenge = await sha256Base64Url(verifier);
    const redirect = new URL(location.href);
    redirect.search = '';
    redirect.hash = '';
    const callback = new URL('github-callback.html', location.href);
    callback.search = '';
    callback.hash = '';
    const pending = {state, verifier, createdAt: Date.now(), returnUri: redirect.href};
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    const url = new URL(worker + '/login');
    url.searchParams.set('state', state);
    url.searchParams.set('redirect_uri', callback.href);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    const popup = window.open(url.href, 'github-auth', 'popup,width=520,height=720,resizable=yes,scrollbars=yes');
    if (!popup) location.href = url.href;
  }
  function cleanupCallbackUrl() {
    try {
      const url = new URL(location.href);
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      url.searchParams.delete('error');
      url.searchParams.delete('error_description');
      history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    } catch (_) {}
  }
  async function completeLogin(code, state) {
    const pendingRaw = localStorage.getItem(PENDING_KEY);
    let pending = null;
    try { pending = JSON.parse(pendingRaw || 'null'); } catch (_) {}
    if (!pending || pending.state !== state) throw new Error('GitHub sign-in state did not match. Please try again.');
    if (Date.now() - Number(pending.createdAt || 0) > 10 * 60 * 1000) throw new Error('GitHub sign-in expired. Please try again.');
    const response = await fetch(workerUrl() + '/exchange', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({code, code_verifier: pending.verifier})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) throw new Error(data.error || data.message || `GitHub token exchange failed (${response.status}).`);
    const profile = await request('/user', {token: data.access_token});
    storeAuth(data.access_token, profile, getRemember());
    localStorage.removeItem(PENDING_KEY);
    cleanupCallbackUrl();
    return profile;
  }
  async function handleOAuthCallback() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    if (!code && !error) return false;
    if (window.opener && window.opener !== window) {
      try {
        window.opener.postMessage({type:'github-oauth-callback', code, state, error, errorDescription: params.get('error_description') || ''}, location.origin);
      } catch (_) {}
      setTimeout(() => window.close(), 150);
      return true;
    }
    if (error) {
      cleanupCallbackUrl();
      throw new Error(params.get('error_description') || `GitHub sign-in failed: ${error}`);
    }
    await completeLogin(code, state);
    return true;
  }
  async function init() {
    loadStoredAuth();
    window.removeEventListener('message', root._messageHandler || (() => {}));
    root._messageHandler = async event => {
      if (event.origin !== location.origin || event.data?.type !== 'github-oauth-callback') return;
      try {
        if (event.data.error) throw new Error(event.data.errorDescription || `GitHub sign-in failed: ${event.data.error}`);
        await completeLogin(event.data.code, event.data.state);
      } catch (e) {
        console.error(e);
        window.dispatchEvent(new CustomEvent('github-auth-error', {detail: e}));
      }
    };
    window.addEventListener('message', root._messageHandler);
    try { await handleOAuthCallback(); } catch (e) { console.error(e); window.dispatchEvent(new CustomEvent('github-auth-error', {detail: e})); }
    return user;
  }
  async function request(path, options = {}) {
    const token = options.token || getToken();
    if (!token) throw new Error('Not signed in to GitHub.');
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/vnd.github+json');
    headers.set('X-GitHub-Api-Version', API_VERSION);
    headers.set('Authorization', `Bearer ${token}`);
    if (options.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const init = {...options, headers, credentials:'omit'};
    // GitHub's GET responses can be cached for up to a minute. Source Control
    // needs the branch/tree/history state immediately after a push, so never
    // let browser/network caching return the pre-commit state.
    if (!init.method || String(init.method).toUpperCase() === 'GET' || String(init.method).toUpperCase() === 'HEAD') init.cache = 'no-store';
    delete init.token;
    const network = window.__sharedBrowserNetwork || window.EditorAppState?.browserNetwork;
    let response;
    if (network?.request) {
      response = await network.request(new Request(API + path, init), 'github-api', () => true);
      if (!response) throw new Error('GitHub API request failed: no Network endpoint returned a response.');
    } else {
      response = await fetch(API + path, init);
    }
    if (response.status === 401) {
      clearStoredAuth();
      notify();
      throw new Error('GitHub authentication expired. Sign in again from Profile.');
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.message || `GitHub API request failed (${response.status}).`;
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      error.oauthScopes = response.headers.get('X-OAuth-Scopes') || '';
      error.acceptedOAuthScopes = response.headers.get('X-Accepted-OAuth-Scopes') || '';
      throw error;
    }
    return data;
  }
  async function listRepositories() {
    const all = [];
    for (let page = 1; page <= 5; page++) {
      const items = await request(`/user/repos?per_page=100&page=${page}&affiliation=owner%2Ccollaborator%2Corganization_member&sort=updated&direction=desc`);
      if (!Array.isArray(items)) break;
      all.push(...items);
      if (items.length < 100) break;
    }
    return all.filter(repo => repo && repo.full_name).map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner?.login || repo.full_name.split('/')[0],
      private: !!repo.private,
      defaultBranch: repo.default_branch || 'main',
      permissions: repo.permissions || {},
      updatedAt: repo.updated_at || ''
    }));
  }
  async function publicRequest(path) {
    const token = getToken();
    const headers = new Headers({Accept:'application/vnd.github+json','X-GitHub-Api-Version':API_VERSION});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const init = {headers, credentials:'omit', cache:'no-store'};
    const network = window.__sharedBrowserNetwork || window.EditorAppState?.browserNetwork;
    const send = requestHeaders => network?.request ? network.request(new Request(API + path, {headers:requestHeaders,credentials:'omit',cache:'no-store'}), 'github-api', () => true) : fetch(API + path, {headers:requestHeaders,credentials:'omit',cache:'no-store'});
    let response = await send(headers);
    if (!response) throw new Error('GitHub API request failed: no Network endpoint returned a response.');
    if (response.status === 401 && token) {
      clearStoredAuth();
      notify();
      response = await send(new Headers({Accept:'application/vnd.github+json','X-GitHub-Api-Version':API_VERSION}));
      if (!response) throw new Error('GitHub API request failed: no Network endpoint returned a response.');
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.message || `GitHub API request failed (${response.status}).`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }
  async function getRepository(owner, repo) { return publicRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`); }
  async function createRepository({name, description = '', privateRepo = false, autoInit = true}) {
    name = String(name || '').trim();
    if (!name) throw new Error('Enter a repository name.');
    return request('/user/repos', {
      method:'POST',
      body:JSON.stringify({name, description:String(description || '').trim(), private:!!privateRepo, auto_init:!!autoInit, has_issues:true, has_projects:false, has_wiki:false})
    });
  }
  async function downloadArchive(owner, repo, ref = '', options = {}) {
    const token = getToken();
    if (!token) throw new Error('Not signed in to GitHub.');
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zipball/${branchPath(ref || 'main')}`;
    const headers = new Headers({Accept:'application/vnd.github+json','X-GitHub-Api-Version':API_VERSION,Authorization:`Bearer ${token}`});
    const network = window.__sharedBrowserNetwork || window.EditorAppState?.browserNetwork;
    const request = new Request(API + path, {headers, credentials:'omit'});
    const response = network?.request ? await network.request(request, 'github-archive', () => true) : await fetch(request);
    if (!response) throw new Error('GitHub archive download failed: no Network endpoint returned a response.');
    if (response.status === 401) {
      clearStoredAuth();
      notify();
      const error = new Error('GitHub authentication expired. Sign in again from Profile.');
      error.status = 401;
      throw error;
    }
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const error = new Error(data?.message || `GitHub archive download failed (${response.status}).`);
      error.status = response.status; error.data = data;
      throw error;
    }
    const total = Number(response.headers?.get?.('content-length')) || 0;
    if (!response.body?.getReader) {
      const blob = await response.blob();
      options.onProgress?.(blob.size, total || blob.size);
      return blob;
    }
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    options.onProgress?.(0, total || 0);
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength || value.length || 0;
      }
      options.onProgress?.(received, total || 0);
    }
    return new Blob(chunks, {type: response.headers?.get?.('content-type') || 'application/zip'});
  }
  function branchPath(branch) { return String(branch || 'main').split('/').filter(Boolean).map(encodeURIComponent).join('/'); }
  async function listBranches(owner, repo) {
    const branches = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`);
    return Array.isArray(branches) ? branches.map(x => x.name).filter(Boolean) : [];
  }
  async function getRemoteHead(owner, repo, branch) {
    const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    try {
      const ref = await publicRequest(`${repoPath}/git/ref/heads/${branchPath(branch)}`);
      const commitSha = ref?.object?.sha || null;
      if (!commitSha || ref?.object?.type !== 'commit') throw new Error('GitHub did not return a commit for origin/' + branch + '.');
      return {commitSha:String(commitSha)};
    } catch (e) {
      if (e?.status === 409 || e?.status === 404) return {commitSha:null, empty:true};
      throw e;
    }
  }
  async function getRemoteCommitState(owner, repo, commitSha) {
    const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const commit = await publicRequest(`${repoPath}/git/commits/${encodeURIComponent(commitSha)}`);
    const treeSha = commit?.tree?.sha;
    if (!treeSha) throw new Error('GitHub did not return a tree for commit ' + commitSha + '.');
    const tree = await publicRequest(`${repoPath}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`);
    return {
      commitSha:String(commit?.sha || commitSha),
      commit,
      treeSha:String(treeSha),
      tree:Array.isArray(tree?.tree) ? tree.tree : [],
      truncated:!!tree?.truncated
    };
  }
  async function getRemoteState(owner, repo, branch) {
    const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    try {
      const ref = await publicRequest(`${repoPath}/git/ref/heads/${branchPath(branch)}`);
      const commitSha = ref?.object?.sha || null;
      if (!commitSha) return {commitSha:null, treeSha:null, tree:[]};
      const commit = await publicRequest(`${repoPath}/git/commits/${encodeURIComponent(commitSha)}`);
      const treeSha = commit?.tree?.sha || null;
      if (!treeSha) return {commitSha, treeSha:null, tree:[]};
      const tree = await publicRequest(`${repoPath}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`);
      return {commitSha, treeSha, tree:Array.isArray(tree?.tree) ? tree.tree : [], truncated:!!tree?.truncated};
    } catch (e) {
      // An empty repository has no refs yet. GitHub reports the missing
      // branch as 409 ("Git Repository is empty"), so that is a normal empty
      // state, not an initialization failure. Git-data writes below will
      // create the first tree, root commit, and branch ref.
      if (e?.status === 409 || e?.status === 404) {
        return {commitSha:null, treeSha:null, tree:[], empty:true};
      }
      throw e;
    }
  }
  async function listCommits(owner, repo, branch, count = 20) {
    try {
      const items = await publicRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?sha=${encodeURIComponent(branch || 'main')}&per_page=${Math.min(100, Math.max(1, count))}`);
      return Array.isArray(items) ? items.map(item => ({
      sha: item.sha,
      message: String(item.commit?.message || '').split(/\r?\n/, 1)[0],
      author: item.author?.login || item.commit?.author?.name || 'Unknown',
      date: item.commit?.author?.date || item.commit?.committer?.date || '',
      url: item.html_url || ''
      })) : [];
    } catch (e) {
      // An empty GitHub repository has no commit history yet; GitHub reports this as 409.
      if (e?.status === 404 || e?.status === 409) return [];
      throw e;
    }
  }
  async function getCommitDiff(owner, repo, commitSha) {
    const commit = await publicRequest('/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/commits/' + encodeURIComponent(commitSha));
    const files = Array.isArray(commit?.files) ? commit.files : [];
    if (!files.length) return 'Commit ' + commitSha + '\\nNo file patches were returned by GitHub.';
    return files.map(file => {
      const path = String(file.filename || 'unknown');
      const previousPath = String(file.previous_filename || path);
      const lines = ['diff --git a/' + previousPath + ' b/' + path];
      if (file.status === 'added') lines.push('new file mode 100644');
      else if (file.status === 'removed') lines.push('deleted file mode 100644');
      else if (file.status === 'renamed') lines.push('rename from ' + previousPath, 'rename to ' + path);
      if (file.patch) lines.push('--- ' + (file.status === 'added' ? '/dev/null' : 'a/' + previousPath), '+++ ' + (file.status === 'removed' ? '/dev/null' : 'b/' + path), file.patch);
      else lines.push('Binary file changed or GitHub omitted this patch.');
      return lines.join('\\n');
    }).join('\\n\\n');
  }

  async function getCommitState(owner, repo, commitSha) {
    const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const commit = await publicRequest(`${repoPath}/git/commits/${encodeURIComponent(commitSha)}`);
    const treeSha = commit?.tree?.sha;
    if (!treeSha) throw new Error('GitHub did not return the selected commit tree.');
    const tree = await publicRequest(`${repoPath}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`);
    const gitTree = Array.isArray(tree?.tree) ? tree.tree.filter(entry => entry?.path && !ignoredPath(entry.path)) : [];
    const entries = gitTree.filter(entry => entry?.type === 'blob');
    return {commitSha:String(commit?.sha || commitSha), treeSha, tree:entries, gitTree, truncated:!!tree?.truncated};
  }
  async function readBlob(owner, repo, sha) {
    const data = await publicRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${encodeURIComponent(sha)}`);
    if (data?.encoding !== 'base64' || typeof data.content !== 'string') throw new Error('GitHub returned an unsupported blob encoding.');
    const binary = atob(data.content.replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  function parseGitmodules(text) {
    const modules = [];
    let current = null;
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.startsWith(';')) continue;
      const section = line.match(/^\[submodule\s+"((?:[^"\\]|\\.)+)"\]$/i);
      if (section) {
        current = {name:section[1].replace(/\\"/g, '"')};
        modules.push(current);
        continue;
      }
      if (!current) continue;
      const setting = line.match(/^([A-Za-z][A-Za-z0-9.-]*)\s*=\s*(.*)$/);
      if (!setting) continue;
      let value = setting[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      current[setting[1].toLowerCase()] = value;
    }
    return modules.filter(module => module.path && module.url);
  }
  function resolveGitHubRepositoryUrl(value, parentOwner, parentRepo) {
    let raw = String(value || '').trim();
    if (!raw) throw new Error('A submodule has an empty repository URL.');
    raw = raw.replace(/^git@github\.com:/i, 'https://github.com/').replace(/^ssh:\/\/git@github\.com\//i, 'https://github.com/').replace(/^git:\/\/github\.com\//i, 'https://github.com/');
    let url;
    try { url = new URL(raw, `https://github.com/${encodeURIComponent(parentOwner)}/${encodeURIComponent(parentRepo)}`); }
    catch (_) { throw new Error(`Invalid submodule repository URL: ${raw}`); }
    if (url.hostname.toLowerCase() !== 'github.com' || !/^https?:$/.test(url.protocol)) throw new Error(`Submodule URL uses an unsupported host: ${url.hostname}. Only GitHub repositories are supported.`);
    let parts;
    try { parts = url.pathname.split('/').filter(Boolean).map(part => decodeURIComponent(part)); }
    catch (_) { throw new Error(`Invalid submodule repository URL: ${raw}`); }
    if (parts.length !== 2) throw new Error(`Submodule URL does not identify a GitHub repository: ${raw}`);
    const repo = parts[1].replace(/\.git$/i, '');
    if (!parts[0] || !repo || parts.some(part => part === '.' || part === '..')) throw new Error(`Invalid submodule repository URL: ${raw}`);
    return {owner:parts[0], repo};
  }
  async function listSubmodules(owner, repo, commitSha) {
    const state = await getCommitState(owner, repo, commitSha);
    if (state.truncated) throw new Error(`GitHub truncated the commit tree for ${owner}/${repo}@${String(commitSha).slice(0, 7)}. Submodules cannot be loaded safely from a truncated tree.`);
    const links = (state.gitTree || []).filter(entry => entry.mode === '160000' || entry.type === 'commit');
    const modulesEntry = (state.gitTree || []).find(entry => entry.path === '.gitmodules' && entry.type === 'blob');
    if (!links.length && !modulesEntry) return [];
    if (state.truncated) throw new Error(`GitHub truncated the commit tree for ${owner}/${repo}@${String(commitSha).slice(0, 7)}. Submodules cannot be loaded safely from a truncated tree.`);
    if (!links.length) return [];
    if (!modulesEntry?.sha) throw new Error(`Commit ${String(commitSha).slice(0, 7)} contains submodules but has no .gitmodules file.`);
    const text = new TextDecoder().decode(await readBlob(owner, repo, modulesEntry.sha));
    const configs = parseGitmodules(text);
    return links.map(link => {
      const config = configs.find(item => item.path === link.path);
      if (!config) throw new Error(`Submodule ${link.path} has no matching entry in .gitmodules.`);
      const remote = resolveGitHubRepositoryUrl(config.url, owner, repo);
      return {
        name:String(config.name || link.path.split('/').pop()),
        path:String(link.path),
        url:String(config.url),
        owner:remote.owner,
        repo:remote.repo,
        branch:String(config.branch || ''),
        configuredBranch:String(config.branch || ''),
        commitSha:String(link.sha),
        mode:'160000'
      };
    });
  }
  function bytesToBase64(data) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data || []);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
    }
    return btoa(binary);
  }

  async function gitBlobSha(data) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data || []);
    const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
    const all = new Uint8Array(header.length + bytes.length);
    all.set(header, 0); all.set(bytes, header.length);
    const hash = await crypto.subtle.digest('SHA-1', all);
    return Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
  }
  function ignoredPath(path) {
    const p = String(path || '').replace(/^\/+/, '');
    return p === '.git' || p.startsWith('.git/');
  }

  function gitIgnoreRegex(pattern) {
    let p = String(pattern || '').trim();
    if (!p || p.startsWith('#')) return null;
    if (p.endsWith('\\')) p = p.slice(0, -1);
    if (!p) return null;
    const negated = p.startsWith('!');
    if (negated) p = p.slice(1);
    const anchored = p.startsWith('/');
    if (anchored) p = p.slice(1);
    const directoryOnly = p.endsWith('/');
    if (directoryOnly) p = p.replace(/\/+$/, '');
    if (!p) return null;

    const escape = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const glob = value => {
      let out = '';
      for (let i = 0; i < value.length; i++) {
        const ch = value[i];
        if (ch === '*') {
          if (value[i + 1] === '*') {
            while (value[i + 1] === '*') i++;
            if (value[i + 1] === '/') { i++; out += '(?:.*/)?'; }
            else out += '.*';
          } else out += '[^/]*';
        } else if (ch === '?') out += '[^/]';
        else if (ch === '[') {
          const end = value.indexOf(']', i + 1);
          if (end > i + 1) {
            const body = value.slice(i + 1, end);
            out += '[' + (body[0] === '!' ? '^' + body.slice(1) : body) + ']';
            i = end;
          } else out += '\\[';
        } else out += escape(ch);
      }
      return out;
    };

    const body = glob(p);
    let source;
    if (p.includes('/')) source = (anchored ? '^' : '^(?:.*/)?') + body;
    else source = '^(?:.*/)?' + body;
    source += directoryOnly ? '(?:/.*)?$' : '$';
    try { return {negated, regex:new RegExp(source)}; } catch (_) { return null; }
  }

  function readGitIgnore(fs, pathPrefix = '') {
    const entries = [];
    const ignorePath = pathPrefix ? String(pathPrefix).replace(/\/+$/, '') + '/.gitignore' : '.gitignore';
    try {
      if (!fs?.existsSync?.(ignorePath)) return entries;
      const text = fs.readFileSync(ignorePath, 'utf8');
      for (const raw of String(text || '').split(/\r?\n/)) {
        const entry = gitIgnoreRegex(raw);
        if (entry) entries.push(entry);
      }
    } catch (_) {}
    return entries;
  }

  function gitIgnoreDecision(path, rules) {
    const p = String(path || '').replace(/^\/+/, '');
    if (!p || ignoredPath(p)) return true;
    let matched = null;
    for (const rule of rules || []) {
      if (rule.regex.test(p)) matched = !rule.negated;
    }
    return matched;
  }

  function isGitIgnored(path, rules) {
    return gitIgnoreDecision(path, rules) === true;
  }

  function isNodeModulesPath(path) {
    return /(^|\/)node_modules(?:\/|$)/.test(String(path || '').replace(/^\/+/, ''));
  }

  function isNodeModulesIgnoredBySetting(fs) {
    try {
      if (!fs?.existsSync?.('.editor/settings.json')) return true;
      const raw = fs.readFileSync('.editor/settings.json', 'utf8');
      const settings = JSON.parse(String(raw || '{}'));
      return settings?.ignoreNodeModules !== false;
    } catch (_) {
      return true;
    }
  }

  function gitDataToBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    // The in-memory workspace filesystem's "binary" read mode returns a
    // binary string in some implementations. Uint8Array(string) is empty.
    if (typeof value === 'string') {
      const bytes = new Uint8Array(value.length);
      for (let i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i) & 255;
      return bytes;
    }
    if (Array.isArray(value)) return Uint8Array.from(value);
    return new Uint8Array(value || []);
  }

  async function compareWorkingTree(fs, remoteTree, options = {}) {
    if (!fs) throw new Error('No workspace filesystem is open.');
    const prefix = String(options.pathPrefix || '').replace(/^\/+|\/+$/g, '');
    const excluded = (options.excludePaths || []).map(path => String(path || '').replace(/^\/+|\/+$/g, '')).filter(Boolean);
    const inExcludedPath = path => excluded.some(excludedPath => path === excludedPath || path.startsWith(excludedPath + '/'));
    const rules = readGitIgnore(fs, prefix);
    const ignoreNodeModules = isNodeModulesIgnoredBySetting(fs);
    // Keep both the repository-relative Git path and the actual workspace
    // path. For submodules pathPrefix is stripped for Git comparisons, but
    // filesystem reads must still use the prefixed workspace path.
    const localPaths = [];
    const addLocalPath = rawPath => {
      const fsPath = String(rawPath).replace(/^\/+/, '');
      if (!fsPath || (prefix && !fsPath.startsWith(prefix + '/'))) return;
      const path = prefix ? fsPath.slice(prefix.length + 1) : fsPath;
      if (!path || ignoredPath(path) || inExcludedPath(path) || (ignoreNodeModules && isNodeModulesPath(path))) return;
      localPaths.push({fsPath, path});
    };
    if (typeof fs.forEachFileSync === 'function') fs.forEachFileSync(addLocalPath, {ignoreNodeModules});
    else for (const rawPath of fs.listFilesSync()) addLocalPath(rawPath);
    const remoteFiles = new Map();
    for (const entry of remoteTree || []) {
      if (entry?.type === 'blob' && entry.path && !ignoredPath(entry.path) && !inExcludedPath(entry.path) && !(ignoreNodeModules && isNodeModulesPath(entry.path))) remoteFiles.set(entry.path, entry);
    }

    const changes = [];
    let compared = 0;
    await withConcurrency(localPaths, 8, async item => {
      const {path, fsPath} = item;
      const data = fs.readFileSync(fsPath, 'binary');
      if (data == null) throw new Error(`Workspace file could not be read while comparing: ${fsPath}`);
      const bytes = gitDataToBytes(data);
      const sha = await gitBlobSha(bytes);
      const remote = remoteFiles.get(path);

      // The node_modules workspace setting is handled above. .gitignore remains
      // independent and only suppresses untracked local additions; a file already
      // tracked by Git remains comparable even if it later becomes ignored.
      const ignoreDecision = gitIgnoreDecision(path, rules);
      if (!remote && ignoreDecision === true) return;

      if (!remote) changes.push({path, fsPath, type:'added', sha, data:bytes});
      else if (remote.sha !== sha) changes.push({path, fsPath, type:'modified', sha, data:bytes, mode:remote.mode || '100644'});
      remoteFiles.delete(path);
      compared++;
      if (compared % 64 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    });
    for (const [path, entry] of remoteFiles) changes.push({path, type:'deleted', sha:null, mode:entry.mode || '100644'});
    const order = {modified:0, added:1, deleted:2};
    changes.sort((a,b) => (order[a.type] - order[b.type]) || a.path.localeCompare(b.path));
    return changes;
  }

  async function createBlob(owner, repo, data) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data || []);
    if (bytes.byteLength > 95 * 1024 * 1024) throw new Error(`File is too large for the GitHub API: ${bytes.byteLength.toLocaleString()} bytes.`);
    return request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`, {
      method:'POST',
      body:JSON.stringify({content:bytesToBase64(bytes), encoding:'base64'})
    });
  }
  async function initializeEmptyRepository(owner, repo, branch, attempt = 0) {
    const placeholder = 'initialize.txt';
    try {
      const response = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${placeholder}`, {
        method:'PUT',
        body:JSON.stringify({
          message:'Initialize Git repository',
          content:bytesToBase64(new TextEncoder().encode('')),
          branch:String(branch || 'main')
        })
      });
      return response?.commit?.sha || null;
    } catch (e) {
      if ((e?.status === 404 || e?.status === 409) && attempt < 8) {
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 + attempt * 1000, 5000)));
        return initializeEmptyRepository(owner, repo, branch, attempt + 1);
      }
      throw e;
    }
  }

  async function createInitializedRepositoryCommit(owner, repo, branch, message, changes, attempt = 0) {
    try {
      const files = (changes || []).filter(change => change.type !== 'deleted' && change.type !== 'gitlink');
      const blobs = await withConcurrency(files, 4, async change => ({
        path:change.path,
        mode:change.mode || '100644',
        type:'blob',
        sha:(await createBlob(owner, repo, change.data)).sha
      }));
      const gitlinks = (changes || []).filter(change => change.type === 'gitlink').map(change => ({path:change.path, mode:'160000', type:'commit', sha:change.sha}));
      const entries = [...blobs, ...gitlinks];
      if (!entries.length) throw new Error('The workspace has no files or submodules to initialize the GitHub repository with.');

      const tree = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`, {
        method:'POST',
        body:JSON.stringify({tree:entries})
      });
      const commit = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`, {
        method:'POST',
        body:JSON.stringify({message, tree:tree.sha})
      });
      const refPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${branchPath(branch)}`;
      await request(refPath, {
        method:'PATCH',
        body:JSON.stringify({sha:commit.sha, force:true})
      });
      return commit.sha;
    } catch (e) {
      if ((e?.status === 404 || e?.status === 409) && attempt < 8) {
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 + attempt * 1000, 5000)));
        return createInitializedRepositoryCommit(owner, repo, branch, message, changes, attempt + 1);
      }
      throw e;
    }
  }
  async function withConcurrency(items, limit, worker) {
    const out = new Array(items.length);
    let cursor = 0;
    async function run() {
      while (cursor < items.length) {
        const index = cursor++;
        out[index] = await worker(items[index], index);
      }
    }
    await Promise.all(Array.from({length:Math.min(limit, items.length)}, run));
    return out;
  }
  async function createGraphQLCommit(owner, repo, branch, message, changes, expectedHead) {
    const additions = [];
    const deletions = [];
    for (const change of changes) {
      if (change.type === 'deleted') {
        deletions.push({path:change.path});
        continue;
      }
      const bytes = change.data instanceof Uint8Array ? change.data : new Uint8Array(change.data || []);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
      additions.push({path:change.path, contents:btoa(binary)});
    }
    const mutation = `mutation($input:CreateCommitOnBranchInput!){createCommitOnBranch(input:$input){commit{oid}}}`;
    const variables = {input:{branch:{repositoryNameWithOwner:`${owner}/${repo}`,branchName:branch},message:{headline:message},fileChanges:{additions,deletions}}};
    if (expectedHead) variables.input.expectedHeadOid = expectedHead;
    const data = await requestGraphQL(mutation, variables);
    if (data?.errors?.length) {
      const error = new Error(data.errors.map(x => x.message).join('; ') || 'GitHub GraphQL commit failed.');
      error.status = 403;
      error.data = data;
      throw error;
    }
    const oid = data?.data?.createCommitOnBranch?.commit?.oid;
    if (!oid) throw new Error('GitHub GraphQL commit did not return a commit SHA.');
    return oid;
  }
  async function requestGraphQL(query, variables) {
    const token = getToken();
    if (!token) throw new Error('Not signed in to GitHub.');
    const headers = new Headers({'Accept':'application/json','Content-Type':'application/json','X-GitHub-Api-Version':API_VERSION,'Authorization':`Bearer ${token}`});
    const init = {method:'POST',headers,body:JSON.stringify({query,variables}),credentials:'omit'};
    const network = window.__sharedBrowserNetwork || window.EditorAppState?.browserNetwork;
    let response = network?.request ? await network.request(new Request('https://api.github.com/graphql', init), 'github-graphql', () => true) : await fetch('https://api.github.com/graphql', init);
    if (!response) throw new Error('GitHub GraphQL request failed: no Network endpoint returned a response.');
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.message || data?.errors?.map(x => x.message).join('; ') || `GitHub GraphQL request failed (${response.status}).`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }
  function validateSubmoduleConfiguration(fs, modules = []) {
    const active = (modules || []).filter(module => !module?.removed);
    const parents = new Set(['', ...active.map(module => String(module.path || ''))]);
    for (const parentPath of parents) {
      const configPath = parentPath ? parentPath + '/.gitmodules' : '.gitmodules';
      const configs = fs?.existsSync?.(configPath) ? parseGitmodules(fs.readFileSync(configPath, 'utf8')) : [];
      const children = active.filter(module => String(module.parentPath || '') === parentPath);
      if (configs.length !== children.length) throw new Error(`Submodule configuration at ${parentPath || 'the repository root'} does not match the loaded submodule layout. Refresh Source Control and check .gitmodules before committing.`);
      for (const config of configs) {
        const module = children.find(child => String(child.path || '').slice(parentPath ? parentPath.length + 1 : 0) === config.path);
        if (!module) throw new Error(`Submodule path ${config.path} does not match a loaded gitlink at ${parentPath || 'the repository root'}.`);
        if (String(module.url || '') !== String(config.url || '') || String(module.configuredBranch || '') !== String(config.branch || '')) throw new Error(`Submodule settings for ${config.path} do not match .gitmodules. Update the submodule through Source Control before committing.`);
        if (!fs?.isDirectorySync?.(module.path)) throw new Error(`Submodule directory ${module.path} is missing. Restore it before committing.`);
      }
    }
    return true;
  }

  async function getSubmoduleStatuses(fs, modules = []) {
    validateSubmoduleConfiguration(fs, modules);
    const byParent = new Map();
    for (const module of modules || []) {
      if (module?.removed) continue;
      const key = String(module.parentPath || '');
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(module);
    }
    async function inspect(module) {
      const children = byParent.get(String(module.path || '')) || [];
      const baseSha = String(module.pendingCommitSha || module.commitSha || '');
      const childResults = await Promise.all(children.map(inspect));
      let changes = [];
      if (baseSha) {
        const base = await getCommitState(module.owner, module.repo, baseSha);
        changes = await compareWorkingTree(fs, base.tree, {
          pathPrefix:module.path,
          excludePaths:children.map(child => String(child.path || '').slice(String(module.path || '').length + 1))
        });
      }
      let canPush = false;
      try {
        const info = await getRepository(module.owner, module.repo);
        canPush = info?.permissions?.push !== false;
      } catch (_) {}
      return {...module, changes, children:childResults, canPush, dirty:!!changes.length || childResults.some(child => child.dirty) || !!module.pendingCommitSha || !!module.added || !!module.previousPath};
    }
    return Promise.all(byParent.get('') || []);
  }

  async function commitAndPush({owner, repo, branch, message, fs, compareTree = null, pathPrefix = '', excludePaths = [], gitlinks = [], removedGitlinks = [], changesOverride = null, expectedRemoteSha = null, parentsOverride = null, _attempt = 0}) {
    message = String(message || '').trim();
    if (!message) throw new Error('Enter a commit message.');
    let remote = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      remote = await getRemoteState(owner, repo, branch);
      if (!remote.unavailable) break;
      await new Promise(resolve => setTimeout(resolve, 500 + attempt * 500));
    }
    if (remote?.unavailable) throw new Error('GitHub is still initializing this repository. Please try again in a moment.');
    if (remote?.truncated) throw new Error('GitHub truncated this repository tree. Source Control cannot safely compare or commit a partial tree; narrow the repository contents or sync a smaller repository first.');
    if (expectedRemoteSha !== null && String(remote.commitSha || '') !== String(expectedRemoteSha || '')) throw new Error('The GitHub branch changed before the push could be completed. Fetch and reconcile the remote changes before retrying.');
    const changes = Array.isArray(changesOverride) ? changesOverride : await compareWorkingTree(fs, compareTree || remote.tree, {pathPrefix, excludePaths});
    const remoteGitlinks = new Map((remote.tree || []).filter(entry => entry?.mode === '160000' || entry?.type === 'commit').map(entry => [entry.path, entry.sha]));
    const updatedGitlinks = (gitlinks || []).filter(link => link?.path && link?.sha && remoteGitlinks.get(link.path) !== link.sha);
    const deletedGitlinks = [...new Set((removedGitlinks || []).map(path => String(path || '').replace(/^\/+|\/+$/g, '')).filter(path => path && remoteGitlinks.has(path)))];
    const allChanges = [...changes, ...updatedGitlinks.map(link => ({path:link.path,type:'gitlink',mode:'160000',sha:link.sha})), ...deletedGitlinks.map(path => ({path,type:'gitlink-deleted',mode:'160000',sha:null}))];
    if (!allChanges.length) return {changed:false, changes:[], commitSha:remote.commitSha};
    if (remote.empty) {
      // GitHub requires an empty repository to be bootstrapped through the
      // Contents API before its Git-data API can be used. The bootstrap commit
      // is temporary: replace the branch with one root commit containing the
      // complete workspace so the visible history starts at "Initialized Repository".
      await initializeEmptyRepository(owner, repo, branch);
      const commitSha = await createInitializedRepositoryCommit(
        owner,
        repo,
        branch,
        message,
        allChanges
      );
      return {changed:true, changes:allChanges, commitSha, initialized:true};
    }
    try {
      const blobs = await withConcurrency(allChanges.filter(x => x.type !== 'deleted' && x.type !== 'gitlink' && x.type !== 'gitlink-deleted'), 4, async change => ({path:change.path, mode:change.mode || '100644', type:'blob', sha:(await createBlob(owner, repo, change.data)).sha}));
      const treeEntries = [...blobs, ...updatedGitlinks.map(change => ({path:change.path, mode:'160000', type:'commit', sha:change.sha})), ...deletedGitlinks.map(path => ({path, mode:'160000', type:'commit', sha:null})), ...allChanges.filter(x => x.type === 'deleted').map(change => ({path:change.path, mode:change.mode || '100644', type:'blob', sha:null}))];
      const treeBody = {tree:treeEntries};
      if (remote.treeSha) treeBody.base_tree = remote.treeSha;
      const tree = await request('/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/git/trees', {method:'POST', body:JSON.stringify(treeBody)});
      const commitBody = {message, tree:tree.sha};
      if (Array.isArray(parentsOverride)) {
        if (!parentsOverride.length || parentsOverride.length > 2 || parentsOverride.some(parent => !/^[0-9a-f]{40}$/i.test(String(parent || '')))) throw new Error('The supplied merge parents are invalid.');
        commitBody.parents = [...parentsOverride];
      } else if (remote.commitSha) commitBody.parents = [remote.commitSha];
      const commit = await request('/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/git/commits', {method:'POST', body:JSON.stringify(commitBody)});
      const refPath = '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/git/refs/heads/' + branchPath(branch);
      try {
        if (remote.commitSha) {
          await request(refPath, {method:'PATCH', body:JSON.stringify({sha:commit.sha, force:false})});
        } else {
          await request('/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/git/refs', {method:'POST', body:JSON.stringify({ref:'refs/heads/' + branch, sha:commit.sha})});
        }
      } catch (e) {
        // A 422 here normally means the branch moved after we read its
        // remote SHA. Rebuild the commit once from the latest branch state;
        // never force-push over the intervening commit.
        if (e?.status === 422 && expectedRemoteSha !== null) throw new Error('The GitHub branch moved while pushing. Your local commit is safe; fetch and reconcile the remote changes before retrying.');
        if (e?.status === 422 && _attempt < 8) {
          await new Promise(resolve => setTimeout(resolve, 500 + _attempt * 500));
          return await commitAndPush({owner, repo, branch, message, fs, compareTree, pathPrefix, excludePaths, gitlinks, removedGitlinks, changesOverride, expectedRemoteSha, parentsOverride, _attempt:_attempt + 1});
        }
        throw e;
      }
      return {changed:true, changes:allChanges, commitSha:commit.sha};
    } catch (e) {
      // A freshly-created repository may still be provisioning its Git
      // database. GitHub can briefly return 404/409 for Git-data writes even
      // after the repository itself exists, so retry the complete transaction
      // with a bounded backoff before surfacing the error.
      if ((e?.status === 404 || e?.status === 409) && _attempt < 8) {
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 + _attempt * 1000, 5000)));
        return await commitAndPush({owner, repo, branch, message, fs, compareTree, pathPrefix, excludePaths, gitlinks, removedGitlinks, changesOverride, expectedRemoteSha, parentsOverride, _attempt:_attempt + 1});
      }
      if (e?.status !== 403) throw e;
      if (updatedGitlinks.length || deletedGitlinks.length) throw new Error('GitHub rejected the Git-data write for a commit containing submodule references. The GraphQL fallback cannot create or remove gitlinks; check your repository permissions and try again.');
      if (Array.isArray(parentsOverride)) throw new Error('GitHub rejected the Git-data merge commit write. The GraphQL fallback cannot preserve multiple commit parents; check repository permissions and retry.');
      const commitSha = await createGraphQLCommit(owner, repo, branch, message, allChanges, remote.commitSha);
      return {changed:true, changes:allChanges, commitSha};
    }
  }
  async function commitWorkspaceAndPush({owner, repo, branch, message, fs, submodules = []}) {
    message = String(message || '').trim();
    if (!message) throw new Error('Enter a commit message.');
    const modules = Array.isArray(submodules) ? submodules : [];
    validateSubmoduleConfiguration(fs, modules);
    const byParent = new Map();
    for (const module of modules) {
      const key = String(module.parentPath || '');
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(module);
    }

    async function commitModule(module, parentBranch = branch || 'main') {
      const entries = byParent.get(String(module.path || '')) || [];
      const children = entries.filter(child => !child.removed);
      const removedChildren = entries.filter(child => child.removed);
      const targetBranch = module.configuredBranch === '.' ? parentBranch : module.branch || 'main';
      const childResults = [];
      for (const child of children) childResults.push({module:child, sha:await commitModule(child, targetBranch)});
      const baselineSha = String(module.pendingCommitSha || module.commitSha || '');
      if (!baselineSha) throw new Error(`Submodule ${module.path} has no pinned commit SHA.`);
      const base = await getCommitState(module.owner, module.repo, baselineSha);
      const childGitlinks = childResults
        .filter(item => item.sha && (item.sha !== String(item.module.commitSha || '') || item.module.added || item.module.previousPath))
        .map(item => ({path:String(item.module.path || '').slice(String(module.path || '').length + 1), sha:item.sha}));
      const removedChildPaths = [
        ...removedChildren.map(child => String(child.path || '').slice(String(module.path || '').length + 1)),
        ...children.filter(child => child.previousPath).map(child => String(child.previousPath).slice(String(module.path || '').length + 1))
      ].filter(Boolean);
      const excludedChildren = children.map(child => String(child.path || '').slice(String(module.path || '').length + 1));
      const result = await commitAndPush({
        owner:module.owner,
        repo:module.repo,
        branch:targetBranch,
        message,
        fs,
        compareTree:base.tree,
        pathPrefix:module.path,
        excludePaths:excludedChildren,
        gitlinks:childGitlinks,
        removedGitlinks:removedChildPaths
      });
      if (result.changed) module.pendingCommitSha = result.commitSha;
      return String(module.pendingCommitSha || module.commitSha || '');
    }

    const roots = (byParent.get('') || []).filter(module => !module.removed);
    const removedRoots = (byParent.get('') || []).filter(module => module.removed);
    const updatedRoots = [];
    for (const module of roots) {
      const sha = await commitModule(module, branch || 'main');
      if (sha && (sha !== String(module.commitSha || '') || module.added || module.previousPath)) updatedRoots.push({path:module.path, sha});
    }
    const removedRootPaths = [
      ...removedRoots.map(module => module.path),
      ...roots.filter(module => module.previousPath).map(module => module.previousPath)
    ].filter(Boolean);

    const result = await commitAndPush({
      owner,
      repo,
      branch,
      message,
      fs,
      excludePaths:roots.map(module => module.path),
      gitlinks:updatedRoots,
      removedGitlinks:removedRootPaths
    });

    for (const module of modules) {
      if (module.pendingCommitSha) {
        module.commitSha = module.pendingCommitSha;
        module.pendingCommitSha = null;
      }
      module.added = false;
      module.previousPath = null;
    }
    for (let i = modules.length - 1; i >= 0; i--) if (modules[i].removed) modules.splice(i, 1);
    return {...result, submodules:modules};
  }
  root.init = init;
  root.onChange = onChange;
  root.getConfig = getConfig;
  root.setConfig = setConfig;
  root.getRemember = getRemember;
  root.setRemember = setRemember;
  root.getToken = getToken;
  root.getUser = getUser;
  root.isSignedIn = isSignedIn;
  root.startLogin = startLogin;
  root.getInstallUrl = getInstallUrl;
  root.installApp = installApp;
  root.waitForInstallation = waitForInstallation;
  root.getInstallations = getInstallations;
  root.isAppInstalled = isAppInstalled;
  root.signOut = () => { localStorage.removeItem(PENDING_KEY); clearStoredAuth(); notify(); };
  root.request = request;
  root.listRepositories = listRepositories;
  root.getRepository = getRepository;
  root.publicRequest = publicRequest;
  root.listSubmodules = listSubmodules;
  root.validateSubmoduleConfiguration = validateSubmoduleConfiguration;
  root.getSubmoduleStatuses = getSubmoduleStatuses;
  root.commitWorkspaceAndPush = commitWorkspaceAndPush;
  root.createRepository = createRepository;
  root.downloadArchive = downloadArchive;
  root.listBranches = listBranches;
  root.getRemoteState = getRemoteState;
  root.getRemoteHead = getRemoteHead;
  root.getRemoteCommitState = getRemoteCommitState;
  root.getCommitState = getCommitState;
  root.readBlob = readBlob;
  root.listCommits = listCommits;
  root.getCommitDiff = getCommitDiff;
  root.compareWorkingTree = compareWorkingTree;
  root.commitAndPush = commitAndPush;
  root.gitBlobSha = gitBlobSha;
})();
