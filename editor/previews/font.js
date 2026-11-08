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

  function extractEotFont(value) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    if (bytes.length < 84) throw new Error('This EOT file is too short to contain a valid font header.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const eotSize = view.getUint32(0, true);
    const fontDataSize = view.getUint32(4, true);
    const version = view.getUint32(8, true);
    const flags = view.getUint32(12, true);
    if (![0x00010000, 0x00020001, 0x00020002].includes(version)) {
      throw new Error('This EOT version is not supported by the font preview.');
    }
    if (view.getUint16(34, true) !== 0x504c) {
      throw new Error('The EOT header has an invalid magic number.');
    }
    if (eotSize > bytes.length || eotSize < 84 || !fontDataSize || fontDataSize > eotSize) {
      throw new Error('The EOT header contains invalid font data bounds.');
    }
    if (flags & 0x00000004) {
      throw new Error('This EOT uses MicroType Express compression, which this preview cannot decompress. Convert it to WOFF2, WOFF, TTF, or OTF to preview it.');
    }
    const start = eotSize - fontDataSize;
    if (start < 82 || start >= eotSize) throw new Error('The EOT font payload is outside the file bounds.');
    const fontBytes = bytes.slice(start, eotSize);
    if (flags & 0x10000000) {
      for (let index = 0; index < fontBytes.length; index++) fontBytes[index] ^= 0x50;
    }
    const signature = Array.from(fontBytes.subarray(0, 4), byte => String.fromCharCode(byte)).join('');
    let mime;
    if (signature === 'OTTO' || signature === 'typ1') mime = 'font/otf';
    else if (signature === 'ttcf') mime = 'font/collection';
    else if (signature === 'true' || (fontBytes[0] === 0 && fontBytes[1] === 1 && fontBytes[2] === 0 && fontBytes[3] === 0)) mime = 'font/ttf';
    else throw new Error('The EOT payload is not a recognized TrueType or OpenType font.');
    return { bytes: fontBytes, mime };
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
      let fontBytes = bytes;
      let fontMime = MIME_TYPES[extension] || 'application/octet-stream';
      if (extension === 'eot') {
        const extracted = extractEotFont(bytes);
        fontBytes = extracted.bytes;
        fontMime = extracted.mime;
      }
      objectURL = URL.createObjectURL(new Blob([fontBytes], { type: fontMime }));
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
      status.textContent = error?.message || 'The browser could not load this font. The specimen is shown in a fallback font.';
    }
  }
  window.EditorPreviewProviders = window.EditorPreviewProviders || [];
  window.EditorPreviewProviders.push({
    id: 'font',
    match(file) { return FONT_EXTENSIONS.has(extensionOf(file)); },
    views: [{ id: 'font-preview', label: 'Font Preview', default: true, priority: 145, create: makePreview }]
  });
})();