(function(global) {
  'use strict';

  const DATA_ID = 'wk-standalone-data';

  function reportProgress(options, message) {
    if (typeof options?.onProgress === 'function') options.onProgress(message);
  }

  function readCompileSettings() {
    let rawBinary = false;
    let compressionLevel = 9;
    try {
      const storedRawBinary = global.localStorage.getItem('node-editor.compile.raw-binary');
      rawBinary = storedRawBinary === null ? false : storedRawBinary === 'true';
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
      chunks.push(encoding === 'iso8859-2' ? encodeISO88592Chunk(bytes) : bytesToBase64(bytes));
      processed += bytes.length;
      reportProgress(options, (encoding === 'iso8859-2' ? 'Encoding ZIP archive… ' : 'Embedding project archive… ') +
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

  // ISO-8859-2 maps every byte to one Unicode code point. The document
  // itself is emitted in this charset so archive bytes remain one byte each.
  const ISO_8859_2_HIGH = [
    0x00A0,0x0104,0x02D8,0x0141,0x00A4,0x013D,0x015A,0x00A7,
    0x00A8,0x0160,0x015E,0x0164,0x0179,0x00AD,0x017D,0x017B,
    0x00B0,0x0105,0x02DB,0x0142,0x00B4,0x013E,0x015B,0x02C7,
    0x00B8,0x0161,0x015F,0x0165,0x017A,0x02DD,0x017E,0x017C,
    0x0154,0x00C1,0x00C2,0x0102,0x00C4,0x0139,0x0106,0x00C7,
    0x010C,0x00C9,0x0118,0x00CB,0x011A,0x00CD,0x00CE,0x010E,
    0x0110,0x0143,0x0147,0x00D3,0x00D4,0x0150,0x00D6,0x00D7,
    0x0158,0x016E,0x00DA,0x0170,0x00DC,0x00DD,0x0162,0x00DF,
    0x0155,0x00E1,0x00E2,0x0103,0x00E4,0x013A,0x0107,0x00E7,
    0x010D,0x00E9,0x0119,0x00EB,0x011B,0x00ED,0x00EE,0x010F,
    0x0111,0x0144,0x0148,0x00F3,0x00F4,0x0151,0x00F6,0x00F7,
    0x0159,0x016F,0x00FA,0x0171,0x00FC,0x00FD,0x0163,0x02D9
  ];
  const ISO_8859_2_BYTE_TO_CODEPOINT = Array.from(
    {length:256},
    (_, byte) => byte < 0xA0 ? byte : ISO_8859_2_HIGH[byte - 0xA0]
  );
  const ISO_8859_2_BYTE_TO_CHAR = ISO_8859_2_BYTE_TO_CODEPOINT.map(code => String.fromCharCode(code));
  const ISO_8859_2_REVERSE = new Map(
    ISO_8859_2_BYTE_TO_CODEPOINT.map((code, byte) => [code, byte])
  );

  const ISO_8859_2_MARKER_CANDIDATES = [
    0x23,0x24,0x25,0x26,0x27,0x28,0x29,0x2A,0x2B,0x2C,
    0x2E,0x3A,0x3B,0x3D,0x3E,0x3F,0x40,0x5B,0x5D,0x5E,
    0x5F,0x60,0x7B,0x7C,0x7D,0x7E
  ];

  function encodeISO88592(value) {
    const source = String(value);
    const bytes = new Uint8Array(source.length);
    for (let index = 0; index < source.length; index++) {
      const codePoint = source.charCodeAt(index);
      const byte = ISO_8859_2_REVERSE.get(codePoint);
      if (byte == null) {
        throw new Error('The standalone HTML contains a character that cannot be represented in ISO-8859-2 (U+' +
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
      output += (ISO_8859_2_REVERSE.has(codePoint) && !(codePoint >= 0x80 && codePoint <= 0x9F))
        ? character
        : '&#x' + codePoint.toString(16) + ';';
    }
    return output;
  }

  function escapeDocumentCharacters(value, context) {
    let output = '';
    for (const character of String(value)) {
      const codePoint = character.codePointAt(0);
      if (ISO_8859_2_REVERSE.has(codePoint) && !(codePoint >= 0x80 && codePoint <= 0x9F)) {
        output += character;
      } else if (context === 'script') {
        for (let index = 0; index < character.length; index++) {
          output += '\\u' + character.charCodeAt(index).toString(16).padStart(4, '0');
        }
      } else if (context === 'style') {
        output += '\\' + codePoint.toString(16) + ' ';
      } else {
        output += '&#x' + codePoint.toString(16) + ';';
      }
    }
    return output;
  }

  function prepareHtmlForISO88592(value) {
    const source = String(value);
    const openingPattern = /<(script|style)\b[^>]*>/ig;
    let output = '';
    let cursor = 0;

    while (cursor < source.length) {
      openingPattern.lastIndex = cursor;
      const opening = openingPattern.exec(source);
      if (!opening) {
        output += escapeDocumentCharacters(source.slice(cursor), 'html');
        break;
      }

      output += escapeDocumentCharacters(source.slice(cursor, opening.index), 'html');

      const tagName = opening[1].toLowerCase();
      const closingPattern = new RegExp('</' + tagName + '\\s*>', 'ig');
      closingPattern.lastIndex = openingPattern.lastIndex;
      const closing = closingPattern.exec(source);
      if (!closing) {
        throw new Error('The standalone HTML contains an unterminated ' + tagName + ' element.');
      }

      const rawText = source.slice(openingPattern.lastIndex, closing.index);
      const isArchiveChunk = tagName === 'script' &&
        /\bclass\s*=\s*["'][^"']*\bwk-standalone-archive-chunk\b[^"']*["']/i.test(opening[0]);

      // Script/style contents are raw text: opening tags inside them are
      // not nested elements. In particular, never scan inside ZIP chunks,
      // whose contents can contain arbitrary "<script" sequences.
      output += opening[0];
      output += isArchiveChunk ? rawText : escapeDocumentCharacters(rawText, tagName);
      output += closing[0];
      cursor = closingPattern.lastIndex;
    }

    if (!source.length) return '';
    return output;
  }

  function chooseISO88592Marker(bytes) {
    const counts = new Uint32Array(256);
    for (const byte of bytes) counts[byte]++;
    let marker = ISO_8859_2_MARKER_CANDIDATES[0];
    for (const candidate of ISO_8859_2_MARKER_CANDIDATES) {
      if (counts[candidate] < counts[marker]) marker = candidate;
    }
    return marker;
  }

  function isScriptEndTag(bytes, index) {
    if (bytes[index] !== 0x3C || bytes[index + 1] !== 0x2F || index + 7 >= bytes.length) {
      return false;
    }
    const target = 'script';
    for (let offset = 0; offset < target.length; offset++) {
      let byte = bytes[index + 2 + offset];
      if (byte >= 0x41 && byte <= 0x5A) byte += 0x20;
      if (byte !== target.charCodeAt(offset)) return false;
    }
    return true;
  }

  function encodeISO88592Chunk(bytes) {
    const markerByte = chooseISO88592Marker(bytes);
    const marker = ISO_8859_2_BYTE_TO_CHAR[markerByte];
    let output = '';

    for (let index = 0; index < bytes.length; index++) {
      const byte = bytes[index];

      if (byte === markerByte) {
        output += marker + marker;
      } else if (byte === 0x00) {
        output += marker + '0';
      } else if (byte === 0x0D) {
        output += marker + 'r';
      } else if (isScriptEndTag(bytes, index)) {
        output += '<' + marker;
        index++;
      } else if (
        byte === 0x3C &&
        bytes[index + 1] === 0x21 &&
        bytes[index + 2] === 0x2D &&
        bytes[index + 3] === 0x2D
      ) {
        output += '<' + marker;
        index++;
      } else {
        output += ISO_8859_2_BYTE_TO_CHAR[byte];
      }
    }

    return {text:output, markerByte};
  }

  function createISO88592ArchiveDecoder() {
    const reverse = Object.fromEntries(ISO_8859_2_REVERSE);
    return [
      'async function(encoded, markerByte, onProgress) {',
      '  if (!Number.isInteger(markerByte) || markerByte < 0 || markerByte > 255) throw new Error("Invalid ISO-8859-2 archive marker.");',
      '  const marker = markerByte;',
      '  const bytes = new Uint8Array(encoded.length);',
      '  let offset = 0;',
      '  const blockSize = 0x40000;',
      '  let index = 0;',
      '  let lastYield = 0;',
      '  while (index < encoded.length) {',
      '    const start = index;',
      '    const code = encoded.charCodeAt(index);',
      '    let consumed = false;',
      '    if (code === 0x3C && encoded.charCodeAt(index + 1) === marker) {',
      '      if (encoded.slice(index + 2, index + 8).toLowerCase() === "script") {',
      '        bytes[offset++] = 0x3C;',
      '        bytes[offset++] = 0x2F;',
      '        index += 2;',
      '        consumed = true;',
      '      } else if (encoded.slice(index + 2, index + 4) === "--") {',
      '        bytes[offset++] = 0x3C;',
      '        bytes[offset++] = 0x21;',
      '        index += 2;',
      '        consumed = true;',
      '      }',
      '    }',
      '    if (!consumed && code === marker) {',
      '      const escaped = encoded.charCodeAt(index + 1);',
      '      if (escaped === marker) bytes[offset++] = marker;',
      '      else if (escaped === 0x30) bytes[offset++] = 0;',
      '      else if (escaped === 0x72) bytes[offset++] = 0x0D;',
      '      else throw new Error("Invalid ISO-8859-2 archive escape at character " + index + ".");',
      '      index += 2;',
      '    } else if (!consumed) {',
      '      const mapped = ' + JSON.stringify(reverse) + '[code];',
      '      if (mapped == null) throw new Error("Invalid ISO-8859-2 archive character at " + index + ".");',
      '      bytes[offset++] = mapped;',
      '      index++;',
      '    }',
      '    if (index - lastYield >= blockSize) {',
      '      if (typeof onProgress === "function") onProgress(index, encoded.length, offset);',
      '      lastYield = index;',
      '      if (index < encoded.length) await new Promise(resolve => setTimeout(resolve, 0));',
      '    }',
      '  }',
      '  if (lastYield < encoded.length && typeof onProgress === "function") onProgress(encoded.length, encoded.length, offset);',
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

  function encodeTemplateLiteral(value) {
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$\{/g, '\\${')
      .replace(/\0/g, '\\x00')
      .replace(/\r/g, '\\r')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
      // Keep embedded source invisible to the HTML raw-text parser and the
      // ISO-8859-2 document scanner. Template evaluation restores each "<".
      .replace(/</g, '\\x3C');
  }

  function createAssetLoader(assets) {
    return [
      'window.__deploymentAssetsReady = (async function() {',
      '  window.__decodeStandaloneISO88592 = ' + createISO88592ArchiveDecoder() + ';',
      '  const dataNode = document.getElementById("wk-standalone-data");',
      '  if (!dataNode) throw new Error("Standalone deployment data is missing.");',
      '  const encodedMetadata = (dataNode.textContent || "").trim();',
      '  if (!encodedMetadata) throw new Error("Standalone deployment metadata is empty.");',
      '  const metadataBinary = atob(encodedMetadata);',
      '  const metadataBytes = new Uint8Array(metadataBinary.length);',
      '  for (let i = 0; i < metadataBinary.length; i++) metadataBytes[i] = metadataBinary.charCodeAt(i);',
      '  const bundle = JSON.parse(new TextDecoder().decode(metadataBytes));',
      '  const embeddedAssets = [',
      ...assets.map((asset, index) =>
        '    {path:' + escapeJsonForHtml(asset.path) + ', url:' + escapeJsonForHtml(asset.url) + ', source:`' +
        encodeTemplateLiteral(asset.source) + '`}' + (index < assets.length - 1 ? ',' : '')
      ),
      '  ];',
      '  bundle.assets = embeddedAssets;',
      '  window.__WKStandaloneData = bundle;',
      '  window.__peerLayer = String(bundle.runConfig && bundle.runConfig.peerLayer || "peer").trim() || "peer";',
      '  const base64Url = asset => {',
      '    if (!asset.parserDataUrl) {',
      '      const bytes = new TextEncoder().encode(asset.source);',
      '      let binary = "";',
      '      const chunkSize = 0x6000;',
      '      for (let offset = 0; offset < bytes.length; offset += chunkSize) {',
      '        binary += String.fromCharCode.apply(null, bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));',
      '      }',
      '      asset.parserDataUrl = "data:text/javascript;charset=utf-8;base64," + btoa(binary);',
      '    }',
      '    return asset.parserDataUrl;',
      '  };',
      '  for (const asset of bundle.assets) {',
      '    const script = document.createElement("script");',
      '    script.async = false;',
      '    script.setAttribute("data-raw-src", asset.url);',
      '    if (/\\/peer\\.js$/.test(asset.path)) script.setAttribute("data-layer", window.__peerLayer);',
      '    script.textContent = asset.source;',
      '    document.head.appendChild(script);',
      '  }',
      '  if (window.NodeEmulator && window.NodeEmulator.prototype && typeof window.NodeEmulator.prototype._config === "function") {',
      '    const originalConfig = window.NodeEmulator.prototype._config;',
      '    const parserUrl = path => {',
      '      const asset = bundle.assets.find(item => item.path === path);',
      '      if (!asset) throw new Error("Embedded Node parser dependency is missing: " + path);',
      '      return base64Url(asset);',
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

  async function patchDeploymentPage(html, bundle, options = {}) {
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
      '      if (archiveEncoding !== "base64" && archiveEncoding !== "iso8859-2") throw new Error("Unknown standalone archive encoding: " + archiveEncoding);',
      '      let chunkIndex = 0;',
      '      for (const node of archiveChunks) {',
      '        if (archiveEncoding === "iso8859-2") {',
      '          const markerAttribute = node.getAttribute("data-escape-marker");',
      '          if (!/^\\d{1,3}$/.test(markerAttribute || "")) throw new Error("Standalone ZIP chunk is missing its ISO-8859-2 escape marker.");',
      '          const markerByte = Number(markerAttribute);',
      '          const encoded = node.textContent;',
      '          archiveParts.push(await window.__decodeStandaloneISO88592(encoded, markerByte, (done, total) => {',
      '            const percent = ((chunkIndex + (total ? done / total : 1)) / archiveChunks.length) * 100;',
      '            setProgress("Decoding embedded project archive…", percent, "Chunk " + (chunkIndex + 1) + " of " + archiveChunks.length);',
      '          }));',
      '        } else {',
      '          const binary = atob(node.textContent.trim());',
      '          const bytes = new Uint8Array(binary.length);',
      '          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);',
      '          archiveParts.push(bytes);',
      '        }',
      '        node.remove();',
      '        chunkIndex++;',
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

    // Minify the deployment template's executable scripts before injecting
    // the large template-literal asset loader. Re-parsing that generated
    // loader as HTML can mistake script-like text inside embedded source for
    // actual HTML tags, so the generated loader must be inserted afterwards.
    const loaderPlaceholder = '<script type="application/x-wk-standalone-placeholder" id="wk-standalone-loader-placeholder"></script>';
    html = html.replace(loaderPattern, loaderPlaceholder);
    if (global.StandaloneMinifier?.isEnabled?.() &&
        typeof global.StandaloneMinifier.minifyInlineScripts === 'function') {
      reportProgress(options, 'Minifying deployment inline scripts…');
      try {
        html = await global.StandaloneMinifier.minifyInlineScripts(html, {
          editorUrl: options.editorUrl || global.location.href
        });
      } catch (error) {
        console.warn('[Compile Page] Kept deployment template scripts after minification failed:', error);
      }
    }

    const {archiveChunks, assets, ...metadata} = bundle;
    const metadataJson = escapeJsonForHtml(metadata);
    const payloadParts = [
      '<script type="application/octet-stream" id="' + DATA_ID + '">' + textToBase64(metadataJson) + '</script>\n'
    ];
    for (const chunk of archiveChunks) {
      if (bundle.archiveEncoding === 'iso8859-2') {
        payloadParts.push('<script type="application/octet-stream" class="wk-standalone-archive-chunk" data-escape-marker="' +
          chunk.markerByte + '">' + chunk.text + '</script>\n');
      } else {
        payloadParts.push('<script type="application/octet-stream" class="wk-standalone-archive-chunk">' + chunk + '</script>\n');
      }
    }
    let loaderSource = createAssetLoader(assets);
    if (global.StandaloneMinifier?.isEnabled?.() &&
        typeof global.StandaloneMinifier.minifyJavaScriptSource === 'function') {
      try {
        loaderSource = await global.StandaloneMinifier.minifyJavaScriptSource(loaderSource, {
          editorUrl: options.editorUrl || global.location.href
        });
      } catch (error) {
        console.warn('[Compile Page] Kept standalone loader source after minification failed:', error);
      }
    }
    const loaderTag = '<script>' + loaderSource + '</script>';

    const safeTitle = escapeUnrepresentableHtmlCharacters(String(bundle.projectName || 'Workspace')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;'));
    html = html.replace(/<title>[\s\S]*?<\/title>/i, () => '<title>' + safeTitle + '</title>');
    if (!html.includes(loaderPlaceholder)) {
      throw new Error('The deployment asset-loader placeholder was lost during HTML minification.');
    }
    // Use a callback because embedded dependencies contain literal "$&".
    // String.replace would otherwise expand it to the matched placeholder.
    html = html.replace(loaderPlaceholder, () => payloadParts.join('') + loaderTag);
    const charsetPattern = /<meta\s+charset=["']?[^"'>\s]+["']?\s*>/i;
    if (!charsetPattern.test(html)) {
      throw new Error('The deployment template must declare a character encoding before standalone payloads can be embedded.');
    }
    if (bundle.archiveEncoding === 'iso8859-2') {
      // Raw ZIP bytes are represented as ISO-8859-2 characters. Preserve that
      // byte mapping only in this opt-in size-optimized mode.
      html = html.replace(charsetPattern, '<meta charset="iso-8859-2">');
      html = prepareHtmlForISO88592(html);
      return new Blob([encodeISO88592(html)], {type:'text/html;charset=iso-8859-2'});
    }

    // The portable Base64 variant is ordinary UTF-8 HTML. Do not run the
    // single-byte charset transformation over it: many upload/hosting
    // services serve HTML as UTF-8 and cannot preserve a legacy charset.
    html = html.replace(charsetPattern, '<meta charset="utf-8">');
    return new Blob([html], {type:'text/html;charset=utf-8'});
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
    const shouldMinifyDependencies = global.StandaloneMinifier?.isEnabled?.() &&
      typeof global.StandaloneMinifier.minifyJavaScriptSource === 'function';
    const assets = await Promise.all(sources.map(async (path, index) => {
      const url = new URL(path, deploymentUrl);
      const original = await fetchText(url.href, path);
      let source = original;
      if (shouldMinifyDependencies) {
        try {
          const optimized = await global.StandaloneMinifier.minifyJavaScriptSource(original, {
            editorUrl: editorUrl.href
          });
          if (optimized.length < original.length) source = optimized;
        } catch (error) {
          console.warn('[Compile Page] Kept original deployment dependency after minification failed:', path, error);
        }
      }
      reportProgress(options, 'Prepared dependency ' + (index + 1) + ' of ' + sources.length + '…');
      return {path, url:url.href, source};
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

    const archiveEncoding = options.archiveEncoding === 'iso8859-2' || options.archiveEncoding === 'raw1252' ? 'iso8859-2' : 'base64';
    reportProgress(options, archiveEncoding === 'iso8859-2' ? 'Encoding ZIP archive…' : 'Embedding project archive…');
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
    return await patchDeploymentPage(deploymentHtml, bundle, {
      editorUrl:editorUrl.href,
      onProgress:options.onProgress
    });
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
          archiveEncoding: compileSettings.rawBinary ? 'iso8859-2' : 'base64',
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