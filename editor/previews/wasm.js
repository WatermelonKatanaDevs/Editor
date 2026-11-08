(function () {
  const SECTION_NAMES = {
    0: 'Custom',
    1: 'Type',
    2: 'Import',
    3: 'Function',
    4: 'Table',
    5: 'Memory',
    6: 'Global',
    7: 'Export',
    8: 'Start',
    9: 'Element',
    10: 'Code',
    11: 'Data',
    12: 'Data Count',
    13: 'Tag'
  };
  const KIND_NAMES = ['function', 'table', 'memory', 'global', 'tag'];

  function bytesOf(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (Array.isArray(value)) return Uint8Array.from(value);
    if (typeof value === 'string') return Uint8Array.from(value, ch => ch.charCodeAt(0) & 255);
    throw new TypeError('Could not read WebAssembly bytes.');
  }

  function readUleb(bytes, state) {
    let result = 0;
    let shift = 0;
    for (let i = 0; i < 5; i++) {
      if (state.offset >= bytes.length) throw new Error('Unexpected end of WebAssembly section.');
      const byte = bytes[state.offset++];
      result += (byte & 0x7f) * Math.pow(2, shift);
      if (!(byte & 0x80)) return result;
      shift += 7;
    }
    throw new Error('Invalid or oversized WebAssembly integer.');
  }

  function readName(bytes, state) {
    const length = readUleb(bytes, state);
    if (length > bytes.length - state.offset) throw new Error('Invalid WebAssembly name length.');
    const value = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(state.offset, state.offset + length));
    state.offset += length;
    return value;
  }

  function skipLimits(bytes, state) {
    const flags = readUleb(bytes, state);
    readUleb(bytes, state);
    if (flags & 1) readUleb(bytes, state);
    if (flags & 2) readUleb(bytes, state);
    if (flags & 4) readUleb(bytes, state);
  }

  function parseImports(bytes, section) {
    const state = { offset: section.start };
    const end = section.end;
    const count = readUleb(bytes, state);
    const imports = [];
    if (count > 100000) throw new Error('Import count is too large to display.');
    for (let i = 0; i < count && state.offset < end; i++) {
      const module = readName(bytes, state);
      const name = readName(bytes, state);
      const kind = bytes[state.offset++];
      const detail = { module, name, kind: KIND_NAMES[kind] || 'unknown' };
      if (kind === 0) detail.typeIndex = readUleb(bytes, state);
      else if (kind === 1) {
        detail.referenceType = bytes[state.offset++];
        skipLimits(bytes, state);
      } else if (kind === 2) skipLimits(bytes, state);
      else if (kind === 3) {
        detail.valueType = bytes[state.offset++];
        detail.mutable = !!bytes[state.offset++];
      } else if (kind === 4) {
        detail.attribute = bytes[state.offset++];
        detail.typeIndex = readUleb(bytes, state);
      } else throw new Error('Unknown WebAssembly import kind.');
      imports.push(detail);
    }
    return imports;
  }

  function parseExports(bytes, section) {
    const state = { offset: section.start };
    const end = section.end;
    const count = readUleb(bytes, state);
    const exports = [];
    if (count > 100000) throw new Error('Export count is too large to display.');
    for (let i = 0; i < count && state.offset < end; i++) {
      const name = readName(bytes, state);
      const kind = bytes[state.offset++];
      const index = readUleb(bytes, state);
      exports.push({ name, kind: KIND_NAMES[kind] || 'unknown', index });
    }
    return exports;
  }

  function inspect(value) {
    const bytes = bytesOf(value);
    if (bytes.length < 8 || bytes[0] !== 0 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) {
      throw new Error('This file does not have a valid WebAssembly magic header.');
    }
    const version = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
    const sections = [];
    const imports = [];
    const exports = [];
    let offset = 8;
    while (offset < bytes.length) {
      if (offset + 1 > bytes.length) throw new Error('Incomplete WebAssembly section header.');
      const id = bytes[offset++];
      const state = { offset };
      const size = readUleb(bytes, state);
      const start = state.offset;
      const end = start + size;
      if (end > bytes.length) throw new Error('WebAssembly section extends past the end of the file.');
      const section = {
        id,
        name: SECTION_NAMES[id] || (id === 0 ? 'Custom' : 'Unknown'),
        size,
        offset: offset - 1,
        start,
        end
      };
      sections.push(section);
      if (id === 0) {
        const nameState = { offset: start };
        try { section.customName = readName(bytes, nameState); } catch (_) {}
      } else if (id === 2) {
        try { imports.push(...parseImports(bytes, section)); }
        catch (error) { section.parseError = error.message; }
      } else if (id === 7) {
        try { exports.push(...parseExports(bytes, section)); }
        catch (error) { section.parseError = error.message; }
      }
      offset = end;
    }
    return { bytes, version, sections, imports, exports };
  }

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value);
    return node;
  }

  function makeList(host, records, emptyMessage, format) {
    if (!records.length) {
      host.appendChild(element('div', 'editor-wasm-empty', emptyMessage));
      return;
    }
    const list = element('ul', 'editor-wasm-list');
    for (const record of records) {
      const li = element('li', 'editor-wasm-list-item');
      const main = element('span', 'editor-wasm-list-main', format(record));
      const meta = element('span', 'editor-wasm-list-meta',
        record.kind + (Number.isInteger(record.index) ? ' · index ' + record.index : ''));
      li.append(main, meta);
      list.appendChild(li);
    }
    host.appendChild(list);
  }

  function makePreview(ctx) {
    const root = element('section', 'editor-wasm-preview');
    const header = element('header', 'editor-wasm-header');
    const titleGroup = element('div', 'editor-wasm-title-group');
    const title = element('h2', 'editor-wasm-title', 'WebAssembly module');
    const subtitle = element('p', 'editor-wasm-subtitle', ctx.file.name + ' · binary inspection');
    titleGroup.append(title, subtitle);
    const badge = element('span', 'editor-wasm-badge', 'WASM');
    header.append(titleGroup, badge);
    root.appendChild(header);

    let info;
    try {
      info = inspect(ctx.readBinary());
    } catch (error) {
      root.appendChild(element('div', 'editor-wasm-error', error?.message || 'Could not inspect this WebAssembly file.'));
      ctx.host.appendChild(root);
      return;
    }

    const stats = element('div', 'editor-wasm-stats');
    const stat = (label, value) => {
      const box = element('div', 'editor-wasm-stat');
      box.append(element('span', 'editor-wasm-stat-label', label), element('strong', 'editor-wasm-stat-value', value));
      stats.appendChild(box);
    };
    stat('File size', formatBytes(info.bytes.length));
    stat('Version', info.version + (info.version === 1 ? ' · MVP' : ''));
    stat('Sections', info.sections.length);
    stat('Imports', info.imports.length);
    stat('Exports', info.exports.length);
    root.appendChild(stats);

    const grid = element('div', 'editor-wasm-grid');
    const sectionCard = element('section', 'editor-wasm-card');
    sectionCard.appendChild(element('h3', 'editor-wasm-card-title', 'Module sections'));
    if (!info.sections.length) sectionCard.appendChild(element('div', 'editor-wasm-empty', 'No sections found.'));
    else {
      const list = element('div', 'editor-wasm-section-list');
      for (const section of info.sections) {
        const row = element('div', 'editor-wasm-section');
        const heading = element('div', 'editor-wasm-section-heading');
        const name = section.customName ? section.name + ' · ' + section.customName : section.name;
        heading.append(element('span', 'editor-wasm-section-name', name), element('span', 'editor-wasm-section-size', formatBytes(section.size)));
        const track = element('div', 'editor-wasm-section-track');
        const bar = element('div', 'editor-wasm-section-bar');
        bar.style.width = Math.max(1, section.size / Math.max(1, info.bytes.length) * 100) + '%';
        track.appendChild(bar);
        row.append(heading, track);
        if (section.parseError) row.appendChild(element('div', 'editor-wasm-section-error', section.parseError));
        list.appendChild(row);
      }
      sectionCard.appendChild(list);
    }
    grid.appendChild(sectionCard);

    const symbolColumn = element('div', 'editor-wasm-symbol-column');
    const importCard = element('section', 'editor-wasm-card');
    importCard.appendChild(element('h3', 'editor-wasm-card-title', 'Imports'));
    makeList(importCard, info.imports, 'This module has no imports.', item => item.module + ' / ' + item.name);
    const exportCard = element('section', 'editor-wasm-card');
    exportCard.appendChild(element('h3', 'editor-wasm-card-title', 'Exports'));
    makeList(exportCard, info.exports, 'This module has no exports.', item => item.name);
    symbolColumn.append(importCard, exportCard);
    grid.appendChild(symbolColumn);
    root.appendChild(grid);

    const hexCard = element('section', 'editor-wasm-card editor-wasm-hex-card');
    const hexHeading = element('div', 'editor-wasm-hex-heading');
    hexHeading.append(element('h3', 'editor-wasm-card-title', 'Binary preview'), element('span', 'editor-wasm-section-size', 'First 256 bytes'));
    hexCard.appendChild(hexHeading);
    const pre = element('pre', 'editor-wasm-hex');
    const limit = Math.min(info.bytes.length, 256);
    for (let offset = 0; offset < limit; offset += 16) {
      const bytes = info.bytes.subarray(offset, Math.min(offset + 16, limit));
      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(' ').padEnd(47, ' ');
      const ascii = Array.from(bytes, byte => byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.').join('');
      pre.appendChild(element('div', 'editor-wasm-hex-line',
        offset.toString(16).padStart(8, '0') + '  ' + hex + '  ' + ascii));
    }
    if (info.bytes.length > limit) pre.appendChild(element('div', 'editor-wasm-hex-more', '… ' + formatBytes(info.bytes.length - limit) + ' more'));
    hexCard.appendChild(pre);
    root.appendChild(hexCard);

    const validation = element('div', 'editor-wasm-validation', 'Checking module validation…');
    root.appendChild(validation);
    if (typeof WebAssembly !== 'undefined' && WebAssembly.compile) {
      WebAssembly.compile(info.bytes).then(() => {
        validation.textContent = 'WebAssembly module validation passed.';
        validation.classList.add('is-valid');
      }).catch(error => {
        validation.textContent = 'Browser validation failed: ' + (error?.message || 'invalid module');
        validation.classList.add('is-invalid');
      });
    } else {
      validation.textContent = 'This browser does not expose the WebAssembly validation API.';
    }

    ctx.host.appendChild(root);
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  window.EditorWasmInspector = { inspect };
  window.EditorPreviewProviders = window.EditorPreviewProviders || [];
  window.EditorPreviewProviders.push({
    id: 'webassembly',
    match(file) {
      return /\.wasm$/i.test(String(file.name || file.path || '')) ||
        String(file.mime || '').toLowerCase() === 'application/wasm';
    },
    views: [{
      id: 'wasm-inspect',
      label: 'Inspect',
      default: true,
      priority: 130,
      create: makePreview
    }]
  });
})();