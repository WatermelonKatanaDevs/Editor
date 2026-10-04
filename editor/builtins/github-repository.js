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
      const root = document.createElement('div');
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
      g.viewBody.appendChild(root);

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