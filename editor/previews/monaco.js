(function () {
  const textMimes = ['application/json','application/manifest+json','application/javascript','application/typescript','application/xml','model/gltf+json'];
  function match(file) {
    const mime = String(file.mime || '');
    return mime.startsWith('text/') || textMimes.includes(mime) || mime === 'image/svg+xml' || String(file.name || '').toLowerCase().endsWith('.obj');
  }
  function language(path) {
    const ext = String(path || '').split('/').pop().split('.').pop().toLowerCase();
    return ({
      js:'javascript',mjs:'javascript',cjs:'javascript',ts:'typescript',tsx:'typescript',jsx:'javascript',json:'json',webmanifest:'json',
      html:'html',htm:'html',css:'css',scss:'scss',less:'less',md:'markdown',xml:'xml',yaml:'yaml',yml:'yaml',
      py:'python',pyw:'python',java:'java',kt:'kotlin',c:'c',h:'c',cpp:'cpp',cc:'cpp',cxx:'cpp',hpp:'cpp',
      sh:'shell',bash:'shell',sql:'sql',ini:'ini',toml:'ini',svg:'html',gltf:'json',frag:'glsl',vert:'glsl',glsl:'glsl',
      hlsl:'hlsl',fx:'hlsl',wgsl:'wgsl'
    })[ext] || 'plaintext';
  }
  const SHADER_LANGUAGES = {
    glsl: {
      extensions: ['.glsl', '.frag', '.vert'],
      aliases: ['GLSL', 'OpenGL Shading Language'],
      keywords: [
        'attribute','const','uniform','varying','buffer','shared','coherent','volatile','restrict','readonly','writeonly',
        'atomic_uint','layout','centroid','flat','smooth','noperspective','patch','sample','break','continue','do','for',
        'while','switch','case','default','if','else','subroutine','in','out','inout','invariant','discard','return',
        'precision','highp','mediump','lowp','struct','void'
      ],
      types: [
        'bool','int','uint','float','double','vec2','vec3','vec4','ivec2','ivec3','ivec4','uvec2','uvec3','uvec4',
        'bvec2','bvec3','bvec4','dvec2','dvec3','dvec4','mat2','mat3','mat4','mat2x2','mat2x3','mat2x4','mat3x2',
        'mat3x3','mat3x4','mat4x2','mat4x3','mat4x4','sampler1D','sampler2D','sampler3D','samplerCube',
        'sampler2DShadow','samplerCubeShadow','isampler2D','usampler2D','image2D','iimage2D','uimage2D'
      ],
      builtins: [
        'gl_Position','gl_PointSize','gl_ClipDistance','gl_VertexID','gl_InstanceID','gl_FragCoord','gl_FrontFacing',
        'gl_FragDepth','gl_PointCoord','gl_SampleID','gl_GlobalInvocationID','gl_LocalInvocationID','gl_WorkGroupID',
        'gl_NumWorkGroups','gl_FragColor','gl_FragData','gl_TexCoord','gl_Normal','gl_ModelViewMatrix'
      ]
    },
    hlsl: {
      extensions: ['.hlsl', '.fx'],
      aliases: ['HLSL', 'High Level Shading Language'],
      keywords: [
        'cbuffer','tbuffer','groupshared','globallycoherent','nointerpolation','noperspective','linear','centroid',
        'sample','in','out','inout','precise','shared','extern','static','uniform','volatile','row_major','column_major',
        'register','packoffset','technique','technique10','technique11','pass','compile','true','false','if','else',
        'switch','case','default','for','while','do','break','continue','return','discard','struct','typedef','namespace'
      ],
      types: [
        'void','bool','int','uint','dword','half','float','double','min10float','min16float','min12int','min16int',
        'min16uint','float1','float2','float3','float4','float2x2','float3x3','float4x4','int2','int3','int4',
        'uint2','uint3','uint4','bool2','bool3','bool4','matrix','vector','Texture1D','Texture2D','Texture3D',
        'TextureCube','Texture2DArray','Texture2DMS','SamplerState','SamplerComparisonState','Buffer','StructuredBuffer',
        'ByteAddressBuffer','RWTexture2D','RWBuffer','RWStructuredBuffer','AppendStructuredBuffer','ConsumeStructuredBuffer'
      ],
      builtins: [
        'SV_Position','SV_Target','SV_Target0','SV_Depth','SV_VertexID','SV_InstanceID','SV_PrimitiveID',
        'SV_IsFrontFace','SV_DispatchThreadID','SV_GroupThreadID','SV_GroupID','SV_GroupIndex','SV_Coverage'
      ]
    }
  };

  function registerShaderLanguage(monaco, id) {
    const spec = SHADER_LANGUAGES[id];
    if (!spec) return;
    if (!monaco.languages.getLanguages().some(language => language.id === id)) {
      monaco.languages.register({ id, extensions: spec.extensions, aliases: spec.aliases });
    }
    monaco.languages.setLanguageConfiguration(id, {
      comments: { lineComment: '//', blockComment: ['/*', '*/'] },
      brackets: [['{','}'], ['[',']'], ['(',')']],
      autoClosingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }, { open: '"', close: '"' }]
    });
    monaco.languages.setMonarchTokensProvider(id, {
      defaultToken: '',
      tokenPostfix: '.' + id,
      keywords: spec.keywords,
      types: spec.types,
      builtins: spec.builtins,
      tokenizer: {
        root: [
          [/^\s*#\s*[a-zA-Z_][\w]*/, 'keyword.directive'],
          [/\/\*.*\*\//, 'comment'],
          [/\/\*/, 'comment', '@comment'],
          [/\/\/.*$/, 'comment'],
          [/"([^"\\]|\\.)*"/, 'string'],
          [/'([^'\\]|\\.)*'/, 'string'],
          [/[a-zA-Z_][\w]*/, { cases: { '@keywords': 'keyword', '@types': 'type', '@builtins': 'predefined', '@default': 'identifier' } }],
          [/0[xX][0-9a-fA-F]+[uUlL]*/, 'number.hex'],
          [/(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?[fFuUlL]*/, 'number'],
          [/[{}()\[\]]/, '@brackets'],
          [/[;,.]/, 'delimiter'],
          [/[<>!=~?:&|+\-*\/%^]+/, 'operator']
        ],
        comment: [
          [/[^*/]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/./, 'comment']
        ]
      }
    });
  }

  let wgslLanguagePromise = null;
  async function ensureWGSL(monaco) {
    if (wgslLanguagePromise) return wgslLanguagePromise;
    wgslLanguagePromise = new Promise((resolve, reject) => {
      const amdRequire = window.require || (typeof require === 'function' ? require : null);
      if (!amdRequire) return reject(new Error('Monaco language loader is unavailable'));
      amdRequire(['vs/basic-languages/wgsl/wgsl'], module => {
        try {
          if (!monaco.languages.getLanguages().some(language => language.id === 'wgsl')) {
            monaco.languages.register({ id: 'wgsl', extensions: ['.wgsl'], aliases: ['WGSL', 'WebGPU Shading Language'] });
          }
          monaco.languages.setLanguageConfiguration('wgsl', module.conf);
          monaco.languages.setMonarchTokensProvider('wgsl', module.language);
          resolve();
        } catch (error) {
          reject(error);
        }
      }, reject);
    }).catch(error => {
      wgslLanguagePromise = null;
      throw error;
    });
    return wgslLanguagePromise;
  }

  function frame() {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
  }
  async function waitForUsableHost(host, maxFrames = 30) {
    for (let i = 0; i < maxFrames; i++) {
      if (!host?.isConnected) return false;
      const rect = host.getBoundingClientRect();
      if (rect.width > 1 && rect.height > 1) return true;
      await frame();
    }
    return !!host;
  }
  window.EditorPreviewProviders = window.EditorPreviewProviders || [];
  window.EditorPreviewProviders.push({
    id: 'monaco',
    match,
    views: [{
      id: 'edit',
      label: 'Edit',
      default: true,
      priority: 50,
      async create(ctx) {
        const host = ctx.host;
        const initial = ctx.readText();
        const fallback = document.createElement('textarea');
        fallback.className = 'editor-textarea';
        fallback.value = initial;
        fallback.spellcheck = false;
        fallback.autocorrect = 'off';
        fallback.autocapitalize = 'off';
        host.appendChild(fallback);
        try {
          // The workbench can attach a newly-created nested group during the
          // same activation turn. Do not create Monaco against a zero-sized
          // surface. Keep waiting for a real layout box rather than accepting
          // a connected-but-zero-sized host.
          const usable = await waitForUsableHost(host, 60);
          if (!usable || !ctx.isCurrent?.()) return;

          const monaco = await Promise.race([
            ctx.state.ensureMonaco(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Monaco timed out')), 10000))
          ]);
          if (!ctx.isCurrent?.()) return;

          const model = ctx.tab.model && !ctx.tab.model.isDisposed()
            ? ctx.tab.model
            : monaco.editor.createModel(initial, language(ctx.file.path));
          ctx.tab.model = model;

          const currentText = ctx.readText();
          if (model.getValue() !== currentText) model.setValue(currentText);

          let languageId = language(ctx.file.path);
          if (languageId === 'wgsl') {
            try {
              await ensureWGSL(monaco);
            } catch (error) {
              console.warn('WGSL language registration failed; using C-like highlighting:', error);
              languageId = 'cpp';
            }
          } else if (languageId === 'glsl' || languageId === 'hlsl') {
            registerShaderLanguage(monaco, languageId);
          }
          // Set the language explicitly both before and after editor creation.
          // The second pass covers startup races where a language contribution
          // registers after editor.main has initialized.
          monaco.editor.setModelLanguage(model, languageId);

          if (!ctx.isCurrent?.()) return;

          window.EditorTheme?.apply?.();
          const editor = monaco.editor.create(host, {
            model,
            theme: window.EditorTheme?.id || 'vs-dark',
            'semanticHighlighting.enabled': true,
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
            folding: true,
            wordWrap: 'off'
          });
          ctx.tab.editor = editor;
          const resizeObserver = typeof ResizeObserver === 'function'
            ? new ResizeObserver(() => { try { editor.layout(); } catch (_) {} })
            : null;
          ctx.addCleanup?.(() => {
            try { resizeObserver?.disconnect?.(); } catch (_) {}
            try { editor.dispose(); } catch (_) {}
          });
          if (!ctx.tab.listener) ctx.tab.listener = model.onDidChangeContent(() => {
            if (ctx.tab.view !== 'edit' || !ctx.state.fs) return;
            ctx.writeText(model.getValue());
            ctx.state.updateStatus?.();
          });
          editor.onDidDispose(() => { if (ctx.tab.editor === editor) ctx.tab.editor = null; });
          resizeObserver?.observe(host);

          fallback.remove();
          try { editor.layout(); } catch (_) {}
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
              try { monaco.editor.setModelLanguage(model, languageId); } catch (_) {}
              try { editor.layout(); } catch (_) {}
            });
            requestAnimationFrame(() => {
              try { editor.layout(); } catch (_) {}
            });
          }
        } catch (error) {
          // Keep the fallback editor visible and report the failure without
          // breaking the rest of the workbench.
          console.error('Monaco preview failed:', error);
        }
      }
    }]
  });
})();
