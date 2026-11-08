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
      this.statClock = Date.now();
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
      const flag = typeof options === 'object' ? options?.flag : '';
      if (flag && String(flag).includes('x') && (this.filesystem.existsSync(relative) || this.filesystem.isDirectorySync(relative))) throw gitFsError('EEXIST', normalized);
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
      // FileSystem caches bytes but does not retain browser File.lastModified values.
      // Use a monotonic timestamp so isomorphic-git never trusts a stale stat cache
      // after the editor changes a same-sized file outside this adapter.
      const modified = new Date(Math.max(Date.now(), ++this.statClock, this.modifiedAt.get(normalized) || 0));
      this.statClock = modified.getTime();
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


  function myersDiff(oldLines, newLines) {
    const n = oldLines.length;
    const m = newLines.length;
    const max = n + m;
    const trace = [];
    let visited = 0;
    let v = new Map([[1, 0]]);
    for (let d = 0; d <= max; d++) {
      visited += d + 1;
      if (visited > 2000000) return [...oldLines.map(line => ({type:'-', line})), ...newLines.map(line => ({type:'+', line}))];
      trace.push(new Map(v));
      for (let k = -d; k <= d; k += 2) {
        const left = v.has(k - 1) ? v.get(k - 1) : -Infinity;
        const right = v.has(k + 1) ? v.get(k + 1) : -Infinity;
        let x = k === -d || (k !== d && left < right) ? (v.get(k + 1) || 0) : (v.get(k - 1) || 0) + 1;
        let y = x - k;
        while (x < n && y < m && oldLines[x] === newLines[y]) {
          x++;
          y++;
        }
        v.set(k, x);
        if (x >= n && y >= m) {
          let backX = n;
          let backY = m;
          const edits = [];
          for (let depth = trace.length - 1; depth >= 0; depth--) {
            const previous = trace[depth];
            const diagonal = backX - backY;
            const previousLeft = previous.has(diagonal - 1) ? previous.get(diagonal - 1) : -Infinity;
            const previousRight = previous.has(diagonal + 1) ? previous.get(diagonal + 1) : -Infinity;
            const previousDiagonal = diagonal === -depth || (diagonal !== depth && previousLeft < previousRight) ? diagonal + 1 : diagonal - 1;
            const previousX = previous.get(previousDiagonal) || 0;
            const previousY = previousX - previousDiagonal;
            while (backX > previousX && backY > previousY) {
              edits.push({type:' ', line:oldLines[backX - 1]});
              backX--;
              backY--;
            }
            if (depth > 0) {
              if (backX === previousX) {
                edits.push({type:'+', line:newLines[backY - 1]});
                backY--;
              } else {
                edits.push({type:'-', line:oldLines[backX - 1]});
                backX--;
              }
            }
          }
          return edits.reverse();
        }
      }
    }
    return [];
  }

  function splitDiffText(text) {
    if (text === '') return [];
    const lines = text.split('\n');
    if (text.endsWith('\n')) lines.pop();
    return lines;
  }

  function formatUnifiedDiff(path, before, after) {
    const oldBytes = before?.bytes || null;
    const newBytes = after?.bytes || null;
    const oldMode = before?.mode || null;
    const newMode = after?.mode || null;
    const oldTextBytes = oldBytes || new Uint8Array();
    const newTextBytes = newBytes || new Uint8Array();
    const bytesEqual = oldBytes && newBytes && oldBytes.length === newBytes.length && oldBytes.every((value, index) => value === newBytes[index]);
    if (bytesEqual && oldMode === newMode) return '';
    const lines = ['diff --git a/' + path + ' b/' + path];
    const modeText = mode => Number(mode || 0o100644).toString(8).padStart(6, '0');
    if (!oldBytes) lines.push('new file mode ' + modeText(newMode));
    else if (!newBytes) lines.push('deleted file mode ' + modeText(oldMode));
    else if (oldMode !== newMode) lines.push('old mode ' + modeText(oldMode), 'new mode ' + modeText(newMode));
    const hasNul = bytes => bytes.some(value => value === 0);
    if (hasNul(oldTextBytes) || hasNul(newTextBytes)) {
      lines.push('Binary files ' + (oldBytes ? 'a/' + path : '/dev/null') + ' and ' + (newBytes ? 'b/' + path : '/dev/null') + ' differ');
      return lines.join('\n');
    }
    let oldText;
    let newText;
    try {
      oldText = oldBytes ? new TextDecoder('utf-8', {fatal:true}).decode(oldBytes) : '';
      newText = newBytes ? new TextDecoder('utf-8', {fatal:true}).decode(newBytes) : '';
    } catch (_) {
      lines.push('Binary files ' + (oldBytes ? 'a/' + path : '/dev/null') + ' and ' + (newBytes ? 'b/' + path : '/dev/null') + ' differ');
      return lines.join('\n');
    }
    const oldLines = splitDiffText(oldText);
    const newLines = splitDiffText(newText);
    const edits = myersDiff(oldLines, newLines);
    if (!edits.some(edit => edit.type !== ' ')) return lines.join('\n');
    lines.push('--- ' + (oldBytes ? 'a/' + path : '/dev/null'));
    lines.push('+++ ' + (newBytes ? 'b/' + path : '/dev/null'));
    const changed = [];
    for (let i = 0; i < edits.length; i++) if (edits[i].type !== ' ') changed.push(i);
    const ranges = [];
    for (const index of changed) {
      const start = Math.max(0, index - 3);
      const end = Math.min(edits.length, index + 4);
      const previous = ranges[ranges.length - 1];
      if (previous && start <= previous.end) previous.end = Math.max(previous.end, end);
      else ranges.push({start, end});
    }
    let oldFinalIndex = 0;
    let newFinalIndex = 0;
    for (const range of ranges) {
      const oldBefore = edits.slice(0, range.start).filter(edit => edit.type !== '+').length;
      const newBefore = edits.slice(0, range.start).filter(edit => edit.type !== '-').length;
      const chunk = edits.slice(range.start, range.end);
      const oldCount = chunk.filter(edit => edit.type !== '+').length;
      const newCount = chunk.filter(edit => edit.type !== '-').length;
      const oldStart = oldBefore + (oldCount ? 1 : 0);
      const newStart = newBefore + (newCount ? 1 : 0);
      lines.push('@@ -' + oldStart + ',' + oldCount + ' +' + newStart + ',' + newCount + ' @@');
      let oldIndex = oldBefore;
      let newIndex = newBefore;
      for (const edit of chunk) {
        lines.push(edit.type + edit.line);
        if (edit.type !== '+') {
          oldIndex++;
          if (!oldText.endsWith('\n') && oldIndex === oldLines.length) lines.push('\\ No newline at end of file');
        }
        if (edit.type !== '-') {
          newIndex++;
          if (!newText.endsWith('\n') && newIndex === newLines.length) lines.push('\\ No newline at end of file');
        }
      }
      oldFinalIndex = oldIndex;
      newFinalIndex = newIndex;
    }
    return lines.join('\n');
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
        untracked:(row[1] === 0 && row[2] === 2 && row[3] === 0) || (row[1] === 1 && row[2] !== 0 && row[3] === 0)
      }));
      let branch = null;
      let head = null;
      try { branch = await this.git.currentBranch({fs:this.fs, dir:repository.dir, fullname:false}); } catch (_) {}
      try { head = await this.git.resolveRef({fs:this.fs, dir:repository.dir, ref:'HEAD'}); } catch (_) {}
      return {root:repository.root, branch, head, changes, clean:changes.length === 0};
    }


    _repoPath(repository, cwd, value) {
      const input = String(value || '.');
      const target = input.startsWith('/') ? this.resolvePath(input) : normalizeGitPath(this.resolvePath(cwd) + '/' + input);
      const root = repository.root.replace(/\/+$/, '') || '/';
      const prefix = root === '/' ? '/' : root + '/';
      if (target !== root && !target.startsWith(prefix)) throw new Error('pathspec is outside the Git repository: ' + value);
      return target === root ? '.' : target.slice(prefix.length);
    }

    async _selectChanges(repository, cwd, pathspecs = [], options = {}) {
      const matrix = await this.git.statusMatrix({fs:this.fs, dir:repository.dir});
      let specs = pathspecs.map(path => this._repoPath(repository, cwd, path).replace(/\/+$/, '')).filter(Boolean);
      if (!specs.length && options.wholeRepo) return options.trackedOnly ? matrix.filter(row => row[1] !== 0 || row[3] !== 0) : matrix;
      if (!specs.length && options.all) specs = ['.'];
      if (!specs.length) throw new Error('a path or -A/--all is required');
      const selected = matrix.filter(row => {
        if (options.trackedOnly && row[1] === 0 && row[3] === 0) return false;
        return specs.some(spec => spec === '.' || row[0] === spec || row[0].startsWith(spec + '/'));
      });
      if (!selected.length && options.allowEmpty) {
        const root = repository.root.replace(/\/+$/, '');
        const validPath = specs.some(spec => {
          const absolute = spec === '.' ? root : root + '/' + spec;
          const relative = this.adapter.relative(absolute);
          return this.filesystem.existsSync(relative) || this.filesystem.isDirectorySync(relative);
        });
        if (validPath || options.all) return [];
      }
      if (!selected.length) throw new Error('pathspec did not match any files: ' + pathspecs.join(' '));
      return selected;
    }

    async _stage(repository, rows) {
      const additions = [];
      const removals = [];
      for (const row of rows) {
        if (row[2] === row[3]) continue;
        if (row[2] === 0 && row[3] !== 0) removals.push(row[0]);
        else if (row[2] !== 0) additions.push(row[0]);
      }
      if (additions.length) await this.git.add({fs:this.fs, dir:repository.dir, filepath:additions});
      if (removals.length) await this.git.remove({fs:this.fs, dir:repository.dir, filepath:removals});
      return {added:additions.length, removed:removals.length};
    }

    async _unstage(repository, rows) {
      const remove = [];
      let count = 0;
      for (const row of rows) {
        if (row[1] === row[3]) continue;
        count++;
        if (row[1] === 0 && row[3] !== 0) remove.push(row[0]);
        else await this.git.resetIndex({fs:this.fs, dir:repository.dir, filepath:row[0], ref:'HEAD'});
      }
      if (remove.length) await this.git.remove({fs:this.fs, dir:repository.dir, filepath:remove});
      return count;
    }


    async _emptyTree(repository) {
      if (!this.emptyTrees) this.emptyTrees = new Map();
      if (!this.emptyTrees.has(repository.root)) {
        const oid = await this.git.writeTree({fs:this.fs, dir:repository.dir, tree:[]});
        this.emptyTrees.set(repository.root, oid);
      }
      return this.emptyTrees.get(repository.root);
    }

    async _walkDiff(repository, walkers, options = {}) {
      const required = options.requiredIndices || options.required || [];
      const pathspecs = options.pathspecs || [];
      const results = await this.git.walk({
        fs:this.fs,
        dir:repository.dir,
        trees:walkers,
        map:async (filepath, entries) => {
          const types = await Promise.all(entries.map(async entry => entry ? await entry.type() : null));
          if (!types.includes('blob')) return undefined;
          if (required.some(index => types[index] !== 'blob')) return undefined;
          if (options.requiredAnyIndices?.length && !options.requiredAnyIndices.some(index => types[index] === 'blob')) return undefined;
          if (pathspecs.length && !pathspecs.some(path => path === '.' || filepath === path || filepath.startsWith(path + '/'))) return undefined;
          const read = async (entry, index) => {
            if (!entry || types[index] !== 'blob') return {bytes:null, mode:null};
            const mode = await entry.mode();
            if (options.stageIndices?.includes(index)) {
              const oid = await entry.oid();
              const result = await this.git.readBlob({fs:this.fs, dir:repository.dir, oid});
              return {bytes:new Uint8Array(result.blob), mode};
            }
            const content = await entry.content();
            return {bytes:content == null ? new Uint8Array() : new Uint8Array(content), mode};
          };
          const contents = [];
          for (let i = 0; i < entries.length; i++) contents.push(await read(entries[i], i));
          return {path:filepath, contents};
        }
      });
      return (results || []).filter(result => result && result.path && result.path !== '.');
    }

    async _diffOutput(repository, walkers, options = {}) {
      const files = await this._walkDiff(repository, walkers, options);
      const patches = [];
      for (const file of files) {
        const patch = formatUnifiedDiff(file.path, file.contents[options.leftIndex || 0], file.contents[options.rightIndex ?? 1]);
        if (patch) patches.push(patch);
      }
      return patches.join('\n');
    }

    async _readConfig(repository, path) {
      return await this.git.getConfig({fs:this.fs, dir:repository.dir, path});
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
          const unstaged = result.changes.filter(change => change.unstaged && !change.untracked);
          const untracked = result.changes.filter(change => change.untracked);
          if (staged.length) lines.push('', 'Changes to be committed:', ...staged.map(change => '        ' + change.path));
          if (unstaged.length) lines.push('', 'Changes not staged for commit:', ...unstaged.map(change => '        ' + change.path));
          if (untracked.length) lines.push('', 'Untracked files:', ...untracked.map(change => '        ' + change.path));
          lines.push('', 'no changes added to commit');
        }
        return {output:lines.join('\n'), value:result};
      }
      if (operation === 'add') {
        const pathspecs = [];
        let all = false;
        let trackedOnly = false;
        for (let i = 1; i < command.length; i++) {
          const arg = command[i];
          if (arg === '-A' || arg === '--all') all = true;
          else if (arg === '-u' || arg === '--update') { trackedOnly = true; all = true; }
          else if (arg === '--') {
            pathspecs.push(...command.slice(i + 1));
            i = command.length;
          } else if (arg.startsWith('-')) throw new Error('git add: unsupported option ' + arg);
          else pathspecs.push(arg);
        }
        const repository = await this._repository(cwd);
        const rows = await this._selectChanges(repository, cwd, pathspecs, {all, trackedOnly, allowEmpty:true});
        const result = await this._stage(repository, rows);
        return {output:result.added + result.removed ? 'Staged ' + (result.added + result.removed) + ' file(s).' : 'No changes to stage.', value:result};
      }
      if (operation === 'restore' || operation === 'reset') {
        let staged = operation === 'reset';
        let source = 'HEAD';
        const paths = [];
        let all = false;
        let unsupported = null;
        for (let i = 1; i < command.length; i++) {
          const arg = command[i];
          if (arg === '--staged' || arg === '--cached') staged = true;
          else if (arg === '--worktree' || arg === '-W') staged = false;
          else if (arg === '--mixed') staged = true;
          else if (arg === '--hard' || arg === '--soft') unsupported = arg;
          else if (arg === '--all' || arg === '-A') all = true;
          else if (arg.startsWith('--source=')) source = arg.slice(9);
          else if (arg === '--source' || arg === '-s') source = command[++i] || source;
          else if (arg === '--') {
            paths.push(...command.slice(i + 1));
            i = command.length;
          } else if (arg.startsWith('-')) throw new Error('git ' + operation + ': unsupported option ' + arg);
          else paths.push(arg);
        }
        if (unsupported) throw new Error('git ' + operation + ' ' + unsupported + ' is not implemented yet.');
        if (operation === 'reset' && paths[0] === 'HEAD') paths.shift();
        const wholeRepo = operation === 'reset' && paths.length === 0 && !all;
        if (wholeRepo) all = true;
        if (operation === 'restore' && paths.length === 0) throw new Error('git restore: specify one or more paths.');
        const repository = await this._repository(cwd);
        const rows = await this._selectChanges(repository, cwd, paths, {all, wholeRepo});
        if (staged) {
          const count = await this._unstage(repository, rows);
          return {output:'Unstaged ' + count + ' path(s).', value:count};
        } else {
          const filepaths = rows.filter(row => row[3] !== 0 || row[1] !== 0).map(row => row[0]);
          if (!filepaths.length) throw new Error('git restore: none of the selected paths are in the index.');
          const options = {fs:this.fs, dir:repository.dir, filepaths, force:true};
          if (source !== 'HEAD') options.ref = source;
          await this.git.checkout(options);
        }
        return {output:'Restored ' + rows.length + ' path(s).', value:true};
      }
      if (operation === 'config') {
        const values = command.slice(1);
        if (values[0] === '--global' || values[0] === '--system') throw new Error('git config: only repository-local configuration is supported.');
        if (values[0] === '--local') values.shift();
        if (!values.length) throw new Error('git config: expected a key.');
        const repository = await this._repository(cwd);
        const path = values[0];
        if (values.length === 1) {
          const value = await this._readConfig(repository, path);
          if (value == null) throw new Error('git config: key not found: ' + path);
          return {output:String(value), value};
        }
        if (values.length === 2) {
          await this.git.setConfig({fs:this.fs, dir:repository.dir, path, value:values[1]});
          return {output:'', value:values[1]};
        }
        throw new Error('git config: unsupported arguments.');
      }
      if (operation === 'commit') {
        let message = '';
        for (let i = 1; i < command.length; i++) {
          if (command[i] === '-m' || command[i] === '--message') message = command[++i] || '';
          else if (command[i].startsWith('--message=')) message = command[i].slice(10);
          else if (command[i] === '--') continue;
          else if (command[i].startsWith('-')) throw new Error('git commit: unsupported option ' + command[i]);
          else throw new Error('git commit: path-based commit options are not implemented yet.');
        }
        if (!message.trim()) throw new Error('git commit: use -m "message" to provide a commit message.');
        const repository = await this._repository(cwd);
        const name = await this._readConfig(repository, 'user.name');
        const email = await this._readConfig(repository, 'user.email');
        if (!name || !email) throw new Error('Author identity unknown. Set it with: git config user.name "Your Name" and git config user.email "you@example.com"');
        const result = await this.status(cwd);
        if (!result.changes.some(change => change.staged)) throw new Error('nothing to commit (use git add to stage changes first)');
        const oid = await this.git.commit({fs:this.fs, dir:repository.dir, message, author:{name:String(name), email:String(email)}, disallowEmpty:true});
        const commit = (await this.git.log({fs:this.fs, dir:repository.dir, ref:oid, depth:1}))[0];
        return {output:'[' + (result.branch || 'HEAD') + ' ' + oid.slice(0, 7) + '] ' + message.split('\n')[0], value:{oid, commit:commit?.commit || null}};
      }
      if (operation === 'diff') {
        let cached = false;
        let reference = null;
        const pathspecs = [];
        for (let i = 1; i < command.length; i++) {
          const arg = command[i];
          if (arg === '--cached' || arg === '--staged') cached = true;
          else if (arg === '--') {
            pathspecs.push(...command.slice(i + 1));
            break;
          } else if (arg.startsWith('-')) throw new Error('git diff: unsupported option ' + arg);
          else if (!reference && (arg === 'HEAD' || /^[0-9a-f]{7,40}$/i.test(arg))) reference = arg;
          else pathspecs.push(arg);
        }
        const repository = await this._repository(cwd);
        const resolvedPaths = pathspecs.map(path => this._repoPath(repository, cwd, path).replace(/\/+$/, '')).filter(Boolean);
        let walkers;
        let options;
        if (cached) {
          let base = reference || 'HEAD';
          if (base === 'HEAD') {
            try { base = await this.git.resolveRef({fs:this.fs, dir:repository.dir, ref:'HEAD'}); }
            catch (_) { base = await this._emptyTree(repository); }
          }
          walkers = [this.git.TREE({ref:base}), this.git.STAGE()];
          options = {pathspecs:resolvedPaths, stageIndices:[1], leftIndex:0, rightIndex:1};
        } else if (reference) {
          let base = reference;
          if (base === 'HEAD') base = await this.git.resolveRef({fs:this.fs, dir:repository.dir, ref:'HEAD'});
          walkers = [this.git.TREE({ref:base}), this.git.WORKDIR(), this.git.STAGE()];
          options = {pathspecs:resolvedPaths, requiredAnyIndices:[0,2], leftIndex:0, rightIndex:1};
        } else {
          walkers = [this.git.STAGE(), this.git.WORKDIR()];
          options = {pathspecs:resolvedPaths, required:[0], stageIndices:[0], leftIndex:0, rightIndex:1};
        }
        const output = await this._diffOutput(repository, walkers, options);
        return {output, value:output};
      }
      if (operation === 'log' || operation === 'show') {
        let depth = operation === 'show' ? 1 : 10;
        let oneline = false;
        let ref = 'HEAD';
        let refSet = false;
        for (let i = 1; i < command.length; i++) {
          const arg = command[i];
          if (arg === '--oneline') oneline = true;
          else if (arg === '-n' || arg === '--max-count') depth = Math.max(1, Number(command[++i]) || depth);
          else if (/^-\d+$/.test(arg)) depth = Math.max(1, Number(arg.slice(1)));
          else if (arg.startsWith('--max-count=')) depth = Math.max(1, Number(arg.slice(12)) || depth);
          else if (arg.startsWith('-')) throw new Error('git ' + operation + ': unsupported option ' + arg);
          else if (!refSet) { ref = arg; refSet = true; }
          else throw new Error('git ' + operation + ': too many revisions.');
        }
        const repository = await this._repository(cwd);
        const commits = await this.git.log({fs:this.fs, dir:repository.dir, ref, depth});
        if (!commits.length) return {output:'', value:[]};
        const lines = [];
        for (const entry of commits) {
          const commit = entry.commit;
          const subject = String(commit.message || '').trim().split('\n')[0];
          if (oneline) lines.push(entry.oid.slice(0, 7) + ' ' + subject);
          else {
            lines.push('commit ' + entry.oid);
            if (commit.author) lines.push('Author: ' + commit.author.name + ' <' + commit.author.email + '>');
            if (commit.author?.timestamp) lines.push('Date:   ' + new Date(commit.author.timestamp * 1000).toString());
            lines.push('', '    ' + subject);
          }
          if (operation === 'show') {
            const parent = commit.parent?.[0] || await this._emptyTree(repository);
            const patch = await this._diffOutput(repository, [this.git.TREE({ref:parent}), this.git.TREE({ref:entry.oid})], {leftIndex:0, rightIndex:1});
            if (patch) lines.push('', patch);
          }
          if (!oneline || operation === 'show') lines.push('');
        }
        return {output:lines.join('\n').trimEnd(), value:commits};
      }
      if (operation === '--help' || operation === '-h' || operation === 'help') return {output:'Supported Git commands: --version, init, status, add, restore, reset (mixed), config, commit, log, show, diff, rev-parse.', value:null};
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