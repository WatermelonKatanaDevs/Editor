(function() {
  if (window.NpmDependencyCache) return;

  const DB_NAME = 'wk-node-dependency-cache';
  const DB_VERSION = 1;
  const CACHE_SCHEMA = 1;
  const ENGINE_VERSION = 'wk-browser-node-emulator-1';
  const MAX_TREE_BYTES = 512 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;
  const MAX_ENTRIES = 12;
  let dbPromise = null;

  function cleanRoot(root) {
    return String(root || '').replace(/^\/+|\/+$/g, '').replace(/\\/g, '/');
  }

  function nodeModulesPath(root) {
    return [cleanRoot(root), 'node_modules'].filter(Boolean).join('/');
  }

  function normalizeFilePath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
  }

  function openDatabase() {
    if (!window.indexedDB) return Promise.resolve(null);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise(resolve => {
      let request;
      try {
        request = window.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (_) {
        resolve(null);
        return;
      }

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('trees')) db.createObjectStore('trees', {keyPath:'fingerprint'});
        if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', {keyPath:'fingerprint'});
        if (!db.objectStoreNames.contains('workspaces')) db.createObjectStore('workspaces', {keyPath:'key'});
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    }).catch(() => null);

    return dbPromise;
  }

  function readRecord(db, storeName, key) {
    return new Promise(resolve => {
      try {
        const transaction = db.transaction(storeName, 'readonly');
        const request = transaction.objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
        transaction.onabort = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  }

  function writeRecord(db, storeName, record) {
    return new Promise(resolve => {
      try {
        const transaction = db.transaction(storeName, 'readwrite');
        transaction.objectStore(storeName).put(record);
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => resolve(false);
        transaction.onabort = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  }

  function removeNodeModules(fs, root) {
    const base = nodeModulesPath(root);
    const prefix = base + '/';
    try {
      for (const rawPath of fs.listFilesSync() || []) {
        const path = normalizeFilePath(rawPath);
        if (path === base || path.startsWith(prefix)) {
          try { fs.deleteFileSync('/' + path); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  function toBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return new Uint8Array(value || []);
  }

  async function fingerprint(fs, root, options = {}) {
    try {
      const base = cleanRoot(root);
      const read = relative => {
        const path = '/' + [base, relative].filter(Boolean).join('/');
        try {
          if (!fs?.existsSync?.(path)) return '';
          return String(fs.readFileSync(path, 'utf8') || '');
        } catch (_) {
          return '';
        }
      };

      const packageText = read('package.json');
      if (!packageText) return null;
      let manifest;
      try { manifest = JSON.parse(packageText); }
      catch (_) { return null; }

      const dependencyFields = {};
      for (const name of [
        'dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies',
        'overrides', 'bundledDependencies', 'bundleDependencies', 'engines'
      ]) {
        if (manifest[name] != null) dependencyFields[name] = manifest[name];
      }

      const input = JSON.stringify({
        schema: CACHE_SCHEMA,
        engine: ENGINE_VERSION,
        npm: String(window.NPM?.version || 'unknown'),
        nodeVersion: String(options.nodeVersion || 'browser-emulated-node'),
        platform: String(options.platform || 'browser-node-emulator'),
        dependencies: dependencyFields,
        packageLock: read('package-lock.json'),
        shrinkwrap: read('npm-shrinkwrap.json'),
        npmrc: read('.npmrc')
      });

      if (!window.crypto?.subtle?.digest) return null;
      const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
      const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      return 'sha256-' + hex;
    } catch (error) {
      console.warn('[Node dependency cache] Could not calculate dependency fingerprint:', error);
      return null;
    }
  }

  async function getInstalledFingerprint(workspaceKey, root) {
    const db = await openDatabase();
    if (!db) return null;
    const key = String(workspaceKey || 'workspace') + '::' + cleanRoot(root);
    const record = await readRecord(db, 'workspaces', key);
    return record?.fingerprint || null;
  }

  async function markInstalled(workspaceKey, root, value) {
    const db = await openDatabase();
    if (!db || !value) return false;
    const key = String(workspaceKey || 'workspace') + '::' + cleanRoot(root);
    return await writeRecord(db, 'workspaces', {key, fingerprint:String(value), updatedAt:Date.now()});
  }

  async function pruneDatabase(db) {
    return await new Promise(resolve => {
      try {
        const transaction = db.transaction(['entries', 'trees'], 'readwrite');
        const entries = transaction.objectStore('entries');
        const trees = transaction.objectStore('trees');
        const request = entries.getAll();

        request.onsuccess = () => {
          const records = (request.result || []).sort((a, b) =>
            Number(b.lastUsed || b.createdAt || 0) - Number(a.lastUsed || a.createdAt || 0)
          );
          let total = 0;
          let kept = 0;
          for (const record of records) {
            const size = Math.max(0, Number(record.sizeBytes) || 0);
            if (kept < MAX_ENTRIES && total + size <= MAX_TOTAL_BYTES) {
              total += size;
              kept++;
            } else {
              entries.delete(record.fingerprint);
              trees.delete(record.fingerprint);
            }
          }
        };

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => resolve(false);
        transaction.onabort = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  }

  async function store(fs, root, value) {
    const db = await openDatabase();
    if (!db || !value) return false;

    try {
      const prefix = nodeModulesPath(root) + '/';
      const files = [];
      let sizeBytes = 0;

      for (const rawPath of fs.listFilesSync() || []) {
        const path = normalizeFilePath(rawPath);
        if (!path.startsWith(prefix)) continue;
        const relative = path.slice(prefix.length);
        if (!relative || relative.split('/').some(part => !part || part === '.' || part === '..')) continue;

        const source = fs.readFileSync('/' + path, 'binary');
        if (source == null) continue;
        const data = toBytes(source).slice();
        sizeBytes += data.byteLength;
        if (sizeBytes > MAX_TREE_BYTES) {
          console.info('[Node dependency cache] Dependency tree is too large to cache; keeping the installed copy in this workspace.');
          return false;
        }
        files.push({path:relative, data});
      }

      if (!files.length) return false;

      const now = Date.now();
      const transaction = db.transaction(['trees', 'entries'], 'readwrite');
      transaction.objectStore('trees').put({fingerprint:String(value), schema:CACHE_SCHEMA, files});
      transaction.objectStore('entries').put({
        fingerprint:String(value), schema:CACHE_SCHEMA, fileCount:files.length,
        sizeBytes, createdAt:now, lastUsed:now
      });

      const saved = await new Promise(resolve => {
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => resolve(false);
        transaction.onabort = () => resolve(false);
      });
      if (saved) await pruneDatabase(db);
      return saved;
    } catch (error) {
      console.warn('[Node dependency cache] Could not save dependency tree:', error);
      return false;
    }
  }

  async function restore(fs, root, value) {
    const db = await openDatabase();
    if (!db || !value) return false;

    try {
      const entry = await readRecord(db, 'entries', String(value));
      if (!entry || entry.schema !== CACHE_SCHEMA || !Number(entry.fileCount)) return false;

      const tree = await readRecord(db, 'trees', String(value));
      if (!tree || tree.schema !== CACHE_SCHEMA || !Array.isArray(tree.files) ||
          tree.files.length !== Number(entry.fileCount) || !tree.files.length) return false;

      const base = nodeModulesPath(root);
      const prepared = [];
      for (const file of tree.files) {
        const relative = String(file?.path || '').replace(/\\/g, '/');
        if (!relative || relative.startsWith('/') ||
            relative.split('/').some(part => !part || part === '.' || part === '..')) return false;
        prepared.push({path:'/' + base + '/' + relative, data:toBytes(file.data).slice()});
      }

      removeNodeModules(fs, root);
      try {
        for (const file of prepared) fs.writeFileSync(file.path, file.data);
      } catch (error) {
        removeNodeModules(fs, root);
        throw error;
      }

      entry.lastUsed = Date.now();
      await writeRecord(db, 'entries', entry);
      return true;
    } catch (error) {
      console.warn('[Node dependency cache] Could not restore dependency tree:', error);
      return false;
    }
  }

  window.NpmDependencyCache = Object.freeze({
    isAvailable: async () => !!(await openDatabase()),
    fingerprint,
    getInstalledFingerprint,
    markInstalled,
    store,
    restore
  });
})();