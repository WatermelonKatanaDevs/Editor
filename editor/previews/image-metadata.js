(function () {
  const ENGINE_URL = 'https://cdn.jsdelivr.net/npm/@colorhythm/exiftool-wasm@1.0.6/dist/esm/index.js';
  let enginePromise = null;

  function loadEngine() {
    if (!enginePromise) {
      enginePromise = import(ENGINE_URL).catch(error => {
        enginePromise = null;
        throw error;
      });
    }
    return enginePromise;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function asBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    if (Array.isArray(data)) return new Uint8Array(data);
    return new Uint8Array(0);
  }

  function fileName(ctx) {
    return String(ctx.file.name || ctx.file.path.split('/').pop() || 'image.bin');
  }

  function groupForKey(key) {
    const index = key.indexOf(':');
    return index < 0 ? 'Other' : key.slice(0, index);
  }

  function isReadOnly(entry) {
    const group = groupForKey(entry.key);
    return ['File', 'Composite', 'ExifTool'].includes(group) ||
      (entry.value !== null && typeof entry.value === 'object' && !Array.isArray(entry.value));
  }

  function stringifyValue(value) {
    if (Array.isArray(value)) return JSON.stringify(value, null, 2);
    if (value !== null && typeof value === 'object') return JSON.stringify(value, null, 2);
    return value == null ? '' : String(value);
  }

  function valueForExifTool(entry) {
    const raw = entry.raw;
    if (Array.isArray(entry.value)) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every(value => value == null || ['string', 'number', 'boolean'].includes(typeof value))) {
          return parsed.map(value => value == null ? '' : value);
        }
      } catch (_) {}
      return raw.split(/\r?\n/).filter((value, index, all) => value !== '' || all.length === 1);
    }
    if (typeof entry.value === 'number' && raw.trim() !== '' && Number.isFinite(Number(raw))) return Number(raw);
    if (typeof entry.value === 'boolean') {
      if (/^true$/i.test(raw.trim())) return true;
      if (/^false$/i.test(raw.trim())) return false;
    }
    return raw;
  }

  async function readMetadata(engine, ctx) {
    const bytes = asBytes(ctx.readBinary(ctx.file.path));
    if (!bytes.length) throw new Error('The image file is empty or could not be read.');

    const result = await engine.parseMetadata({
      name: fileName(ctx),
      data: bytes
    }, {
      args: ['-json', '-G1', '-a', '-s', '-n', '-u', '-u', '-m', '-q'],
      transform: output => JSON.parse(output)
    });

    if (!result.success) throw new Error(result.error || 'ExifTool could not read this image.');
    const document = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!document || typeof document !== 'object') return [];

    return Object.entries(document)
      .filter(([key]) => key !== 'SourceFile')
      .map(([key, value]) => ({
        key,
        value,
        raw: stringifyValue(value),
        initialRaw: stringifyValue(value),
        added: false,
        removed: false
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  function create(ctx) {
    const root = element('section', 'editor-image-metadata');
    const header = element('div', 'editor-image-metadata-header');
    const heading = element('div', 'editor-image-metadata-heading');
    heading.appendChild(element('strong', '', 'Image Metadata'));
    heading.appendChild(element('small', '', 'Read and edit metadata stored inside this image.'));
    const status = element('div', 'editor-image-metadata-status', 'Loading metadata engine…');
    header.append(heading, status);

    const toolbar = element('div', 'editor-image-metadata-toolbar');
    const search = element('input', 'editor-image-metadata-search');
    search.type = 'search';
    search.placeholder = 'Search metadata…';
    search.setAttribute('aria-label', 'Search metadata');
    const addButton = element('button', '', 'Add field');
    addButton.type = 'button';
    const reloadButton = element('button', '', 'Reload');
    reloadButton.type = 'button';
    const saveButton = element('button', 'editor-image-metadata-save', 'Save changes');
    saveButton.type = 'button';
    saveButton.disabled = true;
    toolbar.append(search, addButton, reloadButton, saveButton);

    const addPanel = element('div', 'editor-image-metadata-add');
    addPanel.hidden = true;
    const addName = element('input');
    addName.placeholder = 'Tag name, e.g. XMP-dc:Title';
    addName.setAttribute('aria-label', 'Metadata tag name');
    const addValue = element('input');
    addValue.placeholder = 'Value';
    addValue.setAttribute('aria-label', 'Metadata tag value');
    const confirmAdd = element('button', '', 'Add tag');
    confirmAdd.type = 'button';
    const cancelAdd = element('button', '', 'Cancel');
    cancelAdd.type = 'button';
    const addError = element('span', 'editor-image-metadata-add-error');
    addPanel.append(addName, addValue, confirmAdd, cancelAdd, addError);

    const note = element('div', 'editor-image-metadata-note',
      'All detected metadata groups are listed. File and calculated fields are read-only; unsupported tags are reported by ExifTool when saving. Processing runs locally in your browser.');
    const content = element('div', 'editor-image-metadata-content');
    root.append(header, toolbar, addPanel, note, content);
    ctx.host.appendChild(root);

    let engine = null;
    let entries = [];
    let busy = false;
    let disposed = false;

    function hasChanges() {
      return entries.some(entry => entry.added || entry.removed || entry.raw !== entry.initialRaw);
    }

    function updateSaveButton() {
      saveButton.disabled = busy || !hasChanges();
      addButton.disabled = busy;
      reloadButton.disabled = busy;
    }

    function setStatus(message, type) {
      status.textContent = message;
      status.classList.toggle('is-error', type === 'error');
      status.classList.toggle('is-success', type === 'success');
    }

    function renderEntries() {
      content.innerHTML = '';
      const query = search.value.trim().toLowerCase();
      const visible = entries.filter(entry =>
        !query || entry.key.toLowerCase().includes(query) || entry.raw.toLowerCase().includes(query)
      );

      if (!visible.length) {
        content.appendChild(element('div', 'editor-image-metadata-empty',
          entries.length ? 'No metadata fields match your search.' : 'No metadata tags were found. Add a field to write metadata into this image.'));
        updateSaveButton();
        return;
      }

      const groups = new Map();
      for (const entry of visible) {
        const group = groupForKey(entry.key);
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(entry);
      }

      for (const [group, groupEntries] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
        const details = element('details', 'editor-image-metadata-group');
        details.open = !['File', 'Composite', 'ExifTool'].includes(group);
        const summary = element('summary', '');
        summary.append(
          element('span', 'editor-image-metadata-group-name', group),
          element('span', 'editor-image-metadata-group-count', String(groupEntries.length))
        );
        details.appendChild(summary);
        const rows = element('div', 'editor-image-metadata-rows');

        for (const entry of groupEntries) {
          const readOnly = isReadOnly(entry);
          const row = element('div', 'editor-image-metadata-row');
          if (entry.removed) row.classList.add('is-removed');
          if (entry.added) row.classList.add('is-added');

          const key = element('label', 'editor-image-metadata-key', entry.key);
          key.title = entry.key;
          const value = element('textarea', 'editor-image-metadata-value');
          value.value = entry.raw;
          value.rows = Math.min(5, Math.max(1, entry.raw.split('\n').length));
          value.spellcheck = false;
          value.disabled = readOnly || entry.removed;
          value.setAttribute('aria-label', entry.key + ' value');
          value.addEventListener('input', () => {
            entry.raw = value.value;
            updateSaveButton();
          });

          const remove = element('button', 'editor-image-metadata-remove', entry.removed ? 'Undo' : 'Remove');
          remove.type = 'button';
          remove.disabled = readOnly;
          remove.title = readOnly ? 'This field is read-only' : (entry.removed ? 'Restore this field' : 'Remove this metadata field');
          remove.addEventListener('click', () => {
            entry.removed = !entry.removed;
            row.classList.toggle('is-removed', entry.removed);
            value.disabled = readOnly || entry.removed;
            remove.textContent = entry.removed ? 'Undo' : 'Remove';
            updateSaveButton();
          });

          row.append(key, value, remove);
          if (readOnly) row.title = 'Read-only field';
          rows.appendChild(row);
        }

        details.appendChild(rows);
        content.appendChild(details);
      }
      updateSaveButton();
    }

    async function loadEntries(confirmDiscard) {
      if (busy) return;
      if (confirmDiscard && hasChanges() && !window.confirm('Discard your unsaved metadata changes and reload the image?')) return;
      busy = true;
      updateSaveButton();
      setStatus('Reading image metadata…');
      try {
        engine = engine || await loadEngine();
        const nextEntries = await readMetadata(engine, ctx);
        if (disposed || !ctx.isCurrent()) return;
        entries = nextEntries;
        renderEntries();
        const editableCount = entries.filter(entry => !isReadOnly(entry)).length;
        setStatus(entries.length + ' fields found · ' + editableCount + ' editable');
      } catch (error) {
        if (!disposed) setStatus(error.message || String(error), 'error');
      } finally {
        busy = false;
        updateSaveButton();
      }
    }

    async function saveChanges() {
      if (busy || !hasChanges()) return;
      const changes = Object.create(null);
      for (const entry of entries) {
        if (isReadOnly(entry)) continue;
        if (entry.removed) {
          changes[entry.key] = '';
          continue;
        }
        if (entry.added || entry.raw !== entry.initialRaw) changes[entry.key] = valueForExifTool(entry);
      }

      if (!Object.keys(changes).length) return;
      busy = true;
      updateSaveButton();
      setStatus('Saving metadata…');

      try {
        const piskelInstance = ctx.tab._previewInstances?.get('piskel');
        if (piskelInstance?.promise) await piskelInstance.promise;
        if (typeof ctx.tab._piskelFlush === 'function') {
          const flushed = await ctx.tab._piskelFlush();
          if (flushed === false) throw new Error('Piskel could not save its current image before the metadata update.');
        }

        const bytes = asBytes(ctx.readBinary(ctx.file.path));
        if (!bytes.length) throw new Error('The image file could not be read.');
        const result = await engine.writeMetadata({
          name: fileName(ctx),
          data: bytes
        }, changes, {
          args: ['-m', '-q']
        });

        if (!result.success) throw new Error(result.error || 'ExifTool could not write the requested metadata.');
        if (disposed || !ctx.isCurrent()) return;

        ctx.writeBinary(new Uint8Array(result.data), ctx.file.path);
        ctx.markDirty(ctx.file.path);

        // Piskel exports a fresh PNG when it saves. Reapply metadata edited here
        // so a later drawing save does not silently discard these changes.
        ctx.tab._piskelMetadataTags ||= Object.create(null);
        Object.assign(ctx.tab._piskelMetadataTags, changes);
        if (typeof ctx.tab._piskelMetadataPatch !== 'function') {
          const patchMetadataForPiskel = async pngBytes => {
            const tags = ctx.tab._piskelMetadataTags || {};
            if (!Object.keys(tags).length) return pngBytes;
            const baseName = fileName(ctx).replace(/\.[^.]+$/, '');
            const patched = await engine.writeMetadata({
              name: baseName + '.png',
              data: asBytes(pngBytes)
            }, tags, {
              args: ['-m', '-q']
            });
            if (!patched.success) throw new Error(patched.error || 'Could not preserve edited metadata in the Piskel export.');
            return new Uint8Array(patched.data);
          };
          ctx.tab._piskelMetadataPatch = patchMetadataForPiskel;
          ctx.addCleanup(() => {
            if (ctx.tab._piskelMetadataPatch === patchMetadataForPiskel) {
              delete ctx.tab._piskelMetadataPatch;
              delete ctx.tab._piskelMetadataTags;
            }
          });
        }

        ctx.manager.dispose(ctx.tab, 'image-preview');

        entries = await readMetadata(engine, ctx);
        if (disposed || !ctx.isCurrent()) return;
        renderEntries();
        setStatus('Metadata saved · ' + entries.length + ' fields', 'success');
      } catch (error) {
        if (!disposed) setStatus(error.message || String(error), 'error');
      } finally {
        busy = false;
        updateSaveButton();
      }
    }

    addButton.addEventListener('click', () => {
      addPanel.hidden = !addPanel.hidden;
      if (!addPanel.hidden) addName.focus();
    });
    cancelAdd.addEventListener('click', () => {
      addPanel.hidden = true;
      addName.value = '';
      addValue.value = '';
      addError.textContent = '';
    });
    confirmAdd.addEventListener('click', () => {
      const key = addName.value.trim();
      const value = addValue.value;
      if (!/^[A-Za-z0-9_-]+(?::[A-Za-z0-9_:-]+)?$/.test(key)) {
        addError.textContent = 'Use a tag name such as EXIF:Artist or XMP-dc:Title.';
        return;
      }
      if (!value.trim()) {
        addError.textContent = 'Enter a value for the new tag.';
        return;
      }
      if (entries.some(entry => entry.key.toLowerCase() === key.toLowerCase() && !entry.removed)) {
        addError.textContent = 'That tag already exists.';
        return;
      }
      entries.push({
        key,
        value: '',
        raw: value,
        initialRaw: '',
        added: true,
        removed: false
      });
      entries.sort((a, b) => a.key.localeCompare(b.key));
      addPanel.hidden = true;
      addName.value = '';
      addValue.value = '';
      addError.textContent = '';
      renderEntries();
    });
    search.addEventListener('input', renderEntries);
    reloadButton.addEventListener('click', () => loadEntries(true));
    saveButton.addEventListener('click', saveChanges);

    ctx.addCleanup(() => {
      disposed = true;
      root.remove();
    });

    loadEntries(false);
  }

  window.EditorPreviewProviders = window.EditorPreviewProviders || [];
  window.EditorPreviewProviders.push({
    id: 'image-metadata',
    match(file) {
      return String(file.mime || '').toLowerCase().startsWith('image/');
    },
    views: [{
      id: 'image-metadata',
      label: 'Metadata',
      priority: 50,
      create
    }]
  });
})();