// fix adding scripts to DOM

(function() {
  // if (window.__pageEmulator) {

  //   let browserWindow = window.__trueWindow;
  //   while (browserWindow.parent !== browserWindow && !browserWindow.__pageRegistry) browserWindow = browserWindow.parent;

  //   if (!browserWindow.__pageRegistry) {
  //     return alert("Finding page emulator failed: no registry");
  //   }

  //   window.PageEmulator = browserWindow.PageEmulator;

  //   // These are exposed for the existing runtime interceptor / browser-side
  //   // integrations without moving the implementations back into PageEmulator.
  //   window.createDataUri = browserWindow.createDataUri;
  //   window.rewriteCSSURLs = browserWindow.rewriteCSSURLs;
  //   window.getFileNameFromURL = browserWindow.getFileNameFromURL;
  //   window.sandboxSource = browserWindow.sandboxSource;
  //   window.preprocessHtml = browserWindow.preprocessHtml;
  //   window.__pageRegistry = browserWindow.__pageRegistry;

  //   return;
  // }

  window.__pageRegistry = {};

  // I'm thinking we put stuff like preprocessHtml in here not inside the pageEmulator
  async function createDataUri(response) {
    if (!response) return null;
    try {
      const blob = await response.clone().blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (response.source_url && typeof cacheMap !== 'undefined') cacheMap[response.source_url] = reader.result;

          let defaultName = '';

          // 1. Try checking the Content-Disposition header first
          if (response.headers) {
            const disposition = response.headers.get('content-disposition');
            if (disposition && disposition.includes('filename=')) {
              const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
              const matches = filenameRegex.exec(disposition);
              if (matches && matches[1]) {
                defaultName = matches[1].replace(/['"]/g, '').trim();
              }
            }
          }

          // 2. Fall back to your URL extraction method if header parsing failed
          if (!defaultName && response.source_url) {
            defaultName = getFileNameFromURL(response.source_url,'');
          }

          if (defaultName) defaultName = "#f="+defaultName;

          resolve(reader.result+defaultName);
        }
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch(e) {
      if (window.logError) window.logError("DataURI conversion failed: " + e.message);
      return null;
    }
  };

  function getPageBaseUrl(page) {
    if (page && page.location && page.location.url === "about:srcdoc") {
      try {
        if (page.parent && page.parent !== false && page.parent.location && page.parent.location.url) return page.parent.location.url;
      } catch (e) {}
    }
    return page?.location?.url || "http://localhost:3000/";
  }

  const javascriptMimeTypes = new Set([
    "application/ecmascript", "application/javascript",
    "application/x-ecmascript", "application/x-javascript",
    "text/ecmascript", "text/javascript",
    "text/javascript1.0", "text/javascript1.1", "text/javascript1.2",
    "text/javascript1.3", "text/javascript1.4", "text/javascript1.5",
    "text/jscript", "text/livescript", "text/x-ecmascript", "text/x-javascript"
  ]);

  function isExecutableScriptElement(script) {
    const rawType = script?.getAttribute?.("type");
    if (rawType == null || !String(rawType).trim()) return true;
    const type = String(rawType).trim().toLowerCase();
    if (type === "module") return true;
    return javascriptMimeTypes.has(type.split(";", 1)[0].trim());
  }

  async function verifySubresourceIntegrity(response, metadata) {
    const tokens = String(metadata || "").trim().split(/\s+/).map(token => token.split("?", 1)[0]);
    const supported = tokens.map(token => {
      const match = /^(sha256|sha384|sha512)-([A-Za-z0-9+/]+={0,2})$/i.exec(token);
      return match ? { algorithm: match[1].toLowerCase(), digest: match[2].replace(/=+$/, "") } : null;
    }).filter(Boolean);

    if (!supported.length || !globalThis.crypto?.subtle) return false;

    const strength = { sha256: 1, sha384: 2, sha512: 3 };
    const strongest = Math.max(...supported.map(item => strength[item.algorithm]));
    const candidates = supported.filter(item => strength[item.algorithm] === strongest);
    let bytes;
    try {
      bytes = await response.clone().arrayBuffer();
    } catch (_) {
      return false;
    }

    for (const candidate of candidates) {
      try {
        const digest = await globalThis.crypto.subtle.digest(({ sha256: "SHA-256", sha384: "SHA-384", sha512: "SHA-512" })[candidate.algorithm], bytes);
        const actual = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/=+$/, "");
        if (actual === candidate.digest) return true;
      } catch (_) {}
    }
    return false;
  }

  function ensureSandBoxSameOrigin(iframe) {
    if (!iframe.hasAttribute('sandbox')) return;

    var tokens = iframe.getAttribute('sandbox').split(/\s+/).filter(Boolean);

    if (!tokens.includes('allow-same-origin')) {
      tokens.push('allow-same-origin');
      iframe.setAttribute('sandbox',tokens.join(' '));
    }
  }

  async function preprocessHtml(rawHtml, page, baseUrlOverride = null) {
    let pageUrl = baseUrlOverride || getPageBaseUrl(page);
    let dynamicBaseOrigin = (() => { try { return new URL(pageUrl).origin; } catch (_) { return page.location.origin; } })();

    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');

    const resolveUrl = (relUrl) => {
      try { return new URL(relUrl, pageUrl).href; } 
      catch (e) { return relUrl; }
    };

    const processSrcSet = async (el) => {
      return;

      const srcsetVal = el.getAttribute('srcset');
      if (!srcsetVal) return;

      // 1. Stateful parsing loop to safely isolate candidates without breaking data: URIs
      const candidates = [];
      let currentToken = "";
      let inUrl = true;

      for (let i = 0; i < srcsetVal.length; i++) {
        const char = srcsetVal[i];

        if (inUrl && /\s/.test(char)) {
          inUrl = false;
        }

        if (char === ',' && !inUrl) {
          candidates.push(currentToken.trim());
          currentToken = "";
          inUrl = true;
          continue;
        }

        currentToken += char;
      }

      if (currentToken.trim()) {
        candidates.push(currentToken.trim());
      }

      // 2. Process the safely parsed candidates
      const updatedCandidates = await Promise.all(candidates.map(async (candidate) => {
        const match = candidate.match(/^(\S+)\s*(.*)$/);
        if (!match) return candidate;

        const url = match[1];
        const descriptor = match[2];

        if (!url || url.startsWith('data:') || url.startsWith('blob:')) return candidate;

        try {
          const absoluteUrl = resolveUrl(url);
          const response = await page.network.request(absoluteUrl, dynamicBaseOrigin, {}, 'srcset');

          if (response && response.ok) {
            const dataUri = await createDataUri(response);
            return dataUri ? `${dataUri}${descriptor ? ' ' + descriptor : ''}` : candidate;
          }
        } catch (error) {
          console.error(`Failed to process srcset URL: ${url}`, error);
        }

        return candidate;
      }));

      el.setAttribute('srcset', updatedCandidates.join(', '));
    };

    const processElements = (selector, attr, rawAttr = 'data-raw-src', filter = f => f) => {
      const elements = Array.from(doc.querySelectorAll(selector));

      return elements.map(async (el) => {
        if (el.tagName === "SCRIPT" && !isExecutableScriptElement(el)) return;

        const originalUrl = el.getAttribute(attr);
        if (!originalUrl || originalUrl.startsWith('data:') || originalUrl.startsWith('blob:')) return;

        const absoluteUrl = resolveUrl(originalUrl);
        el.setAttribute(rawAttr, originalUrl);

        const response = await page.network.request(absoluteUrl, dynamicBaseOrigin, {}, selector);
        if (!response || !response.ok) return;

        const integrity = el.getAttribute("integrity");
        if (integrity) {
          const verified = await verifySubresourceIntegrity(response, integrity);
          el.setAttribute("data-raw-integrity", integrity);
          el.removeAttribute("integrity");

          if (!verified) {
            // Do not leave the original URL attached: that would let the native
            // document loader bypass the emulator after a failed verification.
            el.removeAttribute(attr);
            el.setAttribute("data-wk-integrity-error", "verification-failed");
            console.error("[Browser Emulator] Blocked resource with invalid subresource integrity:", absoluteUrl);
            return;
          }
        }

        const processedRes = await filter(response, absoluteUrl, originalUrl, el);

        if (!processedRes) return;

        const dataUri = await createDataUri(processedRes);

        if (dataUri) el.setAttribute(attr, dataUri);
      });
    };

    await Promise.all([
      processElements('script[src]', 'src', 'data-raw-src', async function(response, url, ourl, element) {
        let text = await response.clone().text();
        const isModule = element && element.getAttribute('type') === 'module';

        if (isModule) {
          element.removeAttribute('type');
          text = `window.__executeCodeModule(${JSON.stringify(text)}, ${JSON.stringify(ourl)});`;
        } else {
          // Standard synchronous execution
          text = `window.__executeCode(${JSON.stringify(text)}, ${JSON.stringify(ourl)});`;
        }

        return new Response(text, { headers: { 'Content-Type': 'application/javascript' } });
      }),

      processElements('link:not([rel="stylesheet"])[href]', 'href', 'data-raw-href'),

      processElements('link[rel="stylesheet"][href]', 'href', 'data-raw-href', async function(response, absoluteUrl) {
        let cssText = await response.text();
        cssText = await rewriteCSSURLs(cssText, page, absoluteUrl);
        return new Response(cssText, { headers: { 'Content-Type': 'text/css' } });
      }),

      processElements('img[src]', 'src'),
      processElements('video[src]', 'src'),
      processElements('video[poster]', 'poster', 'data-raw-poster'),
      processElements('audio[src]', 'src'),
      processElements('source[src]', 'src'),

      Promise.all(Array.from(doc.querySelectorAll('embed[src]')).map(async function(el) {
        var src = el.getAttribute('src');
        if (!src) return;
        // The parsed document is detached from the live browser document here.
        // Do not create/render the embed yet; the runtime setup below will do
        // that after the document has actually been installed in its iframe.
        el.setAttribute('data-raw-src',src);
        el.removeAttribute('src');
      })),

      Promise.all(Array.from(doc.querySelectorAll('iframe')).map(async function(el) {
        var src = el.getAttribute("src");
        var srcdoc = el.getAttribute("srcdoc");
        if (!src && !srcdoc) srcdoc = '<html><head></head><body></body></html>';
        el.removeAttribute("data-raw-src");
        el.removeAttribute("data-raw-srcdoc");
        if (src) el.setAttribute('data-raw-src',src);
        if (srcdoc !== null && srcdoc !== undefined) el.setAttribute('data-raw-srcdoc',srcdoc);
        el.removeAttribute("src");
        el.removeAttribute("srcdoc");
        el.__sandboxed = true;
        el.__iframeNavigationId = (el.__iframeNavigationId || 0) + 1;

        ensureSandBoxSameOrigin(el);

        page.sendEvent('iframe-create',{
          iframe: el,
          src: src,
          srcdoc: srcdoc,
          is_doc: !src,
        });

        await page.sendAsyncEvent('iframe-navigate',{
          iframe: el,
          src: src,
          srcdoc: srcdoc,
          is_doc: !src,
          navigationId: el.__iframeNavigationId,
        });

        return null;
      })),

      processElements('object[data]', 'data'),

      // Process all srcset instances across img and source elements
      Promise.all(Array.from(doc.querySelectorAll('[srcset]')).map(processSrcSet)),

      Array.from(doc.querySelectorAll('style')).map(async (styleEl) => {
        if (styleEl.textContent) {
          styleEl.setAttribute('data-raw-style-text', styleEl.textContent);
          styleEl.textContent = await rewriteCSSURLs(styleEl.textContent, page);
        }
      }),

      Array.from(doc.querySelectorAll('[style]')).map(async (el) => {
        const styleAttr = el.getAttribute('style');

        if (styleAttr && styleAttr.includes('url(')) {
          el.setAttribute('data-raw-style', styleAttr);
          const updatedStyle = await rewriteCSSURLs(styleAttr,page);
          el.setAttribute('style', updatedStyle);
        }
      })
    ].flat());

    // Handle inline script blocks and inline on* event attributes
    doc.querySelectorAll('*').forEach(node => {
      Array.from(node.attributes || []).forEach(attr => {
        if (attr.name.startsWith('on') && attr.value && !attr.value.includes('__executeCode')) {
          node.setAttribute('data-raw-' + attr.name, attr.value);
          node.setAttribute(attr.name, `return window.__executeCode(${JSON.stringify(attr.value)}, '<anonymous onevent>', this, typeof event !== 'undefined' ? event : undefined)`);
        }
      });
    });

    doc.querySelectorAll('script:not([src]):not([data-wk-device-emulation])').forEach(script => {
      if (!isExecutableScriptElement(script)) return;
      if (script.textContent && !script.textContent.includes('__executeCode')) {
        const rawScript = script.textContent;
        script.setAttribute('data-raw-script', rawScript);
        const isModule = script.getAttribute('type') === 'module';

        if (isModule) script.removeAttribute('type');

        const execFn = isModule ? '__executeCodeModule' : '__executeCode';

        script.textContent = `window.${execFn}(${JSON.stringify(rawScript)}, ${JSON.stringify(pageUrl)}, this);\n`;
      }
    });

    return doc.documentElement.outerHTML;
  }

  async function sandboxSource(rawHtml,page,processHtml = true, baseUrlOverride = null) {
    let processedHtml;

    if (processHtml) processedHtml = await preprocessHtml(rawHtml,page,baseUrlOverride);
    else processedHtml = rawHtml;

    const documentUrl = baseUrlOverride || page.location.url;
    const baseUrl = baseUrlOverride || getPageBaseUrl(page);
    const runtimeInterceptor = createRuntimeInterceptor(documentUrl, page.location.origin, undefined, baseUrl);

    let finalHtml = processedHtml;

    if (finalHtml.includes('<head>')) {
      finalHtml = finalHtml.replace('<head>',`<head><base href="${baseUrl}"><script>${runtimeInterceptor}<\/script>`);
    } else {
      finalHtml = runtimeInterceptor+finalHtml;
    }

    return finalHtml;
  }

  var acornParseOptions = {
    ecmaVersion: 'latest',
    allowReturnOutsideFunction: true,
    allowAwaitOutsideFunction: true
  };

  function parseCode(code, sourceType = 'script') {
    return acorn.parse(code, { ...acornParseOptions, sourceType });
  }

  function extractFunctionBody(funct) {
    const code = '('+funct.toString()+')();';

    const ast = parseCode(code, 'script');

    const node = ast.body[0].expression.callee;

    function codeSlice(blockNode) {
      const start = blockNode.start + 1;
      const end = blockNode.end - 1;
      return code.substring(start, end).trim();
    }

    // Case: function(){...}
    if (node.type === "FunctionDeclaration" ||
        node.type === "FunctionExpression") {
      return codeSlice(node.body);
    }

    // Case: expression statement wrapping a function
    if (node.type === "ExpressionStatement") {
      const expr = node.expression;

      // (function(){})
      if (expr.type === "FunctionExpression") {
        return codeSlice(expr.body);
      }

      // Arrow function
      if (expr.type === "ArrowFunctionExpression") {
        if (expr.body.type === "BlockStatement") {
          return codeSlice(expr.body);
        } else {
          // Expression body: () => x + 1
          return astring.generate(expr.body);
        }
      }
    }

    throw new Error("Unsupported function format");
  }

  function getPatternNames(pattern,names = []) {
    if (!pattern) return names;

    if (pattern.type === "Identifier") {
      if (!names.includes(pattern.name)) names.push(pattern.name);
    }
    else if (pattern.type === "AssignmentPattern") {
      getPatternNames(pattern.left,names);
    }
    else if (pattern.type === "RestElement") {
      getPatternNames(pattern.argument,names);
    }
    else if (pattern.type === "ObjectPattern") {
      for (const prop of pattern.properties) {
        if (prop.type === "RestElement") getPatternNames(prop.argument,names);
        else getPatternNames(prop.value,names);
      }
    }
    else if (pattern.type === "ArrayPattern") {
      for (const element of pattern.elements) {
        if (element) getPatternNames(element,names);
      }
    }

    return names;
  }

  function extractGlobals(ast) {
    const vars = new Set();
    const funcs = new Set();

    acorn.walk.simple(ast, {
      VariableDeclaration(node) {
        if (node.kind === "var") {
          for (const decl of node.declarations) {
            getPatternNames(decl.id).forEach(name => vars.add(name));
          }
        }
      },

      FunctionDeclaration(node) {
        if (node.id && node.id.name) {
          funcs.add(node.id.name);
        }
      },

      ClassDeclaration(node) {
        if (node.id && node.id.name) {
          vars.add(node.id.name);
        }
      }
    });

    return { vars, funcs };
  }

  function createGlobalLexicalDeclaration(kind,name) {
    return {
      type: "ExpressionStatement",
      expression: {
        type: "CallExpression",
        callee: {
          type: "Identifier",
          name: kind === "const" ? "__declareGlobalLexicalConstant" : "__declareGlobalLexicalVariable"
        },
        arguments: [{ type: "Literal", value: name, raw: JSON.stringify(name) }]
      }
    };
  }

  function createGlobalLexicalInitialization(name,initValueNode) {
    return {
      type: "ExpressionStatement",
      expression: {
        type: "AssignmentExpression",
        operator: "=",
        left: {
          type: "MemberExpression",
          object: { type: "Identifier", name: "__globalLexicalScope" },
          property: { type: "Identifier", name: name },
          computed: false
        },
        right: initValueNode || { type: "Identifier", name: "undefined" }
      }
    };
  }

  function transformPatternToTarget(pattern,targetName) {
    if (!pattern) return pattern;

    if (pattern.type === "Identifier") {
      return {
        type: "MemberExpression",
        object: { type: "Identifier", name: targetName },
        property: { type: "Identifier", name: pattern.name },
        computed: false
      };
    }

    if (pattern.type === "AssignmentPattern") {
      return {
        type: "AssignmentPattern",
        left: transformPatternToTarget(pattern.left,targetName),
        right: pattern.right
      };
    }

    if (pattern.type === "RestElement") {
      return {
        type: "RestElement",
        argument: transformPatternToTarget(pattern.argument,targetName)
      };
    }

    if (pattern.type === "ObjectPattern") {
      return {
        type: "ObjectPattern",
        properties: pattern.properties.map(prop => {
          if (prop.type === "RestElement") return transformPatternToTarget(prop,targetName);

          return {
            ...prop,
            value: transformPatternToTarget(prop.value,targetName),
            shorthand: false
          };
        })
      };
    }

    if (pattern.type === "ArrayPattern") {
      return {
        type: "ArrayPattern",
        elements: pattern.elements.map(element => element ? transformPatternToTarget(element,targetName) : null)
      };
    }

    return pattern;
  }

  // Use one native destructuring assignment so the initializer is evaluated exactly once.
  function createGlobalDestructuringAssignment(kind,decl) {
    const names = getPatternNames(decl.id);
    const body = [];
    const targetName = (kind === "let" || kind === "const") ? "__globalLexicalScope" : "window";

    if (kind === "let" || kind === "const") {
      names.forEach(name => body.push(createGlobalLexicalDeclaration(kind,name)));
    }

    body.push({
      type: "ExpressionStatement",
      expression: {
        type: "AssignmentExpression",
        operator: "=",
        left: transformPatternToTarget(decl.id,targetName),
        right: decl.init || { type: "Identifier", name: "undefined" }
      }
    });

    return body.length === 1 ? body[0] : { type: "BlockStatement", body };
  }

  function transformAST(ast) {
    acorn.walk.simple(ast, {
      CallExpression(node) {
        const callee = node.callee;

        // IIFE: (function(){})()
        if (callee.type === "FunctionExpression") {
          node.callee = {
            type: "MemberExpression",
            object: callee,
            property: { type: "Identifier", name: "call" },
            computed: false
          };

          node.arguments.unshift({ type: "Identifier", name: "__windowProxy" });
        }

        // Simple identifier call: foo()
        else if (callee.type === "Identifier" && callee.name !== "eval") {
          node.callee = {
            type: "MemberExpression",
            object: callee,
            property: { type: "Identifier", name: "call" },
            computed: false
          };

          node.arguments.unshift({ type: "Identifier", name: "__windowProxy" });
        }

        // Comma operator — (0, fn)()
        if (callee.type === "SequenceExpression") {
          const exprs = callee.expressions;
          const last = exprs[exprs.length - 1];

          // Only rewrite if last expression is callable
          if (last.type === "Identifier" || last.type === "MemberExpression") {
            node.callee = {
              type: "MemberExpression",
              object: last,
              property: { type: "Identifier", name: "call" },
              computed: false
            };

            node.arguments.unshift({ type: "Identifier", name: "__windowProxy" });
          }
        }
      }
    });

    const rootBody = ast.body;
    const newBody = [];
    const hoistedAssignments = [];

    for (const node of rootBody) {

      // 1. Keep Functions hoisted where they are, but queue a global assignment for the top
      if (node.type === "FunctionDeclaration") {
        if (node.id && node.id.name) {
          const name = node.id.name;

          // Queue assignment: window.foo = foo;
          hoistedAssignments.push(createGlobalAssignment(name, {
            type: "Identifier",
            name: name
          }));
        }

        newBody.push(node);
      }

      // 2. Rewrite global variables
      else if (node.type === "VariableDeclaration") {
        for (const decl of node.declarations) {
          if (decl.id.type === "Identifier") {
            if (node.kind === "let" || node.kind === "const") {
              newBody.push(createGlobalLexicalDeclaration(node.kind,decl.id.name));
              newBody.push(createGlobalLexicalInitialization(decl.id.name,decl.init));
            } else if (decl.init) {
              newBody.push(createGlobalAssignment(decl.id.name, decl.init));
            } else {
              newBody.push(createGlobalVarDeclaration(decl.id.name));
            }
          } else {
            newBody.push(createGlobalDestructuringAssignment(node.kind,decl));
          }
        }
      }

      // 3. Rewrite classes: class Foo {} -> window.Foo = class Foo {}
      else if (node.type === "ClassDeclaration") {
        if (node.id && node.id.name) {
          const name = node.id.name;

          node.type = "ClassExpression";

          newBody.push(createGlobalAssignment(name, node));
        }
      }

      // 4. Leave loops, expressions, statements alone
      else {
        newBody.push(node);
      }
    }

    // Prepend the assignments to the top of the script body
    ast.body = [...hoistedAssignments,...newBody];
  }

  // A global var declaration without an initializer must not overwrite an
  // existing global binding/property (for example repeated "var Namespace;"
  // declarations in AMD loaders).
  function createGlobalVarDeclaration(name) {
    return {
      type: "IfStatement",
      test: {
        type: "UnaryExpression",
        operator: "!",
        prefix: true,
        argument: {
          type: "BinaryExpression",
          operator: "in",
          left: { type: "Literal", value: name, raw: JSON.stringify(name) },
          right: { type: "Identifier", name: "window" }
        }
      },
      consequent: {
        type: "BlockStatement",
        body: [createGlobalAssignment(name, { type: "Identifier", name: "undefined" })]
      },
      alternate: null
    };
  }

  // Helper to generate AST nodes for: window[name] = value;
  function createGlobalAssignment(name,initValueNode) {
    return {
      type: "ExpressionStatement",
      expression: {
        type: "AssignmentExpression",
        operator: "=",
        left: {
          type: "MemberExpression",
          object: { type: "Identifier", name: "window" },
          property: { type: "Identifier", name: name },
          computed: false
        },
        right: initValueNode || { type: "Identifier", name: "undefined" }
      }
    };
  }

  function editCode(code) {
    // Allow passing a function directly
    if (typeof code === 'function') {
      code = extractFunctionBody(code);
    }

    if (typeof code !== 'string' || !code.trim()) {
      return { code, globals: { vars: [], funcs: [] } };
    }

    // Parse the code (function or raw)
    const ast = parseCode(code, 'script');

    // Transform AST
    transformAST(ast);

    // Regenerate code
    const transformed = astring.generate(ast);

    // Extract globals (var + function declarations)
    const globals = extractGlobals(ast);

    return { code: transformed, globals };
  }

  function editCodeAsync(codeObj) {
    var __codeString = codeObj.code;

    if (!__codeString || !__codeString.trim()) {
      return { code: '', globals: codeObj.globals };
    }

    try {
      const ast = parseCode(__codeString, 'script');

      const body = ast.body;

      if (body.length > 0) {
        const lastIndex = body.length - 1;
        const lastNode = body[lastIndex];

        // Change the last expression to evaluate and assign to __execResult
        if (lastNode.type === 'ExpressionStatement') {
          body[lastIndex] = {
            type: 'ExpressionStatement',
            start: lastNode.start,
            end: lastNode.end,
            expression: {
              type: 'AssignmentExpression',
              operator: '=',
              left: { type: 'Identifier', name: '__execResult' },
              right: lastNode.expression
            }
          };
        }
      }

      const transformedCode = astring.generate(ast);

      return {
        code: transformedCode,
        globals: codeObj.globals
      };
    } catch (err) {
      console.error("Failed to parse/transform code string via Acorn:", err);
      return {
        code: __codeString,
        globals: codeObj.globals
      };
    }
  }

  function editCodeModule(code) {
    // Allow passing a function directly
    if (typeof code === 'function') {
      code = extractFunctionBody(code);
    }

    if (!code || !code.trim()) {
      return code;
    }

    let ast;

    try {
      ast = parseCode(code, 'module');
    } catch (e) {
      console.error("Failed to parse module code via Acorn:", e);
      return code;
    }

    const newBody = [];
    
    ast.body.forEach(node => {
      // Process import.meta & dynamic import()
      transformNode(node);

      if (node.type === 'ImportDeclaration') {
        const sourceUrl = node.source.value;
        const specifiers = node.specifiers;
        
        if (specifiers.length === 0) {
          newBody.push(createSafeParserNode(`await __importModule("${sourceUrl}");`));
        } else {
          const props = specifiers.map(spec => {
            if (spec.type === 'ImportDefaultSpecifier') return 'default: ' + spec.local.name;
            if (spec.type === 'ImportNamespaceSpecifier') return spec.local.name;
            return `${spec.imported.name}: ${spec.local.name}`;
          }).join(', ');
          
          const isNamespace = specifiers[0].type === 'ImportNamespaceSpecifier';

          const decl = `const ${isNamespace ? props : `{ ${props} }`} = await __importModule("${sourceUrl}");`;

          newBody.push(createSafeParserNode(decl));
        }
      }

      else if (node.type === 'ExportDefaultDeclaration') {
        // export default function foo() {} OR export default 42;
        const declNode = node.declaration;
        
        if (declNode.type === 'FunctionDeclaration' || declNode.type === 'ClassDeclaration') {
          const name = declNode.id ? declNode.id.name : '__defaultExport';

          if (!declNode.id) {
            declNode.id = {
              type: 'Identifier',
              name
            };
          }
          
          // 1. Declare the function/class locally
          newBody.push(declNode);

          // 2. Export its reference
          newBody.push(createSafeParserNode(`__exportModule({ default: ${name} });`));
        } else {
          // Expressions like: export default 123 + 456;
          const exprCode = code.slice(declNode.start, declNode.end);

          newBody.push(createSafeParserNode(`__exportModule({ default: ${exprCode} });`));
        }
      }

      else if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          // export const a = 1; / export function foo() {} / export class Bar {}
          const decl = node.declaration;

          newBody.push(decl);

          if (decl.type === 'VariableDeclaration') {
            const names = decl.declarations.map(d => d.id.name);
            const exportCall = `__exportModule({ ${names.map(n => `${n}: ${n}`).join(', ')} });`;

            newBody.push(createSafeParserNode(exportCall));
          }

          else if (decl.type === 'FunctionDeclaration' || decl.type === 'ClassDeclaration') {
            const name = decl.id.name;
            const exportCall = `__exportModule({ ${name} });`;

            newBody.push(createSafeParserNode(exportCall));
          }
        }

        else if (node.specifiers && node.specifiers.length > 0) {
          if (node.source) {
            // export { a, b as c } from './exports.js'
            const sourceUrl = node.source.value;

            const proxyBlock = `const __tempExport = await __importModule("${sourceUrl}");\n__exportModule({ ${node.specifiers.map(s => `${s.exported.name}: __tempExport.${s.local.name}`).join(', ')} });`;

            newBody.push(createSafeParserNode(proxyBlock));
          } else {
            // export { subtract, divide as safeDivide };
            const specMappings = node.specifiers.map(s => `${s.exported.name}: ${s.local.name}`).join(', ');

            const exportCall = `__exportModule({ ${specMappings} });`;

            newBody.push(createSafeParserNode(exportCall));
          }
        }
      }

      else if (node.type === 'ExportAllDeclaration') {
        const sourceUrl = node.source.value;

        if (node.exported) {
          // export * as exportsNs from './exports.js'
          const nsName = node.exported.name;

          const exportNsCall = `const ${nsName} = await __importModule("${sourceUrl}");\n__exportModule({ ${nsName} });`;

          newBody.push(createSafeParserNode(exportNsCall));
        } else {
          // export * from './exports.js'
          const exportAllCall = `const __allExport = await __importModule("${sourceUrl}");\n__exportModule(__allExport);`;

          newBody.push(createSafeParserNode(exportAllCall));
        }
      }

      else {
        newBody.push(node);
      }
    });

    ast.body = newBody;

    return astring.generate(ast);
  }

  // Helper to safely parse strings into AST nodes with top-level await support
  function createSafeParserNode(codeSnippet) {
    try {
      const parsed = acorn.parse(codeSnippet, { 
        ecmaVersion: 'latest',
        allowAwaitOutsideFunction: true
      });

      return parsed.body.length === 1 ? parsed.body[0] : {
        type: 'BlockStatement',
        body: parsed.body
      };
    } catch (err) {
      console.error("Failed to parse snippet:", codeSnippet, err);
      throw err;
    }
  }

  // Recursive AST Node Transformer for dynamic import() and import.meta
  function transformNode(node) {
    if (!node || typeof node !== 'object') return node;

    if (node.type === 'ImportExpression') {
      node.type = 'CallExpression';
      node.callee = {
        type: 'Identifier',
        name: '__importModule'
      };
      node.arguments = [transformNode(node.source)];

      delete node.source;

      return node;
    }

    if (node.type === 'MetaProperty' &&
        node.meta &&
        node.meta.name === 'import' &&
        node.property &&
        node.property.name === 'meta') {

      return {
        type: 'MemberExpression',
        object: {
          type: 'Identifier',
          name: '__importModule'
        },
        property: {
          type: 'Identifier',
          name: 'meta'
        },
        computed: false,
        optional: false
      };
    }

    for (const key of Object.keys(node)) {
      if (['parent','start','end','loc'].includes(key)) continue;

      const child = node[key];

      if (Array.isArray(child)) {
        child.forEach((item,index) => {
          if (item && typeof item === 'object' && item.type) {
            child[index] = transformNode(item);
          }
        });
      }

      else if (child && typeof child === 'object' && child.type) {
        node[key] = transformNode(child);
      }
    }

    return node;
  }

  // Kept because the original implementation exposed this separately.
  function transformModuleAST(node) {
    if (!node || typeof node !== 'object') return node;

    // 1. Convert dynamic import(...) -> __importModule(...)
    if (node.type === 'ImportExpression') {
      node.type = 'CallExpression';
      node.callee = {
        type: 'Identifier',
        name: '__importModule'
      };
      node.arguments = [transformModuleAST(node.source)];

      delete node.source;

      return node;
    }

    // 2. Convert import.meta -> __importModule.meta
    if (node.type === 'MetaProperty' &&
        node.meta &&
        node.meta.name === 'import' &&
        node.property &&
        node.property.name === 'meta') {

      return {
        type: 'MemberExpression',
        object: {
          type: 'Identifier',
          name: '__importModule'
        },
        property: {
          type: 'Identifier',
          name: 'meta'
        },
        computed: false,
        optional: false
      };
    }

    // Recursively visit all object keys/children
    for (const key of Object.keys(node)) {
      if (['parent','start','end','loc'].includes(key)) continue;

      const child = node[key];

      if (Array.isArray(child)) {
        child.forEach((item,index) => {
          if (item && typeof item === 'object' && item.type) {
            child[index] = transformModuleAST(item);
          }
        });
      }

      else if (child && typeof child === 'object' && child.type) {
        node[key] = transformModuleAST(child);
      }
    }

    return node;
  }

  async function rewriteCSSURLs(cssText, baseUrl, baseOrigin, networkRequest, createDataUri) {
    // Support both the new page-based API and the old explicit API.
    if (typeof baseUrl === 'object' && baseUrl.network) {
      const page = baseUrl;
      // Linked stylesheets resolve url(...) against their own URL, not the
      // document URL. The optional third argument carries that original URL.
      const sourceUrl = typeof baseOrigin === 'string' && baseOrigin
        ? baseOrigin
        : getPageBaseUrl(page);
      baseOrigin = page.location.origin;
      baseUrl = sourceUrl;
      networkRequest = page.network.request.bind(page.network);
      createDataUri = createDataUri || window.createDataUri || window.__createDataUri || globalsCreateDataUri;
    }

    const urlRegex = /url\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi;
    const matches = Array.from(cssText.matchAll(urlRegex));
    if (matches.length === 0) return cssText;

    const urlMap = new Map();

    function decodeCSSDataUri(url) {
      const data = url.split('#')[0];
      const comma = data.indexOf(',');
      if (comma === -1) return null;

      const meta = data.slice(5, comma);
      const payload = data.slice(comma + 1);

      try {
        if (/;base64/i.test(meta)) {
          const binary = atob(payload);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          return new TextDecoder().decode(bytes);
        }
        return decodeURIComponent(payload);
      } catch (err) {
        console.error('Failed to decode CSS data URI:', err);
        return null;
      }
    }

    async function processCSS(css, cssUrl) {
      const rewritten = await rewriteCSSURLs(css, cssUrl, baseOrigin, networkRequest, createDataUri);
      const response = new Response(rewritten, { status: 200, headers: { 'Content-Type': 'text/css' } });
      response.source_url = cssUrl;
      return await createDataUri(response);
    }

    await Promise.all(matches.map(async (match) => {
      const rawUrl = match[2].trim();
      if (urlMap.has(rawUrl) || rawUrl.startsWith('blob:')) return;

      // Recursively process CSS embedded in a data:text/css URL.
      if (/^data:text\/css/i.test(rawUrl)) {
        try {
          const importedCSS = decodeCSSDataUri(rawUrl);
          if (importedCSS == null) return;

          const dataUri = await processCSS(importedCSS, baseUrl);
          if (dataUri) {
            const fragment = rawUrl.includes('#') ? rawUrl.slice(rawUrl.indexOf('#')) : '';
            urlMap.set(rawUrl, dataUri + (dataUri.includes('#') ? '' : fragment));
          }
        } catch (err) {
          console.error('Failed to process imported CSS:', err);
        }
        return;
      }

      if (rawUrl.startsWith('data:')) return;

      try {
        const resolvedUrl = new URL(rawUrl, baseUrl).href;
        const response = await networkRequest(resolvedUrl, baseOrigin, {}, 'css-url');
        if (!response || !response.ok) return;

        const contentType = response.headers.get('content-type') || '';
        const isCSS = contentType.toLowerCase().includes('text/css') || /\.css(?:[?#]|$)/i.test(resolvedUrl);

        let finalResponse = response;

        if (isCSS) {
          const importedCSS = await response.text();
          const rewrittenCSS = await rewriteCSSURLs(importedCSS, resolvedUrl, baseOrigin, networkRequest, createDataUri);
          finalResponse = new Response(rewrittenCSS, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
          finalResponse.source_url = response.source_url || resolvedUrl;
        }

        const dataUri = await createDataUri(finalResponse);
        if (dataUri) urlMap.set(rawUrl, dataUri);
      } catch (err) {
        console.error(`Failed to process CSS url(${rawUrl}):`, err);
      }
    }));

    return cssText.replace(urlRegex, (match, quote, rawUrl) => {
      const trimmed = rawUrl.trim();
      return urlMap.has(trimmed) ? `url("${urlMap.get(trimmed)}")` : match;
    });
  }

  function getFileNameFromURL(url, defaultName) {
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      const match = url.match(/#f=([^&#]+)/);
      defaultName = match ? decodeURIComponent(match[1]) : defaultName;
    } else {
      defaultName = new URL(url).pathname.split('/').filter(Boolean).pop() || defaultName;
    }

    return defaultName;
  }

  // Kept only so the page-based rewriteCSSURLs overload can resolve
  // the helper without changing createRuntimeInterceptor.
  var globalsCreateDataUri = createDataUri;

  var usefulHelpers = {
    createDataUri,
    editCode,
    editCodeAsync,
    editCodeModule,
    extractFunctionBody,
    extractGlobals,
    transformAST,
    transformModuleAST,
    createGlobalAssignment,
    createSafeParserNode,
    transformNode,
    rewriteCSSURLs,
    getFileNameFromURL,
    sandboxSource,
    ensureSandBoxSameOrigin,
    preprocessHtml,
    createRuntimeInterceptor,
  };

  __pageRegistry.__usefulHelpers = usefulHelpers;

  /*
   * createRuntimeInterceptor intentionally left as-is.
   */
  function createRuntimeInterceptor(source_url, source_origin, name = "about:srcdoc", base_url) {
    var interceptorFunction = function(BASE_ORIGIN, CURRENT_PAGE_URL, DOCUMENT_URL) { 
      DOCUMENT_URL = DOCUMENT_URL || CURRENT_PAGE_URL;
      if (window.__windowProxy) return;

      const frameElement = window.frameElement;
      if (!frameElement) {
        window.__executeCode = window.eval.bind(window);
        console.error("Finding page emulator failed: no frame element");
        return;
      }

      if (!frameElement.pageEmulator) {
        const id = frameElement.getAttribute('data-page-id');
        let browserWindow = window;
        while (browserWindow.parent !== browserWindow && !browserWindow.__pageRegistry) browserWindow = browserWindow.parent;

        const registry = browserWindow.__pageRegistry;
        if (!registry) {
          window.__executeCode = window.eval.bind(window);
          console.error("Finding page emulator failed: no registry");
          return;
        }

        let registeredPage = id ? registry[id] : null;
        if (!registeredPage) {
          registeredPage = Object.values(registry).find(candidate => candidate?.iframe === frameElement) || null;
        }

        if (!registeredPage) {
          window.__executeCode = window.eval.bind(window);
          console.error(id
            ? "Finding page emulator failed: page id is not registered (" + id + ")"
            : "Finding page emulator failed: no id or matching registered frame");
          return;
        }

        if (registeredPage.id && id !== registeredPage.id) {
          frameElement.setAttribute('data-page-id',registeredPage.id);
        }
        registeredPage.iframe = frameElement;
        frameElement.pageEmulator = registeredPage;
        frameElement.usefulHelpers = registry.__usefulHelpers;
      }

      window.__frameElement = frameElement;
      window.__pageEmulator = frameElement.pageEmulator;
      window.__usefulHelpers = frameElement.usefulHelpers;
      // Shared by interceptor setup and the later runtime hooks below. Keep
      // these outside the setup IIFE so functions such as __executeCode and
      // dynamic-node processing can resolve them through the same closure.
      const isTurboWarpPlayUrl = value => { try { return new URL(value, BASE_ORIGIN).pathname === '/turbowarp/play'; } catch (_) { return false; } };

      window.__runSyncInterceptor = function(__elem,__elemWindow) {
        if (!__elemWindow) return;
        var __childPage = __elemWindow.__pageEmulator || __elem.pageEmulator || null;
        var __getCallerProxy = window.__pageEmulator?.__getCallerWindowProxy;
        if (__elemWindow.__windowProxy) {
          return __childPage && typeof __getCallerProxy === 'function'
            ? __getCallerProxy(__childPage, __elemWindow)
            : __elemWindow.__windowProxy;
        }
        var PATH_URL = new URL(__elem.getAttribute('src') || "about:srcdoc", BASE_ORIGIN);
        var __baseUrl = PATH_URL.href;
        try {
          if (/^about:srcdoc$/i.test(PATH_URL.href) && __childPage?.parent?.location?.url) __baseUrl = __childPage.parent.location.url;
        } catch (e) {}
        var __interceptorCode = window.__usefulHelpers.createRuntimeInterceptor(PATH_URL.href, BASE_ORIGIN, undefined, __baseUrl);
        var __childProxy = (function(window, document){
          with (window) {
            eval(__interceptorCode);
          }
          return window.__windowProxy;
        })(__elemWindow, __elemWindow.document);
        __getCallerProxy = window.__pageEmulator?.__getCallerWindowProxy;
        return __childPage && typeof __getCallerProxy === 'function'
          ? __getCallerProxy(__childPage, __elemWindow)
          : __childProxy;
      };

      // Module Registry
      window.__moduleRegistry = new Map();

      // Persistent global lexical environment for classic scripts.
      var __globalLexicalScope = Object.create(null);
      function __declareGlobalLexicalConstant(name) {
        if (Object.prototype.hasOwnProperty.call(__globalLexicalScope,name)) {
          throw new SyntaxError(`Identifier '${name}' has already been declared`);
        }

        var initialized = false;
        var value;
        Object.defineProperty(__globalLexicalScope,name,{
          enumerable: false,
          configurable: false,
          get: function() { return value; },
          set: function(nextValue) {
            if (initialized) throw new TypeError("Assignment to constant variable.");
            value = nextValue;
            initialized = true;
          }
        });
      }

      function __declareGlobalLexicalVariable(name) {
        if (Object.prototype.hasOwnProperty.call(__globalLexicalScope,name)) {
          throw new SyntaxError(`Identifier '${name}' has already been declared`);
        }

        var value;
        Object.defineProperty(__globalLexicalScope,name,{
          enumerable: false,
          configurable: false,
          get: function() { return value; },
          set: function(nextValue) { value = nextValue; }
        });
      }

      function __getScriptFileName(__scriptFileName) {
        try {__scriptFileName = __scriptFileName || new URL(document.currentScript.getAttribute('data-raw-src'),BASE_ORIGIN).href;} catch(e) {__scriptFileName = DOCUMENT_URL;};
        return __scriptFileName;
      }
      function __createModuleControls(__scriptFileName) {
        var __importModule = async function(url) {
          const parentUrl = __scriptFileName;
          const resolvedUrl = new URL(url, parentUrl).href;
          
          if (window.__moduleRegistry.has(resolvedUrl)) {
            return window.__moduleRegistry.get(resolvedUrl);
          }

          const res = await window.__pageEmulator.network.request(resolvedUrl, BASE_ORIGIN, {}, 'import');
          if (!res || !res.ok) throw new Error(`Cannot import module: ${resolvedUrl}`);
          
          let sourceCode = await res.text();
          
          var __currentModuleExports = {};
          
          try {
            __currentModuleExports = await window.__executeCodeModule(sourceCode, resolvedUrl, window.__windowProxy, undefined, resolvedUrl);
          } catch(e) {}
          
          const finalizedExports = { ...__currentModuleExports };
          window.__moduleRegistry.set(resolvedUrl, finalizedExports);
          
          return finalizedExports;
        };
        __importModule.meta = new Proxy({}, {
          get(target, prop) {
            const currentUrl = __scriptFileName;
            if (prop === 'url') return currentUrl;
            if (prop === 'resolve') return (specifier) => new URL(specifier, currentUrl).href;
            return undefined;
          }
        });
        var __currentModuleExports = {};
        var __exportModule = function(exports) {
          Object.assign(__currentModuleExports, exports);
        };

        return { __importModule, __exportModule, __currentModuleExports };
      }
      
      // do code later
      (function() { 
        
        const parentWindow = window.parent;
        const pageEmulator = window.__pageEmulator;
        const usefulHelpers = window.__usefulHelpers;
        
        const isTopLevel = !pageEmulator.parent;
        
        // setInterval(function(){
        //   const iframes = document.querySelectorAll('iframe');
        //   for (const iframe of iframes) {
        //     try {
        //       return !iframe.contentWindow.location.href;
        //     } catch (error) {
        //       iframe.src = "";
        //       iframe.srcdoc = "";
        //       console.log("Blocked Frame: ",iframe);
        //       return true;
        //     }
        //   }
        //   return null;
        // },100);

        const sendEvent = pageEmulator.sendEvent.bind(pageEmulator);
        const sendAsyncEvent = pageEmulator.sendAsyncEvent.bind(pageEmulator);
        const createDataUri = usefulHelpers.createDataUri;

        window.sendEvent = sendEvent;

        // The direct /turbowarp/play export expects to be hosted by the
        // /turbowarp wrapper, which normally answers its "ready" message with
        // a "turbowarp:init" payload. When /turbowarp/play is embedded directly
        // in an arbitrary page, there is no such host and its project loader
        // remains pending forever. Emulate the small host bridge for that
        // specific route, but leave the real /turbowarp wrapper in control.
        window.addEventListener('message', function(event) {
          const data = event.data;
          if (!data || (data.turbowarp !== 'ready' && data.turbowarp !== 'storage')) return;

          let matchedChildWindow = null;
          const childPage = (pageEmulator.children || []).find(child => {
            const iframe = child?.iframe;
            if (!iframe || !event.source) {
              return false;
            }
            let nativeWindow = iframe.__wkNativeContentWindow || null;
            const hadCachedWindow = !!nativeWindow;
            if (!nativeWindow) {
              try {
                const getter = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow')?.get;
                if (getter) nativeWindow = Reflect.apply(getter, iframe, []);
                if (nativeWindow) {
                  try { Object.defineProperty(iframe, '__wkNativeContentWindow', { value: nativeWindow, writable: true, configurable: true }); } catch (_) {}
                }
              } catch (_) {}
            }
            const callerWindow = nativeWindow ? getCallerWindowProxy(child, nativeWindow) : null;
            const matchesNative = event.source === nativeWindow;
            const matchesProxy = event.source === child.__windowProxy;
            const matchesCallerProxy = event.source === callerWindow;
            const matched = matchesNative || matchesProxy || matchesCallerProxy;
            let childPath = '';
            try { childPath = new URL(child.location?.url || '').pathname; } catch (_) {}
            if (matched) { matchedChildWindow = nativeWindow; return true; }
            return false;
          });
          if (!childPage) return;

          let childUrl;
          let parentUrl;
          try {
            childUrl = new URL(childPage.location?.url || '');
            parentUrl = new URL(CURRENT_PAGE_URL);
          } catch (_) {
            return;
          }

          if (childUrl.pathname !== '/turbowarp/play') return;
          if (parentUrl.pathname === '/turbowarp') return;
          const projectId = childUrl.searchParams.get('u');
          if (!projectId) return;
          const storagePrefix = 'turbowarp:' + projectId + ':';
          const storage = window.localStorage;

          if (data.turbowarp === 'ready') {
            const snapshot = {};
            try {
              for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key && key.startsWith(storagePrefix)) {
                  snapshot[key.slice(storagePrefix.length)] = storage.getItem(key);
                }
              }
            } catch (_) {}

            try {
              const targetWindow = matchedChildWindow || childPage.iframe?.__wkNativeContentWindow;
              if (targetWindow && typeof targetWindow.postMessage === 'function') {
                targetWindow.postMessage({ turbowarp: 'init', userid: null, storage: snapshot }, '*');
              }
            } catch (_) {}
            return;
          }

          // Match the storage bridge provided by /turbowarp's normal host page.
          try {
            if (data.op === 'set') {
              storage.setItem(storagePrefix + String(data.key), String(data.value));
            } else if (data.op === 'remove') {
              storage.removeItem(storagePrefix + String(data.key));
            } else if (data.op === 'clear') {
              const keys = [];
              for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key && key.startsWith(storagePrefix)) keys.push(key);
              }
              keys.forEach(key => storage.removeItem(key));
            }
          } catch (_) {}
        });

        // - Srcset candidate URL resolution helper ---
        function parseSrcSet(srcsetVal) {
          const candidates = [];
          let currentToken = "";
          let inUrl = true;
          for (let i = 0; i < srcsetVal.length; i++) {
            const char = srcsetVal[i];
            if (inUrl && /\s/.test(char)) {
              inUrl = false;
            }
            if (char === ',' && !inUrl) {
              candidates.push(currentToken.trim());
              currentToken = "";
              inUrl = true;
              continue;
            }
            currentToken += char;
          }
          if (currentToken.trim()) {
            candidates.push(currentToken.trim());
          }
          return candidates.map(candidate => {
            const matches = candidate.match(/^(\S+)\s*(.*)$/);
            if (!matches) return { url: candidate, descriptor: '', full: candidate }
            return { url: matches[1], descriptor: matches[2] }
          });
        }
        async function interceptSrcSet(el) {
          const srcsetVal = el.getAttribute('srcset');
          if (!srcsetVal) return;

          // Use the stateful parser to perfectly extract candidates without breaking data: URIs
          const candidates = parseSrcSet(srcsetVal);
          
          const updated = await Promise.all(candidates.map(async (candidate) => {
            // Safely isolate the URL token from descriptors
            const { url, descriptor } = candidate;

            // This safely catches data: and blob: urls and skips reprocessing them
            if (!url || url.startsWith('data:') || url.startsWith('blob:')) return candidate.full;

            try {
              const resolvedUrl = new URL(url, CURRENT_PAGE_URL).href;
              const response = await pageEmulator.network.request(resolvedUrl, BASE_ORIGIN, {}, 'srcset');
              if (response && response.ok) {
                const uri = await createDataUri(response);
                return uri ? `${uri}${descriptor ? ' ' + descriptor : ''}` : candidate.full;
              }
            } catch (e) {
              console.error(`Failed to process: ${url}`, e);
            }
            return candidate.full;
          }));

          el.setAttribute('srcset', updated.join(', '));
          el.setAttribute('data-raw-srcset', srcsetVal);
        }


        const javascriptMimeTypes = new Set([
          "application/ecmascript", "application/javascript",
          "application/x-ecmascript", "application/x-javascript",
          "text/ecmascript", "text/javascript",
          "text/javascript1.0", "text/javascript1.1", "text/javascript1.2",
          "text/javascript1.3", "text/javascript1.4", "text/javascript1.5",
          "text/jscript", "text/livescript", "text/x-ecmascript", "text/x-javascript"
        ]);

        function isExecutableScriptElement(script) {
          const rawType = script?.getAttribute?.("type");
          if (rawType == null || !String(rawType).trim()) return true;
          const type = String(rawType).trim().toLowerCase();
          if (type === "module") return true;
          return javascriptMimeTypes.has(type.split(";", 1)[0].trim());
        }

        async function verifySubresourceIntegrity(response, metadata) {
          const tokens = String(metadata || "").trim().split(/\s+/).map(token => token.split("?", 1)[0]);
          const supported = tokens.map(token => {
            const match = /^(sha256|sha384|sha512)-([A-Za-z0-9+/]+={0,2})$/i.exec(token);
            return match ? { algorithm: match[1].toLowerCase(), digest: match[2].replace(/=+$/, "") } : null;
          }).filter(Boolean);

          if (!supported.length || !window.crypto?.subtle) return false;

          const strength = { sha256: 1, sha384: 2, sha512: 3 };
          const strongest = Math.max(...supported.map(item => strength[item.algorithm]));
          const candidates = supported.filter(item => strength[item.algorithm] === strongest);
          let bytes;
          try {
            bytes = await response.clone().arrayBuffer();
          } catch (_) {
            return false;
          }

          for (const candidate of candidates) {
            try {
              const digest = await window.crypto.subtle.digest(({ sha256: "SHA-256", sha384: "SHA-384", sha512: "SHA-512" })[candidate.algorithm], bytes);
              const actual = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/=+$/, "");
              if (actual === candidate.digest) return true;
            } catch (_) {}
          }
          return false;
        }

        // --- Dynamic Inline On* Handler Rewriter ---
        function patchInlineEvents(node) {
          if (node.nodeType !== Node.ELEMENT_NODE) return;

          Array.from(node.attributes || []).forEach(attr => {
            if (attr.name.startsWith('on') && attr.value && !attr.value.includes('__executeCode')) {
              const rawCode = attr.value;
              if (!node.hasAttribute('data-raw-' + attr.name)) node.setAttribute('data-raw-' + attr.name, rawCode);
              // Override attribute value to dispatch through sandboxed executor
              node.setAttribute(
                attr.name, 
                `return window.__executeCode(${JSON.stringify(rawCode)}, '<anonymous onevent>', this, typeof event !== 'undefined' ? event : undefined)`
              );
            }
          });
        }

        // --- Nested Frame / Embed Interception ---
        async function setupEmbed(el) {
          if (el.__sandboxed) return;
          if (el.tagName.toLowerCase() !== 'embed') return;

          el.__sandboxed = true;
          el.__embedNavigationId = (el.__embedNavigationId || 0) + 1;
          var navigationId = el.__embedNavigationId;
          var src = el.getAttribute('data-raw-src') || el.getAttribute('src');
          if (!src) return;

          el.setAttribute('data-raw-src',src);
          el.removeAttribute('src');

          sendEvent('embed-create',{embed: el});
          await sendAsyncEvent('embed-navigate',{
            embed: el,
            src: src,
            navigationId: navigationId,
          });
        }

        async function setupNestedFrame(el) {
          if (el.__sandboxed) return;
          if (el.tagName.toLowerCase() !== 'iframe') return;

          usefulHelpers.ensureSandBoxSameOrigin(el);

          el.__sandboxed = true;
          el.__iframeNavigationId = (el.__iframeNavigationId || 0) + 1;
          var navigationId = el.__iframeNavigationId;

          if (!el.pageEmulator) {
            const pageId = el.getAttribute('data-page-id');
            const knownPage = pageId ? pageEmulator.__pageRegistry[pageId] : null;

            if (knownPage) {
              knownPage.iframe = el;
              el.pageEmulator = knownPage;
              el.usefulHelpers = pageEmulator.__pageRegistry.__usefulHelpers;

              if (knownPage.tab) {
                knownPage.tab.iframe = el;
                knownPage.tab.frameElement = el;
              }

              // Notify the browser shell that the frame's DOM element changed.
              // The existing iframe-create handler recognizes the page id and
              // rebinds DevTools without creating a duplicate emulator.
              sendEvent('iframe-create',{iframe:el,reattached:true});
            } else {
              sendEvent('iframe-create',{
                iframe: el,
              });
            }
          }

          var hasSrcDoc = el.hasAttribute('data-raw-srcdoc') || el.hasAttribute('srcdoc');
          var hasRawSrc = el.hasAttribute('data-raw-src') || el.hasAttribute('src');

          var srcdoc = hasSrcDoc ? (el.getAttribute('srcdoc') ?? el.getAttribute('data-raw-srcdoc')) : null;
          var src = hasRawSrc ? (el.getAttribute('data-raw-src') ?? el.getAttribute('src')) : null;

          if (hasSrcDoc) {
            el.removeAttribute("srcdoc");
            el.removeAttribute("src");
          } else if (hasRawSrc) {
            el.removeAttribute("src");
          } else {
            el.removeAttribute("src");
            el.removeAttribute("srcdoc");
            srcdoc = `<html><head></head><body></body></html>`;
          }

          await sendAsyncEvent('iframe-navigate',{
            iframe: el,
            src: src,
            srcdoc: srcdoc,
            is_doc: !src,
            navigationId: navigationId,
          });

          return null;
        }// else if (frameEl.tagName.toLowerCase() === 'embed') {
          //   const rawSrc = frameEl.getAttribute('src') || frameEl.getAttribute('data-raw-src');
          //   if (!rawSrc) return;
          //   const res = await pageEmulator.network.request(targetUrl, BASE_ORIGIN, {}, 'embed');
          //   if (res && res.ok) {
          //     const content = await res.text();
          //     const blob = new Blob([frameScript + content], { type: 'text/html' });
          //     frameEl.setAttribute('src', URL.createObjectURL(blob));
          //     frameEl.setAttribute('data-raw-src', rawSrc);
          //   }
          // }

        // Target rules for dynamic element checks
        const ATTRIBUTE_MAP = [
          { selector: 'img[src]', attr: 'src' },
          { selector: 'script[src]', attr: 'src' },
          { selector: 'link:not([rel="stylesheet"])[href]', attr: 'href', rawAttr: 'data-raw-href'},
          { selector: 'link[rel="stylesheet"][href]', attr: 'href', rawAttr: 'data-raw-href', 
            filter: async function(response, absoluteUrl) {
              let cssText = await response.text();
              cssText = await rewriteCSSURLs(cssText, pageEmulator, absoluteUrl);
              return new Response(cssText, { headers: { 'Content-Type': 'text/css' } });
            }
          },
          { selector: 'video[src]', attr: 'src' },
          { selector: 'video[poster]', attr: 'poster', rawAttr: 'data-raw-poster' },
          { selector: 'audio[src]', attr: 'src' },
          { selector: 'source[src]', attr: 'src' },
          { selector: 'object[data]', attr: 'data' }
        ];

        async function interceptElementAttribute(el, attr, rawAttr = 'data-raw-src', filter = f => f) {
          if (el.tagName === "SCRIPT" && !isExecutableScriptElement(el)) return;
          const val = el.getAttribute(attr);
          if (!val || val.startsWith('data:') || val.startsWith('blob:')) return;

          if (!el.hasAttribute(rawAttr)) {
            const resolvedUrl = new URL(val, CURRENT_PAGE_URL).href;
            el.setAttribute(rawAttr, resolvedUrl);

            const response = await pageEmulator.network.request(resolvedUrl, BASE_ORIGIN, {}, el.tagName);
            if (response && response.ok) {
              const integrity = el.getAttribute("integrity");
              if (integrity) {
                const verified = await verifySubresourceIntegrity(response, integrity);
                el.setAttribute("data-raw-integrity", integrity);
                Element.prototype.removeAttribute.call(el, "integrity");

                if (!verified) {
                  el.removeAttribute(attr);
                  el.setAttribute("data-wk-integrity-error", "verification-failed");
                  console.error("[Browser Emulator] Blocked dynamically inserted resource with invalid subresource integrity:", resolvedUrl);
                  return;
                }
              }

              const processedRes = await filter(response, resolvedUrl, BASE_ORIGIN, el);
              if (processedRes) {
                const dataUri = await createDataUri(processedRes);
                if (dataUri) {
                  el.setAttribute(attr, dataUri);
                  // The wrapped setAttribute stores its input in data-raw-src;
                  // restore the original URL after assigning the internal data URL.
                  el.setAttribute(rawAttr, resolvedUrl);
                }
              }
            }
          }
        }

        // Rewrite dynamic inline scripts before inserting them into the live DOM.
        // Native browsers execute classic inline scripts during appendChild /
        // insertBefore / replaceChild, before MutationObserver callbacks run.
        function prepareInlineScript(node) {
          if (!node || node.nodeType !== Node.ELEMENT_NODE || node.tagName !== 'SCRIPT') return;
          if (!isExecutableScriptElement(node)) return;
          if (node.getAttribute('src') || !node.textContent || node.hasAttribute('data-raw-script')) return;
          if (node.textContent.includes('__executeCode')) return;

          const rawScript = node.textContent;
          node.setAttribute('data-raw-script', rawScript);

          const isModule = node.getAttribute('type') === 'module';
          if (isModule) node.removeAttribute('type');

          const execFn = isModule ? '__executeCodeModule' : '__executeCode';
          node.textContent = `window.${execFn}(${JSON.stringify(rawScript)}, ${JSON.stringify(CURRENT_PAGE_URL)}, this);\n`;
        }

        function prepareInsertedScripts(node) {
          if (!node) return;
          prepareInlineScript(node);
          if (typeof node.querySelectorAll === 'function') {
            node.querySelectorAll('script').forEach(prepareInlineScript);
          }
        }

        // Intercept native insertion synchronously. Preserve native method
        // receivers, arguments, return values, and exceptions.
        const applyNodeMethod = Reflect.apply;
        const nativeAppendChild = Node.prototype.appendChild;
        const nativeInsertBefore = Node.prototype.insertBefore;
        const nativeReplaceChild = Node.prototype.replaceChild;

        Node.prototype.appendChild = function(node) {
          prepareInsertedScripts(node);
          return applyNodeMethod(nativeAppendChild, this, [node]);
        };

        Node.prototype.insertBefore = function(node, referenceNode) {
          prepareInsertedScripts(node);
          return applyNodeMethod(nativeInsertBefore, this, [node, referenceNode]);
        };

        Node.prototype.replaceChild = function(newNode, oldNode) {
          prepareInsertedScripts(newNode);
          return applyNodeMethod(nativeReplaceChild, this, [newNode, oldNode]);
        };

        function checkNodeAndChildren(node) {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          if (node.__editingAttribute) return;
          node.__editingAttribute = true;

          // 1. Rewrite dynamic event handlers and inline scripts
          patchInlineEvents(node);
          prepareInlineScript(node);

          // 2. Process inline styles and <style> tags
          processStyleNode(node);
          processInlineStyleAttr(node);

          // 3. Process nested frames & embeds
          if (node.matches('iframe, embed')) {
            setupNestedFrame(node);
          }
          node.querySelectorAll('iframe').forEach(setupNestedFrame);
          node.querySelectorAll('embed').forEach(setupEmbed);

          // 4. Process srcset candidates
          if (node.matches('[srcset]')) interceptSrcSet(node);
          node.querySelectorAll('[srcset]').forEach(interceptSrcSet);

          // 5. Process standard attributes
          ATTRIBUTE_MAP.forEach(({ selector, attr, rawAttr, filter }) => {
            if (node.matches(selector)) {
              interceptElementAttribute(node, attr, rawAttr, filter);
            }
            node.querySelectorAll(selector).forEach(child => {
              interceptElementAttribute(child, attr, rawAttr, filter);
            });
          });
          node.__editingAttribute = false;
        }

        // Keep the dynamic-node processor available to the Element prototype
        // setters below without relying on a later lexical reference.
        window.__checkNodeAndChildren = checkNodeAndChildren;

        function processStyleNode(node) {
          if (node.tagName && node.tagName.toLowerCase() === 'style' && node.textContent.includes('url(')) {
            if (!node.hasAttribute('data-raw-style-text')) node.setAttribute('data-raw-style-text', node.textContent);
            usefulHelpers.rewriteCSSURLs(node.textContent, pageEmulator)
              .then(newCss => { node.textContent = newCss; });
          }
          if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('style')) {
            processInlineStyleAttr(node);
          }
        }

        function processInlineStyleAttr(el) {
          const styleAttr = el.getAttribute('style');
          if (styleAttr && styleAttr.includes('url(') && !el.__processing_style) {
            if (!el.hasAttribute('data-raw-style')) el.setAttribute('data-raw-style', styleAttr);
            el.__processing_style = true;
            usefulHelpers.rewriteCSSURLs(styleAttr, pageEmulator)
              .then(newStyle => {
                el.setAttribute('style', newStyle);
              })
              .finally(() => { el.__processing_style = false; });
          }
        }

        // --- Enhanced MutationObserver ---
        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === 'childList') {
              mutation.addedNodes.forEach(node => {
                checkNodeAndChildren(node);
                if (node.nodeType === Node.ELEMENT_NODE) {
                  node.querySelectorAll('*').forEach(child => checkNodeAndChildren(child));
                }
              });

              // Removed frames must release their child PageEmulators. Otherwise
              // DevTools keeps stale frame records after DOM replacement/navigation.
              mutation.removedNodes.forEach(node => {
                if (node.nodeType !== Node.ELEMENT_NODE) return;
                const removedFrames = [];
                if (node.matches('iframe')) removedFrames.push(node);
                node.querySelectorAll('iframe').forEach(frame => removedFrames.push(frame));
                removedFrames.forEach(frame => {
                  if (!frame.isConnected) sendEvent('iframe-remove', { iframe: frame });
                });
              });
            } else if (mutation.type === 'attributes') {
              const el = mutation.target;
              const attrName = mutation.attributeName;

              if (el.__editingAttribute) continue;
              el.__editingAttribute = true;
              if (attrName.startsWith('data-raw')) continue;

              // Detect dynamically set or modified inline event listeners (e.g. el.setAttribute('onclick', ...))
              if (attrName.startsWith('on')) {
                patchInlineEvents(el);
                continue;
              }

              // if (attrName === 'srcset') {
              //   interceptSrcSet(el);
              //   continue;
              // }

              if (mutation.attributeName === 'style') {
                processInlineStyleAttr(mutation.target);
                el.__editingAttribute = false;
                continue;
              }

              if (el.tagName && el.tagName.toLowerCase() === 'embed' && attrName === 'src') {
                el.__editingAttribute = false;
                setupEmbed(el);
                continue;
              }

              ATTRIBUTE_MAP.forEach(({ attr, rawAttr, filter }) => {
                if (attrName === attr) {
                  interceptElementAttribute(el, attr, rawAttr, filter);
                }
              });
              el.__editingAttribute = false;
            }
          }
        });

        const observerOptions = {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['src', 'href', 'poster', 'data', 'srcset']
        };

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.documentElement, observerOptions);
            document.querySelectorAll('embed').forEach(setupEmbed);
          });
        } else {
          observer.observe(document.documentElement, observerOptions);
          document.querySelectorAll('embed').forEach(setupEmbed);
        }

        // modifies everything returned from document, like document.getElementById()
        function patchClass(name, linkprop, oncreate = () => {}, filter = x => x) {
          var _linkprop = "_" + linkprop;
          const originalClass = window[name];
          if (!originalClass) return;

          // window[name] = class extends originalClass {
          //   constructor() {
          //     super(...arguments);
          //     wrapElement(this);
          //   }
          // };

          const wrapperClass = function(...args) {
            var obj = new originalClass(...filter(args));
            obj = wrapElement(obj);
            oncreate.call(obj, ...args);
            return obj;
          };
          Object.setPrototypeOf(wrapperClass.prototype, originalClass.prototype);
          Object.setPrototypeOf(wrapperClass, originalClass);

          window[name] = wrapperClass;
        }

        patchClass("Image", "src");
        patchClass("Audio", "src", function(url) {
          if (url) this.src = url;
        }, function() {
          return [];
        });

        const nativeElementGetAttribute = Element.prototype.getAttribute;
        const nativeScriptSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, "src");

        function getOriginalScriptSrc(script) {
          const rawSrc = nativeElementGetAttribute.call(script, "data-raw-src");
          if (rawSrc !== null && rawSrc !== "") {
            try {
              return new URL(rawSrc, CURRENT_PAGE_URL).href;
            } catch (_) {
              return rawSrc;
            }
          }
          return nativeScriptSrcDescriptor.get.call(script);
        }

        try {
          Object.defineProperty(HTMLScriptElement.prototype, "src", {
            configurable: nativeScriptSrcDescriptor.configurable,
            enumerable: nativeScriptSrcDescriptor.enumerable,
            get() {
              return getOriginalScriptSrc(this);
            },
            set(value) {
              return nativeScriptSrcDescriptor.set.call(this, value);
            }
          });
        } catch (error) {
          console.warn("[Browser Emulator] Could not virtualize HTMLScriptElement.src:", error);
        }

        var getOldContextWindow = (f=>f.call.bind(f))(Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow').get);
        function wrapElement(elem) {
          if (!(elem instanceof HTMLElement)) return elem;
          
          // Guard against re-wrapping the same node
          if (elem.__isWrapped) return elem;
          elem.__isWrapped = true;

          const tagName = elem.tagName.toLowerCase();
          const propMap = {
            "script": {
              "src":"data-raw-src",
              "integrity":"data-raw-integrity"
            },
            "link": {
              "href":"data-raw-href",
              "integrity":"data-raw-integrity"
            },
            "img": {
              "src":"data-raw-src",
              "srcset":"data-raw-srcset"
            },
            "audio": {
              "src":"data-raw-src"
            },
            "video": {
              "src":"data-raw-src"
            },
            "source": {
              "src":"data-raw-src"
            },
            "track": {
              "src":"data-raw-src"
            },
            "iframe": {
              "src":"data-raw-src",
              "srcdoc":"data-raw-srcdoc"
            },
            "embed": {
              "src":"data-raw-src"
            },
            "object": {
              "data":"data-raw-data"
            },
          };
          const propObj = propMap[tagName];

          if (!propObj) return elem;

          for (var linkprop in propObj) (function(linkprop){
            Object.defineProperty(elem, linkprop, {
              get: function() {
                if (tagName === "script" && linkprop === "src") return getOriginalScriptSrc(this);
                const value = this.getAttribute(linkprop);
                return linkprop === "integrity" && value == null ? "" : value;
              },
              set: function(val) { return this.setAttribute(linkprop, val) },
              configurable: true,
              enumerable: true
            });
          })(linkprop);

          if (tagName == "iframe") {
            // Keep the browser's real WindowProxy before overriding contentWindow
            // with the emulator proxy. Nested PageEmulators need this native handle
            // to deliver postMessage without routing back into their own proxy.
            try {
              Object.defineProperty(elem, '__wkNativeContentWindow', {
                value: getOldContextWindow(elem),
                writable: true,
                configurable: true
              });
            } catch (e) {}

            const ensureFrameEmulator = () => {
              usefulHelpers.ensureSandBoxSameOrigin(elem);
              if (elem.pageEmulator) return elem.pageEmulator;

              const pageId = elem.getAttribute('data-page-id');
              const knownPage = pageId ? pageEmulator.__pageRegistry?.[pageId] : null;

              if (knownPage) {
                knownPage.iframe = elem;
                elem.pageEmulator = knownPage;
                elem.usefulHelpers = pageEmulator.__pageRegistry.__usefulHelpers;

                if (knownPage.tab) {
                  knownPage.tab.iframe = elem;
                  knownPage.tab.frameElement = elem;
                }

                // Keep DevTools in sync if contentWindow is the first code to
                // touch a reconstructed iframe element.
                sendEvent('iframe-create',{iframe:elem,reattached:true});
                return knownPage;
              }

              return sendEvent('iframe-create',{iframe: elem}) || elem.pageEmulator || null;
            };

            if (!elem.getAttribute('data-page-id')) ensureFrameEmulator();

            Object.defineProperty(elem,'contentWindow',{
              get: () => {
                ensureFrameEmulator();
                const contextWindow = elem.__wkNativeContentWindow || getOldContextWindow(elem);
                return window.__runSyncInterceptor(elem,contextWindow);
              },
              set: () => {}
            });

            Object.defineProperty(elem,'contentDocument',{
              get: () => {
                ensureFrameEmulator();
                const contextWindow = elem.__wkNativeContentWindow || getOldContextWindow(elem);
                const proxyWindow = window.__runSyncInterceptor(elem,contextWindow);
                return proxyWindow?.document;
              },
              set: () => {}
            });
          }

          var oldSetAttribute = elem.setAttribute;
          var oldGetAttribute = elem.getAttribute;
          var oldRemoveAttribute = elem.removeAttribute;
          elem.setAttribute = function(prop, value) {
            const lowerProp = prop.toLowerCase();

            // Integrity is metadata, not a URL-bearing attribute. Keep its
            // page-visible value separately while the browser-facing attribute
            // is removed after verification.
            if ((tagName === "script" || tagName === "link") && lowerProp === "integrity" && !this.__editingAttribute) {
              return oldSetAttribute.call(this, "data-raw-integrity", String(value));
            }

            // Guard against internal recursions during dynamic fetches
            if (this.__processing_attr) {
              return oldSetAttribute.call(this, prop, value);
            }

            if (lowerProp in propObj && !this.__editingAttribute) {
              // Non-JavaScript script data blocks (JSON, import maps,
              // speculation rules, etc.) must retain native resource behavior.
              if (tagName === "script" && lowerProp === "src" && !isExecutableScriptElement(this)) {
                return oldSetAttribute.call(this, prop, value);
              }

              if (!value) {
                oldSetAttribute.call(this, propObj[lowerProp], '');
                return oldSetAttribute.call(this, prop, value);
              }

              oldSetAttribute.call(this, propObj[lowerProp], value);

              if (value.startsWith("data:") || value.startsWith("blob:") || value.startsWith("javascript:")) {
                return oldSetAttribute.call(this, prop, value);
              }

              this.__processing_attr = true;

              // Async resolution
              (async () => {
                if (this.tagName == 'IFRAME') {
                  // Keep iframe src/srcdoc virtual. Setting the native attribute
                  // first starts a real browser navigation that races the
                  // emulator's own fetch + srcdoc navigation.
                  this.__sandboxed = false;
                  try {
                    await setupNestedFrame(this);
                  } finally {
                    this.__processing_attr = false;
                  }
                  return;
                }
                
                try {
                  const resolvedUrl = new URL(value, CURRENT_PAGE_URL).href;
                  const response = await pageEmulator.network.request(resolvedUrl, BASE_ORIGIN, {}, tagName);
                  if (response && response.ok) {
                    const integrity = oldGetAttribute.call(this, "integrity") ||
                      oldGetAttribute.call(this, "data-raw-integrity");
                    if (integrity) {
                      const verified = await verifySubresourceIntegrity(response, integrity);
                      oldSetAttribute.call(this, "data-raw-integrity", integrity);
                      oldRemoveAttribute.call(this, "integrity");

                      if (!verified) {
                        oldRemoveAttribute.call(this, prop);
                        oldSetAttribute.call(this, "data-wk-integrity-error", "verification-failed");
                        console.error("[Browser Emulator] Blocked dynamically assigned resource with invalid subresource integrity:", resolvedUrl);
                        return;
                      }
                    }

                    const dataUri = await createDataUri(response);
                    if (dataUri) {
                      return oldSetAttribute.call(this, prop, dataUri);
                    }
                  }
                  oldSetAttribute.call(this, prop, value);
                } catch (err) {
                  oldSetAttribute.call(this, prop, value);
                } finally {
                  this.__processing_attr = false;
                }
              })();

              return; // Prevent setting un-virtualized path synchronously
            }

            return oldSetAttribute.call(this, prop, value);
          };
          elem.getAttribute = function(prop) {
            const lowerProp = prop.toLowerCase();

            if (lowerProp in propObj && !this.__editingAttribute) {
              const rawValue = oldGetAttribute.call(this, propObj[lowerProp]);
              return rawValue === null ? oldGetAttribute.call(this, prop) : rawValue;
            }

            return oldGetAttribute.call(this, prop);
          };
          elem.removeAttribute = function(prop) {
            const lowerProp = prop.toLowerCase();
            if ((tagName === "script" || tagName === "link") && lowerProp === "integrity") {
              oldRemoveAttribute.call(this, "data-raw-integrity");
            }
            return oldRemoveAttribute.call(this, prop);
          };

          return elem;
        }

        // Keep native live DOM collections, but wrap elements as they are read
        // so collections such as document.scripts expose the same virtualized
        // element properties as querySelector()/getElementById().
        const wrappedDOMCollections = new WeakMap();

        function wrapDOMCollection(collection) {
          if (!(collection instanceof HTMLCollection) && !(collection instanceof NodeList)) return collection;
          if (wrappedDOMCollections.has(collection)) return wrappedDOMCollections.get(collection);

          let proxy;
          proxy = new Proxy(collection, {
            get(target, prop) {
              if (prop === Symbol.iterator || prop === 'values') {
                return function* () {
                  for (let i = 0; i < target.length; i++) yield wrapElement(target[i]);
                };
              }
              if (prop === 'keys') {
                return function* () {
                  for (let i = 0; i < target.length; i++) yield i;
                };
              }
              if (prop === 'entries') {
                return function* () {
                  for (let i = 0; i < target.length; i++) yield [i, wrapElement(target[i])];
                };
              }
              if (prop === 'forEach' && target instanceof NodeList) {
                return function(callback, thisArg) {
                  for (let i = 0; i < target.length; i++) {
                    Reflect.apply(callback, thisArg, [wrapElement(target[i]), i, proxy]);
                  }
                };
              }
              if ((prop === 'item' || prop === 'namedItem') && typeof target[prop] === 'function') {
                return function(...args) {
                  return wrapElement(Reflect.apply(target[prop], target, args));
                };
              }
              if (typeof prop === 'string' && /^(?:0|[1-9]\d*)$/.test(prop)) {
                return wrapElement(Reflect.get(target, prop, target));
              }

              const value = Reflect.get(target, prop, target);
              if (typeof value === 'function') return value.bind(target);
              return wrapElement(value);
            }
          });

          wrappedDOMCollections.set(collection, proxy);
          return proxy;
        }

        function wrapDocumentValue(value) {
          if (value instanceof HTMLElement) return wrapElement(value);
          if (value instanceof HTMLCollection || value instanceof NodeList) return wrapDOMCollection(value);
          return value;
        }

        const originalInsertRule = CSSStyleSheet.prototype.insertRule;
        CSSStyleSheet.prototype.insertRule = function(rule, index) {
          if (rule && rule.includes('url(')) {
            const sheet = this;
            usefulHelpers.rewriteCSSURLs(rule, pageEmulator)
              .then(processedRule => {
                try {
                  originalInsertRule.call(sheet, processedRule, index);
                } catch(e) {
                  originalInsertRule.call(sheet, rule, index);
                }
              });
            return index || 0;
          }
          return originalInsertRule.apply(this, arguments);
        };

        const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
        CSSStyleDeclaration.prototype.setProperty = function(propertyName, value, priority) {
          if (value && typeof value === 'string' && value.includes('url(')) {
            const styleDecl = this;
            usefulHelpers.rewriteCSSURLs(value, pageEmulator)
              .then(processedVal => {
                originalSetProperty.call(styleDecl, propertyName, processedVal, priority);
              });
            return;
          }
          return originalSetProperty.apply(this, arguments);
        };

        // Console logging intercepter

        Object.keys(console).forEach(method => {
          const original = console[method];
          if (typeof original != 'function') return;
          console[method] = function(...args) {
            sendEvent('console',method,args);
          };
        });

        function addEventListener(e,p,f,t) {
          e.addEventListener(p,f,t);
          setTimeout(()=>e.addEventListener(p,f,t),0);
        }

        addEventListener(window, 'error', function(e) {
          var loc = (document.currentScript?.getAttribute || (v=>'undefined')).call(document.currentScript, 'data-raw-src');
          sendEvent('error',e,loc);
        });

        const originalPrepare = Error.prepareStackTrace;
        Error.prepareStackTrace = function (error, structuredStackTrace) {
          const message = `${error.name}: ${error.message || ""}`;
          const frames = structuredStackTrace.map(f => f.toString()).filter((f,i) => !f.includes("data:") || i != structuredStackTrace.length - 1).map(f => f.includes("about:srcdoc") ? '' : `\n    at ${f}`).join("");
          const stackString = message + frames;
          return stackString.replace(/at eval \(([^]*?):(\d+):(\d+)\)$/g, 'at $1:$2:$3');
        };

        window.open = function(url, target, features) {
          if (url && url.startsWith('javascript:')) {
            const code = decodeURIComponent(url.slice(11));
            window.__executeCode(code, '<anonymous>');
            return null;
          }

          const resolved = url ? new URL(url, CURRENT_PAGE_URL).href : 'about:blank';
          const normalizedTarget = (target || '_blank').toLowerCase();

          // 1. Handle targeted contextual routing structures
          if (normalizedTarget === '_self') {
            window.__windowProxy.location.href = resolved;
            return window.__windowProxy;
          } 
          
          if (normalizedTarget === '_parent') {
            window.__windowProxy.parent.location.href = resolved;
            return window.__windowProxy.parent;
          } 
          
          if (normalizedTarget === '_top') {
            window.__windowProxy.top.location.href = resolved;
            return window.__windowProxy.top;
          }

          // Pass false if features specify background rules, or default to foreground (true)
          const activateTab = !features || !features.includes('background');
          const newPage = sendEvent('open', resolved, activateTab);

          // An open interceptor may create an emulated PageEmulator, return
          // its iframe/window proxy, or hand the URL to the real browser for
          // an external origin. Do not assume every result has an iframe.
          if (!newPage) return null;
          if (newPage.__windowProxy) return newPage.__windowProxy;
          if (newPage.iframe) {
            const contentWindow = newPage.iframe.contentWindow;
            return contentWindow?.__windowProxy || contentWindow || newPage;
          }
          return newPage;
        };

        ['MouseEvent', 'KeyboardEvent', 'FocusEvent', 'UIEvent'].forEach(eventName => {
          if (window[eventName]) {
            window[eventName] = new Proxy(window[eventName], {
              construct(target, args) {
                const [type, params] = args;
                if (params && params.view) {
                  params.view = params.view.__trueWindow || params.view;
                }
                return Reflect.construct(target, args, target);
              }
            });
          }
        });

        // Catch file input activation before the native file picker can open.
        const nativeElementClick = HTMLElement.prototype.click;
        HTMLElement.prototype.click = function() {
          if (this.tagName === 'INPUT' && String(this.getAttribute('type') || '').toLowerCase() === 'file') {
            if (!this.disabled) void sendAsyncEvent('upload',this).catch(() => {});
            return;
          }
          if (this.tagName === 'A') {
            const href = this.getAttribute('href');
            if (href) {
              if (href.startsWith('javascript:')) {
                const code = decodeURIComponent(href.slice(11));
                window.__executeCode(code, '<anonymous>');
                return;
              }

              const resolved = new URL(href, CURRENT_PAGE_URL).href;
              const target = (this.getAttribute('target') || '_self').toLowerCase();

              let targetWindow = window.__windowProxy;
              if (target === '_top') {
                targetWindow = window.__windowProxy.top;
              } else if (target === '_parent') {
                targetWindow = window.__windowProxy.parent;
              } else if (target === '_blank') {
                window.open(resolved, '_blank');
                return;
              }

              if (targetWindow && targetWindow.location) {
                targetWindow.location.href = resolved;
                return;
              }
            }
          }
          
          return nativeElementClick.apply(this, arguments);
        };

        addEventListener(document, 'click', function(e) {
          const fileInput = e.target.closest('input[type=\"file\"]');
          if (fileInput) {
            e.preventDefault();
            e.stopPropagation();
            if (!fileInput.disabled) void sendAsyncEvent('upload',fileInput).catch(() => {});
            return;
          }
          const link = e.target.closest('a');
          if (link && link.dataset.isInternalDownload) {
            return; 
          }
          if (link && link.getAttribute('href')) {
            const href = link.getAttribute('href');
            if (href && href.startsWith('javascript:')) {
              const code = decodeURIComponent(href.slice(11));
              window.__executeCode(code, '<anonymous>');
              return;
            }

            const resolved = new URL(href, CURRENT_PAGE_URL).href;
            const isMiddleClick = e.button === 1;
            const isCmdOrCtrl = e.ctrlKey || e.metaKey;
            const isTargetBlank = link.getAttribute('target') === '_blank';

            if (isMiddleClick || isCmdOrCtrl || isTargetBlank) {
              e.preventDefault();
              e.stopPropagation();
              sendEvent('open', resolved, !isCmdOrCtrl && !isMiddleClick);
            } else if (pageEmulator?.eventInterceptors?.navigate?.length) {
              const anchor = e.target.closest('a');
              if (!anchor || !anchor.href) return;
              if (anchor.getAttribute('download')) return (async function() {
                e.preventDefault();
                e.stopPropagation();
                try {
                  await sendAsyncEvent('download',resolved,anchor.getAttribute('download') || '');
                } catch(e) { console.error('Download via fetch failed:', e); };
              })();
              const target = (anchor.getAttribute('target') || '').toLowerCase();
              if (target === '_top') {
                e.preventDefault();
                e.stopPropagation();
                window.__windowProxy.top.location.href = anchor.href;
              } else if (target === '_parent') {
                e.preventDefault();
                e.stopPropagation();
                window.__windowProxy.parent.location.href = anchor.href;
              } else {
                e.preventDefault();
                e.stopPropagation();
                window.__windowProxy.location.href = anchor.href;
              }
            }
          }
        }, true);
        
        // 1. Neutralize programmatic form .submit() calls
        HTMLFormElement.prototype.submit = function() {
          const event = new Event('submit', { 
            bubbles: true, 
            cancelable: true
          });
          this.dispatchEvent(event);
        };

        document.addEventListener('submit', function(e) {
          const form = e.target;
          if (!form || !(form instanceof HTMLFormElement)) return;
          
          // Halt the native browser submission immediately
          e.preventDefault(); 

          // --- 1. Evaluate if this form intended to block navigation ---
          let shouldNavigate = true;
          if (typeof form.onsubmit === 'function') {
            // Run the handler in the context of the form. 
            // If it explicitly returns false, flag it to block redirection later.
            if (form.onsubmit.call(form, e) === false) {
              shouldNavigate = false;
            }
          } else {
            const onsubmitAttr = form.getAttribute('onsubmit');
            if (onsubmitAttr && onsubmitAttr.includes('return false')) {
              shouldNavigate = false;
            }
          }

          // --- 2. Setup your Proxy Network Context ---
          let targetWindow = window.__windowProxy || window;
          const action = form.getAttribute('action') || targetWindow.location.href;
          const method = (form.getAttribute('method') || 'GET').toUpperCase();
          const target = (form.getAttribute('target') || '_self').toLowerCase();
          let targetUrlObj = new URL(action, targetWindow.location.href);

          if (target === '_top') targetWindow = targetWindow.top;
          if (target === '_parent') targetWindow = targetWindow.parent;

          const formData = new FormData(form);

          // --- GET ROUTE ---
          if (method === 'GET') {
            for (const [key, value] of formData.entries()) {
              targetUrlObj.searchParams.append(key, value);
            }
            
            // Only perform the window location shift if the form didn't cancel navigation
            if (shouldNavigate) {
              if (target === '_blank') {
                window.open(targetUrlObj.href, '_blank');
              } else {
                targetWindow.location.href = targetUrlObj.href;
              }
            }
            return;
          }

          // --- POST / OTHER ROUTE ---
          const isMultipart = form.enctype === 'multipart/form-data';
          const bodyPayload = isMultipart ? formData : new URLSearchParams(formData);

          // Only pre-open a blank window if we actually intend to navigate to it
          let blankWindowRef = null;
          if (target === '_blank' && shouldNavigate) {
            blankWindowRef = window.open('about:blank', '_blank');
          }

          fetch(targetUrlObj.href, {
            method: method,
            body: bodyPayload
          }).then(async response => {
            
            // Read the body content regardless of navigation state
            const contentType = response.headers.get('content-type') || '';
            let responseData = null;
            if (contentType.includes('text/html')) {
              responseData = await response.text();
            } else if (contentType.includes('application/json')) {
              responseData = await response.json();
            }

            // --- CRITICAL FIX: Wake up your local consumer code ---
            // We fire a custom event directly onto the form containing the raw proxy response
            const proxyEvent = new CustomEvent('proxysubmit:success', {
              bubbles: true,
              cancelable: true,
              detail: {
                url: response.url,
                status: response.status,
                contentType: contentType,
                data: responseData
              }
            });
            form.dispatchEvent(proxyEvent);

            // If the form intended to cancel standard browser navigation, stop here.
            // The event above has already broadcasted the payload to your other scripts.
            if (!shouldNavigate) {
              if (blankWindowRef) blankWindowRef.close();
              return; 
            }

            const contextWindow = blankWindowRef || targetWindow;

            if (response.redirected) {
              contextWindow.location.href = response.url;
            } else {
              if (contentType.includes('text/html')) {
                contextWindow.document.documentElement.innerHTML = responseData; // reuse the parsed text
                
                contextWindow.document.querySelectorAll('script').forEach(oldScript => {
                  const newScript = contextWindow.document.createElement('script');
                  Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                  newScript.appendChild(contextWindow.document.createTextNode(oldScript.innerHTML));
                  oldScript.parentNode.replaceChild(newScript, oldScript);
                });
              } else {
                contextWindow.location.href = response.url;
              }
            }
          }).catch(err => {
            console.error(`Proxied Form submission (${method}) failed:`, err.message);
            if (blankWindowRef) blankWindowRef.close();
          });
        }, true);

        if (pageEmulator.runtimeInterceptor) eval(pageEmulator.runtimeInterceptor);

        const originalFetch = window.fetch;
        window.fetch = async function(input, data = {}, type = 'fetch') {
          let fetchUrl = input;
          let requestOptions = { ...data };

          // Check if the input is a Request object
          if (input instanceof Request) {
            fetchUrl = input.url;
            
            // Clone the request so reading the body doesn't break the original fallback
            const clonedRequest = input.clone();
            
            // Extract properties from the Request object into your data object
            requestOptions.method = clonedRequest.method;
            requestOptions.headers = Object.fromEntries(clonedRequest.headers.entries());
            
            // Safely extract the body text if a body exists
            if (clonedRequest.body) {
              try {
                requestOptions.body = await clonedRequest.text();
              } catch (e) {
                console.warn("Could not read request body:", e);
              }
            }
          }

          const resolvedUrl = new URL(typeof fetchUrl === 'string' ? fetchUrl : fetchUrl.url, CURRENT_PAGE_URL).href;
          
          // Pass the enriched requestOptions into your network handler
          const response = await pageEmulator.network.request(resolvedUrl, BASE_ORIGIN, requestOptions, type);
          if (response) return response;
          
          return await originalFetch.apply(this, arguments);
        };


        // Workers have their own global scope, so page-realm patches do not
        // reach them. Bootstrap each worker before its entry script and bridge
        // its network APIs back through this PageEmulator.
        (function installVirtualWorkers() {
          const NativeWorker = window.Worker;
          if (typeof NativeWorker !== 'function' || NativeWorker.__wkVirtualized) return;

          function workerBootstrap() {
            const nativeImportScripts = typeof self.importScripts === 'function'
              ? self.importScripts.bind(self)
              : null;
            const queuedMessages = [];
            let initialized = false;
            let bridgePort = null;
            let workerBaseURL = self.location.href;

            function receiveInitialMessage(event) {
              if (event.data && event.data.__wkEmulatorInit === true && event.ports && event.ports[0]) {
                self.removeEventListener('message', receiveInitialMessage);
                bridgePort = event.ports[0];
                bridgePort.onmessage = receiveBridgeMessage;
                if (bridgePort.start) bridgePort.start();
                bridgePort.postMessage({ kind: 'bridge-ready' });
                return;
              }
              if (!initialized) queuedMessages.push({
                data: event.data,
                origin: event.origin,
                lastEventId: event.lastEventId,
                ports: Array.from(event.ports || [])
              });
            }

            const pendingRequests = new Map();
            const workerSockets = new Map();
            let nextRequestId = 1;

            function receiveBridgeMessage(event) {
              const message = event.data || {};
              if (message.kind === 'start') {
                startWorkerSource(message).catch(error => {
                  try {
                    bridgePort.postMessage({
                      kind: 'bootstrap-error',
                      message: error && error.message || String(error),
                      stack: error && error.stack || ''
                    });
                  } catch (_) {}
                });
                return;
              }
              if (message.kind === 'rpc-result') {
                const pending = pendingRequests.get(message.id);
                if (!pending) return;
                pendingRequests.delete(message.id);
                if (pending.signal && pending.abortHandler) {
                  pending.signal.removeEventListener('abort', pending.abortHandler);
                }
                if (message.error) pending.reject(new Error(message.error));
                else pending.resolve(message.response);
                return;
              }
              if (message.kind === 'ws-event') {
                const socket = workerSockets.get(message.socketId);
                if (socket) socket._receive(message.event, message.data);
              }
            }

            function rpc(operation, payload, transfer, signal) {
              const id = nextRequestId++;
              return new Promise((resolve, reject) => {
                const pending = { resolve, reject, signal, abortHandler: null };
                if (signal) {
                  if (signal.aborted) {
                    reject(new DOMException('The operation was aborted.', 'AbortError'));
                    return;
                  }
                  pending.abortHandler = () => {
                    pendingRequests.delete(id);
                    try { bridgePort.postMessage({ kind: 'cancel', id }); } catch (_) {}
                    reject(new DOMException('The operation was aborted.', 'AbortError'));
                  };
                  signal.addEventListener('abort', pending.abortHandler, { once: true });
                }
                pendingRequests.set(id, pending);
                try {
                  bridgePort.postMessage({
                    kind: 'rpc',
                    id,
                    operation,
                    payload
                  }, transfer || []);
                } catch (error) {
                  pendingRequests.delete(id);
                  if (signal && pending.abortHandler) signal.removeEventListener('abort', pending.abortHandler);
                  reject(error);
                }
              });
            }

            async function virtualFetch(input, init) {
              const NativeRequest = self.Request;
              const requestUrl = input instanceof NativeRequest
                ? input.url
                : new URL(String(input), workerBaseURL).href;
              const request = input instanceof NativeRequest
                ? new NativeRequest(input, init)
                : new NativeRequest(requestUrl, init);
              const clone = request.clone();
              let body = null;
              if (clone.body) body = await clone.arrayBuffer();
              const options = {
                method: request.method,
                headers: Array.from(request.headers.entries()),
                credentials: request.credentials,
                mode: request.mode,
                cache: request.cache,
                redirect: request.redirect,
                referrer: request.referrer,
                referrerPolicy: request.referrerPolicy,
                integrity: request.integrity,
                keepalive: request.keepalive
              };
              if (body && body.byteLength) options.body = body;
              const transfer = body && body.byteLength ? [body] : [];
              const result = await rpc('fetch', {
                url: request.url,
                options,
                body
              }, transfer, request.signal);
              const status = result.status || 200;
              const responseBody = [204, 205, 304].includes(status) ? null : (result.body || null);
              const response = new Response(responseBody, {
                status,
                statusText: result.statusText || '',
                headers: result.headers || []
              });
              try {
                Object.defineProperty(response, 'url', { configurable: true, value: result.url || request.url });
              } catch (_) {}
              try {
                Object.defineProperty(response, 'redirected', { configurable: true, value: !!result.redirected });
              } catch (_) {}
              return response;
            }

            class VirtualXMLHttpRequest extends EventTarget {
              constructor() {
                super();
                this.readyState = 0;
                this.status = 0;
                this.statusText = '';
                this.responseURL = '';
                this.responseType = '';
                this.timeout = 0;
                this.withCredentials = false;
                this.upload = new EventTarget();
                this._method = 'GET';
                this._url = '';
                this._async = true;
                this._requestHeaders = {};
                this._responseHeaders = new Headers();
                this._responseBuffer = new ArrayBuffer(0);
                this._controller = null;
                this._timeoutId = null;
                this._sent = false;
              }
              _emit(type, event) {
                const dispatched = event || new Event(type);
                this.dispatchEvent(dispatched);
                const handler = this['on' + type];
                if (typeof handler === 'function') handler.call(this, dispatched);
              }
              open(method, url, async = true) {
                if (async === false) throw new DOMException('Synchronous XMLHttpRequest is not supported in virtual workers.', 'NotSupportedError');
                this._method = String(method || 'GET').toUpperCase();
                this._url = new URL(String(url), workerBaseURL).href;
                this._async = true;
                this._requestHeaders = {};
                this._sent = false;
                this.readyState = 1;
                this._emit('readystatechange');
              }
              setRequestHeader(name, value) {
                if (this.readyState !== 1 || this._sent) throw new DOMException('XMLHttpRequest is not in the OPENED state.', 'InvalidStateError');
                const key = String(name);
                this._requestHeaders[key] = this._requestHeaders[key]
                  ? this._requestHeaders[key] + ', ' + String(value)
                  : String(value);
              }
              send(body = null) {
                if (this.readyState !== 1 || this._sent) throw new DOMException('XMLHttpRequest is not in the OPENED state.', 'InvalidStateError');
                this._sent = true;
                this._controller = new AbortController();
                const headers = { ...this._requestHeaders };
                const options = {
                  method: this._method,
                  headers,
                  signal: this._controller.signal,
                  credentials: this.withCredentials ? 'include' : 'same-origin'
                };
                if (!['GET', 'HEAD'].includes(this._method) && body !== null) options.body = body;
                if (this.timeout > 0) {
                  this._timeoutId = setTimeout(() => {
                    if (this._controller) this._controller.abort();
                    this._emit('timeout');
                    this._emit('loadend');
                  }, this.timeout);
                }
                virtualFetch(this._url, options).then(async response => {
                  if (this._controller && this._controller.signal.aborted) return;
                  this.status = response.status;
                  this.statusText = response.statusText;
                  this.responseURL = response.url;
                  this._responseHeaders = response.headers;
                  this.readyState = 2;
                  this._emit('readystatechange');
                  this._responseBuffer = await response.arrayBuffer();
                  this.readyState = 3;
                  this._emit('readystatechange');
                  const length = this._responseBuffer.byteLength;
                  this._emit('progress', new ProgressEvent('progress', { lengthComputable: true, loaded: length, total: length }));
                  this.readyState = 4;
                  this._emit('readystatechange');
                  this._emit('load');
                  this._emit('loadend');
                }).catch(error => {
                  if (this._controller && this._controller.signal.aborted) {
                    this._emit('abort');
                  } else {
                    this._emit('error');
                  }
                  this._emit('loadend');
                }).finally(() => {
                  if (this._timeoutId) clearTimeout(this._timeoutId);
                  this._timeoutId = null;
                });
              }
              abort() {
                if (this._controller) this._controller.abort();
                this.readyState = 0;
                this._sent = false;
                this._emit('readystatechange');
                this._emit('abort');
                this._emit('loadend');
              }
              getResponseHeader(name) {
                return this.readyState < 2 ? null : this._responseHeaders.get(name);
              }
              getAllResponseHeaders() {
                if (this.readyState < 2) return '';
                return Array.from(this._responseHeaders.entries()).map(entry => entry[0] + ': ' + entry[1] + '\r\n').join('');
              }
              get responseText() {
                if (this.responseType && this.responseType !== 'text') throw new DOMException('responseText is unavailable for this responseType.', 'InvalidStateError');
                return new TextDecoder().decode(this._responseBuffer);
              }
              get response() {
                if (this.readyState !== 4) return null;
                switch (this.responseType) {
                  case 'arraybuffer': return this._responseBuffer.slice(0);
                  case 'blob': return new Blob([this._responseBuffer]);
                  case 'json':
                    try { return JSON.parse(new TextDecoder().decode(this._responseBuffer)); } catch (_) { return null; }
                  case 'document': return null;
                  case '':
                  case 'text': return new TextDecoder().decode(this._responseBuffer);
                  default: return null;
                }
              }
            }
            Object.assign(VirtualXMLHttpRequest, {
              UNSENT: 0, OPENED: 1, HEADERS_RECEIVED: 2, LOADING: 3, DONE: 4
            });
            Object.assign(VirtualXMLHttpRequest.prototype, {
              UNSENT: 0, OPENED: 1, HEADERS_RECEIVED: 2, LOADING: 3, DONE: 4
            });

            const NativeWebSocket = self.WebSocket;
            let nextSocketId = 1;
            class VirtualWebSocket extends EventTarget {
              constructor(url, protocols) {
                super();
                this.url = new URL(String(url), workerBaseURL).href;
                this.readyState = VirtualWebSocket.CONNECTING;
                this.protocol = '';
                this.extensions = '';
                this.binaryType = 'blob';
                this.bufferedAmount = 0;
                this._socketId = nextSocketId++;
                this._native = null;
                workerSockets.set(this._socketId, this);
                rpc('ws-open', {
                  socketId: this._socketId,
                  url: this.url,
                  protocols
                }).then(result => {
                  if (result && result.fallback) {
                    this._native = protocols === undefined
                      ? new NativeWebSocket(this.url)
                      : new NativeWebSocket(this.url, protocols);
                    this._native.binaryType = this.binaryType;
                    for (const type of ['open', 'message', 'error', 'close']) {
                      this._native.addEventListener(type, event => this._receive(type, event.data, event));
                    }
                  }
                }).catch(() => this._receive('error'));
              }
              _emit(type, event) {
                const dispatched = event || new Event(type);
                this.dispatchEvent(dispatched);
                const handler = this['on' + type];
                if (typeof handler === 'function') handler.call(this, dispatched);
              }
              _receive(type, data, sourceEvent) {
                if (type === 'open') {
                  this.readyState = VirtualWebSocket.OPEN;
                  if (sourceEvent) {
                    this.protocol = sourceEvent.target && sourceEvent.target.protocol || '';
                    this.extensions = sourceEvent.target && sourceEvent.target.extensions || '';
                  }
                  this._emit('open');
                } else if (type === 'message') {
                  const event = new MessageEvent('message', { data });
                  this._emit('message', event);
                } else if (type === 'close') {
                  this.readyState = VirtualWebSocket.CLOSED;
                  const event = new CloseEvent('close', {
                    code: sourceEvent && sourceEvent.code || 1000,
                    reason: sourceEvent && sourceEvent.reason || '',
                    wasClean: sourceEvent ? !!sourceEvent.wasClean : true
                  });
                  this._emit('close', event);
                  workerSockets.delete(this._socketId);
                } else if (type === 'error') {
                  this._emit('error');
                }
              }
              send(data) {
                if (this.readyState !== VirtualWebSocket.OPEN) throw new DOMException('WebSocket is not open.', 'InvalidStateError');
                if (this._native) this._native.send(data);
                else bridgePort.postMessage({ kind: 'ws-send', socketId: this._socketId, data });
              }
              close(code, reason) {
                if (this.readyState === VirtualWebSocket.CLOSED || this.readyState === VirtualWebSocket.CLOSING) return;
                this.readyState = VirtualWebSocket.CLOSING;
                if (this._native) this._native.close(code, reason);
                else bridgePort.postMessage({ kind: 'ws-close', socketId: this._socketId, code, reason });
              }
            }
            Object.assign(VirtualWebSocket, {
              CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3
            });
            Object.assign(VirtualWebSocket.prototype, {
              CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3
            });

            function installNetworkPatches(baseURL) {
              workerBaseURL = baseURL;
              Object.defineProperty(self, '__wkWorkerURL', {
                configurable: false,
                enumerable: false,
                writable: false,
                value: baseURL
              });
              self.fetch = virtualFetch;
              self.XMLHttpRequest = VirtualXMLHttpRequest;
              if (NativeWebSocket) self.WebSocket = VirtualWebSocket;
            }

            async function startWorkerSource(payload) {
              workerBaseURL = payload.url;
              installNetworkPatches(payload.url);

              const scriptEntries = new Map(payload.scripts.map(item => [item.url, item]));
              if (payload.type === 'module') {
                const moduleBlobUrls = new Map();
                const creating = new Set();
                function createModuleUrl(url) {
                  if (moduleBlobUrls.has(url)) return moduleBlobUrls.get(url);
                  if (creating.has(url)) throw new Error('Cyclic module-worker imports cannot currently be virtualized: ' + url);
                  const entry = scriptEntries.get(url);
                  if (!entry) throw new Error('Missing preloaded worker module: ' + url);
                  creating.add(url);
                  let source = entry.source;
                  const dependencies = (entry.dependencies || []).slice().sort((a, b) => b.start - a.start);
                  for (const dependency of dependencies) {
                    const importedUrl = createModuleUrl(dependency.url);
                    source = source.slice(0, dependency.start) + JSON.stringify(importedUrl) + source.slice(dependency.end);
                  }
                  const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
                  moduleBlobUrls.set(url, blobUrl);
                  creating.delete(url);
                  return blobUrl;
                }
                const rootUrl = createModuleUrl(payload.url);
                await import(rootUrl);
              } else {
                if (!nativeImportScripts) throw new Error('Classic worker importScripts() is unavailable.');
                const scriptUrls = new Map();
                const blobUrls = [];
                for (const entry of payload.scripts) {
                  if (entry.url === payload.url) continue;
                  const blobUrl = URL.createObjectURL(new Blob([entry.source], { type: 'text/javascript' }));
                  blobUrls.push(blobUrl);
                  scriptUrls.set(entry.url, blobUrl);
                }
                let currentScriptUrl = payload.url;
                self.importScripts = function(...urls) {
                  for (const specifier of urls) {
                    const resolved = new URL(String(specifier), currentScriptUrl).href;
                    const blobUrl = scriptUrls.get(resolved);
                    if (!blobUrl) {
                      throw new TypeError('Worker importScripts() resource was not preloaded through the virtual network: ' + resolved);
                    }
                    const previous = currentScriptUrl;
                    currentScriptUrl = resolved;
                    try { nativeImportScripts(blobUrl); }
                    finally { currentScriptUrl = previous; }
                  }
                };
                const rootBlobUrl = URL.createObjectURL(new Blob([scriptEntries.get(payload.url).source], { type: 'text/javascript' }));
                blobUrls.push(rootBlobUrl);
                try { nativeImportScripts(rootBlobUrl); }
                finally { currentScriptUrl = payload.url; }
              }

              initialized = true;
              self.removeEventListener('message', receiveInitialMessage);
              for (const message of queuedMessages.splice(0)) {
                self.dispatchEvent(new MessageEvent('message', {
                  data: message.data,
                  origin: message.origin,
                  lastEventId: message.lastEventId,
                  ports: message.ports
                }));
              }
            }

            self.addEventListener('message', receiveInitialMessage);
          }

          const bootstrapSource = '(' + workerBootstrap.toString() + ')();';

          function getStaticWorkerDependencies(source, type) {
            const ast = acorn.parse(source, {
              ecmaVersion: 'latest',
              sourceType: type === 'module' ? 'module' : 'script',
              allowAwaitOutsideFunction: true
            });
            const dependencies = [];
            const add = node => {
              if (node && node.type === 'Literal' && typeof node.value === 'string') {
                dependencies.push({
                  specifier: node.value,
                  start: node.start,
                  end: node.end
                });
              }
            };
            if (type === 'module') {
              acorn.walk.simple(ast, {
                ImportDeclaration(node) { add(node.source); },
                ExportNamedDeclaration(node) { if (node.source) add(node.source); },
                ExportAllDeclaration(node) { add(node.source); },
                ImportExpression(node) { add(node.source); }
              });
            } else {
              acorn.walk.simple(ast, {
                CallExpression(node) {
                  if (node.callee && node.callee.type === 'Identifier' && node.callee.name === 'importScripts') {
                    node.arguments.forEach(add);
                  }
                }
              });
            }
            return dependencies;
          }

          async function fetchWorkerGraph(rootUrl, type, signal) {
            const scripts = new Map();
            async function visit(url) {
              if (scripts.has(url)) return;
              const response = await pageEmulator.network.request(url, BASE_ORIGIN, { signal }, 'worker');
              if (!response || !response.ok) {
                throw new Error('Failed to load worker script through the virtual network: ' + url +
                  (response ? ' (HTTP ' + response.status + ')' : ''));
              }
              const source = await response.text();
              const entry = { url, source, dependencies: [] };
              scripts.set(url, entry);
              const dependencies = getStaticWorkerDependencies(source, type);
              for (const dependency of dependencies) {
                let dependencyUrl;
                try { dependencyUrl = new URL(dependency.specifier, url).href; }
                catch (_) {
                  throw new Error('Cannot resolve worker dependency "' + dependency.specifier + '" from ' + url);
                }
                if (type === 'module' && !/^(?:[a-z][a-z\d+.-]*:|\/|\.{1,2}\/)/i.test(dependency.specifier)) {
                  throw new Error('Bare module specifier "' + dependency.specifier + '" cannot be resolved in a virtual module worker.');
                }
                entry.dependencies.push({
                  specifier: dependency.specifier,
                  start: dependency.start,
                  end: dependency.end,
                  url: dependencyUrl
                });
                await visit(dependencyUrl);
              }
            }
            await visit(rootUrl);
            return Array.from(scripts.values());
          }

          function dispatchWorkerStartupError(worker, url, error) {
            const message = error && error.message || String(error);
            const event = typeof ErrorEvent === 'function'
              ? new ErrorEvent('error', { message, filename: url, error })
              : new Event('error');
            try { worker.dispatchEvent(event); } catch (_) {}
          }

          const VirtualWorker = class extends NativeWorker {
            constructor(scriptURL, options = {}) {
              const sourceUrl = new URL(String(scriptURL), CURRENT_PAGE_URL).href;
              const bootstrapBlob = new Blob([bootstrapSource], { type: 'text/javascript' });
              const bootstrapUrl = URL.createObjectURL(bootstrapBlob);
              super(bootstrapUrl, options || {});

              const channel = new MessageChannel();
              const port = channel.port1;
              const abortController = new AbortController();
              const sockets = new Map();
              let nextSocketId = 1;
              let bootstrapRevoked = false;
              const revokeBootstrap = () => {
                if (bootstrapRevoked) return;
                bootstrapRevoked = true;
                URL.revokeObjectURL(bootstrapUrl);
              };
              const fail = error => {
                if (abortController.signal.aborted) return;
                abortController.abort();
                dispatchWorkerStartupError(this, sourceUrl, error);
              };

              this.__wkWorkerPort = port;
              this.__wkWorkerAbortController = abortController;
              this.__wkWorkerSockets = sockets;
              port.onmessage = async event => {
                const message = event.data || {};
                if (message.kind === 'bridge-ready') {
                  revokeBootstrap();
                  try {
                    const type = options && options.type === 'module' ? 'module' : 'classic';
                    const scripts = await fetchWorkerGraph(sourceUrl, type, abortController.signal);
                    port.postMessage({
                      kind: 'start',
                      url: sourceUrl,
                      type,
                      scripts
                    });
                  } catch (error) {
                    fail(error);
                  }
                  return;
                }

                if (message.kind === 'bootstrap-error') {
                  fail(new Error(message.message || 'Worker bootstrap failed.'));
                  return;
                }

                if (message.kind === 'cancel') {
                  const controller = this.__wkWorkerRequests && this.__wkWorkerRequests.get(message.id);
                  if (controller) controller.abort();
                  return;
                }

                if (message.kind === 'ws-send') {
                  const socket = sockets.get(message.socketId);
                  if (socket && socket.readyState === 1) {
                    try { socket.send(message.data); } catch (_) {}
                  }
                  return;
                }

                if (message.kind === 'ws-close') {
                  const socket = sockets.get(message.socketId);
                  if (socket) {
                    try { socket.close(message.code, message.reason); } catch (_) {}
                    sockets.delete(message.socketId);
                  }
                  return;
                }

                if (message.kind !== 'rpc') return;
                if (message.operation === 'ws-open') {
                  try {
                    const socket = await pageEmulator.network.socket(
                      message.payload.url,
                      BASE_ORIGIN,
                      message.payload.protocols
                    );
                    if (!socket || typeof socket.send !== 'function' || typeof socket.close !== 'function') {
                      port.postMessage({ kind: 'rpc-result', id: message.id, response: { fallback: true } });
                      return;
                    }
                    sockets.set(message.payload.socketId, socket);
                    const forward = type => event => {
                      const outgoing = { kind: 'ws-event', socketId: message.payload.socketId, event: type };
                      if (type === 'message') outgoing.data = event.data;
                      if (type === 'close') {
                        outgoing.code = event.code;
                        outgoing.reason = event.reason;
                        outgoing.wasClean = event.wasClean;
                      }
                      try { port.postMessage(outgoing); } catch (_) {}
                      if (type === 'close') sockets.delete(message.payload.socketId);
                    };
                    if (typeof socket.addEventListener === 'function') {
                      for (const type of ['open', 'message', 'error', 'close']) socket.addEventListener(type, forward(type));
                    } else {
                      for (const type of ['open', 'message', 'error', 'close']) socket['on' + type] = forward(type);
                    }
                    port.postMessage({ kind: 'rpc-result', id: message.id, response: { fallback: false } });
                  } catch (_) {
                    port.postMessage({ kind: 'rpc-result', id: message.id, response: { fallback: true } });
                  }
                  return;
                }

                if (message.operation === 'fetch') {
                  const controller = new AbortController();
                  this.__wkWorkerRequests = this.__wkWorkerRequests || new Map();
                  this.__wkWorkerRequests.set(message.id, controller);
                  try {
                    const payload = message.payload || {};
                    const options = { ...(payload.options || {}), signal: controller.signal };
                    if (payload.body && payload.body.byteLength) options.body = payload.body;
                    const response = await pageEmulator.network.request(payload.url, BASE_ORIGIN, options, 'worker-fetch');
                    const finalResponse = response || await originalFetch(new Request(payload.url, options));
                    const body = await finalResponse.arrayBuffer();
                    const status = finalResponse.status || 200;
                    const responseData = {
                      status,
                      statusText: finalResponse.statusText || '',
                      headers: Array.from(finalResponse.headers.entries()),
                      url: finalResponse.url || payload.url,
                      redirected: !!finalResponse.redirected,
                      body
                    };
                    port.postMessage({
                      kind: 'rpc-result',
                      id: message.id,
                      response: responseData
                    }, body.byteLength ? [body] : []);
                  } catch (error) {
                    port.postMessage({ kind: 'rpc-result', id: message.id, error: error && error.message || String(error) });
                  } finally {
                    if (this.__wkWorkerRequests) this.__wkWorkerRequests.delete(message.id);
                  }
                }
              };
              if (port.start) port.start();

              this.postMessage({ __wkEmulatorInit: true }, [channel.port2]);
              const originalTerminate = this.terminate.bind(this);
              this.terminate = () => {
                abortController.abort();
                for (const socket of sockets.values()) {
                  try { socket.close(); } catch (_) {}
                }
                sockets.clear();
                try { port.close(); } catch (_) {}
                revokeBootstrap();
                return originalTerminate();
              };
              this.addEventListener('error', () => {
                abortController.abort();
                revokeBootstrap();
              }, { once: true });
            }
          };

          Object.defineProperty(VirtualWorker, '__wkVirtualized', { value: true });
          window.Worker = VirtualWorker;
        })();

        (function() {
          const OriginalWebSocket = window.WebSocket;
          
          class InterceptableWebSocket extends EventTarget {
            constructor(url, protocols) {
              super();
              const rawUrl = typeof url === 'string' ? url : url.toString();
              const baseUrl =  CURRENT_PAGE_URL;
              this.url = new URL(rawUrl, baseUrl).href;
              this.readyState = OriginalWebSocket.CONNECTING;
              this.protocol = "";
              this.extensions = "";
              this.binaryType = "blob";
              this.bufferedAmount = 0;
              this._sendQueue = [];
              this._mock = null;
              this._serverFrameBuffer = new Uint8Array(0);
              this._init(this.url, protocols);
            }

            async _init(url, protocols) {
              const base = CURRENT_PAGE_URL;
              let response;
              try {
                response = await pageEmulator.network.socket(url, base, protocols);
              } catch (e) {
                console.error('[VirtualWS v10] WS NETWORK REQUEST THREW', e && e.stack || e);
                response = null;
              }

              // Network sockets may come from a parent iframe, so instanceof is not reliable across realms.
              const isRealWebSocket = response && typeof response.send === 'function' && typeof response.close === 'function' && typeof response.readyState === 'number';
              if (isRealWebSocket) {
                this._setupReal(response);
              } else if (response && typeof response.onClientMessage === 'function') {
                this._setupMock(response);
              } else {
                this._setupReal(new OriginalWebSocket(url, protocols));
              }
            }

            _setupReal(wsInstance) {
              this._ws = wsInstance;
              this._ws.binaryType = this.binaryType;
              this._ws.onopen = (e) => {
                this.readyState = OriginalWebSocket.OPEN;
                this.protocol = this._ws.protocol;
                this.extensions = this._ws.extensions;
                this.dispatchEvent(new Event('open'));
                if (this.onopen) this.onopen(e);
                this._flushQueue();
              };
              this._ws.onmessage = (e) => {
                this.dispatchEvent(new MessageEvent('message', { data: e.data }));
                if (this.onmessage) this.onmessage(e);
              };
              this._ws.onclose = (e) => {
                this.readyState = OriginalWebSocket.CLOSED;
                this.dispatchEvent(new CloseEvent('close', {
                  code: e.code, reason: e.reason, wasClean: e.wasClean
                }));
                if (this.onclose) this.onclose(e);
              };
              this._ws.onerror = (e) => {
                this.dispatchEvent(new Event('error'));
                if (this.onerror) this.onerror(e);
              };
            }

            _setupMock(mockBackend) {
              this._mock = mockBackend;

              // Do NOT replace backend sendToClient/closeClient. The backend owns the
              // server -> browser transport; we only register callbacks on it.
              mockBackend._onOpen = () => {
                if (this.readyState !== OriginalWebSocket.CONNECTING) return;
                this.readyState = OriginalWebSocket.OPEN;
                this.dispatchEvent(new Event('open'));
                if (this.onopen) this.onopen(new Event('open'));
                this._flushQueue();
              };

              mockBackend._onServerData = (data) => {
                try {
                  this._consumeServerFrames(data);
                } catch (err) {
                  console.error('[VirtualWS v15] SERVER DATA PARSER THREW', err && err.stack || err);
                  throw err;
                }
              };

              mockBackend._onClose = (code, reason) => {
                if (this.readyState === OriginalWebSocket.CLOSED) return;
                this.readyState = OriginalWebSocket.CLOSED;
                const evt = new CloseEvent('close', {
                  code: code || 1000,
                  reason: reason || '',
                  wasClean: true
                });
                this.dispatchEvent(evt);
                if (this.onclose) this.onclose(evt);
              };
            }

            _consumeServerFrames(data) {
              // The interceptor and browser shim can run in different VM realms.
              // Do NOT rely on `instanceof Uint8Array` / `instanceof ArrayBuffer`:
              // a Uint8Array created in the interceptor realm is not necessarily an
              // instance of this realm's Uint8Array. ArrayBuffer.isView() plus the
              // byteLength/byteOffset duck-type handles cross-realm Buffer/Uint8Array.
              let incoming;
              if (typeof data === 'string') {
                incoming = new TextEncoder().encode(data);
              } else if (data && typeof data.byteLength === 'number' && data.buffer) {
                const byteOffset = typeof data.byteOffset === 'number' ? data.byteOffset : 0;
                incoming = new Uint8Array(data.buffer, byteOffset, data.byteLength);
              } else if (data && typeof data.byteLength === 'number') {
                // Cross-realm ArrayBuffer fallback. Copy through a Uint8Array view
                // when the value is accepted by the current realm's constructor.
                try {
                  incoming = new Uint8Array(data);
                } catch (_) {
                  incoming = null;
                }
              }
              if (!incoming) return;

              const merged = new Uint8Array(this._serverFrameBuffer.length + incoming.length);
              merged.set(this._serverFrameBuffer);
              merged.set(incoming, this._serverFrameBuffer.length);
              this._serverFrameBuffer = merged;

              let offset = 0;
              while (this._serverFrameBuffer.length - offset >= 2) {
                const b0 = this._serverFrameBuffer[offset];
                const b1 = this._serverFrameBuffer[offset + 1];
                const fin = !!(b0 & 0x80);
                const opcode = b0 & 0x0f;
                const masked = !!(b1 & 0x80);
                let len = b1 & 0x7f;
                let headerLen = 2;

                if (len === 126) {
                  if (this._serverFrameBuffer.length - offset < 4) break;
                  len = (this._serverFrameBuffer[offset+2] << 8) |
                        this._serverFrameBuffer[offset+3];
                  headerLen = 4;
                } else if (len === 127) {
                  if (this._serverFrameBuffer.length - offset < 10) break;
                  // JS safe integer is enough for practical WebSocket payloads.
                  len = 0;
                  for (let i = 0; i < 8; i++) len = len * 256 + this._serverFrameBuffer[offset+2+i];
                  headerLen = 10;
                  if (len > Number.MAX_SAFE_INTEGER) {
                    this.close(1009, 'Message too large');
                    return;
                  }
                }

                const maskLen = masked ? 4 : 0;
                const frameLen = headerLen + maskLen + len;
                if (this._serverFrameBuffer.length - offset < frameLen) break;

                let p = offset + headerLen;
                let mask;
                if (masked) {
                  mask = this._serverFrameBuffer.slice(p, p + 4);
                  p += 4;
                }
                let payload = this._serverFrameBuffer.slice(p, p + len);
                if (masked) {
                  for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
                }

                offset += frameLen;


                if (opcode === 0x8) {
                  let code = 1000, reason = '';
                  if (payload.length >= 2) {
                    code = (payload[0] << 8) | payload[1];
                    reason = new TextDecoder().decode(payload.slice(2));
                  }
                  this.readyState = OriginalWebSocket.CLOSED;
                  const evt = new CloseEvent('close', {code, reason, wasClean: true});
                  this.dispatchEvent(evt);
                  if (this.onclose) this.onclose(evt);
                  return;
                }
                if (opcode === 0x9) {
                  // RFC6455 ping -> pong. The server normally handles this itself,
                  // but responding here makes the browser-side mock complete.
                  this._sendRawFrame(0xA, payload);
                  continue;
                }
                if (opcode === 0xA || opcode === 0x0) {
                  // pong/continuation handling below
                }

                if (opcode === 0x1 || opcode === 0x2) {
                  if (fin) this._dispatchServerPayload(opcode, payload);
                  else {
                    this._fragmentOpcode = opcode;
                    this._fragmentParts = [payload];
                  }
                } else if (opcode === 0x0 && this._fragmentParts) {
                  this._fragmentParts.push(payload);
                  if (fin) {
                    let total = 0;
                    for (const part of this._fragmentParts) total += part.length;
                    const all = new Uint8Array(total);
                    let at = 0;
                    for (const part of this._fragmentParts) { all.set(part, at); at += part.length; }
                    this._dispatchServerPayload(this._fragmentOpcode, all);
                    this._fragmentParts = null;
                    this._fragmentOpcode = null;
                  }
                }
              }

              this._serverFrameBuffer = this._serverFrameBuffer.slice(offset);
            }

            _dispatchServerPayload(opcode, payload) {
              let data;
              if (opcode === 0x1) data = new TextDecoder().decode(payload);
              else if (this.binaryType === 'arraybuffer') {
                data = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength);
              } else {
                data = new Blob([payload]);
              }
              const evt = new MessageEvent('message', {data});
              try {
                this.dispatchEvent(evt);
              } catch (err) {
                console.error('[VirtualWS v15] BROWSER dispatchEvent THREW', err && err.stack || err);
                throw err;
              }
              if (this.onmessage) {
                this.onmessage(evt);
              }
            }

            _sendRawFrame(opcode, payload) {
              // The server should almost never send us ping frames in Socket.IO, but
              // keep this path safe for completeness. Browser-originated frames are
              // masked; the mock backend receives the complete RFC6455 frame.
              const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload || []);
              const mask = new Uint8Array(4);
              if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(mask);
              else for (let i=0;i<4;i++) mask[i]=Math.random()*256;
              let header;
              if (bytes.length < 126) header = new Uint8Array([0x80|opcode, 0x80|bytes.length]);
              else if (bytes.length <= 65535) header = new Uint8Array([0x80|opcode, 0x80|126, bytes.length>>>8, bytes.length&255]);
              else return;
              const frame = new Uint8Array(header.length + 4 + bytes.length);
              frame.set(header);
              frame.set(mask, header.length);
              for (let i=0;i<bytes.length;i++) frame[header.length+4+i]=bytes[i]^mask[i&3];
              if (this._mock) this._mock.onClientMessage(frame);
            }

            _flushQueue() {
              while (this._sendQueue.length > 0 && this.readyState === OriginalWebSocket.OPEN) {
                this.send(this._sendQueue.shift());
              }
            }

            send(data) {
              if (this.readyState === OriginalWebSocket.CONNECTING) {
                this._sendQueue.push(data);
                return;
              }
              if (this.readyState !== OriginalWebSocket.OPEN) {
                throw new DOMException('WebSocket is not open', 'InvalidStateError');
              }
              if (this._ws) {
                this._ws.send(data);
              } else if (this._mock) {
                // The virtual server socket is a Node net.Socket as far as ws is
                // concerned, so it must receive actual RFC6455 frames, not the
                // Socket.IO payload by itself.
                this._sendClientFrame(data);
              }
            }

            _sendClientFrame(data) {
              let payload;
              let opcode = 0x1;
              if (typeof data === 'string') {
                payload = new TextEncoder().encode(data);
              } else if (data instanceof ArrayBuffer) {
                payload = new Uint8Array(data);
                opcode = 0x2;
              } else if (data instanceof Uint8Array) {
                payload = new Uint8Array(data);
                opcode = 0x2;
              } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
                // Native WebSocket.send(Blob) is async; mirror that behavior.
                data.arrayBuffer().then(buf => this._sendClientFrame(buf));
                return;
              } else {
                payload = new TextEncoder().encode(String(data));
              }

              const mask = new Uint8Array(4);
              if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(mask);
              else for (let i = 0; i < 4; i++) mask[i] = Math.floor(Math.random() * 256);

              let header;
              if (payload.length < 126) {
                header = new Uint8Array([0x80 | opcode, 0x80 | payload.length]);
              } else if (payload.length <= 65535) {
                header = new Uint8Array([0x80 | opcode, 0x80 | 126,
                  (payload.length >>> 8) & 255, payload.length & 255]);
              } else {
                // Encode a 64-bit length without BigInt so older browser targets work.
                header = new Uint8Array(10);
                header[0] = 0x80 | opcode;
                header[1] = 0x80 | 127;
                let n = payload.length;
                for (let i = 9; i >= 2; i--) {
                  header[i] = n % 256;
                  n = Math.floor(n / 256);
                }
              }

              const frame = new Uint8Array(header.length + 4 + payload.length);
              frame.set(header);
              frame.set(mask, header.length);
              for (let i = 0; i < payload.length; i++) {
                frame[header.length + 4 + i] = payload[i] ^ mask[i & 3];
              }
              this.bufferedAmount = Math.max(0, this.bufferedAmount + frame.byteLength);
              this._mock.onClientMessage(frame);
              this.bufferedAmount = Math.max(0, this.bufferedAmount - frame.byteLength);
            }

            close(code, reason) {
              if (this.readyState === OriginalWebSocket.CLOSED ||
                  this.readyState === OriginalWebSocket.CLOSING) return;
              if (this._ws) {
                this.readyState = OriginalWebSocket.CLOSING;
                this._ws.close(code, reason);
              } else if (this._mock && typeof this._mock.closeClient === 'function') {
                this.readyState = OriginalWebSocket.CLOSING;
                this._mock.closeClient(code || 1000, reason || '');
              } else {
                this.readyState = OriginalWebSocket.CLOSED;
              }
            }
          }

          InterceptableWebSocket.CONNECTING = 0;
          InterceptableWebSocket.OPEN = 1;
          InterceptableWebSocket.CLOSING = 2;
          InterceptableWebSocket.CLOSED = 3;
          
          window.WebSocket = InterceptableWebSocket;
        })();

        (function() {
          const global = window;

          // 1. Inherit correctly from EventTarget to support addEventListener/removeEventListener
          class XMLHttpRequestEventTarget extends EventTarget {
            constructor() {
              super();
              this._listeners = new Map();
            }
          }

          class XMLHttpRequestUpload extends XMLHttpRequestEventTarget {}

          class XMLHttpRequestPolyfill extends XMLHttpRequestEventTarget {
            // Ready State constants
            static get UNSENT() { return 0; }
            static get OPENED() { return 1; }
            static get HEADERS_RECEIVED() { return 2; }
            static get LOADING() { return 3; }
            static get DONE() { return 4; }

            constructor() {
              super();
              
              // Public States
              this.readyState = XMLHttpRequestPolyfill.UNSENT;
              this.status = 0;
              this.statusText = '';
              this.response = null;
              this.responseText = '';
              this.responseXML = null;
              this.responseType = '';
              this.timeout = 0;
              this.withCredentials = false;
              this.upload = new XMLHttpRequestUpload();

              // Event Property Handlers
              this.onreadystatechange = null;
              this.onloadstart = null;
              this.onprogress = null;
              this.onabort = null;
              this.onerror = null;
              this.onload = null;
              this.ontimeout = null;
              this.onloadend = null;

              // Internal properties
              this._method = '';
              this._url = '';
              this._async = true;
              this._requestHeaders = new Headers();
              this._responseHeaders = new Headers();
              this._abortController = null;
              this._overrideMimeType = null;
              this._timeoutTimer = null;
            }

            // Assign proxy helpers to catch macro on-event hooks
            _dispatchEvent(eventName, eventObj = new Event(eventName)) {
              const handler = this[`on${eventName}`];
              if (typeof handler === 'function') {
                try { handler.call(this, eventObj); } catch (e) { console.error(e); }
              }
              this.dispatchEvent(eventObj);
            }

            _changeState(newState) {
              this.readyState = newState;
              this._dispatchEvent('readystatechange');
            }

            open(method, url, async = true, username = null, password = null) {
              this._method = method.toUpperCase();
              
              // Standardize relative URL resolution
              const parsedUrl = new URL(url, CURRENT_PAGE_URL);
              if (username) parsedUrl.username = username;
              if (password) parsedUrl.password = password;
              this._url = parsedUrl.href;
              
              this._async = !!async;

              // Fail explicitly for Synchronous implementations since native fetch forces Async threads
              if (!this._async) {
                throw new DOMException("Synchronous XMLHttpRequest via fetch polyfill is unsupported.", "NotSupportedError");
              }

              // Reset configurations on reopening
              this._requestHeaders = new Headers();
              this._responseHeaders = new Headers();
              this.responseText = '';
              this.response = null;

              this._changeState(XMLHttpRequestPolyfill.OPENED);
            }

            setRequestHeader(header, value) {
              if (this.readyState !== XMLHttpRequestPolyfill.OPENED) {
                throw new DOMException("Failed to execute 'setRequestHeader': The object's state must be OPENED.", "InvalidStateError");
              }
              this._requestHeaders.append(header, value);
            }

            overrideMimeType(mime) {
              if (this.readyState >= XMLHttpRequestPolyfill.LOADING) {
                throw new DOMException("Failed to execute 'overrideMimeType': Actions cannot be performed after loading begins.", "InvalidStateError");
              }
              this._overrideMimeType = mime;
            }

            getResponseHeader(header) {
              if (this.readyState < XMLHttpRequestPolyfill.HEADERS_RECEIVED) return null;
              return this._responseHeaders.get(header);
            }

            getAllResponseHeaders() {
              if (this.readyState < XMLHttpRequestPolyfill.HEADERS_RECEIVED) return '';
              let headersString = '';
              this._responseHeaders.forEach((value, key) => {
                headersString += `${key}: ${value}\r\n`;
              });
              return headersString;
            }

            abort() {
              if (this._abortController) {
                this._abortController.abort();
              }
              if (this._timeoutTimer) clearTimeout(this._timeoutTimer);
              
              if (this.readyState !== XMLHttpRequestPolyfill.UNSENT && 
                (this.readyState < XMLHttpRequestPolyfill.OPENED || this.readyState === XMLHttpRequestPolyfill.DONE)) {
                this.readyState = XMLHttpRequestPolyfill.UNSENT;
                return;
              }

              this.readyState = XMLHttpRequestPolyfill.UNSENT;
              this._dispatchEvent('abort');
              this._dispatchEvent('loadend');
            }

            send(body = null) {
              //try { console.warn("[XHR v20] SEND", { method: this._method, url: this._url, bodyType: typeof body, bodyPreview: typeof body === "string" ? body.slice(0, 160) : body }); } catch (_) {}
              if (this.readyState !== XMLHttpRequestPolyfill.OPENED) {
                throw new DOMException("Failed to execute 'send': The object's state must be OPENED.", "InvalidStateError");
              }

              this._abortController = new AbortController();
              const fetchOptions = {
                method: this._method,
                headers: this._requestHeaders,
                signal: this._abortController.signal,
                credentials: this.withCredentials ? 'include' : 'same-origin'
              };

              if (body !== null && this._method !== 'GET' && this._method !== 'HEAD') {
                fetchOptions.body = body;
              }

              // Handle timeouts via Abort Signal binding
              if (this.timeout > 0) {
                this._timeoutTimer = setTimeout(() => {
                  this._abortController.abort();
                  this._dispatchEvent('timeout');
                  this._dispatchEvent('loadend');
                }, this.timeout);
              }

              // Execution Pipeline
              this._dispatchEvent('loadstart');

              fetch(this._url, fetchOptions, 'xhr')
                .then(async (res) => {
                  if (pageEmulator?.network?.logXMLHttpRequests) {
                    try { console.warn("[XHR v20] FETCH RESPONSE", { method: this._method, url: this._url, status: res.status, ok: res.ok }); } catch (_) {}
                  }
                  if (this._timeoutTimer) clearTimeout(this._timeoutTimer);

                  //if (res.redirected) alert(this._url);

                  this.status = res.status;
                  this.statusText = res.statusText;
                  this._responseHeaders = res.headers;

                  this._changeState(XMLHttpRequestPolyfill.HEADERS_RECEIVED);
                  this._changeState(XMLHttpRequestPolyfill.LOADING);

                  // Extract content mapping configurations
                  let mimeType = this._overrideMimeType || res.headers.get('content-type') || 'text/plain';
                  
                  if (this.responseType === 'blob') {
                    this.response = await res.blob();
                  } else if (this.responseType === 'arraybuffer') {
                    this.response = await res.arrayBuffer();
                  } else if (this.responseType === 'json') {
                    const txt = await res.text();
                    this.responseText = txt;
                    this.response = JSON.parse(txt);
                  } else if (this.responseType === 'document' || mimeType.includes('xml') || mimeType.includes('html')) {
                    const txt = await res.text();
                    this.responseText = txt;
                    if (global.DOMParser) {
                      const parser = new DOMParser();
                      this.responseXML = parser.parseFromString(txt, mimeType.includes('html') ? 'text/html' : 'application/xml');
                      this.response = this.responseXML;
                    } else {
                      this.response = txt;
                    }
                  } else {
                    // Default raw text decoding strategy
                    const txt = await res.text();
                    this.responseText = txt;
                    this.response = txt;
                  }

                  this._changeState(XMLHttpRequestPolyfill.DONE);
                  if (pageEmulator?.network?.logXMLHttpRequests) {
                    try { console.warn("[XHR v20] LOAD", { method: this._method, url: this._url, responseTextLength: typeof this.responseText === "string" ? this.responseText.length : -1 }); } catch (_) {}
                  }
                  this._dispatchEvent('load');
                  this._dispatchEvent('loadend');
                })
                .catch((err) => {
                  if (this._timeoutTimer) clearTimeout(this._timeoutTimer);
                  if (err.name === 'AbortError') return; // Handled locally inside wrapper pipelines

                  if (pageEmulator?.network?.logXMLHttpRequests) {
                    try { console.warn("[XHR v20] ERROR", { method: this._method, url: this._url, error: err && err.message || String(err) }); } catch (_) {}
                  }
                  this.status = 0;
                  this._changeState(XMLHttpRequestPolyfill.DONE);
                  this._dispatchEvent('error');
                  this._dispatchEvent('loadend');
                });
            }
          }

          // Bind prototype constant fallback chains
          [XMLHttpRequestPolyfill, XMLHttpRequestPolyfill.prototype].forEach(target => {
            target.UNSENT = 0;
            target.OPENED = 1;
            target.HEADERS_RECEIVED = 2;
            target.LOADING = 3;
            target.DONE = 4;
          });

          // Hot swap global object space natively
          global.XMLHttpRequest = XMLHttpRequestPolyfill;
        })();

        const oldGetEntriesByType = performance.getEntriesByType;
        performance.getEntriesByType = function() {
          var value = oldGetEntriesByType.apply(this,arguments);
          for (var i in value) value[i].name = DOCUMENT_URL;
          return value;
        }

        const originalAddEventListener = EventTarget.prototype.addEventListener;
        const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
        const listenerMap = new WeakMap();

        EventTarget.prototype.addEventListener = function(type, listener, options) {
          if (type !== 'message' || typeof listener !== 'function') {
            return originalAddEventListener.call(this, type, listener, options);
          }
          const wrappedListener = function(event) {
            // Keep message.source consistent with the virtual contentWindow
            // exposed by this emulator, even when srcdoc inherits a non-opaque
            // origin. Only rewrite the origin for opaque/srcdoc messages.
            let sourceProxy = null;
            try {
              const nativeParentWindow = window.parent;
              const parentPage = pageEmulator?.parent && pageEmulator.parent !== false ? pageEmulator.parent : null;
              if (parentPage && event.source === nativeParentWindow) {
                // window.parent and MessageEvent.source must use the exact same
                // caller-realm proxy for TurboWarp's strict source check.
                sourceProxy = getCallerWindowProxy(parentPage, nativeParentWindow);
              } else {
                const sourcePage = (pageEmulator?.children || []).find(child =>
                  child?.iframe?.__wkNativeContentWindow === event.source
                );
                if (sourcePage) {
                  sourceProxy = getCallerWindowProxy(sourcePage, event.source);
                } else {
                  sourceProxy = event.source?.__windowProxy || null;
                }
              }
            } catch (_) {}
            const rewriteOrigin = !event.origin || event.origin === 'null' || event.origin === 'about:srcdoc';
            if (!sourceProxy && !rewriteOrigin) {
              return listener.call(this, event);
            }

            const proxyEvent = new Proxy(event, {
              get(target, prop) {
                if (prop === 'origin' && rewriteOrigin) return BASE_ORIGIN;
                if (prop === 'source' && sourceProxy) return sourceProxy;
                const val = target[prop];
                return typeof val === 'function' ? val.bind(target) : val;
              }
            });
            return listener.call(this, proxyEvent);
          };
          listenerMap.set(listener, wrappedListener);
          return originalAddEventListener.call(this, type, wrappedListener, options);
        };

        EventTarget.prototype.removeEventListener = function(type, listener, options) {
          if (type === 'message' && typeof listener === 'function' && listenerMap.has(listener)) {
            return originalRemoveEventListener.call(this, type, listenerMap.get(listener), options);
          }
          return originalRemoveEventListener.call(this, type, listener, options);
        };

        Object.defineProperty(window, 'frameElement', {
          get: function() { return isTopLevel ? null : wrapElement(window.__frameElement); },
          set: undefined,
          configurable: true,
          enumerable: true
        });

        function createStorageProxy(storageProvider, storagePrefix) {
          return new Proxy(storageProvider, {
            // Intercept property access (e.g., storage.getItem, storage.length, storage.foo)
            get(target, prop, receiver) {
              // 1. Handle explicit method overrides
              if (prop === 'setItem') {
                return (key, value) => target.setItem(storagePrefix + key, value);
              }
              if (prop === 'getItem') {
                return (key) => target.getItem(storagePrefix + key);
              }
              if (prop === 'removeItem') {
                return (key) => target.removeItem(storagePrefix + key);
              }
              if (prop === 'clear') {
                return () => {
                  const keysToRemove = [];
                  for (let i = 0; i < target.length; i++) {
                    const internalKey = target.key(i);
                    if (internalKey && internalKey.startsWith(storagePrefix)) {
                      keysToRemove.push(internalKey);
                    }
                  }
                  keysToRemove.forEach(key => target.removeItem(key));
                };
              }
              if (prop === 'key') {
                return (index) => {
                  let internalIndex = 0;
                  for (let i = 0; i < target.length; i++) {
                    const internalKey = target.key(i);
                    if (internalKey && internalKey.startsWith(storagePrefix)) {
                      if (internalIndex === index) {
                        return internalKey.slice(storagePrefix.length);
                      }
                      internalIndex++;
                    }
                  }
                  return null;
                };
              }

              // 2. Handle 'length' property override
              if (prop === 'length') {
                let count = 0;
                for (let i = 0; i < target.length; i++) {
                  const internalKey = target.key(i);
                  if (internalKey && internalKey.startsWith(storagePrefix)) {
                    count++;
                  }
                }
                return count;
              }

              // 3. Support direct property access (e.g., storageProxy.myKey)
              if (typeof prop === 'string') {
                return target.getItem(storagePrefix + prop);
              }

              // Fallback for symbols or other unhandled properties
              const value = Reflect.get(target, prop, receiver);
              return typeof value === 'function' ? value.bind(target) : value;
            },

            // Intercept property assignment (e.g., storageProxy.myKey = 'value')
            set(target, prop, value) {
              if (typeof prop === 'string') {
                target.setItem(storagePrefix + prop, value);
                return true;
              }
              return Reflect.set(target, prop, value);
            },

            // Intercept the `delete` operator (e.g., delete storageProxy.myKey)
            deleteProperty(target, prop) {
              if (typeof prop === 'string') {
                target.removeItem(storagePrefix + prop);
                return true;
              }
              return Reflect.deleteProperty(target, prop);
            }
          });
        }

        const storagePrefix = BASE_ORIGIN + ":";
        const localStorageProxy = createStorageProxy(window.localStorage, storagePrefix);
        const sessionStorageProxy = createStorageProxy(window.sessionStorage, storagePrefix);
        Object.defineProperty(window, 'localStorage', {
          get: function() { return localStorageProxy; },
          set: undefined,
          configurable: true,
          enumerable: true
        });
        Object.defineProperty(window, 'sessionStorage', {
          get: function() { return localStorageProxy; },
          set: undefined,
          configurable: true,
          enumerable: true
        });

        // history & location
        const virtualLocation = Object.create(Location.prototype);
        Object.assign(virtualLocation, {
          href: DOCUMENT_URL,
          origin: BASE_ORIGIN,
          protocol: new URL(DOCUMENT_URL).protocol,
          host: new URL(DOCUMENT_URL).host,
          hostname: new URL(DOCUMENT_URL).hostname,
          pathname: new URL(DOCUMENT_URL).pathname,
          search: new URL(DOCUMENT_URL).search,
          hash: new URL(DOCUMENT_URL).hash,
          assign: function(newUrl) { sendEvent('navigate', newUrl, true); },
          replace: function(newUrl) { sendEvent('navigate', newUrl, false); },
          reload: function() { sendEvent('navigate', DOCUMENT_URL, false); },
          toString: function() { return DOCUMENT_URL; }
        });
        ['href', 'origin', 'protocol', 'host', 'hostname', 'pathname', 'search', 'hash'].forEach(function(prop) {
          Object.defineProperty(virtualLocation, prop, {
            get: function() {
              try {
                const current = new URL(DOCUMENT_URL);
                return current[prop];
              } catch (_) {
                return prop === 'href' ? DOCUMENT_URL : '';
              }
            },
            set: prop === 'href' ? function(u) { return this.assign(u); } : undefined,
            configurable: true,
            enumerable: true
          });
        });
        Object.defineProperty(virtualLocation, Symbol.toStringTag, {
          value: 'Location',
          configurable: true,
          writable: false,
          enumerable: false
        });

        Object.defineProperty(window, 'origin', {
          value: BASE_ORIGIN,
          configurable: true,
          writable: true
        });

        Object.defineProperty(PerformanceNavigationTiming.prototype, 'name', {
          value: DOCUMENT_URL,
          enumerable: true,
          configurable: true
        });

        var documentTarget = Object.create(Document.prototype);
        Object.getOwnPropertyNames(document).forEach(prop => {
          try {
            if (prop === 'location') {
              Object.defineProperty(documentTarget, prop, {
                get: function() { return virtualLocation; },
                set: function(url) { virtualLocation.assign(url); },
                configurable: true,
                enumerable: true
              });
              return;
            }
            const desc = Object.getOwnPropertyDescriptor(document, prop);
            if (desc) {
              Object.defineProperty(documentTarget, prop, desc);
            }
          } catch(e) {
            console.log("Failed to clone 2:", prop);
          }
        });
        function virtualizeDocumentSelector(selector) {
          if (typeof selector !== 'string') return selector;
          return selector.replace(/(^|[,>+~\s])script(\s*)\[src([\s~|^$*]?=)/gi, '$1script$2[data-raw-src$3');
        }

        const documentProxy = new Proxy(documentTarget, {
          has(target, prop) {
            if (prop === 'location') return true;
            return Reflect.has(document, prop);
          },
          get(target, prop) {
            if (prop === Symbol.unscopables) return undefined;
            
            // Force document.location to return the virtual location object
            if (prop === 'location') return virtualLocation;
            if (prop === 'referrer') return '';
            if (prop === 'documentURI') return DOCUMENT_URL;
            if (prop === 'URL') return DOCUMENT_URL;
            if (prop === 'defaultView') return windowProxy;
            if (prop === 'domain') return new URL(CURRENT_PAGE_URL).hostname;

            // --- Intercept document.open() to prevent context wiping ---
            if (prop === 'open') {
              return function(...args) {
                const ret = Reflect.apply(document.open, document, args);
                return documentProxy;
              };
            }

            // --- Intercept document.write() and document.writeln() ---
            if (prop === 'write' || prop === 'writeln') {
              return function(...args) {
                (async function() {
                  const htmlContent = args.join('');
                  let processedHtml = await usefulHelpers.sandboxSource(htmlContent, pageEmulator, true);
                  Reflect.apply(document[prop], document, [processedHtml]);
                })();
              };
            }

            // --- Intercept document.close() ---
            if (prop === 'close') {
              return function(...args) {
                return Reflect.apply(document.close, document, args);
              };
            }
            
            // HTMLCollection-backed document properties are live, but their
            // elements still need the emulator's element wrappers.
            if (prop === 'scripts') return wrapDOMCollection(document.scripts);

            const value = Reflect.get(document, prop, document);

            // Virtualized resource attributes are stored in data-raw-* while the
            // live DOM uses rewritten URLs. Make selector queries see the same
            // logical attributes that getAttribute()/element.src expose.
            if (prop === 'querySelector' || prop === 'querySelectorAll') {
              return function(selector) {
                const virtualSelector = virtualizeDocumentSelector(selector);
                const result = value.call(document, virtualSelector);
                if (prop === 'querySelectorAll') return Array.from(result).map(wrapElement);
                return wrapElement(result);
              };
            }

            // Handle native methods (like document.getElementById, etc.)
            if (isNativeFunction(value) && !value.prototype && prop != 'constructor') {
              return function(){
                const args = Array.from(arguments).map(v => v == documentProxy ? document : v);
                return wrapDocumentValue(Reflect.apply(value, document, args));
              };
            }
            if (typeof value == 'function' && prop != 'constructor') {
              return function(){
                const receiver = this == documentProxy ? document : this;
                return wrapDocumentValue(Reflect.apply(value, receiver, arguments));
              };
            }
            return wrapDocumentValue(value);
          },
          set(target, prop, value) {
            if (prop === 'location') {
              virtualLocation.assign(value);
              return true;
            }
            const ret = Reflect.set(document, prop, value, document);
            const desc = Object.getOwnPropertyDescriptor(document, prop);
            if (desc && desc.configurable) {
              Reflect.defineProperty(target, prop, desc);
            }
            return ret;
          },
          ownKeys(target) {
            return Reflect.ownKeys(target);
          },
          getOwnPropertyDescriptor(target, prop) {
            return Reflect.getOwnPropertyDescriptor(target, prop);
          },
          defineProperty(target, prop, desc) {
            try {
              Object.defineProperty(document, prop, desc);
            } catch (e) {
              console.warn("Failed to define property on true document:", prop, e);
            }
            return Reflect.defineProperty(target, prop, desc);
          },
          deleteProperty(target, prop) {
            try {
              Reflect.deleteProperty(document, prop);
            } catch(e) {}
            return Reflect.deleteProperty(target, prop);
          }
        });

        function updateVirtualDocumentURL(url) {
          try {
            const resolvedUrl = new URL(url, DOCUMENT_URL).href;
            DOCUMENT_URL = resolvedUrl;
            CURRENT_PAGE_URL = resolvedUrl;
            try { BASE_ORIGIN = new URL(resolvedUrl).origin; } catch (_) {}
            try { window.origin = BASE_ORIGIN; } catch (_) {}
            return resolvedUrl;
          } catch (_) {
            return DOCUMENT_URL;
          }
        }

        var virtualHistory;
        Object.keys(virtualHistory = {
          state: null,
          length: pageEmulator.history ? pageEmulator.history.length : 1,
          pushState: function(state, unused, url) {
            this.state = state;
            if (url) {
              const resolvedUrl = new URL(url, virtualLocation.href).href;
              updateVirtualDocumentURL(resolvedUrl);
              sendEvent('navigate', resolvedUrl, true, false);
            }
          },
          replaceState: function(state, unused, url) {
            this.state = state;
            if (url) {
              const resolvedUrl = new URL(url, virtualLocation.href).href;
              updateVirtualDocumentURL(resolvedUrl);
              sendEvent('navigate', resolvedUrl, true, true);
            }
          },
          go: function(delta) {
            if (!pageEmulator || typeof delta !== 'number' || delta === 0) return;
            const targetIndex = pageEmulator.historyIndex + delta;
            if (targetIndex >= 0 && targetIndex < pageEmulator.history.length) {
              pageEmulator.historyIndex = targetIndex;
              const targetUrl = pageEmulator.history[targetIndex];
              sendEvent('navigate', targetUrl, false);
            }
          },
          back: function() {
            this.go(-1);
          },
          forward: function() {
            this.go(1);
          }
        }).forEach((k,v)=>window.history[k] = virtualHistory[k]);

        var windowTarget = Object.create(Window.prototype);
        Object.getOwnPropertyNames(window).forEach(prop => {
          try {
            if (prop === 'location') {
              Object.defineProperty(windowTarget, prop, {
                get: function() { return virtualLocation; },
                set: function(url) { virtualLocation.assign(url); },
                configurable: true,
                enumerable: true
              });
              return;
            }
            if (prop === 'document') {
              Object.defineProperty(windowTarget, prop, {
                get: function() { return documentProxy; },
                set: undefined,
                configurable: true,
                enumerable: true
              });
              return;
            }
            if (['window','globalThis','self'].includes(prop)) {
              Object.defineProperty(windowTarget, prop, {
                get: function() { return window.__windowProxy; },
                set: undefined,
                configurable: true,
                enumerable: prop !== 'globalThis'
              });
              return;
            }
            const desc = Object.getOwnPropertyDescriptor(window, prop);
            if (desc) {
              Object.defineProperty(windowTarget, prop, desc);
            }
          } catch(e) {
            console.log("Failed to clone:", prop);
          }
        });
        let windowProxy;
        function getTopPage() {
          let current = pageEmulator;
          const seen = new Set();
          while (current?.parent && current.parent !== false && !seen.has(current)) {
            seen.add(current);
            current = current.parent;
          }
          return current || pageEmulator;
        }
        function getChildPage(key) {
          const children = pageEmulator?.children || [];
          if (typeof key === 'number' || (typeof key === 'string' && /^\d+$/.test(key))) {
            return children[Number(key)] || null;
          }
          if (typeof key === 'string') {
            return children.find(child => child?.iframe?.name === key || child?.iframe?.id === key) || null;
          }
          return null;
        }

        // A WindowProxy returned by another PageEmulator is implemented in
        // that other frame's realm. Calling its proxied postMessage from this
        // frame would therefore make the browser attribute the message to the
        // wrong browsing context. Wrap ancestor windows in the caller's realm
        // and invoke the matching native ancestor WindowProxy directly.
        const callerWindowProxyCache = new Map();
        function getCallerWindowProxy(targetPage, nativeTargetWindow) {
          if (!targetPage || targetPage === pageEmulator) return windowProxy;
          if (!targetPage.__windowProxy && nativeTargetWindow && targetPage.iframe && typeof window.__runSyncInterceptor === 'function') {
            // A frame may be reachable before its runtime interceptor has been
            // installed. Initialize its emulator proxy rather than exposing the
            // native WindowProxy as a temporary fallback.
            try {
              window.__runSyncInterceptor(targetPage.iframe, nativeTargetWindow);
            } catch (_) {}
          }
          if (!targetPage.__windowProxy || !nativeTargetWindow) {
            // Never return a native WindowProxy to code running in the emulated page.
            return targetPage.__windowProxy || windowProxy;
          }
          const cacheKey = targetPage;
          const targetWindowProxy = targetPage.__windowProxy;
          const cachedProxy = callerWindowProxyCache.get(cacheKey);
          if (
            cachedProxy &&
            cachedProxy.nativeTargetWindow === nativeTargetWindow &&
            cachedProxy.targetWindowProxy === targetWindowProxy
          ) return cachedProxy.proxy;

          const callerProxy = new Proxy(targetWindowProxy, {
            get(target, prop) {
              if (prop === 'postMessage') {
                return function(message, targetOrigin, transfer) {
                  try {
                    const origin = targetOrigin || '*';
                    nativeTargetWindow.postMessage(message, origin, transfer);
                  } catch (error) {
                    try { nativeTargetWindow.postMessage(message, '*'); } catch (_) {}
                  }
                };
              }

              if (prop === 'parent') {
                const parentPage = targetPage.parent && targetPage.parent !== false ? targetPage.parent : null;
                if (!parentPage) return callerProxy;
                let nativeParentWindow = null;
                try { nativeParentWindow = nativeTargetWindow.parent; } catch (_) {}
                return getCallerWindowProxy(parentPage, nativeParentWindow);
              }

              if (prop === 'top') {
                let topPage = targetPage;
                let nativeTopWindow = nativeTargetWindow;
                const seen = new Set();
                while (topPage?.parent && topPage.parent !== false && !seen.has(topPage)) {
                  seen.add(topPage);
                  topPage = topPage.parent;
                  try { nativeTopWindow = nativeTopWindow.parent; } catch (_) { break; }
                }
                return getCallerWindowProxy(topPage, nativeTopWindow);
              }

              return Reflect.get(target, prop, target);
            }
          });

          callerWindowProxyCache.set(cacheKey, {
            nativeTargetWindow,
            targetWindowProxy,
            proxy: callerProxy
          });
          return callerProxy;
        }

        windowProxy = new Proxy(windowTarget, {
          has(target, prop) {
            if (prop === 'location' || prop === 'document' || ['window','parent','top','globalThis','self','frames'].includes(prop)) {
              return true;
            }
            if (typeof prop === 'string' && /^\d+$/.test(prop)) return Number(prop) < (pageEmulator?.children || []).length;
            return Reflect.has(target, prop) || Reflect.has(window, prop);
          },
          get(target, prop) {
            if (prop === Symbol.unscopables) return undefined;
            if (prop === 'location') return virtualLocation;

            // Device emulation is shared by the browser shell through the
            // PageEmulator object. Reading these through the window proxy keeps
            // navigator/screen values live when the device is rotated.
            const getDeviceEmulation = () => {
              let current = pageEmulator;
              const seen = new Set();
              while (current && !seen.has(current)) {
                seen.add(current);
                if (current.deviceEmulation?.enabled) return current.deviceEmulation;
                current = current.parent && current.parent !== false ? current.parent : null;
              }
              return null;
            };
            if (prop === 'navigator' || prop === 'screen' || prop === 'devicePixelRatio' || prop === 'orientation') {
              const emulation = getDeviceEmulation();
              if (emulation) {
                const width = Math.max(200, Math.round(Number(emulation.width) || 390));
                const height = Math.max(240, Math.round(Number(emulation.height) || 844));
                const landscape = width >= height;
                if (prop === 'devicePixelRatio') return Number(emulation.deviceScaleFactor) || 1;
                if (prop === 'orientation') return landscape ? 90 : 0;
                if (prop === 'navigator') {
                  const nativeNavigator = Reflect.get(window, 'navigator', window);
                  const ios = emulation.platform === 'ios';
                  const androidPlatformVersion = /Android 10/i.test(emulation.userAgent || '') ? '10.0.0' : '14.0.0';
                  const uaData = ios ? undefined : {
                    brands: [{brand:'Chromium',version:'120'},{brand:'Google Chrome',version:'120'}],
                    mobile: true,
                    platform: 'Android',
                    getHighEntropyValues: async function() {
                      return {
                        architecture: '', bitness: '',
                        model: emulation.deviceId === 'pixel-7' ? 'Pixel 7' : '',
                        platform: 'Android', platformVersion: androidPlatformVersion,
                        uaFullVersion: '120.0.0.0',
                        fullVersionList: this.brands, mobile: true
                      };
                    }
                  };
                  return new Proxy(nativeNavigator, {
                    get(target, key) {
                      if (key === 'userAgent') return emulation.userAgent || (ios
                        ? (emulation.deviceId === 'ipad-mini'
                          ? 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
                          : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
                        : 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
                      if (key === 'platform') return ios ? (emulation.deviceId === 'ipad-mini' ? 'iPad' : 'iPhone') : 'Linux armv8l';
                      if (key === 'vendor') return ios ? 'Apple Computer, Inc.' : 'Google Inc.';
                      if (key === 'maxTouchPoints') return 5;
                      if (key === 'userAgentData') return uaData;
                      const value = Reflect.get(target, key, target);
                      return typeof value === 'function' ? value.bind(target) : value;
                    }
                  });
                }
                if (prop === 'screen') {
                  const nativeScreen = Reflect.get(window, 'screen', window);
                  return new Proxy(nativeScreen, {
                    get(target, key) {
                      if (key === 'width' || key === 'availWidth') return width;
                      if (key === 'height' || key === 'availHeight') return height;
                      if (key === 'orientation') {
                        const orientation = Reflect.get(target, key, target);
                        if (!orientation) return orientation;
                        return new Proxy(orientation, {
                          get(orientationTarget, orientationKey) {
                            if (orientationKey === 'angle') return landscape ? 90 : 0;
                            if (orientationKey === 'type') return landscape ? 'landscape-primary' : 'portrait-primary';
                            const value = Reflect.get(orientationTarget, orientationKey, orientationTarget);
                            return typeof value === 'function' ? value.bind(orientationTarget) : value;
                          }
                        });
                      }
                      const value = Reflect.get(target, key, target);
                      return typeof value === 'function' ? value.bind(target) : value;
                    }
                  });
                }
              }
            }
            if (prop === 'document') return documentProxy;
            if (['window','globalThis','self','frames'].includes(prop)) return windowProxy;
            if (prop === 'length') return (pageEmulator?.children || []).length;
            if (prop === 'top') {
              const topPage = getTopPage();
              if (topPage === pageEmulator) return windowProxy;
              let nativeTopWindow = window;
              const seen = new Set();
              let currentPage = pageEmulator;
              while (currentPage?.parent && currentPage.parent !== false && !seen.has(currentPage)) {
                seen.add(currentPage);
                currentPage = currentPage.parent;
                try { nativeTopWindow = nativeTopWindow.parent; } catch (_) { break; }
              }
              return getCallerWindowProxy(topPage, nativeTopWindow);
            }
            if (prop === 'parent') {
              const parentPage = pageEmulator?.parent && pageEmulator.parent !== false ? pageEmulator.parent : null;
              if (!parentPage) return windowProxy;
              let nativeParentWindow = null;
              try { nativeParentWindow = window.parent; } catch (_) {}
              return getCallerWindowProxy(parentPage, nativeParentWindow);
            }
            if (prop === 'postMessage') {
              return function(message, targetOrigin, transfer) {
                // postMessage is a method of the Window being referenced.
                // In particular, window.top.postMessage() must target top,
                // not resolve the target from the child that created this proxy.
                var receiverPage = pageEmulator;
                if (this && this !== windowProxy) {
                  var current = pageEmulator;
                  var seen = new Set();
                  while (current && !seen.has(current)) {
                    seen.add(current);
                    if (current.__windowProxy === this) {
                      receiverPage = current;
                      break;
                    }
                    current = current.parent && current.parent !== false ? current.parent : null;
                    if (!current) break;
                  }
                  if (pageEmulator?.parent && pageEmulator.parent !== false && pageEmulator.parent.__windowProxy === this) {
                    receiverPage = pageEmulator.parent;
                  }
                }
                var targetFrame = receiverPage?.iframe;
                var targetWindow = targetFrame?.__wkNativeContentWindow || null;

                // A nested frame's public contentWindow getter returns its
                // virtual proxy. Calling postMessage on that proxy here would
                // recursively route the same message back to itself. Prefer the
                // native WindowProxy captured before the getter was replaced.
                if (!targetWindow && targetFrame) {
                  try {
                    var nativeContentWindowGetter = Object.getOwnPropertyDescriptor(
                      HTMLIFrameElement.prototype,
                      'contentWindow'
                    )?.get;
                    if (nativeContentWindowGetter) {
                      targetWindow = Reflect.apply(nativeContentWindowGetter,targetFrame,[]);
                    }
                  } catch(e) {}
                }

                // Root browser tabs are not wrapped by another emulated page, so
                // their iframe.contentWindow is already the native WindowProxy.
                if (!targetWindow && targetFrame) {
                  try { targetWindow = targetFrame.contentWindow; } catch(e) {}
                }
                if (!targetWindow || targetWindow === receiverPage?.__windowProxy || typeof targetWindow.postMessage !== 'function') {
                  return;
                }
                try {
                  var origin = targetOrigin || '*';
                  targetWindow.postMessage(message, origin, transfer);
                } catch(e) {
                  try { targetWindow.postMessage(message, '*'); } catch(_) {}
                }
              };
            }
            if (typeof prop === 'string' && /^\d+$/.test(prop)) {
              const child = getChildPage(prop);
              if (!child) return undefined;
              const nativeChildWindow = child.iframe?.__wkNativeContentWindow || null;
              return nativeChildWindow ? getCallerWindowProxy(child, nativeChildWindow) : child.__windowProxy || undefined;
            }
            if (typeof prop === 'string') {
              const child = getChildPage(prop);
              if (child?.__windowProxy) {
                const nativeChildWindow = child.iframe?.__wkNativeContentWindow || null;
                return nativeChildWindow ? getCallerWindowProxy(child, nativeChildWindow) : child.__windowProxy;
              }
            }
            const value = Reflect.get(window, prop, window);
            if (isNativeFunction(value) && !value.prototype) {
              return value.bind(window);
            }
            return value;
          },
          set(target, prop, value) {
            if (prop === 'location') {
              virtualLocation.assign(value);
              return true;
            }
            const ret = Reflect.set(window, prop, value, window);
            const desc = Object.getOwnPropertyDescriptor(window, prop);
            if (desc && desc.configurable) {
              Reflect.defineProperty(target, prop, desc);
            }
            return ret;
          },
          ownKeys(target) {
            return Reflect.ownKeys(target);
          },
          getOwnPropertyDescriptor(target, prop) {
            return Reflect.getOwnPropertyDescriptor(target, prop);
          },
          defineProperty(target, prop, desc) {
            try {
              Object.defineProperty(window, prop, desc);
            } catch (e) {
              console.warn("Failed to define property on true window:", prop, e);
            }
            return Reflect.defineProperty(target, prop, desc);
          },
          deleteProperty(target, prop) {
            try {
              Reflect.deleteProperty(window, prop);
            } catch(e) {}
            return Reflect.deleteProperty(target, prop);
          }
        });

        // 1. Store pure, raw native references BEFORE overriding anything
        const rawCall = Function.prototype.call;
        const rawApply = Function.prototype.apply;
        const rawBind = Function.prototype.bind;
        const rawToString = Function.prototype.toString;
        const rawReflectApply = Reflect.apply;

        // 2. Safe native check that DOES NOT invoke .call() on any prototype
        function isNativeFunction(fn) {
          if (typeof fn !== 'function') return false;
          try {
            // Use rawReflectApply so we don't trigger Function.prototype.call
            const str = rawReflectApply(rawToString, fn, []);
            return str.includes('[native code]');
          } catch (e) {
            return false;
          }
        }

        function normalizeThis(fn, thisArg) {
          // Prevent recursion on Function prototype methods themselves
          if (fn === rawCall || fn === rawApply || fn === rawBind || fn === rawToString) {
            return thisArg;
          }

          // Native browser functions (e.g., addEventListener, setTimeout) MUST keep real window/target
          if (isNativeFunction(fn)) {
            if (thisArg == windowProxy) return window;
            return (thisArg === undefined || thisArg === null) ? window : thisArg;
          }

          // User functions: redirect default global (undefined/null/real window) to windowProxy
          if (thisArg === undefined || thisArg === null || thisArg === window) {
            return windowProxy;
          }

          return thisArg;
        }

        // 3. Apply overrides safely using cached rawReflectApply
        Function.prototype.bind = function(thisArg, ...args) {
          const targetThis = normalizeThis(this, thisArg);
          const boundFn = rawReflectApply(rawBind, this, [targetThis, ...args]);

          Object.defineProperty(boundFn, '__boundThis__', {
            value: targetThis,
            writable: false,
            enumerable: false,
            configurable: true
          });

          return boundFn;
        };

        Function.prototype.call = function(thisArg, ...args) {
          const targetThis = normalizeThis(this, thisArg);
          return rawReflectApply(rawCall, this, [targetThis, ...args]);
        };

        Function.prototype.apply = function(thisArg, argsArray) {
          const targetThis = normalizeThis(this, thisArg);
          return rawReflectApply(rawApply, this, [targetThis, argsArray || []]);
        };

        window.__windowProxy = windowProxy;
        pageEmulator.__windowProxy = windowProxy;
        pageEmulator.__getCallerWindowProxy = getCallerWindowProxy;
        window.__rawReflectApply = rawReflectApply;
        window.__hostURL = window.top.location.href;
        window.__hostOrigin = window.top.location.origin;
      })();

      window.__executeCode = function(__codeString, __sourceURL, __thisArg, __event) {
        var { __importModule } = __createModuleControls(__getScriptFileName());
        var __requireModule = __importModule;

        __codeString = window.__usefulHelpers.editCode(__codeString);
        return __rawReflectApply(function(window, self, globalThis, parent, top, location, document) {
          with (__globalLexicalScope) {
            return eval(`
            ${__event ? 'let event = __event;' : ''}
            ${__codeString.code}
            \n//# sourceURL=`+__sourceURL);
          }
        }, __thisArg, [__windowProxy, __windowProxy, __windowProxy, __windowProxy.parent, __windowProxy.top, __windowProxy.location, __windowProxy.document]);
      };

      window.__executeCodeAsync = function(__codeString, __sourceURL, __thisArg, __event) {
        var { __importModule } = __createModuleControls(__getScriptFileName());
        var __requireModule = __importModule;
        
        __codeString = window.__usefulHelpers.editCode(__codeString);
        __codeString = window.__usefulHelpers.editCodeAsync(__codeString);
        return __rawReflectApply(async function(window, self, globalThis, parent, top, location, document) {
          let __execResult;
          with (__globalLexicalScope) {
            await eval(`
            ${__event ? 'let event = __event;' : ''}
            (async function(){
              ${__codeString.code}
            })();
            \n//# sourceURL=`+__sourceURL);
          }
          return { value: __execResult };
        }, __thisArg, [__windowProxy, __windowProxy, __windowProxy, __windowProxy.parent, __windowProxy.top, __windowProxy.location, __windowProxy.document]);
      };

      window.__executeCodeModule = function(__codeString, __sourceURL, __thisArg, __event, __scriptFileName) {
        var { __importModule, __exportModule, __currentModuleExports } = __createModuleControls(__getScriptFileName(__scriptFileName));
        var __requireModule = __importModule;

        __codeString = `
          (async function(){
            ${window.__usefulHelpers.editCodeModule(__codeString)}
          })();
        `;

        __codeString = window.__usefulHelpers.editCode(__codeString);
        
        return __rawReflectApply(async function(window, self, globalThis, parent, top, location, document) {
          let __execResult;
          with (__globalLexicalScope) {
            await eval(`
            ${__event ? 'let event = __event;' : ''}
            ${__codeString.code}
            \n//# sourceURL=`+__sourceURL);
          }
          return __currentModuleExports;
        }, __thisArg, [__windowProxy, __windowProxy, __windowProxy, __windowProxy.parent, __windowProxy.top, __windowProxy.location, __windowProxy.document]);


      };
      // Hide emulator-only DOM state when page code serializes HTML.
      const nativeElementInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
      const nativeElementOuterHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML');

      function cleanSerializedElement(root) {
        if (!root || root.nodeType !== Node.ELEMENT_NODE) return root;
        const elements = [root, ...root.querySelectorAll('*')];
        for (const el of elements) {
          if (el.hasAttribute('data-embed-frame') || el.hasAttribute('data-embed-wrapper') || el.hasAttribute('data-page-id')) {
            if (el.parentNode) el.parentNode.removeChild(el);
            continue;
          }
          if (el.tagName === 'SCRIPT' && /createRuntimeInterceptor|__runSyncInterceptor|__pageRegistry/.test(el.textContent || '')) {
            if (el.parentNode) el.parentNode.removeChild(el);
            continue;
          }
          const rawScript = el.getAttribute('data-raw-script');
          if (el.tagName === 'SCRIPT' && rawScript != null) el.textContent = rawScript;
          const rawStyleText = el.getAttribute('data-raw-style-text');
          if (el.tagName === 'STYLE' && rawStyleText != null) el.textContent = rawStyleText;
          const rawStyle = el.getAttribute('data-raw-style');
          if (rawStyle != null) el.setAttribute('style', rawStyle);
          for (const attr of Array.from(el.attributes || [])) {
            if (!attr.name.startsWith('data-raw-')) continue;
            const publicName = attr.name.slice('data-raw-'.length);
            if (publicName === 'script') { el.removeAttribute(attr.name); continue; }
            if (publicName) el.setAttribute(publicName, attr.value);
            el.removeAttribute(attr.name);
          }
        }
        return root;
      }

      function serializePublicElement(elem, outer) {
        if (!elem) return '';
        const clone = elem.cloneNode(true);
        cleanSerializedElement(clone);
        return outer ? nativeElementOuterHTML.get.call(clone) : nativeElementInnerHTML.get.call(clone);
      }

      function serializePageElement(elem, outer) {
        return serializePublicElement(elem, outer);
      }
      window.__serializePublicElement = function(elem, outer) { return serializePublicElement(elem, outer); };
      window.__isEmulatorInjectedScript = function(code) { return /createRuntimeInterceptor|__runSyncInterceptor|__pageRegistry/.test(String(code || '')); };

      // Native HTML assignments bypass the MutationObserver until after the
      // current JavaScript turn. Queue the same dynamic-node processing for a
      // microtask instead of running it synchronously: page code must be able
      // to see the freshly-assigned DOM in its native state before the emulator
      // adds data/raw attributes, rewrites handlers, or virtualizes resources.
      const assignedNodeQueue = new Set();
      let assignedNodeFlushScheduled = false;

      function flushAssignedNodes() {
        assignedNodeFlushScheduled = false;
        const processNode = window.__checkNodeAndChildren;
        if (typeof processNode !== 'function') {
          assignedNodeQueue.clear();
          return;
        }

        const nodes = Array.from(assignedNodeQueue);
        assignedNodeQueue.clear();

        for (const node of nodes) {
          if (!node) continue;
          processNode(node);
          if (node.nodeType === Node.ELEMENT_NODE) {
            node.querySelectorAll('*').forEach(child => processNode(child));
          }
        }
      }

      function queueAssignedNodes(nodes) {
        for (const node of nodes || []) {
          if (node) assignedNodeQueue.add(node);
        }
        if (assignedNodeFlushScheduled) return;
        assignedNodeFlushScheduled = true;
        Promise.resolve().then(flushAssignedNodes);
      }

      // Resource-bearing nodes need an emulator request started immediately.
      // In particular, document.head.innerHTML += can replace an already
      // virtualized stylesheet with its original URL; waiting for a microtask
      // lets the native srcdoc document try to fetch that URL first.
      function primeAssignedResources(nodes) {
        const processNode = window.__checkNodeAndChildren;
        if (typeof processNode !== 'function') return;

        for (const node of nodes || []) {
          if (!node || node.nodeType !== Node.ELEMENT_NODE) continue;

          const resources = [];
          if (node.matches?.('link[href], script[src], img[src], audio[src], video[src], source[src], object[data]')) {
            resources.push(node);
          }
          if (node.querySelectorAll) {
            resources.push(...node.querySelectorAll(
              'link[href], script[src], img[src], audio[src], video[src], source[src], object[data]'
            ));
          }

          for (const resource of resources) {
            processNode(resource);
          }
        }
      }

      window.__processAssignedNodes = queueAssignedNodes;

      Object.defineProperty(Element.prototype, 'innerHTML', {
        configurable: nativeElementInnerHTML.configurable,
        enumerable: nativeElementInnerHTML.enumerable,
        get() { return serializePageElement(this, false); },
        set(value) {
          nativeElementInnerHTML.set.call(this, value);
          const nodes = Array.from(this.childNodes);
          primeAssignedResources(nodes);
          queueAssignedNodes(nodes);
        }
      });

      Object.defineProperty(Element.prototype, 'outerHTML', {
        configurable: nativeElementOuterHTML.configurable,
        enumerable: nativeElementOuterHTML.enumerable,
        get() { return serializePageElement(this, true); },
        set(value) {
          const parent = this.parentNode;
          const before = parent ? new Set(parent.childNodes) : null;
          nativeElementOuterHTML.set.call(this, value);

          if (!parent || !before) return;
          const nodes = Array.from(parent.childNodes).filter(node => !before.has(node));
          primeAssignedResources(nodes);
          queueAssignedNodes(nodes);
        }
      });
    }
    return `(${interceptorFunction.toString()})("${source_origin}","${base_url || source_url}","${source_url}");//# sourceURL=${name}`;
  }

  function createPageNetwork(network) {
    if (!(network instanceof Network)) return network || new Network();
    var pageNetwork = new Network();
    pageNetwork.endpoints = network.endpoints;
    Object.defineProperty(pageNetwork, 'logXMLHttpRequests', {
      configurable: true,
      get: () => !!network.logXMLHttpRequests,
      set: value => { network.logXMLHttpRequests = !!value; }
    });
    return pageNetwork;
  }

  class PageEmulator {
    constructor(iframe, options = {}) {
      this.id = Math.random().toString(36).substring(2);
      window.__pageRegistry[this.id] = this;
      this.__pageRegistry = window.__pageRegistry;

      if (iframe.pageEmulator) throw new Error("iframe already has an emulator");

      const { network, location, history } = options;

      this.iframe = iframe;
      iframe.setAttribute('data-page-id',this.id);
      iframe.pageEmulator = this;
      iframe.usefulHelpers = usefulHelpers;

      this.iframe.removeAttribute('src');
      this.iframe.removeAttribute('srcdoc');

      this.location = location || {
        url: 'http://localhost:3000/',
        origin: 'http://localhost:3000'
      };

      this.history = history || [];
      this.historyIndex = -1;
      this.network = createPageNetwork(network);

      this.parent = false;
      this.children = [];

      this.runtimeInterceptor = "";
      this.eventInterceptors = {};
    }

    remove() {
      if (!this.id && !this.iframe) return;

      const children = Array.isArray(this.children) ? this.children.slice() : [];
      children.forEach(child => child?.remove?.());

      const parent = this.parent;
      if (parent && parent !== false && Array.isArray(parent.children)) {
        const index = parent.children.indexOf(this);
        if (index >= 0) parent.children.splice(index, 1);
      }

      const iframe = this.iframe;
      if (iframe) {
        try {
          if (iframe.pageEmulator === this) delete iframe.pageEmulator;
          if (iframe.getAttribute?.('data-page-id') === this.id) iframe.removeAttribute('data-page-id');
          if (iframe.usefulHelpers === usefulHelpers) delete iframe.usefulHelpers;
        } catch (_) {}
      }

      delete __pageRegistry[this.id];
      for (const key of Object.keys(this)) delete this[key];
    }

    addChild(page) {
      if (!page || page === this) return page;
      if (page.parent === this && this.children.includes(page)) return page;
      if (page.parent && page.parent !== false && Array.isArray(page.parent.children)) {
        const oldIndex = page.parent.children.indexOf(page);
        if (oldIndex >= 0) page.parent.children.splice(oldIndex, 1);
      }
      page.parent = this;
      if (!this.children.includes(page)) this.children.push(page);
      return page;
    }

    async setDocument(rawHtml, processHtml = true, baseUrlOverride = null) {
      // A document replacement discards every nested browsing context from
      // the previous document. Release those PageEmulators before preprocessHtml
      // creates the child frames belonging to the new document.
      for (const child of (this.children || []).slice()) {
        this.sendEvent('iframe-remove', { iframe: child.iframe, page: child, reason: 'document-replaced' });
        if (this.children?.includes(child)) child.remove();
      }

      // Keep the exact source supplied to the emulator. DevTools Sources uses
      // this as the iframe's Original document, including dynamically-created
      // frames whose source was fetched after the parent page loaded.
      this.rawDocument = String(rawHtml ?? '');
      const finalHtml = await sandboxSource(rawHtml,this,processHtml,baseUrlOverride);

      // Use the native srcdoc setter exactly once. Assigning it twice starts
      // two separate iframe navigations and can leave a stale browsing context.
      const iframe = this.iframe;
      iframe.removeAttribute('src');
      iframe.removeAttribute('srcdoc');

      let srcdocSetter = null;
      for (let prototype = Object.getPrototypeOf(iframe); prototype && !srcdocSetter; prototype = Object.getPrototypeOf(prototype)) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'srcdoc');
        if (typeof descriptor?.set === 'function') srcdocSetter = descriptor.set;
      }

      if (srcdocSetter) {
        Reflect.apply(srcdocSetter, iframe, [finalHtml]);
      } else {
        iframe.setAttribute('srcdoc', finalHtml);
      }
    }

    setLocation(url, origin) {
      this.location.url = url;
      this.location.origin = origin;
    }

    setRuntimeInterceptor(funct) {
      this.runtimeInterceptor = extractFunctionBody(funct);
    }

    addRuntimeInterceptor(funct) {
      this.runtimeInterceptor = this.runtimeInterceptor + extractFunctionBody(funct);
    }

    deleteRuntimeInterceptor(funct) {
      this.runtimeInterceptor = '';
    }

    sendEvent(event, ...args) {
      var list = this.eventInterceptors[event];
      if (!list) return console.warn("No interceptor set up for: "+event);
      for (var i = 0; i < list.length; i++) {
        var ret = list[i].callback.apply(this, args);
        if (ret) return ret;
      }
    }

    async sendAsyncEvent(event, ...args) {
      var list = this.eventInterceptors[event];
      if (!list) return console.warn("No interceptor set up for: "+event);
      for (var i = 0; i < list.length; i++) {
        var ret = await list[i].callback.apply(this, args);
        if (ret) return ret;
      }
    }

    interceptEvent(event, callback, options) {
      this.eventInterceptors[event] = this.eventInterceptors[event] || [];
      this.eventInterceptors[event].push({callback,options});
      return callback;
    }
    removeEventListener(event, callback) {
      var list = this.eventInterceptors[event];
      if (!list) return;
      this.eventInterceptors[event] = list.filter(item => item.callback !== callback);
    }

    addEndpoint(endpoint) {
      this.network.addEndpoint(endpoint);
    }

    async runCommand(txt,source='<anonymous>') {
      var targetWin = this.iframe.contentWindow;
      return await targetWin.__executeCodeAsync(txt,source);
    }
  }

  window.PageEmulator = PageEmulator;

  // These are exposed for the existing runtime interceptor / browser-side
  // integrations without moving the implementations back into PageEmulator.
  window.createDataUri = createDataUri;
  window.rewriteCSSURLs = rewriteCSSURLs;
  window.getFileNameFromURL = getFileNameFromURL;
  window.sandboxSource = sandboxSource;
  window.preprocessHtml = preprocessHtml;

})();
