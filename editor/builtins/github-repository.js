(function() {
  const factories = window.EditorBuiltinFactories = window.EditorBuiltinFactories || {};

  factories['github-repository'] = function(ctx) {
    const state = ctx.state;

    function repository() {
      const remote = state.gitRemote;
      if (!remote || remote.provider !== 'github' || !remote.owner || !remote.repo) return null;
      return {owner:String(remote.owner), repo:String(remote.repo), branch:String(remote.branch || 'main')};
    }

    function render(g) {
      const view = document.createElement('div');
      view.className = 'editor-github-repository-view';
      const root = document.createElement('div');
      const style = document.createElement('style');
      style.textContent = `
        .editor-github-repository-page { box-sizing:border-box; width:min(760px,100%); margin:0 auto; padding:36px; color:#eee; }
        .editor-github-repository-header { display:flex; align-items:center; gap:14px; margin-bottom:24px; }
        .editor-github-repository-logo { width:32px; height:32px; flex:0 0 32px; filter:invert(1); }
        .editor-github-repository-header h2 { margin:0 0 8px; font-size:28px; }
        .editor-github-repository-header p { margin:0 0 24px; color:#aaa; }
        .editor-github-repository-card { background:#1e1e1e; border:1px solid #333; border-radius:10px; padding:22px; }
        .editor-github-repository-status { color:#aaa; }
        .editor-github-repository-status.error { color:#f88; }
        .editor-github-repository-card label { display:block; margin:0 0 18px; color:#ddd; }
        .editor-github-repository-card input { display:block; width:100%; box-sizing:border-box; margin-top:7px; padding:10px 12px; background:#151515; color:#eee; border:1px solid #444; border-radius:5px; font:inherit; }
        .editor-github-repository-name { color:#aaa; margin-bottom:22px; font-family:monospace; }
        .editor-github-repository-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:8px; }
        .editor-github-repository-actions button { padding:9px 14px; background:#333; color:#eee; border:1px solid #555; border-radius:4px; cursor:pointer; }
        .editor-github-repository-actions button[type="submit"] { background:#176b4a; }
        .editor-github-repository-actions button:disabled { opacity:.5; cursor:default; }
        .editor-github-repository-message { margin-top:14px; color:#aaa; }
        .editor-github-repository-message.success { color:#6dca9a; }
        .editor-github-repository-message.error { color:#f88; }
        .editor-github-repository-open-title { font-size:18px; font-weight:600; margin-bottom:8px; }
        .editor-github-repository-open-copy { color:#aaa; line-height:1.5; margin-bottom:18px; }
        .editor-github-repository-card button { padding:9px 14px; background:#333; color:#eee; border:1px solid #555; border-radius:4px; cursor:pointer; }
        .editor-github-repository-card button:hover { background:#444; }
        @media (max-width:600px) { .editor-github-repository-page { padding:20px; } }
      `;
      root.className = 'editor-github-repository-page';
      root.innerHTML = `
        <div class="editor-github-repository-header">
          <h2>GitHub Repository</h2>
          <p>Edit the GitHub repository description and topics for the repository currently open in Source Control.</p>
        </div>
        <div class="editor-github-repository-card">
          <div class="editor-github-repository-status" data-status>Loading…</div>
          <form data-form hidden>
            <div class="editor-github-repository-name" data-name></div>
            <label>Description<input type="text" data-description placeholder="Repository description"></label>
            <label>Topics<input type="text" data-topics placeholder="comma, separated, topics"></label>
            <div class="editor-github-repository-actions">
              <button type="button" data-reload>Reload</button>
              <button type="submit">Save to GitHub</button>
            </div>
            <div class="editor-github-repository-message" data-message></div>
          </form>
        </div>
      `;
      // Keep the stylesheet inside the same lifecycle-managed element as the view.
      // Workbench reuses builtin elements when tabs are switched; having <style>
      // as a sibling of the view lets the lifecycle hide/remove it independently.
      view.appendChild(style);
      view.appendChild(root);
      g.viewBody.appendChild(view);

      const status = root.querySelector('[data-status]');
      const form = root.querySelector('[data-form]');
      const name = root.querySelector('[data-name]');
      const description = root.querySelector('[data-description]');
      const topics = root.querySelector('[data-topics]');
      const message = root.querySelector('[data-message]');

      function setStatus(text, error = false) {
        status.hidden = !text;
        status.textContent = text || '';
        status.className = 'editor-github-repository-status' + (error ? ' error' : '');
      }

      function normalizeTopics(value) {
        return [...new Set(String(value || '')
          .split(',')
          .map(x => x.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''))
          .filter(Boolean))].slice(0, 20);
      }

      async function load() {
        form.hidden = true;
        message.textContent = '';
        const repo = repository();
        if (!repo) {
          setStatus('Open a GitHub repository in Source Control first.', true);
          return;
        }
        if (!window.GitHubService?.isSignedIn?.()) {
          setStatus('Sign in to GitHub from Profile to edit repository metadata.', true);
          return;
        }
        setStatus('Loading GitHub repository…');
        try {
          const data = await window.GitHubService.request('/repos/' + encodeURIComponent(repo.owner) + '/' + encodeURIComponent(repo.repo));
          name.textContent = data.full_name || (repo.owner + '/' + repo.repo);
          description.value = data.description || '';
          topics.value = Array.isArray(data.topics) ? data.topics.join(', ') : '';
          setStatus('');
          form.hidden = false;
        } catch (e) {
          setStatus(e?.message || String(e), true);
        }
      }

      root.querySelector('[data-reload]').onclick = load;

      form.onsubmit = async event => {
        event.preventDefault();
        const repo = repository();
        if (!repo) return;
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        message.className = 'editor-github-repository-message';
        message.textContent = 'Saving…';
        try {
          const names = normalizeTopics(topics.value);
          await window.GitHubService.request('/repos/' + encodeURIComponent(repo.owner) + '/' + encodeURIComponent(repo.repo), {
            method:'PATCH',
            body:JSON.stringify({description:String(description.value || '').trim()})
          });
          await window.GitHubService.request('/repos/' + encodeURIComponent(repo.owner) + '/' + encodeURIComponent(repo.repo) + '/topics', {
            method:'PUT',
            body:JSON.stringify({names})
          });
          topics.value = names.join(', ');
          message.className = 'editor-github-repository-message success';
          message.textContent = 'Saved to GitHub.';
        } catch (e) {
          message.className = 'editor-github-repository-message error';
          message.textContent = e?.message || String(e);
        } finally {
          button.disabled = false;
        }
      };

      load();
    }

    return {

      title: 'GitHub Repository',
      icon: 'GH',
      render
    };
  };
})();