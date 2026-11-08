(function () {
  const FONT_EXTENSIONS = new Set(['eot', 'woff', 'woff2', 'ttf', 'tff', 'otf', 'ttc', 'otc', 'dfont']);
  const MIME_TYPES = {
    eot: 'application/vnd.ms-fontobject', woff: 'font/woff', woff2: 'font/woff2',
    ttf: 'font/ttf', tff: 'font/ttf', otf: 'font/otf',
    ttc: 'font/collection', otc: 'font/collection', dfont: 'font/dfont'
  };
  function extensionOf(file) {
    return String(file.name || file.path || '').split('.').pop().toLowerCase();
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  async function makePreview(ctx) {
    const extension = extensionOf(ctx.file);
    const family = 'WKFontPreview_' + Math.random().toString(36).slice(2);
    const root = element('section', 'editor-font-preview');
    const header = element('header', 'editor-font-header');
    const heading = element('div', 'editor-font-heading');
    heading.append(element('h2', '', 'Font specimen'), element('p', '', ctx.file.name));
    header.append(heading, element('span', 'editor-font-format', extension.toUpperCase()));
    const controls = element('div', 'editor-font-controls');
    const sizeLabel = element('label', 'editor-font-size-label', 'Sample size');
    const size = element('input', 'editor-font-size');
    size.type = 'range'; size.min = '24'; size.max = '112'; size.step = '1'; size.value = '64';
    sizeLabel.appendChild(size);
    const sizeValue = element('span', 'editor-font-size-value', '64 px');
    const customLabel = element('label', 'editor-font-custom-label', 'Custom text');
    const customInput = element('input', 'editor-font-custom-input');
    customInput.type = 'text'; customInput.value = 'The quick brown fox jumps over the lazy dog.'; customInput.maxLength = 240;
    customLabel.appendChild(customInput);
    controls.append(sizeLabel, sizeValue, customLabel);

    const specimen = element('div', 'editor-font-specimen');
    const hero = element('section', 'editor-font-hero');
    const heroLetters = element('div', 'editor-font-hero-letters', 'Aa');
    const heroText = element('div', 'editor-font-hero-text', 'The quick brown fox jumps over the lazy dog.');
    hero.append(heroLetters, heroText);
    const alphabet = element('section', 'editor-font-sample-card');
    alphabet.append(
      element('div', 'editor-font-sample-caption', 'UPPERCASE'),
      element('div', 'editor-font-sample-text', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
      element('div', 'editor-font-sample-caption', 'lowercase'),
      element('div', 'editor-font-sample-text', 'abcdefghijklmnopqrstuvwxyz')
    );
    const figures = element('section', 'editor-font-sample-card');
    figures.append(
      element('div', 'editor-font-sample-caption', 'NUMERALS'),
      element('div', 'editor-font-sample-text', '0123456789'),
      element('div', 'editor-font-sample-caption', 'PUNCTUATION'),
      element('div', 'editor-font-sample-text', '!?@#$%&*()[]{}<>+-=/\\:;,.\u201c\u201d\u2018\u2019')
    );
    const custom = element('section', 'editor-font-custom-card');
    custom.append(element('div', 'editor-font-sample-caption', 'YOUR TEXT'), element('div', 'editor-font-custom-sample', customInput.value));
    specimen.append(hero, alphabet, figures, custom);
    const status = element('div', 'editor-font-status', 'Loading font…');
    root.append(header, controls, specimen, status);
    ctx.host.appendChild(root);

    size.addEventListener('input', () => {
      const value = Number(size.value) || 64;
      sizeValue.textContent = value + ' px';
      heroLetters.style.fontSize = value + 'px';
      heroText.style.fontSize = Math.max(18, Math.round(value * 0.34)) + 'px';
    });
    size.dispatchEvent(new Event('input'));
    customInput.addEventListener('input', () => {
      custom.querySelector('.editor-font-custom-sample').textContent = customInput.value || 'Type to preview this font';
    });

    let objectURL = null, loadedFace = null, disposed = false;
    ctx.addCleanup(() => {
      disposed = true;
      if (loadedFace) { try { document.fonts.delete(loadedFace); } catch (_) {} loadedFace = null; }
      if (objectURL) { URL.revokeObjectURL(objectURL); objectURL = null; }
    });
    try {
      const bytes = ctx.readBinary();
      if (!bytes || !bytes.byteLength) throw new Error('The font file is empty or could not be read.');
      objectURL = URL.createObjectURL(new Blob([bytes], { type: MIME_TYPES[extension] || 'application/octet-stream' }));
      if (typeof FontFace !== 'function' || !document.fonts) throw new Error('This browser does not support loading local font files into a preview.');
      const face = new FontFace(family, 'url("' + objectURL + '")');
      loadedFace = await face.load();
      if (disposed || !ctx.isCurrent()) {
        try { document.fonts.delete(loadedFace); } catch (_) {}
        loadedFace = null;
        return;
      }
      document.fonts.add(loadedFace);
      specimen.style.fontFamily = '"' + family + '", sans-serif';
      root.classList.add('font-loaded');
      status.textContent = 'Font loaded · ' + extension.toUpperCase();
    } catch (error) {
      if (disposed || !ctx.isCurrent()) return;
      status.classList.add('is-error');
      status.textContent = extension === 'eot'
        ? 'This browser cannot load legacy EOT fonts. The specimen is shown in a fallback font; convert the file to WOFF2, WOFF, TTF, or OTF to preview it here.'
        : (error?.message || 'The browser could not load this font. The specimen is shown in a fallback font.');
    }
  }
  window.EditorPreviewProviders = window.EditorPreviewProviders || [];
  window.EditorPreviewProviders.push({
    id: 'font',
    match(file) { return FONT_EXTENSIONS.has(extensionOf(file)); },
    views: [{ id: 'font-preview', label: 'Font Preview', default: true, priority: 145, create: makePreview }]
  });
})();