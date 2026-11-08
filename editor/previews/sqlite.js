(function () {
  const SQLJS_VERSION = '1.15.2';
  const SQLJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/' + SQLJS_VERSION + '/';
  let libraryPromise = null;

  function loadSqlJs() {
    if (window.initSqlJs) return Promise.resolve(window.initSqlJs);
    if (libraryPromise) return libraryPromise;
    libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SQLJS_BASE + 'sql-wasm.js';
      script.async = true;
      script.onload = () => window.initSqlJs ? resolve(window.initSqlJs) : reject(new Error('SQLite engine loaded without its initializer.'));
      script.onerror = () => {
        libraryPromise = null;
        reject(new Error('Could not load the SQLite engine from cdnjs. Check your connection and try again.'));
      };
      document.head.appendChild(script);
    });
    return libraryPromise;
  }

  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content != null) node.textContent = String(content);
    return node;
  }

  function button(label, className) {
    const node = element('button', className, label);
    node.type = 'button';
    return node;
  }

  function bytesFrom(ctx) {
    const data = ctx.readBinary();
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    if (typeof data === 'string') {
      const bytes = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i) & 255;
      return bytes;
    }
    throw new Error('The database file could not be read as binary data.');
  }

  function quoteIdentifier(value) {
    return '"' + String(value).replace(/"/g, '""') + '"';
  }

  function formatValue(value) {
    if (value == null) return 'NULL';
    if (value instanceof Uint8Array) return '[BLOB · ' + value.byteLength.toLocaleString() + ' bytes]';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function tokenizeSql(sql) {
    const words = [];
    let i = 0;
    while (i < sql.length) {
      const c = sql[i], next = sql[i + 1];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '-' && next === '-') {
        i += 2;
        while (i < sql.length && sql[i] !== '\n') i++;
        continue;
      }
      if (c === '/' && next === '*') {
        i += 2;
        while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
        i = Math.min(sql.length, i + 2);
        continue;
      }
      if (c === "'" || c === '"' || c === '`' || c === '[') {
        const end = c === '[' ? ']' : c;
        i++;
        while (i < sql.length) {
          if (sql[i] === end) {
            if (sql[i + 1] === end && end !== ']') { i += 2; continue; }
            i++;
            break;
          }
          if (sql[i] === '\\' && end === "'") i++;
          i++;
        }
        continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let word = c.toUpperCase();
        i++;
        while (i < sql.length && /[A-Za-z0-9_$]/.test(sql[i])) word += sql[i++].toUpperCase();
        words.push(word);
        continue;
      }
      i++;
    }
    return words;
  }

  function validateReadOnly(sql) {
    const words = tokenizeSql(sql);
    if (!words.length) throw new Error('Enter a SQL query first.');
    if (!['SELECT', 'WITH', 'EXPLAIN', 'PRAGMA'].includes(words[0])) {
      throw new Error('Only read-only SELECT, CTE, EXPLAIN, and inspection PRAGMA statements are allowed.');
    }
    const forbidden = new Set([
      'INSERT', 'UPDATE', 'DELETE', 'REPLACE', 'CREATE', 'DROP', 'ALTER',
      'ATTACH', 'DETACH', 'VACUUM', 'REINDEX', 'ANALYZE', 'BEGIN', 'COMMIT',
      'ROLLBACK', 'SAVEPOINT', 'RELEASE'
    ]);
    const blocked = words.find(word => forbidden.has(word));
    if (blocked) throw new Error('Read-only mode: ' + blocked + ' statements are not allowed.');
    if (words[0] === 'PRAGMA') {
      const allowed = new Set([
        'TABLE_INFO', 'TABLE_XINFO', 'INDEX_LIST', 'INDEX_INFO', 'INDEX_XINFO',
        'FOREIGN_KEY_LIST', 'DATABASE_LIST', 'COMPILE_OPTIONS', 'PAGE_COUNT',
        'PAGE_SIZE', 'FREELIST_COUNT', 'INTEGRITY_CHECK', 'QUICK_CHECK',
        'USER_VERSION', 'SCHEMA_VERSION', 'APPLICATION_ID'
      ]);
      if (!words[1] || !allowed.has(words[1])) {
        throw new Error('Only schema and diagnostic PRAGMA queries are allowed.');
      }
      if (/=/.test(sql)) throw new Error('PRAGMA assignments are disabled in read-only mode.');
    }
  }

  function queryRows(db, sql) {
    validateReadOnly(sql);
    const results = db.exec(sql);
    return results.map(result => ({
      columns: result.columns || [],
      values: result.values || []
    }));
  }

  function renderResults(host, results, limit = 500) {
    host.replaceChildren();
    if (!results.length) {
      host.appendChild(element('div', 'editor-sql-empty', 'Query completed. No rows were returned.'));
      return;
    }
    let shown = 0, total = results.reduce((sum, result) => sum + result.values.length, 0);
    for (const result of results) {
      const wrap = element('div', 'editor-sql-result');
      const meta = element('div', 'editor-sql-result-meta', result.values.length.toLocaleString() + ' row' + (result.values.length === 1 ? '' : 's') + ' · ' + result.columns.length + ' columns');
      const scroll = element('div', 'editor-sql-table-wrap');
      const table = element('table', 'editor-sql-table');
      const thead = element('thead');
      const headerRow = element('tr');
      result.columns.forEach(name => headerRow.appendChild(element('th', '', name)));
      thead.appendChild(headerRow);
      table.appendChild(thead);
      const tbody = element('tbody');
      for (const row of result.values) {
        if (shown >= limit) break;
        const tr = element('tr');
        row.forEach(value => {
          const td = element('td', '', formatValue(value));
          if (value == null) td.classList.add('is-null');
          if (value instanceof Uint8Array) td.classList.add('is-blob');
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
        shown++;
      }
      table.appendChild(tbody);
      scroll.appendChild(table);
      wrap.append(meta, scroll);
      host.appendChild(wrap);
    }
    if (total > limit) host.appendChild(element('div', 'editor-sql-note', 'Showing the first ' + limit.toLocaleString() + ' of ' + total.toLocaleString() + ' returned rows.'));
  }

  async function makeDatabase(ctx) {
    const root = element('section', 'editor-sql-browser');
    const header = element('header', 'editor-sql-header');
    const titleBlock = element('div', 'editor-sql-header-title');
    titleBlock.append(element('div', 'editor-sql-eyebrow', 'SQLITE DATABASE'), element('h2', '', ctx.file.name || 'Database'));
    const status = element('div', 'editor-sql-status', 'Loading SQLite engine…');
    header.append(titleBlock, status);

    const body = element('div', 'editor-sql-layout');
    const sidebar = element('aside', 'editor-sql-sidebar');
    const sideHeading = element('div', 'editor-sql-sidebar-heading', 'DATABASE OBJECTS');
    const objects = element('div', 'editor-sql-objects');
    sidebar.append(sideHeading, objects);

    const main = element('main', 'editor-sql-main');
    const tabs = element('div', 'editor-sql-tabs');
    const dataTab = button('Browse data', 'editor-sql-tab is-active');
    const queryTab = button('SQL query', 'editor-sql-tab');
    tabs.append(dataTab, queryTab);
    const dataView = element('section', 'editor-sql-data-view');
    const dataHeading = element('div', 'editor-sql-view-heading');
    const dataTitle = element('h3', '', 'Tables');
    const dataDescription = element('p', '', 'Select a table to inspect its columns and rows.');
    dataHeading.append(dataTitle, dataDescription);
    const schema = element('div', 'editor-sql-schema');
    const dataResults = element('div', 'editor-sql-results');
    dataView.append(dataHeading, schema, dataResults);

    const queryView = element('section', 'editor-sql-query-view');
    const queryInfo = element('div', 'editor-sql-query-info', 'Read-only query console · SELECT, CTEs, EXPLAIN, and inspection PRAGMAs');
    const editor = element('textarea', 'editor-sql-query-input');
    editor.spellcheck = false;
    editor.setAttribute('aria-label', 'SQL query');
    editor.placeholder = 'SELECT name, type FROM sqlite_master ORDER BY type, name;';
    const queryActions = element('div', 'editor-sql-query-actions');
    const run = button('Run query', 'editor-sql-run');
    const clear = button('Clear', 'editor-sql-clear');
    const queryStatus = element('span', 'editor-sql-query-status', 'Ctrl + Enter to run');
    queryActions.append(run, clear, queryStatus);
    const queryResults = element('div', 'editor-sql-query-results');
    queryView.append(queryInfo, editor, queryActions, queryResults);
    main.append(tabs, dataView, queryView);
    body.append(sidebar, main);
    root.append(header, body);
    ctx.host.appendChild(root);

    let db = null, selectedName = null, currentPage = 0, rowCount = 0;
    const pageSize = 100;
    const cleanup = () => { try { db?.close(); } catch (_) {} db = null; };
    ctx.addCleanup(cleanup);

    function switchView(which) {
      const query = which === 'query';
      dataView.hidden = query;
      queryView.hidden = !query;
      dataTab.classList.toggle('is-active', !query);
      queryTab.classList.toggle('is-active', query);
      if (query) editor.focus();
    }
    dataTab.addEventListener('click', () => switchView('data'));
    queryTab.addEventListener('click', () => switchView('query'));
    clear.addEventListener('click', () => { editor.value = ''; editor.focus(); });

    function executeQuery() {
      try {
        const results = queryRows(db, editor.value);
        renderResults(queryResults, results);
        const count = results.reduce((sum, result) => sum + result.values.length, 0);
        queryStatus.textContent = results.length
          ? count.toLocaleString() + ' row' + (count === 1 ? '' : 's') + ' returned'
          : 'Query completed';
        queryStatus.classList.remove('is-error');
      } catch (error) {
        queryResults.replaceChildren(element('pre', 'editor-sql-error', error?.message || String(error)));
        queryStatus.textContent = 'Query failed';
        queryStatus.classList.add('is-error');
      }
    }
    run.addEventListener('click', executeQuery);
    editor.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        executeQuery();
      }
    });

    function renderSchema(name) {
      const info = db.exec('PRAGMA table_info(' + quoteIdentifier(name) + ')');
      schema.replaceChildren();
      if (!info.length || !info[0].values.length) {
        schema.appendChild(element('div', 'editor-sql-note', 'No column information available.'));
        return;
      }
      const heading = element('div', 'editor-sql-schema-heading', 'COLUMNS');
      const table = element('table', 'editor-sql-schema-table');
      const thead = element('thead');
      const hr = element('tr');
      ['Name', 'Type', 'Nullable', 'Key'].forEach(label => hr.appendChild(element('th', '', label)));
      thead.appendChild(hr);
      table.appendChild(thead);
      const tbody = element('tbody');
      for (const row of info[0].values) {
        const tr = element('tr');
        [row[1], row[2] || '—', row[3] ? 'No' : 'Yes', row[5] ? 'Primary' : '—'].forEach(value => tr.appendChild(element('td', '', value)));
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      schema.append(heading, table);
    }

    function renderTable(name) {
      selectedName = name;
      currentPage = 0;
      const count = db.exec('SELECT COUNT(*) FROM ' + quoteIdentifier(name));
      rowCount = count[0]?.values[0]?.[0] || 0;
      dataTitle.textContent = name;
      dataDescription.textContent = rowCount.toLocaleString() + ' rows';
      renderSchema(name);
      renderPage();
      objects.querySelectorAll('.editor-sql-object').forEach(node => node.classList.toggle('is-selected', node.dataset.name === name));
    }

    function renderPage() {
      if (!selectedName) return;
      const offset = currentPage * pageSize;
      const results = queryRows(db, 'SELECT * FROM ' + quoteIdentifier(selectedName) + ' LIMIT ' + pageSize + ' OFFSET ' + offset);
      dataResults.replaceChildren();
      renderResults(dataResults, results, pageSize);
      const pager = element('div', 'editor-sql-pager');
      const previous = button('Previous', 'editor-sql-page-button');
      const next = button('Next', 'editor-sql-page-button');
      const pageCount = Math.max(1, Math.ceil(rowCount / pageSize));
      const label = element('span', 'editor-sql-page-label', 'Page ' + (currentPage + 1) + ' of ' + pageCount + ' · ' + rowCount.toLocaleString() + ' rows');
      previous.disabled = currentPage === 0;
      next.disabled = currentPage + 1 >= pageCount;
      previous.addEventListener('click', () => { currentPage--; renderPage(); });
      next.addEventListener('click', () => { currentPage++; renderPage(); });
      pager.append(previous, label, next);
      dataResults.appendChild(pager);
    }

    function populateObjects() {
      const results = db.exec("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name");
      objects.replaceChildren();
      let tables = 0, views = 0;
      const rows = results[0]?.values || [];
      for (const row of rows) {
        const name = String(row[0]), type = String(row[1]);
        if (type === 'table') tables++; else views++;
        const item = button(name, 'editor-sql-object');
        item.dataset.name = name;
        item.title = type.toUpperCase() + ': ' + name;
        item.appendChild(element('span', 'editor-sql-object-type', type === 'view' ? 'V' : 'T'));
        item.addEventListener('click', () => renderTable(name));
        objects.appendChild(item);
      }
      sideHeading.textContent = 'DATABASE OBJECTS · ' + tables + ' TABLES · ' + views + ' VIEWS';
      if (!rows.length) objects.appendChild(element('div', 'editor-sql-empty', 'No user tables or views found.'));
      if (rows.length) renderTable(String(rows[0][0]));
    }

    try {
      const initSqlJs = await loadSqlJs();
      if (!ctx.isCurrent()) return;
      status.textContent = 'Opening database…';
      const SQL = await initSqlJs({ locateFile: file => SQLJS_BASE + file });
      if (!ctx.isCurrent()) return;
      const bytes = bytesFrom(ctx);
      db = new SQL.Database(bytes);
      const version = db.exec('SELECT sqlite_version()');
      const versionText = version[0]?.values[0]?.[0] || 'unknown';
      const integrity = db.exec('PRAGMA quick_check');
      const integrityText = integrity[0]?.values[0]?.[0] || 'Unknown';
      const size = bytes.byteLength;
      status.textContent = 'SQLite ' + versionText + ' · ' + (size / 1024 / 1024).toFixed(size > 1048576 ? 1 : 2) + ' MB · ' + integrityText;
      populateObjects();
    } catch (error) {
      status.textContent = 'Could not open database';
      main.replaceChildren(element('pre', 'editor-sql-error', error?.message || String(error)));
    }
  }

  window.EditorPreviewProviders = window.EditorPreviewProviders || [];
  window.EditorPreviewProviders.push({
    id: 'sqlite',
    match(file) {
      const name = String(file.name || file.path || '');
      const mime = String(file.mime || '').toLowerCase();
      return /\.(db|sqlite|sqlite3)$/i.test(name) ||
        ['application/vnd.sqlite3', 'application/x-sqlite3', 'application/x-sqlite-db'].includes(mime);
    },
    views: [{
      id: 'sqlite-browser',
      label: 'Database',
      default: true,
      priority: 180,
      create: makeDatabase
    }]
  });
})();