(function(global) {
  'use strict';

  const DATA_ID = 'wk-standalone-data';

  function reportProgress(options, message) {
    if (typeof options?.onProgress === 'function') options.onProgress(message);
  }

  function readCompileSettings() {
    let rawBinary = true;
    let compressionLevel = 9;
    try {
      const storedRawBinary = global.localStorage.getItem('node-editor.compile.raw-binary');
      rawBinary = storedRawBinary === null ? true : storedRawBinary === 'true';
      compressionLevel = global.localStorage.getItem('node-editor.compile.compression') === '6' ? 6 : 9;
    } catch (_) {}
    return {rawBinary, compressionLevel};
  }

  async function fetchText(url, label) {
    const response = await fetch(url, {cache:'no-store'});
    if (!response.ok) throw new Error('Unable to fetch ' + label + ' (' + response.status + '): ' + url);
    return await response.text();
  }

  function parseStringArray(source) {
    const values = [];
    let index = 0;

    function skipTrivia() {
      while (index < source.length) {
        if (/\s/.test(source[index])) {
          index++;
          continue;
        }
        if (source.slice(index, index + 2) === '//') {
          index += 2;
          while (index < source.length && source[index] !== '\n') index++;
          continue;
        }
        if (source.slice(index, index + 2) === '/*') {
          const end = source.indexOf('*/', index + 2);
          if (end < 0) throw new Error('Unterminated comment in deployment asset list.');
          index = end + 2;
          continue;
        }
        break;
      }
    }

    while (index < source.length) {
      skipTrivia();
      if (index >= source.length) break;
      if (source[index] === ',') {
        index++;
        continue;
      }
      const quote = source[index];
      if (quote !== '"' && quote !== "'") {
        throw new Error('The deployment asset list must contain only string literals.');
      }
      index++;
      let value = '';
      let closed = false;
      while (index < source.length) {
        const char = source[index++];
        if (char === quote) {
          closed = true;
          break;
        }
        if (char === '\\') {
          if (index >= source.length) throw new Error('Invalid escape in deployment asset list.');
          const escaped = source[index++];
          const escapes = {n:'\n',r:'\r',t:'\t',b:'\b',f:'\f'};
          if (escaped === 'u') {
            const hex = source.slice(index, index + 4);
            if (!/^[0-9a-f]{4}$/i.test(hex)) throw new Error('Invalid Unicode escape in deployment asset list.');
            value += String.fromCharCode(parseInt(hex, 16));
            index += 4;
          } else {
            value += Object.prototype.hasOwnProperty.call(escapes, escaped) ? escapes[escaped] : escaped;
          }
        } else {
          value += char;
        }
      }
      if (!closed) throw new Error('Unterminated string in deployment asset list.');
      values.push(value);
      skipTrivia();
      if (index < source.length) {
        if (source[index] !== ',') throw new Error('Unexpected expression in deployment asset list.');
        index++;
      }
    }

    if (!values.length) throw new Error('No deployment script dependencies were declared.');
    if (new Set(values).size !== values.length) throw new Error('The deployment asset list contains duplicate entries.');
    return values;
  }

  function extractDeploymentSources(html) {
    const loaderStart = html.indexOf('window.__deploymentAssetsReady');
    if (loaderStart < 0) throw new Error('deployment.html does not declare its deployment asset loader.');
    const match = html.slice(loaderStart).match(/\bconst\s+sources\s*=\s*\[([\s\S]*?)\]\s*;/);
    if (!match) throw new Error('Unable to locate the deployment page source list.');
    return parseStringArray(match[1]);
  }

  function extractWorkersPath(html) {
    // The deployment template validates embedded workers first and only fetches
    // workers.json for normal deployments. Locate the fetch independently of
    // the surrounding initialization expression so template guards can evolve.
    const matches = [...html.matchAll(/\bfetch\s*\(\s*(['"])([^'"]+)\1/g)];
    const match = matches.find(item => /(?:^|\/)workers\.json(?:[?#]|$)/.test(item[2]));
    if (!match) throw new Error('Unable to locate the deployment page workers.json dependency.');
    return match[2];
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x6000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
    }
    return btoa(binary);
  }

  async function blobToEncodedChunks(blob, encoding, options = {}) {
    if (!blob || typeof blob.size !== 'number') {
      throw new TypeError('The project archive is not a Blob.');
    }

    const chunkSize = 3 * 1024 * 1024;
    const chunks = [];
    let processed = 0;

    async function encodePart(bytes) {
      if (!bytes.length) return;
      chunks.push(encoding === 'raw1252' ? encodeRaw1252Chunk(bytes) : bytesToBase64(bytes));
      processed += bytes.length;
      reportProgress(options, (encoding === 'raw1252' ? 'Embedding raw project bytes… ' : 'Embedding project archive… ') +
        Math.min(100, Math.round(processed / Math.max(1, blob.size) * 100)) + '%');
    }

    if (typeof blob.stream === 'function') {
      const reader = blob.stream().getReader();
      let buffer = new Uint8Array(chunkSize);
      let used = 0;
      try {
        while (true) {
          const result = await reader.read();
          if (result.done) break;
          const incoming = result.value instanceof Uint8Array ? result.value : new Uint8Array(result.value);
          let offset = 0;
          while (offset < incoming.length) {
            const count = Math.min(chunkSize - used, incoming.length - offset);
            buffer.set(incoming.subarray(offset, offset + count), used);
            used += count;
            offset += count;
            if (used === chunkSize) {
              await encodePart(buffer);
              buffer = new Uint8Array(chunkSize);
              used = 0;
            }
          }
        }
      } finally {
        try { reader.releaseLock(); } catch (_) {}
      }
      if (used) await encodePart(buffer.subarray(0, used));
    } else if (typeof blob.slice === 'function') {
      for (let offset = 0; offset < blob.size; offset += chunkSize) {
        const bytes = new Uint8Array(await blob.slice(offset, Math.min(offset + chunkSize, blob.size)).arrayBuffer());
        await encodePart(bytes);
      }
    } else {
      throw new TypeError('The browser cannot stream the project archive.');
    }

    if (!chunks.length) throw new Error('The current project archive is empty.');
    return chunks;
  }

  const WINDOWS_1252_SPECIAL = [
    0x20AC,0x0081,0x201A,0x0192,0x201E,0x2026,0x2020,0x2021,
    0x02C6,0x2030,0x0160,0x2039,0x0152,0x008D,0x017D,0x008F,
    0x0090,0x2018,0x2019,0x201C,0x201D,0x2022,0x2013,0x2014,
    0x02DC,0x2122,0x0161,0x203A,0x0153,0x009D,0x017E,0x0178
  ];
  const WINDOWS_1252_REVERSE = new Map(WINDOWS_1252_SPECIAL.map((codePoint,index) => [codePoint, index + 0x80]));

  function windows1252Byte(codePoint) {
    if (codePoint <= 0x7F || (codePoint >= 0x80 && codePoint <= 0x9F) ||
        (codePoint >= 0xA0 && codePoint <= 0xFF)) return codePoint;
    return WINDOWS_1252_REVERSE.get(codePoint);
  }

  function encodeWindows1252(value) {
    const bytes = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index++) {
      const codePoint = value.charCodeAt(index);
      const byte = windows1252Byte(codePoint);
      if (byte == null) {
        throw new Error('The standalone HTML contains a character that cannot be represented in Windows-1252 (U+' +
          codePoint.toString(16).toUpperCase().padStart(4, '0') + ').');
      }
      bytes[index] = byte;
    }
    return bytes;
  }

  function escapeUnrepresentableHtmlCharacters(value) {
    let output = '';
    for (const character of String(value)) {
      const codePoint = character.codePointAt(0);
      output += (windows1252Byte(codePoint) == null || (codePoint >= 0x80 && codePoint <= 0x9F))
        ? '&#x' + codePoint.toString(16) + ';'
        : character;
    }
    return output;
  }

  function encodeRaw1252Chunk(bytes) {
    let output = '';
    const hex = value => value.toString(16).padStart(2, '0').toUpperCase();
    for (let index = 0; index < bytes.length; index++) {
      const byte = bytes[index];
      if (byte === 0x00 || byte === 0x0D || byte === 0x5C) {
        output += '\\x' + hex(byte);
        continue;
      }
      if (byte === 0x3C && index + 7 < bytes.length &&
          bytes[index + 1] === 0x2F &&
          String.fromCharCode(...bytes.subarray(index + 2, index + 8)).toLowerCase() === 'script') {
        output += '<\\x2Fscript';
        index += 7;
        continue;
      }
      output += String.fromCharCode(byte);
    }
    return output;
  }

  function createRaw1252Decoder() {
    const reverse = Object.fromEntries(WINDOWS_1252_REVERSE);
    return [
      'function(encoded) {',
      '  const bytes = new Uint8Array(encoded.length);',
      '  let offset = 0;',
      '  for (let index = 0; index < encoded.length; index++) {',
      '    let code = encoded.charCodeAt(index);',
      '    if (code === 92) {',
      '      if (encoded[index + 1] === "x") {',
      '        const hex = encoded.slice(index + 2, index + 4);',
      '        if (!/^[0-9a-f]{2}$/i.test(hex)) throw new Error("Invalid raw archive escape at character " + index + ".");',
      '        bytes[offset++] = parseInt(hex, 16);',
      '        index += 3;',
      '        continue;',
      '      }',
      '      throw new Error("Invalid raw archive escape at character " + index + ".");',
      '    }',
      '    const mapped = ' + JSON.stringify(reverse) + '[code];',
      '    if (mapped != null) code = mapped;',
      '    if (code > 255) throw new Error("Invalid raw archive character at " + index + ".");',
      '    bytes[offset++] = code;',
      '  }',
      '  return bytes.subarray(0, offset);',
      '}'
    ].join('\n');
  }

  function textToBase64(value) {
    return bytesToBase64(new TextEncoder().encode(String(value)));
  }

  function escapeJsonForHtml(value) {
    return JSON.stringify(value)
      .replace(/</g, '\\u003c')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }

  function replaceOnce(source, search, replacement, label) {
    const first = source.indexOf(search);
    if (first < 0) throw new Error('The deployment template changed: unable to find ' + label + '.');
    if (source.indexOf(search, first + search.length) >= 0) {
      throw new Error('The deployment template changed: found multiple ' + label + ' anchors.');
    }
    return source.slice(0, first) + replacement + source.slice(first + search.length);
  }

  function createAssetLoader() {
    return [
      'window.__deploymentAssetsReady = (async function() {',
      '  window.__decodeStandaloneRaw1252 = ' + createRaw1252Decoder() + ';',
      '  const dataNode = document.getElementById("wk-standalone-data");',
      '  if (!dataNode) throw new Error("Standalone deployment data is missing.");',
      '  const encodedMetadata = (dataNode.textContent || "").trim();',
      '  if (!encodedMetadata) throw new Error("Standalone deployment metadata is empty.");',
      '  const metadataBinary = atob(encodedMetadata);',
      '  const metadataBytes = new Uint8Array(metadataBinary.length);',
      '  for (let i = 0; i < metadataBinary.length; i++) metadataBytes[i] = metadataBinary.charCodeAt(i);',
      '  const bundle = JSON.parse(new TextDecoder().decode(metadataBytes));',
      '  const assetNodes = Array.from(document.querySelectorAll("script.wk-standalone-asset"));',
      '  const embeddedAssets = assetNodes.map(node => ({',
      '    path: node.getAttribute("data-path") || "",',
      '    url: node.getAttribute("data-url") || "",',
      '    base64: node.textContent.trim()',
      '  }));',
      '  if (!Array.isArray(bundle.assets) || !bundle.assets.length) bundle.assets = embeddedAssets;',
      '  if (!Array.isArray(bundle.assets) || !bundle.assets.length) throw new Error("Standalone HTML is missing its embedded deployment dependencies.");',
      '  window.__WKStandaloneData = bundle;',
      '  window.__peerLayer = String(bundle.runConfig && bundle.runConfig.peerLayer || "peer").trim() || "peer";',
      '  const dataUrl = asset => "data:text/javascript;charset=utf-8;base64," + asset.base64;',
      '  for (const asset of bundle.assets) {',
      '    const script = document.createElement("script");',
      '    script.async = false;',
      '    script.setAttribute("data-raw-src", asset.url);',
      '    if (/\\/peer\\.js$/.test(asset.path)) script.setAttribute("data-layer", window.__peerLayer);',
      '    script.src = dataUrl(asset);',
      '    await new Promise((resolve, reject) => {',
      '      script.addEventListener("load", resolve, {once:true});',
      '      script.addEventListener("error", () => reject(new Error("Failed to initialize embedded deployment dependency: " + asset.path)), {once:true});',
      '      document.head.appendChild(script);',
      '    });',
      '  }',
      '  if (window.NodeEmulator && window.NodeEmulator.prototype && typeof window.NodeEmulator.prototype._config === "function") {',
      '    const originalConfig = window.NodeEmulator.prototype._config;',
      '    const parserUrl = path => {',
      '      const asset = bundle.assets.find(item => item.path === path);',
      '      if (!asset) throw new Error("Embedded Node parser dependency is missing: " + path);',
      '      return dataUrl(asset);',
      '    };',
      '    window.NodeEmulator.prototype._config = function(snapshot) {',
      '      const config = originalConfig.call(this, snapshot);',
      '      config.moduleParserUrls = {',
      '        acorn: parserUrl("browser/external/acorn.js"),',
      '        astring: parserUrl("browser/external/astring.js")',
      '      };',
      '      if (location.protocol === "file:") {',
      '        config.hostOrigin = "http://127.0.0.1";',
      '        config.hostURL = "http://127.0.0.1/";',
      '        config.currentPageUrl = "http://127.0.0.1/";',
      '        config.baseOrigin = "http://127.0.0.1/";',
      '      }',
      '      return config;',
      '    };',
      '  }',
      '  return true;',
      '})();'
    ].join('\n');
  }

  function patchDeploymentPage(html, bundle) {
    html = replaceOnce(
      html,
      'async function getRepositoryInfo(owner, repo) {',
      'async function getRepositoryInfo(owner, repo) {\n    if (window.__WKStandaloneData) return {defaultBranch:"main"};',
      'repository lookup function'
    );

    const archiveBranch = [
      'async function loadArchive(owner, repo, ref) {',
      '    if (window.__WKStandaloneData) {',
      '      const archiveParts = [];',
      '      const archiveChunks = document.querySelectorAll("script.wk-standalone-archive-chunk");',
      '      if (!archiveChunks.length) throw new Error("The standalone project archive is missing.");',
      '      const archiveEncoding = window.__WKStandaloneData.archiveEncoding || "base64";',
      '      if (archiveEncoding !== "base64" && archiveEncoding !== "raw1252") throw new Error("Unknown standalone archive encoding: " + archiveEncoding);',
      '      for (const node of archiveChunks) {',
      '        if (archiveEncoding === "raw1252") {',
      '          archiveParts.push(window.__decodeStandaloneRaw1252(node.textContent));',
      '        } else {',
      '          const binary = atob(node.textContent.trim());',
      '          const bytes = new Uint8Array(binary.length);',
      '          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);',
      '          archiveParts.push(bytes);',
      '        }',
      '        node.remove();',
      '      }',
      '      return new Blob(archiveParts, {type:"application/zip"});',
      '    }'
    ].join('\n');
    html = replaceOnce(html, 'async function loadArchive(owner, repo, ref) {', archiveBranch, 'project archive loader');

    const paramsBranch = [
      'const params = new URLSearchParams(location.search);',
      '  if (window.__WKStandaloneData) {',
      '    const data = window.__WKStandaloneData;',
      '    params.set("github", "https://github.com/standalone/embedded-project");',
      '    params.set("branch", "main");',
      '    params.set("commit", "0000000000000000000000000000000000000000");',
      '    if (!params.has("path")) params.set("path", String(data.path || "/"));',
      '    params.set("usePeerServer", data.runConfig && data.runConfig.usePeerServer ? "1" : "0");',
      '  }'
    ].join('\n');
    html = replaceOnce(html, 'const params = new URLSearchParams(location.search);', paramsBranch, 'deployment query parameters');

    html = replaceOnce(
      html,
      'const runConfigFromProject = readJSON(fs, \'/\.editor/config.json\');',
      'const runConfigFromProject = {...readJSON(fs, \'/\.editor/config.json\'), ...(window.__WKStandaloneData?.runConfig || {})};',
      'project run configuration'
    );

    const loaderPattern = /<script>\s*window\.__deploymentAssetsReady = \(async function\(\) \{[\s\S]*?<\/script>/;
    if (!loaderPattern.test(html)) {
      throw new Error('Unable to replace the deployment page asset loader.');
    }

    const {archiveChunks, assets, ...metadata} = bundle;
    const metadataJson = escapeJsonForHtml(metadata);
    const escapeAttribute = value => escapeUnrepresentableHtmlCharacters(String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;'));
    const payloadParts = [
      '<script type="application/octet-stream" id="' + DATA_ID + '">' + textToBase64(metadataJson) + '</script>\n'
    ];
    for (const asset of assets) {
      payloadParts.push('<script type="application/octet-stream" class="wk-standalone-asset" data-path="' + escapeAttribute(asset.path) + '" data-url="' + escapeAttribute(asset.url) + '">' + asset.base64 + '</script>\n');
    }
    for (const chunk of archiveChunks) {
      payloadParts.push('<script type="application/octet-stream" class="wk-standalone-archive-chunk">' + chunk + '</script>\\n');
    }
    const loaderTag = '<script>\n' + createAssetLoader() + '\n</script>';

    const safeTitle = escapeUnrepresentableHtmlCharacters(String(bundle.projectName || 'Workspace')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;'));
    html = html.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + safeTitle + '</title>');
    html = html.replace(loaderPattern, payloadParts.join('') + loaderTag);
    html = html.replace(/<meta\s+charset=["']?[^"'>\s]+["']?\s*>/i, '<meta charset="windows-1252">');
    return new Blob([encodeWindows1252(html)], {type:'text/html;charset=windows-1252'});
  }

  async function compile(snapshot, options = {}) {
    if (!snapshot || !snapshot.archive || typeof snapshot.archive.arrayBuffer !== 'function') {
      throw new TypeError('The Editor did not provide a project archive.');
    }

    const editorUrl = new URL('.', options.editorUrl || global.location.href);
    const deploymentUrl = new URL('deployment.html', editorUrl);
    reportProgress(options, 'Reading deployment page…');
    const deploymentHtml = await fetchText(deploymentUrl.href, 'deployment.html');
    const sources = extractDeploymentSources(deploymentHtml);
    const workersPath = extractWorkersPath(deploymentHtml);

    reportProgress(options, 'Embedding deployment dependencies…');
    const assets = await Promise.all(sources.map(async (path, index) => {
      const url = new URL(path, deploymentUrl);
      const content = await fetchText(url.href, path);
      reportProgress(options, 'Embedded dependency ' + (index + 1) + ' of ' + sources.length + '…');
      return {path, url:url.href, base64:textToBase64(content)};
    }));

    const workersUrl = new URL(workersPath, deploymentUrl);
    const workersText = await fetchText(workersUrl.href, workersPath);
    let workers;
    try {
      workers = JSON.parse(workersText);
    } catch (error) {
      throw new Error('The deployment workers configuration is invalid JSON: ' + error.message);
    }
    if (!workers || typeof workers !== 'object' || Array.isArray(workers)) {
      throw new Error('The deployment workers configuration must be a JSON object.');
    }

    let projectArchive = snapshot.archive;
    if (global.StandaloneMinifier?.isEnabled?.()) {
      reportProgress(options, 'Minifying project HTML, CSS, and JavaScript…');
      const result = await global.StandaloneMinifier.minifyArchive(snapshot.archive, {
        editorUrl: editorUrl.href,
        compressionLevel: options.compressionLevel,
        onProgress: message => reportProgress(options, message),
        onFileError: (path, error) => console.warn('[Compile Page] Kept original file after minification failed:', path, error)
      });
      projectArchive = result.archive;
      if (result.filesMinified) {
        const savedKB = Math.round(result.bytesSaved / 1024);
        reportProgress(options, 'Minified ' + result.filesMinified + ' files' + (savedKB ? ' · saved ' + savedKB + ' KB' : '') + '…');
      }
    }

    const archiveEncoding = options.archiveEncoding === 'raw1252' ? 'raw1252' : 'base64';
    reportProgress(options, archiveEncoding === 'raw1252' ? 'Embedding raw project bytes…' : 'Embedding project archive…');
    const archiveChunks = await blobToEncodedChunks(projectArchive, archiveEncoding, options);

    const runConfig = snapshot.runConfig && typeof snapshot.runConfig === 'object'
      ? snapshot.runConfig
      : {};
    const bundle = {
      version: 1,
      projectName: String(snapshot.projectName || 'Workspace'),
      archiveEncoding,
      archiveChunks,
      assets,
      workers,
      runConfig,
      path: String(snapshot.deploymentSettings?.path || runConfig.path || '/')
    };

    reportProgress(options, 'Building standalone HTML…');
    return patchDeploymentPage(deploymentHtml, bundle);
  }

  function safeFilename(value) {
    const name = String(value || 'Workspace')
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/[. ]+$/g, '')
      .trim();
    return (name || 'Workspace') + '.html';
  }

  function download(blob, filename) {
    if (!(blob instanceof Blob)) blob = new Blob([blob], {type:'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = safeFilename(filename).replace(/\.html$/i, '') + '.html';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function installButton() {
    const button = document.getElementById('compilePageBtn');
    if (!button || button.dataset.standaloneExportInstalled === '1') return;
    button.dataset.standaloneExportInstalled = '1';

    button.addEventListener('click', async () => {
      if (button.dataset.busy === '1' || button.disabled) return;
      button.dataset.busy = '1';
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = 'Compiling Page…';
      try {
        const editor = global.EditorApp;
        if (!editor || typeof editor.getSinglePageSnapshot !== 'function') {
          throw new Error('The Editor standalone export API is unavailable.');
        }
        const compileSettings = readCompileSettings();
        const snapshot = await editor.getSinglePageSnapshot({
          compressionLevel: compileSettings.compressionLevel
        });
        const html = await compile(snapshot, {
          editorUrl: global.location.href,
          compressionLevel: compileSettings.compressionLevel,
          archiveEncoding: compileSettings.rawBinary ? 'raw1252' : 'base64',
          onProgress: message => { button.textContent = message; }
        });
        download(html, snapshot.projectName);
        button.textContent = 'Page Downloaded';
      } catch (error) {
        button.textContent = 'Compile Failed';
        button.title = error?.message || String(error);
        console.error('[Compile Page]', error);
      } finally {
        delete button.dataset.busy;
        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
        }, 1800);
      }
    });
  }

  global.StandalonePageExporter = Object.freeze({compile});
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installButton, {once:true});
  } else {
    installButton();
  }
})(window);