(function() {
  const root = window.EditorSidebar = window.EditorSidebar || {};

  const sources = [
    {
      category: 'Web & JavaScript',
      entries: [
        {name: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web'},
        {name: 'W3Schools', url: 'https://www.w3schools.com/'},
        {name: 'JavaScript.info', url: 'https://javascript.info/'},
        {name: 'MDN Canvas API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API'},
        {name: 'MDN Web Audio API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API'}
      ]
    },
    {
      category: 'Graphics & Rendering',
      entries: [
        {name: 'WebGL Fundamentals', url: 'https://webglfundamentals.org/'},
        {name: 'WebGL2 Fundamentals', url: 'https://webgl2fundamentals.org/'},
        {name: 'WebGPU Fundamentals', url: 'https://webgpufundamentals.org/webgpu/lessons/'},
        {name: 'p5.js Reference', url: 'https://p5js.org/reference/'},
        {name: 'Three.js Manual', url: 'https://threejs.org/manual/'},
        {name: 'Three.js API', url: 'https://threejs.org/docs/'},
        {name: 'Babylon.js Docs', url: 'https://doc.babylonjs.com/'},
        {name: 'PixiJS Guides', url: 'https://pixijs.com/8.x/guides'}
      ]
    },
    {
      category: 'JavaScript, Node.js & Packages',
      entries: [
        {name: 'Node.js Learn', url: 'https://nodejs.org/learn'},
        {name: 'Node.js API Reference', url: 'https://nodejs.org/api/'},
        {name: 'npm Documentation', url: 'https://docs.npmjs.com/'},
        {name: 'Express.js Guide', url: 'https://expressjs.com/en/guide/'},
        {name: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/'},
        {name: 'Socket.IO Docs', url: 'https://socket.io/docs/v4/'}
      ]
    },
    {
      category: 'Game Development & Physics',
      entries: [
        {name: 'Phaser Documentation', url: 'https://www.phaser.io/oss/docs/'},
        {name: 'Matter.js Documentation', url: 'https://brm.io/matter-js/docs/'},
        {name: 'Game Programming Patterns', url: 'https://gameprogrammingpatterns.com/contents.html'}
      ]
    }
  ];

  function faviconURL(url) {
    const domain = new URL(url).hostname;
    return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=64';
  }

  root.Documentation = function(options) {
    const {tree, openDocumentationURL} = options;

    function makeEntry(entry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'documentation-link';
      button.title = entry.url;
      button.setAttribute('aria-label', 'Open ' + entry.name + ' in Browser');

      const icon = document.createElement('img');
      icon.className = 'documentation-favicon';
      icon.alt = '';
      icon.loading = 'lazy';
      icon.referrerPolicy = 'no-referrer';
      icon.src = faviconURL(entry.url);
      icon.addEventListener('error', () => {
        const fallback = document.createElement('span');
        fallback.className = 'documentation-favicon-fallback';
        fallback.textContent = entry.name.slice(0, 1).toUpperCase();
        fallback.setAttribute('aria-hidden', 'true');
        icon.replaceWith(fallback);
      }, {once: true});

      const label = document.createElement('span');
      label.className = 'documentation-link-label';
      label.textContent = entry.name;
      button.append(icon, label);

      button.addEventListener('click', async () => {
        if (button.disabled) return;
        button.disabled = true;
        try {
          await openDocumentationURL?.(entry.url);
        } catch (error) {
          console.error('Unable to open documentation:', entry.url, error);
        } finally {
          button.disabled = false;
        }
      });
      return button;
    }

    function show() {
      tree.classList.remove('activity-collapsed');
      tree.innerHTML = '';

      const page = document.createElement('div');
      page.className = 'documentation-page';

      const header = document.createElement('header');
      header.className = 'documentation-header';
      const title = document.createElement('h2');
      title.textContent = 'Documentation';
      const subtitle = document.createElement('p');
      subtitle.textContent = 'Common references and learning resources.';
      header.append(title, subtitle);
      page.appendChild(header);

      for (const section of sources) {
        const group = document.createElement('section');
        group.className = 'documentation-section';

        const heading = document.createElement('h3');
        heading.textContent = section.category;
        group.appendChild(heading);

        const list = document.createElement('div');
        list.className = 'documentation-links';
        for (const entry of section.entries) list.appendChild(makeEntry(entry));
        group.appendChild(list);
        page.appendChild(group);
      }

      tree.appendChild(page);
    }

    return {show};
  };
})();
