(function() {
  const root = window.EditorSidebar = window.EditorSidebar || {};
  root.Placeholders = function(options) {
    const {tree} = options;
    return {
      show(title, message = `No ${title.toLowerCase()} content yet.`) {
        tree.classList.remove('activity-collapsed');
        tree.innerHTML = `<div class="activity-sidebar-placeholder"><div class="activity-sidebar-title">${title}</div><div class="activity-sidebar-empty">${message}</div></div>`;
      }
    };
  };
})();
