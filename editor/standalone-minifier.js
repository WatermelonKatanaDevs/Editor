(function(global) {
  'use strict';

  const ACORN_PATH = 'browser/external/acorn.js';
  let acornPromise = null;
  const MERGING_PUNCTUATORS = new Set([
    '++', '--', '**', '=>', '==', '!=', '<=', '>=', '<<', '>>',
    '&&', '||', '??', '?.', '+=', '-=', '*=', '/=', '%=', '&=',
    '|=', '^=', '...', '//', '/*', '..', '**=', '===', '!==',
    '>>>', '>>=', '<<=', '&&=', '||=', '??='
  ]);

  function progress(options, message) {
    if (typeof options?.onProgress === 'function') options.onProgress(message);
  }

  function minificationEnabled() {
    try {
      const stored = global.localStorage.getItem('node-editor.compile.minify');
      return stored === null ? true : stored === 'true';
    } catch (_) {
      return true;
    }
  }

  function isAcornParser(candidate) {
    return !!candidate && typeof candidate.parse === 'function' &&
      typeof candidate.tokenizer === 'function';
  }

  function findAcornParser() {
    // The UMD build normally publishes window.acorn. Some editor/runtime
    // environments expose CommonJS globals, however, causing Acorn's UMD
    // wrapper to populate exports/module.exports instead.
    const candidates = [
      global.acorn,
      global.Acorn,
      global.module && global.module.exports,
      global.exports
    ];
    return candidates.find(isAcornParser) || null;
  }

  async function loadAcorn(editorUrl) {
    const existing = findAcornParser();
    if (existing) return existing;
    if (!acornPromise) {
      acornPromise = (async () => {
        const url = new URL(ACORN_PATH, editorUrl || global.location.href).href;
        const response = await fetch(url, {cache:'force-cache'});
        if (!response.ok) {
          throw new Error('Unable to load the local Acorn parser (' + response.status + '): ' + url);
        }
        const source = await response.text();
        if (!/exports\.tokenizer\s*=\s*tokenizer/.test(source) ||
            !/exports\.parse\s*=\s*parse/.test(source)) {
          throw new Error('The local Acorn resource does not appear to contain the expected parser build: ' + url);
        }
        // Force the UMD build down its browser-global branch. The Editor can
        // provide lexical CommonJS/AMD bindings that are not visible on window.
        const evaluate = new Function(
          'globalThis', 'exports', 'module', 'define', 'self',
          source + '\n;return globalThis.acorn;'
        );
        const acorn = evaluate(global, undefined, undefined, undefined, global);
        if (!isAcornParser(acorn)) {
          throw new Error('The local Acorn build executed but did not expose parse() and tokenizer().');
        }
        return acorn;
      })();
    }
    try {
      return await acornPromise;
    } catch (error) {
      acornPromise = null;
      throw error;
    }
  }

  function isWordCharacter(character) {
    return !!character && /[A-Za-z0-9_$]/.test(character);
  }

  function needsJavaScriptSeparator(previous, next) {
    if (!previous || !next) return false;
    const left = previous.raw;
    const right = next.raw;
    const leftLast = left.charAt(left.length - 1);
    const rightFirst = right.charAt(0);

    if (isWordCharacter(leftLast) && isWordCharacter(rightFirst)) return true;
    if (MERGING_PUNCTUATORS.has(leftLast + rightFirst)) return true;
    if (previous.label === 'num' && rightFirst === '.') return true;
    return false;
  }

  function minifyJavaScript(source, acorn) {
    if (!source || /^\s*#!.*/.test(source)) return source;

    const parseOptions = {
      ecmaVersion: 'latest',
      allowHashBang: true,
      allowReturnOutsideFunction: true
    };
    let sourceType = 'script';
    try {
      acorn.parse(source, {...parseOptions, sourceType});
    } catch (scriptError) {
      sourceType = 'module';
      try {
        acorn.parse(source, {...parseOptions, sourceType});
      } catch (moduleError) {
        throw moduleError || scriptError;
      }
    }

    const entries = [];
    const comments = [];
    const tokenizer = acorn.tokenizer(source, {
      ...parseOptions,
      sourceType,
      onComment(block, text, start, end) {
        if (text.startsWith('!')) {
          comments.push({start, end, raw:source.slice(start, end), label:'comment'});
        }
      }
    });

    while (true) {
      const token = tokenizer.getToken();
      if (token.type.label === 'eof') break;
      entries.push({
        start:token.start,
        end:token.end,
        raw:source.slice(token.start, token.end),
        label:token.type.label
      });
    }

    entries.push(...comments);
    entries.sort((a, b) => a.start - b.start || a.end - b.end);

    let output = '';
    let previous = null;
    for (const entry of entries) {
      if (previous) {
        const gap = source.slice(previous.end, entry.start);
        // Keep every Acorn token lexically separate. A hand-maintained list of
        // punctuator combinations is not sufficient: concatenating two tokens
        // can change how the browser parses the result without causing a syntax
        // error. Collapse whitespace, but retain a line terminator where the
        // original source had one so automatic semicolon insertion is stable.
        const templateBoundary = previous.label === 'backQuote' ||
          previous.label === 'template' || entry.label === 'template';
        if (templateBoundary) output += gap;
        else if (/\r|\n/.test(gap)) output += '\n';
        else output += ' ';
      }
      output += entry.raw;
      previous = entry;
    }
    // Never emit a token-concatenated result unless the parser accepts it.
    // This catches ASI/separator edge cases and lets callers retain the original.
    acorn.parse(output, {...parseOptions, sourceType});
    return output;
  }

  async function minifyJavaScriptSource(source, options = {}) {
    const acorn = await loadAcorn(options.editorUrl);
    return minifyJavaScript(String(source), acorn);
  }

  function minifyCSS(source) {
    let output = '';
    let index = 0;
    let pendingSpace = false;

    while (index < source.length) {
      const character = source[index];

      if (character === '"' || character === "'") {
        if (pendingSpace && output && !/[{;,>]/.test(output[output.length - 1])) output += ' ';
        pendingSpace = false;
        const quote = character;
        output += character;
        index++;
        while (index < source.length) {
          const current = source[index++];
          output += current;
          if (current === '\\' && index < source.length) {
            output += source[index++];
          } else if (current === quote) {
            break;
          }
        }
        continue;
      }

      if (character === '/' && source[index + 1] === '*') {
        const end = source.indexOf('*/', index + 2);
        if (end < 0) {
          if (pendingSpace && output) output += ' ';
          output += source.slice(index);
          break;
        }
        const comment = source.slice(index, end + 2);
        if (comment.startsWith('/*!')) {
          if (pendingSpace && output && !/[{;,>]/.test(output[output.length - 1])) output += ' ';
          output += comment;
        } else {
          pendingSpace = true;
        }
        index = end + 2;
        continue;
      }

      if (/\s/.test(character)) {
        pendingSpace = true;
        index++;
        continue;
      }

      if (pendingSpace && output) {
        const previous = output[output.length - 1];
        const remove = /[{};,>]/.test(previous) || /[{};,>]/.test(character);
        if (!remove) output += ' ';
      }
      pendingSpace = false;
      output += character;
      index++;
    }

    return output.trim();
  }

  function findTagEnd(source, start) {
    let quote = '';
    for (let index = start; index < source.length; index++) {
      const character = source[index];
      if (quote) {
        if (character === quote) quote = '';
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === '>') {
        return index + 1;
      }
    }
    return -1;
  }

  function compactHTMLTag(tag) {
    let output = '';
    let quote = '';
    let pendingSpace = false;

    for (let index = 0; index < tag.length; index++) {
      const character = tag[index];

      if (quote) {
        output += character;
        if (character === quote) quote = '';
        else if (character === '\\' && index + 1 < tag.length) output += tag[++index];
        continue;
      }

      if (character === '"' || character === "'") {
        if (pendingSpace && output && !output.endsWith('=')) output += ' ';
        pendingSpace = false;
        quote = character;
        output += character;
      } else if (/\s/.test(character)) {
        pendingSpace = true;
      } else if (character === '=') {
        output = output.replace(/\s+$/, '') + '=';
        pendingSpace = false;
      } else if (character === '>') {
        output = output.replace(/\s+$/, '') + '>';
        pendingSpace = false;
      } else {
        if (pendingSpace && output && !output.endsWith('=')) output += ' ';
        pendingSpace = false;
        output += character;
      }
    }

    return output.replace(/\s+\/>/g, '/>');
  }

  function getScriptType(tag) {
    const match = tag.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    return String(match ? (match[1] ?? match[2] ?? match[3] ?? '') : '').trim().toLowerCase();
  }

  function minifyHTML(source, acorn, options = {}) {
    let output = '';
    let index = 0;

    while (index < source.length) {
      if (source.startsWith('<!--', index)) {
        const end = source.indexOf('-->', index + 4);
        if (end < 0) {
          output += source.slice(index);
          break;
        }
        const comment = source.slice(index, end + 3);
        if (options.scriptsOnly || /^<!--\s*(?:\[if\b|!|#)/i.test(comment)) output += comment;
        index = end + 3;
        continue;
      }

      if (source[index] !== '<') {
        const nextTag = source.indexOf('<', index);
        const end = nextTag < 0 ? source.length : nextTag;
        // Text-node whitespace can be significant under CSS white-space rules; preserve it exactly.
        output += source.slice(index, end);
        index = end;
        continue;
      }

      const tagEnd = findTagEnd(source, index);
      if (tagEnd < 0) {
        output += source.slice(index);
        break;
      }

      const rawTag = source.slice(index, tagEnd);
      const tag = options.scriptsOnly ? rawTag : compactHTMLTag(rawTag);
      output += tag;
      index = tagEnd;

      const nameMatch = tag.match(/^<\s*([a-z][\w:-]*)\b/i);
      if (!nameMatch || /^<\s*\//.test(tag) || /\/\s*>$/.test(tag)) continue;

      const tagName = nameMatch[1].toLowerCase();
      if (!['script', 'style', 'pre', 'textarea', 'xmp', 'plaintext'].includes(tagName)) continue;

      const closePattern = new RegExp('</\\s*' + tagName + '\\s*>', 'ig');
      closePattern.lastIndex = index;
      const closeMatch = closePattern.exec(source);
      if (!closeMatch) {
        output += source.slice(index);
        break;
      }

      const content = source.slice(index, closeMatch.index);
      let optimized = content;
      if (tagName === 'style' && !options.scriptsOnly) {
        optimized = minifyCSS(content);
      } else if (tagName === 'script') {
        const type = getScriptType(tag);
        const isJavaScript = !type || type === 'module' ||
          /^(?:text|application)\/(?:java|ecma)script(?:\s*;.*)?$/.test(type);
        const hasSrc = /\bsrc\s*=/i.test(tag);
        if (isJavaScript && !hasSrc) {
          try { optimized = minifyJavaScript(content, acorn); } catch (_) { optimized = content; }
        }
      }

      output += optimized;
      const closeEnd = findTagEnd(source, closeMatch.index);
      if (closeEnd < 0) {
        output += source.slice(closeMatch.index);
        break;
      }
      output += options.scriptsOnly ? source.slice(closeMatch.index, closeEnd) : compactHTMLTag(source.slice(closeMatch.index, closeEnd));
      index = closeEnd;
    }

    return output;
  }

  async function minifyInlineScripts(source, options = {}) {
    const acorn = await loadAcorn(options.editorUrl);
    return minifyHTML(String(source), acorn, {scriptsOnly:true});
  }
  function utf8Size(value) {
    return new TextEncoder().encode(value).byteLength;
  }

  function isMinifiablePath(path) {
    const lower = path.toLowerCase();
    if (/(?:^|\/)\.git(?:\/|$)/.test(lower)) return false;
    if (/\.(?:min|bundle)\.js$/.test(lower)) return false;
    if (/\.(?:js|mjs|cjs|css|html|htm)$/.test(lower)) return true;
    return false;
  }

  async function minifyArchive(archive, options = {}) {
    if (!global.JSZip?.loadAsync) throw new Error('JSZip is unavailable; the project archive cannot be minified.');
    const acorn = await loadAcorn(options.editorUrl);
    const zip = await global.JSZip.loadAsync(archive);
    const paths = Object.keys(zip.files).filter(path => {
      const entry = zip.files[path];
      return entry && !entry.dir && isMinifiablePath(path);
    });

    if (!paths.length) return {archive, filesMinified:0, filesSkipped:0, bytesSaved:0};

    let filesMinified = 0;
    let filesSkipped = 0;
    let bytesSaved = 0;

    for (let index = 0; index < paths.length; index++) {
      const path = paths[index];
      const entry = zip.files[path];
      try {
        const original = await zip.file(path).async('string');
        let optimized = original;
        const extension = path.toLowerCase().slice(path.lastIndexOf('.') + 1);
        if (extension === 'js' || extension === 'mjs' || extension === 'cjs') {
          optimized = minifyJavaScript(original, acorn);
        } else if (extension === 'css') {
          optimized = minifyCSS(original);
        } else {
          optimized = minifyHTML(original, acorn);
        }

        const before = utf8Size(original);
        const after = utf8Size(optimized);
        if (after < before) {
          const replacementOptions = {
            date:entry.date,
            createFolders:false,
            compression:'DEFLATE'
          };
          if (entry.unixPermissions != null) replacementOptions.unixPermissions = entry.unixPermissions;
          if (entry.dosPermissions != null) replacementOptions.dosPermissions = entry.dosPermissions;
          zip.file(path, optimized, replacementOptions);
          filesMinified++;
          bytesSaved += before - after;
        }
      } catch (error) {
        filesSkipped++;
        if (typeof options?.onFileError === 'function') options.onFileError(path, error);
      }

      progress(options, 'Minifying project files… ' + (index + 1) + '/' + paths.length);
    }

    if (!filesMinified) return {archive, filesMinified:0, filesSkipped, bytesSaved:0};
    const requestedLevel = Number(options.compressionLevel);
    const compressionLevel = Number.isFinite(requestedLevel)
      ? Math.max(1, Math.min(9, requestedLevel))
      : 9;
    const optimizedArchive = await zip.generateAsync({
      type:'blob',
      compression:'DEFLATE',
      compressionOptions:{level:compressionLevel}
    });
    return {archive:optimizedArchive, filesMinified, filesSkipped, bytesSaved};
  }

  global.StandaloneMinifier = Object.freeze({
    isEnabled:minificationEnabled,
    minifyJavaScriptSource,
    minifyInlineScripts,
    minifyArchive
  });
})(window);
