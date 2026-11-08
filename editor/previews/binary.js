(function () {
  const MAX_PREVIEW_BYTES = 4096;
  const LINE_BYTES = 16;
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function toBytes(value) {
    if (value instanceof Uint8Array) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (Array.isArray(value)) return Uint8Array.from(value);
    throw new TypeError('The binary file could not be read as bytes.');
  }
  function detectFormat(bytes) {
    if (bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) return 'ELF executable or shared library';
    if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) return 'Windows PE/DOS executable';
    const magic = Array.from(bytes.subarray(0, 4), value => value.toString(16).padStart(2, '0')).join('');
    if (['feedface','feedfacf','cefaedfe','cffaedfe','cafebabe','bebafeca'].includes(magic)) return 'Mach-O binary';
    if (bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d) return 'WebAssembly module';
    if (bytes.length >= 4 && String.fromCharCode(...bytes.subarray(0, 4)) === 'wOFF') return 'WOFF font';
    if (bytes.length >= 4 && String.fromCharCode(...bytes.subarray(0, 4)) === 'wOF2') return 'WOFF2 font';
    return 'Unknown binary format';
  }
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  function makePreview(ctx) {
    const name = String(ctx.file.name || ctx.file.path || 'binary file');
    const extension = name.split('.').pop().toLowerCase();
    const bytes = toBytes(ctx.readBinary());
    const root = element('section', 'editor-binary-preview');
    const header = element('header', 'editor-binary-header');
    const heading = element('div', 'editor-binary-heading');
    heading.append(element('h2', '', extension === 'node' ? 'Native addon binary' : 'Binary file'), element('p', '', name));
    header.append(heading, element('span', 'editor-binary-format', extension.toUpperCase()));
    const stats = element('div', 'editor-binary-stats');
    stats.append(element('span', '', formatBytes(bytes.length)), element('span', '', detectFormat(bytes)));
    const note = element('div', 'editor-binary-note');
    const shown = Math.min(bytes.length, MAX_PREVIEW_BYTES);
    note.textContent = bytes.length > shown
      ? 'Showing the first ' + formatBytes(shown) + ' of ' + formatBytes(bytes.length) + '. This preview is read-only.'
      : 'Read-only hexadecimal view · ' + bytes.length + ' bytes';
    const table = element('div', 'editor-binary-hex');
    table.setAttribute('role', 'table');
    for (let offset = 0; offset < shown; offset += LINE_BYTES) {
      const row = element('div', 'editor-binary-row');
      row.setAttribute('role', 'row');
      const address = element('span', 'editor-binary-address', offset.toString(16).padStart(8, '0'));
      const hex = element('span', 'editor-binary-bytes');
      const ascii = element('span', 'editor-binary-ascii');
      const chars = [];
      const parts = [];
      for (let index = 0; index < LINE_BYTES; index++) {
        const value = bytes[offset + index];
        if (value == null) { parts.push('  '); chars.push(' '); continue; }
        parts.push(value.toString(16).padStart(2, '0'));
        chars.push(value >= 32 && value <= 126 ? String.fromCharCode(value) : '.');
      }
      hex.textContent = parts.join(' ');
      ascii.textContent = chars.join('');
      row.append(address, hex, ascii);
      table.appendChild(row);
    }
    if (!bytes.length) table.appendChild(element('div', 'editor-binary-empty', 'This file is empty.'));
    root.append(header, stats, note, table);
    ctx.host.appendChild(root);
  }
  window.EditorBinaryInspector = { detectFormat };
  window.EditorPreviewProviders = window.EditorPreviewProviders || [];
  window.EditorPreviewProviders.push({
    id: 'binary',
    match(file) { return /\.(?:bin|node)$/i.test(String(file.name || file.path || '')); },
    views: [{
      id: 'binary-hex',
      label: 'Hex',
      default: true,
      priority: 140,
      create: makePreview
    }]
  });
})();