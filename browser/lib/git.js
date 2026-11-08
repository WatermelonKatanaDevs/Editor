(function () {
  function normalizeGitPath(path) {
    const parts = String(path || '/').replace(/\\/g, '/').split('/');
    const out = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') {
        if (out.length) out.pop();
      } else out.push(part);
    }
    return '/' + out.join('/');
  }

  function gitFsError(code, path) {
    const messages = {
      EEXIST: 'file already exists',
      EISDIR: 'is a directory',
      ENOENT: 'no such file or directory',
      ENOTDIR: 'not a directory',
      ENOTEMPTY: 'directory not empty',
      EBUSY: 'device or resource busy'
    };
    const error = new Error(code + ': ' + (messages[code] || 'filesystem error') + ", '" + path + "'");
    error.code = code;
    error.path = path;
    return error;
  }

  class GitFileSystemAdapter {
    constructor(filesystem) {
      if (!filesystem || typeof filesystem.readFileSync !== 'function') throw new Error('Git requires an initialized editor filesystem.');
      this.filesystem = filesystem;
      this.modifiedAt = new Map();
      const promises = {
        readFile: (path, options) => this.readFile(path, options),
        writeFile: (path, data, options) => this.writeFile(path, data, options),
        unlink: path => this.unlink(path),
        readdir: (path, options) => this.readdir(path, options),
        mkdir: (path, options) => this.mkdir(path, options),
        rmdir: (path, options) => this.rmdir(path, options),
        stat: path => this.stat(path),
        lstat: path => this.stat(path)
      };
      this.fs = {promises};
    }

    normalize(path) {
      return normalizeGitPath(path);
    }

    relative(path) {
      return this.normalize(path).replace(/^\/+/, '');
    }

    readFile(path, options = {}) {
      const normalized = this.normalize(path);
      const relative = this.relative(normalized);
      if (!this.filesystem.existsSync(relative)) {
        if (this.filesystem.isDirectorySync(relative)) throw gitFsError('EISDIR', normalized);
        throw gitFsError('ENOENT', normalized);
      }
      const data = this.filesystem.readFileSync(relative, 'binary');
      const encoding = typeof options === 'string' ? options : options?.encoding;
      if (encoding === 'utf8' || encoding === 'utf-8') return new TextDecoder().decode(data);
      return new Uint8Array(data);
    }

    writeFile(path, data, options = {}) {
      const normalized = this.normalize(path);
      const relative = this.relative(normalized);
      if (!relative) throw gitFsError('EISDIR', normalized);
      if (this.filesystem.isDirectorySync(relative)) throw gitFsError('EISDIR', normalized);
      const parent = relative.includes('/') ? relative.slice(0, relative.lastIndexOf('/')) : '';
      if (parent) this.filesystem.mkdirSync(parent);
      const encoding = typeof options === 'string' ? options : options?.encoding;
      if (typeof data === 'string' && encoding !== 'buffer') this.filesystem.writeFileSync(relative, data);
      else {
        let bytes;
        if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
        else if (ArrayBuffer.isView(data)) bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        else if (Array.isArray(data)) bytes = new Uint8Array(data);
        else bytes = new TextEncoder().encode(String(data ?? ''));
        this.filesystem.writeFileSync(relative, new Uint8Array(bytes));
      }
      this.modifiedAt.set(normalized, Date.now());
    }

    unlink(path) {
      const normalized = this.normalize(path);
      const relative = this.relative(normalized);
      if (this.filesystem.isDirectorySync(relative)) throw gitFsError('EISDIR', normalized);
      if (!this.filesystem.deleteFileSync(relative)) throw gitFsError('ENOENT', normalized);
      this.modifiedAt.delete(normalized);
    }

    readdir(path) {
      const normalized = this.normalize(path);
      const relative = this.relative(normalized);
      if (!this.filesystem.isDirectorySync(relative)) {
        if (this.filesystem.existsSync(relative)) throw gitFsError('ENOTDIR', normalized);
        throw gitFsError('ENOENT', normalized);
      }
      const prefix = relative ? relative + '/' : '';
      const entries = new Set();
      for (const file of this.filesystem.listFilesSync()) {
        if (!file.startsWith(prefix)) continue;
        const remainder = file.slice(prefix.length);
        if (remainder) entries.add(remainder.split('/')[0]);
      }
      for (const directory of this.filesystem.listDirectoriesSync()) {
        if (!directory.startsWith(prefix)) continue;
        const remainder = directory.slice(prefix.length);
        if (remainder) entries.add(remainder.split('/')[0]);
      }
      return Array.from(entries).sort();
    }

    mkdir(path) {
      const normalized = this.normalize(path);
      const relative = this.relative(normalized);
      if (!relative) return;
      if (this.filesystem.existsSync(relative) || this.filesystem.isDirectorySync(relative)) throw gitFsError('EEXIST', normalized);
      const parent = relative.includes('/') ? relative.slice(0, relative.lastIndexOf('/')) : '';
      if (parent && !this.filesystem.isDirectorySync(parent)) throw gitFsError('ENOENT', parent);
      this.filesystem.mkdirSync(relative);
    }

    rmdir(path, options = {}) {
      const normalized = this.normalize(path);
      const relative = this.relative(normalized);
      if (!relative) throw gitFsError('EBUSY', normalized);
      if (!this.filesystem.isDirectorySync(relative)) {
        if (this.filesystem.existsSync(relative)) throw gitFsError('ENOTDIR', normalized);
        throw gitFsError('ENOENT', normalized);
      }
      const prefix = relative + '/';
      const hasFiles = this.filesystem.listFilesSync().some(file => file.startsWith(prefix));
      const hasDirectories = this.filesystem.listDirectoriesSync().some(dir => dir.startsWith(prefix));
      if ((hasFiles || hasDirectories) && !options?.recursive) throw gitFsError('ENOTEMPTY', normalized);
      this.filesystem.deleteDirectorySync(relative);
    }

    stat(path) {
      const normalized = this.normalize(path);
      const relative = this.relative(normalized);
      const directory = this.filesystem.isDirectorySync(relative);
      const file = !directory && this.filesystem.existsSync(relative);
      if (!directory && !file) throw gitFsError('ENOENT', normalized);
      const bytes = file ? this.filesystem.readFileSync(relative, 'binary') : null;
      const modified = new Date(this.modifiedAt.get(normalized) || 0);
      return {
        dev: 0,
        ino: 0,
        mode: directory ? 0o40755 : 0o100644,
        nlink: 1,
        uid: 0,
        gid: 0,
        rdev: 0,
        size: bytes?.byteLength || 0,
        blksize: 4096,
        blocks: Math.ceil((bytes?.byteLength || 0) / 512),
        atime: modified,
        mtime: modified,
        ctime: modified,
        birthtime: modified,
        isFile: () => file,
        isDirectory: () => directory,
        isSymbolicLink: () => false
      };
    }

    async flush() {
      await this.filesystem.flush?.();
      return true;
    }
  }

  class LocalGitService {
    constructor(filesystem, options = {}) {
      const library = window.git?.default || window.git;
      if (!library || typeof library.init !== 'function') throw new Error('The isomorphic-git library has not loaded.');
      this.git = library;
      this.filesystem = filesystem;
      this.adapter = new GitFileSystemAdapter(filesystem);
      this.fs = this.adapter.fs;
      this.rootfolder = String(options.rootfolder || '').replace(/^\/+|\/+$/g, '');
      this.queue = Promise.resolve();
    }

    resolvePath(path = '/') {
      const cwd = normalizeGitPath(path);
      return normalizeGitPath('/' + [this.rootfolder, cwd.replace(/^\/+/, '')].filter(Boolean).join('/'));
    }

    async _repository(cwd = '/') {
      const start = this.resolvePath(cwd);
      const root = await this.git.findRoot({fs:this.fs, filepath:start});
      return {root, dir:root, start};
    }

    async detect(cwd = '/') {
      try {
        const repository = await this._repository(cwd);
        let branch = null;
        let head = null;
        try { branch = await this.git.currentBranch({fs:this.fs, dir:repository.dir, fullname:false}); } catch (_) {}
        try { head = await this.git.resolveRef({fs:this.fs, dir:repository.dir, ref:'HEAD'}); } catch (_) {}
        return {isRepository:true, root:repository.root, branch, head, bare:false};
      } catch (error) {
        if (error?.code === 'NotFoundError' || error?.name === 'NotFoundError' || /could not find|not found|no git/i.test(error?.message || '')) return {isRepository:false, root:null, branch:null, head:null, bare:false};
        throw error;
      }
    }

    async init(cwd = '/', defaultBranch = 'main') {
      const dir = this.resolvePath(cwd);
      const existing = await this.detect(cwd);
      if (existing.isRepository) return {...existing, reinitialized:true};
      await this.git.init({fs:this.fs, dir, defaultBranch});
      await this.adapter.flush();
      return {...await this.detect(cwd), reinitialized:false};
    }

    async status(cwd = '/') {
      const repository = await this._repository(cwd);
      const matrix = await this.git.statusMatrix({fs:this.fs, dir:repository.dir});
      const changes = matrix.filter(row => row[1] !== row[2] || row[1] !== row[3]).map(row => ({
        path:row[0],
        head:row[1],
        workdir:row[2],
        stage:row[3],
        staged:row[1] !== row[3],
        unstaged:row[2] !== row[3],
        untracked:row[1] === 0 && row[2] === 2 && row[3] === 0
      }));
      let branch = null;
      let head = null;
      try { branch = await this.git.currentBranch({fs:this.fs, dir:repository.dir, fullname:false}); } catch (_) {}
      try { head = await this.git.resolveRef({fs:this.fs, dir:repository.dir, ref:'HEAD'}); } catch (_) {}
      return {root:repository.root, branch, head, changes, clean:changes.length === 0};
    }

    async run(args = [], context = {}) {
      const command = Array.from(args || [], value => String(value));
      const operation = command[0] || '--help';
      if (operation === '--version' || operation === '-v') {
        const version = typeof this.git.version === 'function' ? await this.git.version() : 'unknown';
        return {output:'git version ' + version + ' (isomorphic-git)', value:version};
      }
      const cwd = context.cwd || '/';
      if (operation === 'init') {
        let branch = 'main';
        let directory = cwd;
        for (let i = 1; i < command.length; i++) {
          if (command[i] === '-b' || command[i] === '--initial-branch') branch = command[++i] || branch;
          else if (command[i].startsWith('--initial-branch=')) branch = command[i].slice(17) || branch;
          else if (!command[i].startsWith('-')) directory = normalizeGitPath(cwd + '/' + command[i]);
          else throw new Error('git init: unsupported option ' + command[i]);
        }
        const result = await this.init(directory, branch);
        const suffix = result.root ? result.root.replace(/\/+$/, '') + '/.git/' : '';
        return {output:(result.reinitialized ? 'Reinitialized existing' : 'Initialized empty') + ' Git repository in ' + suffix, value:result};
      }
      if (operation === 'rev-parse') {
        const repository = await this._repository(cwd);
        if (command.includes('--show-toplevel')) return {output:repository.root, value:repository.root};
        if (command.includes('--is-inside-work-tree')) return {output:'true', value:true};
        if (command.includes('--show-prefix')) {
          const prefix = this.resolvePath(cwd).slice(repository.root.length).replace(/^\/+/, '');
          return {output:prefix ? prefix.replace(/\/+$/, '') + '/' : '', value:prefix};
        }
        throw new Error('git rev-parse: unsupported option.');
      }
      if (operation === 'status') {
        const result = await this.status(cwd);
        const lines = ['On branch ' + (result.branch || 'HEAD')];
        if (!result.head) lines.push('', 'No commits yet');
        if (result.clean) lines.push('', 'nothing to commit, working tree clean');
        else {
          const staged = result.changes.filter(change => change.staged);
          const unstaged = result.changes.filter(change => !change.staged && !change.untracked);
          const untracked = result.changes.filter(change => change.untracked);
          if (staged.length) lines.push('', 'Changes to be committed:', ...staged.map(change => '        ' + change.path));
          if (unstaged.length) lines.push('', 'Changes not staged for commit:', ...unstaged.map(change => '        ' + change.path));
          if (untracked.length) lines.push('', 'Untracked files:', ...untracked.map(change => '        ' + change.path));
          lines.push('', 'no changes added to commit');
        }
        return {output:lines.join('\n'), value:result};
      }
      if (operation === '--help' || operation === '-h') return {output:'Supported Git commands are being initialized. Try git --version, git init, git status, or git rev-parse.', value:null};
      throw new Error('git: command not implemented yet: ' + operation);
    }

    async runSerialized(args, context = {}) {
      const task = this.queue.catch(() => {}).then(async () => {
        const result = await this.run(args, context);
        await this.adapter.flush();
        return result;
      });
      this.queue = task.then(() => undefined, () => undefined);
      return task;
    }
  }

  window.GitFileSystemAdapter = GitFileSystemAdapter;
  window.LocalGitService = LocalGitService;
})();