(function () {
  const factories = window.EditorBuiltinFactories = window.EditorBuiltinFactories || {};

  factories['ai-asset-studio'] = function () {
    function render(group) {
      const page = document.createElement('div');
      page.className = 'ai-asset-studio-page';
      page.innerHTML = '<h2>AI Asset Studio</h2><p>Coming soon!</p>';
      group.viewBody.appendChild(page);
      return page;
    }

    return {
      title: 'AI Asset Studio',
      icon: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
      render
    };
  };
})();
