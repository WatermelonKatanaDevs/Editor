importScripts('../../browser/external/7zz.js');

const MAX_FILES = 5000;
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;

function safeArchivePath(value) {
  let path = String(value || '').replace(/\\/g, '/');
  if (!path || path.startsWith('/') || /^[a-z]:/i.test(path)) return null;
  const parts = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..' || part.includes('\0')) return null;
    parts.push(part);
  }
  return parts.length ? parts.join('/') : null;
}

function parseListing(output) {
  const records = [];
  let current = {};
  const finish = () => {
    if (current.Path && current.Size != null && current.Type == null) records.push(current);
    current = {};
  };
  for (const line of String(output || '').replace(/\r/g, '').split('\n')) {
    if (!line.trim()) {
      finish();
      continue;
    }
    const split = line.indexOf(' = ');
    if (split > 0) current[line.slice(0, split).trim()] = line.slice(split + 3).trim();
  }
  finish();
  return records;
}

async function unpack(buffer, extension) {
  if (typeof self.SevenZip !== 'function') throw new Error('The 7-Zip WebAssembly module could not be loaded.');
  postMessage({ type: 'progress', message: 'Starting 7-Zip…' });

  const module = await self.SevenZip({
    noInitialRun: true,
    noExitRuntime: true,
    locateFile: path => new URL('../../browser/external/' + path, self.location.href).href,
    print: () => {},
    printErr: () => {}
  });

  const FS = module.FS;
  FS.mkdir('/wk-archive');
  FS.mkdir('/wk-archive/out');
  const safeExtension = /^(?:7z|gz|tgz|tar|rar)$/i.test(String(extension || '')) ? String(extension).toLowerCase() : 'archive';
  const inputPath = '/wk-archive/input.' + safeExtension;
  FS.writeFile(inputPath, new Uint8Array(buffer));

  const listingOutput = [];
  module.print = line => listingOutput.push(String(line));
  module.printErr = line => listingOutput.push(String(line));
  const listStatus = module.callMain(['l', '-slt', inputPath]);
  if (listStatus !== 0) {
    throw new Error(listingOutput.join('\n').trim() || '7-Zip could not read this archive.');
  }

  const records = parseListing(listingOutput.join('\n'));
  if (!records.length) throw new Error('7-Zip did not find any files in this archive.');

  let declaredFiles = 0;
  let declaredBytes = 0;
  for (const record of records) {
    const path = safeArchivePath(record.Path);
    const attributes = String(record.Attributes || '');
    const isDirectory = record.Folder === '+' || /^D/.test(attributes);
    if (!path || isDirectory) continue;
    const size = Number(record.Size);
    if (!Number.isFinite(size) || size < 0) throw new Error('The archive contains a file with an invalid size.');
    if (size > MAX_FILE_BYTES) throw new Error('A file in this archive exceeds the 64 MB preview limit.');
    declaredFiles++;
    declaredBytes += size;
    if (declaredFiles > MAX_FILES) throw new Error('This archive contains more than 5,000 files.');
    if (declaredBytes > MAX_TOTAL_BYTES) throw new Error('The extracted archive would exceed the 256 MB preview limit.');
  }

  postMessage({ type: 'progress', message: 'Extracting ' + declaredFiles + ' files…' });
  module.print = () => {};
  module.printErr = line => listingOutput.push(String(line));
  const extractStatus = module.callMain(['x', '-y', '-bd', '-o/wk-archive/out', inputPath]);
  if (extractStatus !== 0) {
    const detail = listingOutput.slice(-8).join('\n').trim();
    throw new Error(detail || '7-Zip could not extract this archive.');
  }

  const entries = [];
  const transfer = [];
  let extractedBytes = 0;
  let extractedFiles = 0;

  function walk(directory, prefix) {
    for (const name of FS.readdir(directory)) {
      if (name === '.' || name === '..') continue;
      const fullPath = directory + '/' + name;
      const relativePath = safeArchivePath(prefix ? prefix + '/' + name : name);
      if (!relativePath) continue;
      let stat;
      try { stat = FS.stat(fullPath, true); } catch (_) { continue; }
      if (FS.isLink(stat.mode)) continue;
      if (FS.isDir(stat.mode)) {
        entries.push({ path: relativePath, directory: true });
        walk(fullPath, relativePath);
        continue;
      }
      if (!FS.isFile(stat.mode)) continue;
      if (stat.size > MAX_FILE_BYTES) throw new Error('An extracted file exceeds the 64 MB preview limit.');
      extractedBytes += stat.size;
      if (extractedBytes > MAX_TOTAL_BYTES) throw new Error('The extracted archive exceeds the 256 MB preview limit.');
      extractedFiles++;
      if (extractedFiles > MAX_FILES) throw new Error('This archive contains more than 5,000 files.');
      const bytes = FS.readFile(fullPath);
      const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      entries.push({ path: relativePath, directory: false, data });
      transfer.push(data);
    }
  }

  walk('/wk-archive/out', '');
  if (!entries.some(entry => !entry.directory)) throw new Error('The archive did not contain any readable files.');
  postMessage({ type: 'done', entries }, transfer);
}

self.onmessage = async event => {
  try {
    await unpack(event.data?.buffer, event.data?.extension);
  } catch (error) {
    postMessage({ type: 'error', message: error?.message || String(error) });
  }
};