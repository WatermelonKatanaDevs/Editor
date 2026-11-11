
(function() {
  async function generateCompressedZip(cache, directories, compressionLevel) {
    const level = Math.max(1, Math.min(9, Number(compressionLevel) || 9));
    const zip = new JSZip();
    for (const directory of directories || []) {
      if (directory) zip.folder(directory);
    }
    for (const [path, data] of cache || []) {
      zip.file(path, data, {binary:true});
    }
    return await zip.generateAsync({
      type:'blob',
      compression:'DEFLATE',
      compressionOptions:{level}
    });
  }

  class FileSystem {
    constructor(provider, sourceMode, syncEnabled) {
      this.provider = provider;
      this.sourceMode = sourceMode;
      this.sync = syncEnabled;
      this.modifiedAt = provider.modifiedAt || new Map();
      this.provider.modifiedAt = this.modifiedAt;
      this.statClock = Number(provider.statClock) || Date.now();
      this.revision = 0;
      this.directories = new Set(['']);
      this.children = new Map([['', new Set()]]);
    }

    get isPersistentDirectory() {
      return this.sourceMode === 1 && !!this.provider?.dirHandle;
    }

    get supportsLocalGit() {
      return typeof this.provider?.write === 'function' && typeof this.provider?.delete === 'function';
    }

    _normalize(path) {
      const parts = String(path ?? '').replace(/\\/g,'/').split('/').filter(Boolean);
      const out = [];
      for (const part of parts) {
        if (part === '.') continue;
        if (part === '..') { if (out.length) out.pop(); continue; }
        out.push(part);
      }
      return out.join('/');
    }

    async _rebuildDirectoryIndex() {
      this.directories = new Set(['']);
      this.children = new Map([['', new Set()]]);
      let processed = 0;
      for (const path of this.provider.directories || []) {
        this._addParentDirectories(path);
        if (++processed % 1024 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
      for (const rawPath of this.provider.cache?.keys?.() || []) {
        const path = this._normalize(rawPath);
        if (!path) continue;
        const separator = path.lastIndexOf('/');
        const parent = separator >= 0 ? path.slice(0, separator) : '';
        if (parent && !this.directories.has(parent)) this._addParentDirectories(parent);
        const name = separator >= 0 ? path.slice(separator + 1) : path;
        if (name) this._addDirectoryChild(parent, name);
        if (++processed % 1024 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
      this.provider.directories = this.directories;
    }

    _addDirectoryChild(parent, name) {
      let children = this.children.get(parent);
      if (!children) this.children.set(parent, children = new Set());
      children.add(name);
    }

    _addParentDirectories(path) {
      const parts = this._normalize(path).split('/').filter(Boolean);
      let curr = '';
      for (const part of parts) {
        const parent = curr;
        curr = curr ? curr + '/' + part : part;
        this.directories.add(curr);
        this._addDirectoryChild(parent, part);
        if (!this.children.has(curr)) this.children.set(curr, new Set());
      }
    }

    _touchModifiedTime(path) {
      path = this._normalize(path);
      this.statClock = Math.max(Date.now(), this.statClock + 1);
      this.provider.statClock = this.statClock;
      this.modifiedAt.set(path, this.statClock);
      return this.statClock;
    }

    getModifiedTime(path) {
      path = this._normalize(path);
      if (!this.modifiedAt.has(path)) this._touchModifiedTime(path);
      return this.modifiedAt.get(path);
    }

    findFileSync(predicate) {
      if (typeof predicate !== 'function') return null;
      for (const path of this.provider.cache.keys()) if (predicate(path)) return path;
      return null;
    }

    readdirSync(path) {
      const normalized = this._normalize(path);
      if (!this.directories.has(normalized)) return null;
      return Array.from(this.children.get(normalized) || []);
    }

    static async empty(options = { sync: false }) {
      if (typeof JSZip === 'undefined') throw new Error('JSZip library required.');
      const provider = new ZipProvider(new JSZip(), false);
      await provider.init();
      const filesystem = new this(provider, 4, options.sync !== false);
      await filesystem._rebuildDirectoryIndex();
      return filesystem;
    }

    static async create(source, options = { sync: true }) {
      let provider;
      let mode = 0;
      const sync = options.sync !== false;

      if (typeof FileSystemDirectoryHandle !== 'undefined' && source instanceof FileSystemDirectoryHandle) {
        provider = new DirectoryHandleProvider(source, sync);
        mode = 1;
      } else if (typeof FileSystemFileHandle !== 'undefined' && source instanceof FileSystemFileHandle) {
        if (typeof JSZip === 'undefined') throw new Error("JSZip library required.");
        provider = new ZipFileHandleProvider(source, sync);
        mode = 2;
      } else if (source instanceof FileList || Array.isArray(source)) {
        if (typeof JSZip === 'undefined') throw new Error("JSZip library required.");
        const zip = new JSZip();
        const files = source instanceof FileList ? Array.from(source) : source;
        const promises = files.map(async (file) => {
          const path = file.customRelativePath || file.webkitRelativePath || file.name;
          const buffer = await file.arrayBuffer();
          zip.file(path, new Uint8Array(buffer));
        });
        await Promise.all(promises);
        provider = new ZipProvider(zip, false);
        mode = 3;
      } else if (source instanceof File && (source.type === 'application/zip' || source.name.endsWith('.zip'))) {
        if (typeof JSZip === 'undefined') throw new Error("JSZip library required.");
        const zip = await JSZip.loadAsync(source);
        provider = new ZipProvider(zip, false);
        mode = 4;
      } else if (source.files) {
        provider = new ZipProvider(source, false);
        mode = 4;
      } else {
        throw new Error("Unsupported file system source.");
      }

      await provider.init({ignoreNodeModules:options.ignoreNodeModules === true});
      const filesystem = new this(provider, mode, sync);
      await filesystem._rebuildDirectoryIndex();
      return filesystem;
    }

    readFileSync(path, encoding = 'binary') {
      path = this._normalize(path);
      const data = this.provider.cache.get(path);
      if (!data) return null;
      return encoding === 'utf8' ? new TextDecoder().decode(data) : data;
    }

    writeFileSync(path, content) {
      path = this._normalize(path);
      const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      this._addParentDirectories(parent);
      this._addDirectoryChild(parent, parent ? path.slice(parent.length + 1) : path);
      let binary = content;
      if (typeof content === 'string') binary = new TextEncoder().encode(content);
      this.provider.write(path, binary, content);
      this._touchModifiedTime(path);
      this.revision++;
    }

    mkdirSync(path) {
      path = this._normalize(path);
      if (!path) return;
      this._addParentDirectories(path);
      this.provider.mkdir?.(path);
      this.revision++;
    }

    deleteFileSync(path) {
      path = this._normalize(path);
      const deleted = this.provider.delete(path);
      if (deleted) {
        this.modifiedAt.delete(path);
        this.revision++;
        const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
        const name = parent ? path.slice(parent.length + 1) : path;
        this.children.get(parent)?.delete(name);
      }
      return deleted;
    }

    moveSync(source, destination) {
      source = this._normalize(source);
      destination = this._normalize(destination);
      if (!source || !destination || source === destination) return false;
      if (destination.startsWith(source + '/')) throw new Error('Cannot move a path into itself.');
      if (this.existsSync(destination) || this.isDirectorySync(destination)) throw new Error(`Destination already exists: ${destination}`);
      const sourceIsDir = this.isDirectorySync(source);
      if (sourceIsDir) {
        const files = this.listFilesSync().filter(path => path === source || path.startsWith(source + '/'));
        const dirs = this.listDirectoriesSync().filter(path => path === source || path.startsWith(source + '/'));
        this._addParentDirectories(destination);
        for (const path of dirs) this._addParentDirectories(destination + path.slice(source.length));
        for (const path of files) {
          const target = destination + path.slice(source.length);
          const data = this.readFileSync(path, 'binary');
          this.writeFileSync(target, data);
        }
        for (const path of files) this.deleteFileSync(path);
        for (const path of dirs.sort((a,b) => b.length - a.length)) this.directories.delete(path);
        this._rebuildDirectoryIndex();
        this.provider.directories = this.directories;
        this.provider.removeDirectory?.(source);
      } else {
        const parent = destination.includes('/') ? destination.slice(0, destination.lastIndexOf('/')) : '';
        this._addParentDirectories(parent);
        const data = this.readFileSync(source, 'binary');
        this.writeFileSync(destination, data);
        this.deleteFileSync(source);
      }
      return true;
    }

    deleteDirectorySync(path) {
      path = this._normalize(path);
      if (!path) return false;
      let changed = false;
      const prefix = path + '/';
      for (const file of [...this.provider.cache.keys()]) {
        if (file === path || file.startsWith(prefix)) {
          this.provider.delete(file);
          this.modifiedAt.delete(file);
          changed = true;
        }
      }
      for (const dir of [...this.directories]) {
        if (dir === path || dir.startsWith(prefix)) {
          this.directories.delete(dir);
          this.children.delete(dir);
          this.modifiedAt.delete(dir);
          changed = true;
        }
      }
      if (changed) this.revision++;
      const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      const name = parent ? path.slice(parent.length + 1) : path;
      this.children.get(parent)?.delete(name);
      this.provider.directories = this.directories;
      this.provider.removeDirectory?.(path);
      return changed;
    }

    existsSync(path) {
      return this.provider.cache.has(this._normalize(path));
    }

    isDirectorySync(path) {
      return this.directories.has(this._normalize(path));
    }

    listFilesSync() {
      return Array.from(this.provider.cache.keys());
    }

    forEachEntrySync(callback, options = {}) {
      const stack = [''];
      const skipDirectory = typeof options.skipDirectory === 'function' ? options.skipDirectory : null;
      while (stack.length) {
        const parent = stack.pop();
        for (const name of this.children.get(parent) || []) {
          const path = parent ? parent + '/' + name : name;
          const isDirectory = this.directories.has(path);
          callback(path, isDirectory);
          if (isDirectory && !skipDirectory?.(path)) stack.push(path);
        }
      }
    }

    _shouldSkipDirectory(path, options = {}) {
      return (options.ignoreNodeModules && path.split('/').includes('node_modules')) ||
        (options.ignoreGitMetadata && (path === '.git' || path.startsWith('.git/')));
    }

    forEachFileSync(callback, options = {}) {
      if (!options.ignoreNodeModules && !options.ignoreGitMetadata) {
        for (const path of this.provider.cache.keys()) callback(path);
        return;
      }
      this.forEachEntrySync((path, isDirectory) => {
        if (!isDirectory) callback(path);
      }, {skipDirectory:path => this._shouldSkipDirectory(path, options)});
    }

    async forEachEntry(callback, options = {}) {
      const stack = [''];
      let visited = 0;
      while (stack.length) {
        const parent = stack.pop();
        for (const name of this.children.get(parent) || []) {
          const path = parent ? parent + '/' + name : name;
          const isDirectory = this.directories.has(path);
          callback(path, isDirectory);
          if (isDirectory && !this._shouldSkipDirectory(path, options)) stack.push(path);
          if (++visited % 512 === 0) await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }

    async forEachFile(callback, options = {}) {
      await this.forEachEntry((path, isDirectory) => {
        if (!isDirectory) callback(path);
      }, options);
    }

    listDirectoriesSync() {
      return Array.from(this.directories).filter(Boolean);
    }

    canSave() {
      return !!this.provider?.canSave;
    }

    async permissionState() {
      if (!this.canSave()) return 'denied';
      return await this.provider.permissionState?.() || 'granted';
    }

    async requestPermission() {
      if (!this.canSave()) throw new Error('This workspace does not have a writable File System API source.');
      if (typeof this.provider.requestPermission === 'function') return await this.provider.requestPermission();
      return await this.permissionState();
    }

    async flush() {
      if (typeof this.provider.flush === 'function') await this.provider.flush();
      return true;
    }

    async save() {
      if (!this.canSave()) throw new Error('This workspace does not have a writable File System API source.');
      return await this.provider.save();
    }

    async saveAs(suggestedName = 'workspace.zip') {
      if (typeof showSaveFilePicker !== 'function') throw new Error('The File System Access API is unavailable.');
      if (typeof JSZip === 'undefined') throw new Error('JSZip library required.');
      const handle = await showSaveFilePicker({
        suggestedName,
        types: [{ description: 'ZIP project', accept: { 'application/zip': ['.zip'] } }]
      });
      if (!handle) return false;
      const blob = await this.exportZip();
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      const provider = new ZipFileHandleProvider(handle, this.sync);
      await provider.init();
      this.provider = provider;
      this.sourceMode = 2;
      this._rebuildDirectoryIndex();
      this.provider.directories = this.directories;
      return true;
    }

    async exportZip(options = {}) {
      return await this.provider.exportZip(options);
    }
  }

  async function loadZipContents(zip, cache, directories, options = {}) {
    const files = [];
    const ignoreNodeModules = !!options.ignoreNodeModules;
    const stripPrefix = String(options.stripPrefix || '').replace(/^\/+|\/+$/g, '');
    let scanned = 0;
    const entries = zip.files || {};
    for (const relativePath in entries) {
      if (!Object.prototype.hasOwnProperty.call(entries, relativePath)) continue;
      const file = entries[relativePath];
      const clean = relativePath.replace(/\/$/,'');
      if (ignoreNodeModules && clean.split('/').includes('node_modules')) continue;
      if (stripPrefix && (clean === stripPrefix || !clean.startsWith(stripPrefix + '/'))) continue;
      const path = stripPrefix ? clean.slice(stripPrefix.length + 1) : clean;
      if (!path) continue;
      if (file.dir) directories.add(path);
      else files.push({path,file});
      if (++scanned % 1024 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    let cursor = 0;
    let loaded = 0;
    const workers = Array.from({length:Math.min(8, files.length)}, async () => {
      while (cursor < files.length) {
        const item = files[cursor++];
        cache.set(item.path, await item.file.async('uint8array'));
        loaded++;
        if (loaded % 8 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
    });
    await Promise.all(workers);
  }

  class DirectoryHandleProvider {
    constructor(dirHandle, sync) {
      this.dirHandle = dirHandle;
      this.canSave = true;
      this.sync = sync;
      this.cache = new Map();
      this.directories = new Set(['']);
      this.writeQueue = Promise.resolve();
      this.writeErrors = [];
    }
    async init() {
      await this._readDir(this.dirHandle, '');
    }
    async _readDir(handle, currentPath) {
      for await (const entry of handle.values()) {
        const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          const buffer = await file.arrayBuffer();
          this.cache.set(entryPath, new Uint8Array(buffer));
        } else if (entry.kind === 'directory') {
          this.directories.add(entryPath);
          await this._readDir(entry, entryPath);
        }
      }
    }
    _queuePersist(operation) {
      const task = this.writeQueue.catch(() => {}).then(operation);
      this.writeQueue = task.catch(error => { this.writeErrors.push(error); });
      return this.writeQueue;
    }
    write(path, binary, original) {
      this.cache.set(path, binary);
      if (this.sync) this._queuePersist(() => this._persistFile(path, binary));
    }
    delete(path) {
      const deleted = this.cache.delete(path);
      if (deleted && this.sync) this._queuePersist(() => this._persistDelete(path));
      return deleted;
    }
    mkdir(path) { if (this.sync) this._queuePersist(() => this._persistDirectory(path)); }
    async _persistDirectory(path) {
      const parts = String(path).split('/').filter(Boolean);
      let curr = this.dirHandle;
      for (const part of parts) curr = await curr.getDirectoryHandle(part, { create: true });
    }
    removeDirectory(path) { if (this.sync) this._queuePersist(() => this._persistRemoveDirectory(path)); }
    async _persistRemoveDirectory(path) {
      const parts = String(path).split('/').filter(Boolean);
      const name = parts.pop();
      let curr = this.dirHandle;
      try {
        for (const p of parts) curr = await curr.getDirectoryHandle(p);
      } catch (error) {
        if (error?.name === 'NotFoundError') return;
        throw error;
      }
      try {
        await curr.removeEntry(name, { recursive: true });
      } catch (error) {
        if (error?.name !== 'NotFoundError') throw error;
      }
    }
    async _persistFile(path, binary) {
      const parts = path.split('/');
      const fileName = parts.pop();
      let curr = this.dirHandle;
      for (const p of parts) curr = await curr.getDirectoryHandle(p, { create: true });
      const fh = await curr.getFileHandle(fileName, { create: true });
      const writable = await fh.createWritable();
      try {
        await writable.write(binary);
        await writable.close();
      } catch (error) {
        try { await writable.abort?.(); } catch (_) {}
        throw error;
      }
    }
    async _persistDelete(path) {
      const parts = path.split('/');
      const fileName = parts.pop();
      let curr = this.dirHandle;
      try {
        for (const p of parts) curr = await curr.getDirectoryHandle(p);
        await curr.removeEntry(fileName);
      } catch (error) {
        if (error?.name !== 'NotFoundError') throw error;
      }
    }
    async permissionState() {
      if (typeof this.dirHandle?.queryPermission !== 'function') return 'granted';
      try { return await this.dirHandle.queryPermission({ mode: 'readwrite' }); } catch (_) { return 'denied'; }
    }
    async requestPermission() {
      if (typeof this.dirHandle?.requestPermission !== 'function') return await this.permissionState();
      try { return await this.dirHandle.requestPermission({ mode: 'readwrite' }); } catch (_) { return 'denied'; }
    }
    async flush() {
      let queue;
      do {
        queue = this.writeQueue;
        await queue;
      } while (queue !== this.writeQueue);
      if (this.writeErrors.length) {
        const errors = this.writeErrors.splice(0);
        const error = new Error('Unable to persist ' + errors.length + ' filesystem operation' + (errors.length === 1 ? '' : 's') + '. ' + (errors[0]?.message || errors[0]));
        error.errors = errors;
        throw error;
      }
      return true;
    }
    async save() {
      for (const [path, binary] of this.cache) this._queuePersist(() => this._persistFile(path, binary));
      await this.flush();
      return null;
    }
    async exportZip(options = {}) {
      if (options.compressionLevel != null) {
        return await generateCompressedZip(this.cache, this.directories, options.compressionLevel);
      }
      const zip = new JSZip();
      for (const [path, data] of this.cache) zip.file(path, data);
      return await zip.generateAsync({ type: 'blob' });
    }
  }

  class ZipFileHandleProvider {
    constructor(fileHandle, sync) {
      this.fileHandle = fileHandle;
      this.canSave = true;
      this.sync = sync;
      this.cache = new Map();
      this.directories = new Set(['']);
      this.zip = null;
      this.writing = false;
    }
    async init() {
      const file = await this.fileHandle.getFile();
      this.zip = await JSZip.loadAsync(file);
      await loadZipContents(this.zip, this.cache, this.directories);
    }
    write(path, binary, original) {
      this.cache.set(path, binary);
      this.zip.file(path, original);
      const parts = path.split('/').filter(Boolean);
      let curr = '';
      for (let i = 0; i < parts.length - 1; i++) { curr = curr ? curr + '/' + parts[i] : parts[i]; this.directories.add(curr); this.zip.folder(curr); }
      if (this.sync) {
        this._autoSave();
      }
    }
    delete(path) {
      const deleted = this.cache.delete(path);
      if (deleted) {
        this.zip.remove(path);
        if (this.sync) this._autoSave();
      }
      return deleted;
    }
    async _autoSave() {
      if (this.writing) return;
      this.writing = true;
      try { await this.save(); } finally { this.writing = false; }
    }
    async permissionState() {
      if (typeof this.fileHandle?.queryPermission !== 'function') return 'granted';
      try { return await this.fileHandle.queryPermission({ mode: 'readwrite' }); } catch (_) { return 'denied'; }
    }
    async save() {
      for (const dir of this.directories) if (dir) this.zip.folder(dir);
      this.cache.forEach((data, path) => this.zip.file(path, data));
      const blob = await this.zip.generateAsync({ type: 'blob' });
      const writable = await this.fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return null;
    }
    async exportZip(options = {}) {
      if (options.compressionLevel != null) {
        return await generateCompressedZip(this.cache, this.directories, options.compressionLevel);
      }
      for (const dir of this.directories) if (dir) this.zip.folder(dir);
      this.cache.forEach((data, path) => this.zip.file(path, data));
      return await this.zip.generateAsync({ type: 'blob' });
    }
  }

  class ZipProvider {
    constructor(zipInstance, sync) {
      this.zip = zipInstance;
      this.rootPrefix = String(zipInstance.__wkRootPrefix || '').replace(/^\/+|\/+$/g, '');
      this.canSave = false;
      this.sync = sync;
      this.cache = new Map();
      this.directories = new Set(['']);
    }
    physicalPath(path) {
      return this.rootPrefix ? this.rootPrefix + '/' + String(path || '').replace(/^\/+/, '') : path;
    }
    async init(options = {}) {
      await loadZipContents(this.zip, this.cache, this.directories, {...options, stripPrefix:this.rootPrefix});
    }
    write(path, binary, original) {
      this.cache.set(path, binary);
      this.zip.file(this.physicalPath(path), original);
      const parts = path.split('/').filter(Boolean);
      let curr = '';
      for (let i = 0; i < parts.length - 1; i++) { curr = curr ? curr + '/' + parts[i] : parts[i]; this.directories.add(curr); this.zip.folder(this.physicalPath(curr)); }
    }
    mkdir(path) { this.directories.add(path); this.zip.folder(this.physicalPath(path)); }
    removeDirectory(path) {
      for (const dir of [...this.directories]) if (dir === path || dir.startsWith(path + '/')) this.directories.delete(dir);
      this.zip.remove(this.physicalPath(path));
    }
    delete(path) {
      const deleted = this.cache.delete(path);
      if (deleted) this.zip.remove(this.physicalPath(path));
      return deleted;
    }
    async save() {
      return await this.exportZip();
    }
    async exportZip(options = {}) {
      if (options.compressionLevel != null) {
        return await generateCompressedZip(this.cache, this.directories, options.compressionLevel);
      }
      const zip = this.rootPrefix ? new JSZip() : this.zip;
      for (const dir of this.directories) if (dir) zip.folder(dir);
      this.cache.forEach((data, path) => zip.file(path, data));
      return await zip.generateAsync({ type: 'blob' });
    }
  }

  window.FileSystem = FileSystem;
})();