(function () {
  const DELIMITERS = [
    { value: 'auto', label: 'Auto detect' },
    { value: ',', label: 'Comma (,)' },
    { value: '\t', label: 'Tab' },
    { value: ';', label: 'Semicolon (;)' },
    { value: '|', label: 'Pipe (|)' }
  ];
  function parseDelimited(text, delimiter) {
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else quoted = false;
        } else field += ch;
      } else if (ch === '"' && field.length === 0) {
        quoted = true;
      } else if (ch === delimiter) {
        row.push(field); field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
    if (field.length || row.length || !rows.length) {
      row.push(field); rows.push(row);
    }
    while (rows.length && rows[rows.length - 1].every(value => value === '')) rows.pop();
    return rows;
  }
  function detectDelimiter(text) {
    const sample = text.slice(0, 65536);
    let best = ',', bestScore = -1;
    for (const delimiter of [',', '\t', ';', '|']) {
      const rows = parseDelimited(sample, delimiter).slice(0, 24).filter(row => row.length > 1);
      if (!rows.length) continue;
      const counts = rows.map(row => row.length);
      const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
      const variance = counts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / counts.length;
      const score = mean - Math.sqrt(variance) * 1.5;
      if (score > bestScore) { bestScore = score; best = delimiter; }
    }
    return best;
  }
  function delimiterLabel(value) {
    return value === '\t' ? 'tab' : value === ',' ? 'comma' : value === ';' ? 'semicolon' : 'pipe';
  }
  function make(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }
  window.EditorPreviewProviders = window.EditorPreviewProviders || [];
  window.EditorPreviewProviders.push({
    id: 'delimited-text',
    match(file) {
      const name = String(file.name || file.path || '').toLowerCase();
      return file.mime === 'text/csv' || file.mime === 'text/tab-separated-values' || /\.(csv|tsv)$/.test(name);
    },
    views: [{
      id: 'table-preview',
      label: 'Preview',
      default: true,
      priority: 110,
      create(ctx) {
        const root = make('section', 'editor-csv-preview');
        const toolbar = make('div', 'editor-csv-toolbar');
        const search = make('input', 'editor-csv-search');
        search.type = 'search';
        search.placeholder = 'Search rows…';
        search.setAttribute('aria-label', 'Search table rows');
        const delimiter = make('select', 'editor-csv-delimiter');
        delimiter.setAttribute('aria-label', 'Delimiter');
        for (const item of DELIMITERS) {
          const option = make('option', '', item.label);
          option.value = item.value;
          delimiter.appendChild(option);
        }
        const headerLabel = make('label', 'editor-csv-header-toggle');
        const headerToggle = make('input');
        headerToggle.type = 'checkbox';
        headerToggle.checked = true;
        headerLabel.append(headerToggle, document.createTextNode(' First row is header'));
        const summary = make('span', 'editor-csv-summary');
        toolbar.append(search, delimiter, headerLabel, summary);
        const tableWrap = make('div', 'editor-csv-table-wrap');
        const table = make('table', 'editor-csv-table');
        tableWrap.appendChild(table);
        const footer = make('div', 'editor-csv-footer');
        const pageInfo = make('span', 'editor-csv-page-info');
        const prev = make('button', 'editor-csv-page-button', 'Previous');
        const next = make('button', 'editor-csv-page-button', 'Next');
        prev.type = next.type = 'button';
        footer.append(pageInfo, prev, next);
        root.append(toolbar, tableWrap, footer);
        ctx.host.appendChild(root);

        const source = ctx.readText();
        const state = { delimiter: 'auto', header: true, query: '', sort: -1, direction: 1, page: 0 };
        const pageSize = 100;
        function getRows() {
          const separator = state.delimiter === 'auto' ? detectDelimiter(source) : state.delimiter;
          return { rows: parseDelimited(source, separator), separator };
        }
        function render() {
          const parsed = getRows();
          let rows = parsed.rows.slice();
          const headers = state.header && rows.length ? rows.shift() : null;
          const width = Math.max(headers ? headers.length : 0, ...rows.slice(0, 1000).map(row => row.length), 0);
          const names = Array.from({ length: width }, (_, i) => headers && headers[i] !== undefined && headers[i] !== '' ? headers[i] : 'Column ' + (i + 1));
          const query = state.query.trim().toLocaleLowerCase();
          if (query) rows = rows.filter(row => row.some(value => String(value).toLocaleLowerCase().includes(query)));
          if (state.sort >= 0 && state.sort < width) {
            const col = state.sort;
            rows.sort((a, b) => {
              const av = String(a[col] ?? ''), bv = String(b[col] ?? '');
              const result = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
              return result * state.direction;
            });
          }
          const total = rows.length;
          const pages = Math.max(1, Math.ceil(total / pageSize));
          state.page = Math.min(state.page, pages - 1);
          const visible = rows.slice(state.page * pageSize, (state.page + 1) * pageSize);
          summary.textContent = total.toLocaleString() + ' rows · ' + width + ' columns · ' + delimiterLabel(parsed.separator);
          table.replaceChildren();
          const thead = make('thead');
          const headRow = make('tr');
          for (let i = 0; i < width; i++) {
            const th = make('th');
            th.scope = 'col';
            const button = make('button', 'editor-csv-sort', names[i] + (state.sort === i ? (state.direction === 1 ? ' ▲' : ' ▼') : ''));
            button.type = 'button';
            button.title = 'Sort by ' + names[i];
            button.setAttribute('aria-sort', state.sort === i ? (state.direction === 1 ? 'ascending' : 'descending') : 'none');
            button.addEventListener('click', () => {
              if (state.sort === i) state.direction *= -1;
              else { state.sort = i; state.direction = 1; }
              state.page = 0; render();
            });
            th.appendChild(button); headRow.appendChild(th);
          }
          if (!width) {
            const th = make('th', '', 'No columns detected');
            headRow.appendChild(th);
          }
          thead.appendChild(headRow); table.appendChild(thead);
          const tbody = make('tbody');
          for (const values of visible) {
            const tr = make('tr');
            for (let i = 0; i < width; i++) tr.appendChild(make('td', '', values[i] ?? ''));
            tbody.appendChild(tr);
          }
          if (!visible.length) {
            const tr = make('tr');
            const td = make('td', 'editor-csv-empty', total ? 'No rows on this page' : (query ? 'No matching rows' : 'This file contains no data'));
            td.colSpan = Math.max(1, width);
            tr.appendChild(td); tbody.appendChild(tr);
          }
          table.appendChild(tbody);
          pageInfo.textContent = 'Page ' + (state.page + 1) + ' of ' + pages;
          prev.disabled = state.page <= 0;
          next.disabled = state.page >= pages - 1;
        }
        search.addEventListener('input', () => { state.query = search.value; state.page = 0; render(); });
        delimiter.addEventListener('change', () => { state.delimiter = delimiter.value; state.page = 0; render(); });
        headerToggle.addEventListener('change', () => { state.header = headerToggle.checked; state.page = 0; render(); });
        prev.addEventListener('click', () => { state.page = Math.max(0, state.page - 1); render(); });
        next.addEventListener('click', () => { state.page++; render(); });
        render();
      }
    }]
  });
})();