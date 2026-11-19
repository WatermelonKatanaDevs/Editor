(function() {
  const root = window.EditorAI = window.EditorAI || {};
  const HF_KEY_STORAGE = 'editor.aiHuggingFaceKey';
  const STORAGE_KEY = 'editor.aiModels.v2';
  const PROTOCOLS = {
    'openai-chat': {label:'OpenAI Chat Completions', tools:true},
    'openai-responses': {label:'OpenAI Responses', tools:true},
    'anthropic-messages': {label:'Anthropic Messages', tools:true},
    'google-gemini': {label:'Google Gemini', tools:true},
    'cohere-v2': {label:'Cohere Chat v2', tools:true},
    'gradio-space': {label:'Gradio Space', tools:false},
    'local-transformers': {label:'Local Browser Model', tools:false}
  };
  const PROVIDERS = {
    local: {label:'Local Browser Model', protocol:'local-transformers', endpoint:'', name:'Local browser model', model:'', supportsTools:false, supportsAgentTools:true, supportsReasoning:false, supportsStreaming:true, modelBrowser:null},
    huggingface: {label:'Hugging Face', protocol:'openai-chat', endpoint:'https://router.huggingface.co/v1', name:'Hugging Face', model:'', supportsTools:true, supportsReasoning:true, supportsStreaming:true, modelBrowser:{kind:'dynamic',path:'/models',auth:'bearer',responseKey:'data',idField:'id',freeFilter:true}},
    groq: {label:'Groq', protocol:'openai-chat', endpoint:'https://api.groq.com/openai/v1', name:'Groq', model:'openai/gpt-oss-120b', supportsTools:true, supportsReasoning:true, supportsStreaming:true, modelBrowser:{kind:'dynamic',path:'/models',auth:'bearer',responseKey:'data',idField:'id',freeFilter:false}, chatOptions:[
      {match:/gpt-oss/i,body:{include_reasoning:true}},
      {match:/^(?:qwen\/)?qwen3(?:\.|\-|$)/i,body:{reasoning_format:'parsed'}}
    ], toolCallRecovery:{status:400,errorCodes:['output_parse_failed'],strategy:'lower-temperature',maxRetries:2,factor:.5,minTemperature:.2}},
    'google-gemini': {label:'Google Gemini', protocol:'google-gemini', endpoint:'https://generativelanguage.googleapis.com', name:'Google Gemini', model:'gemini-3.8-flash', supportsTools:true, supportsReasoning:true, supportsStreaming:true, modelBrowser:{kind:'dynamic',path:'/v1beta/models',auth:'google',responseKey:'models',idField:'baseModelId',query:'pageSize=1000',filter:'generateContent',freeFilter:false}},
    custom: {label:'Custom', protocol:'openai-chat', endpoint:'', name:'', model:'', supportsTools:true, supportsReasoning:true, supportsStreaming:true, modelBrowser:null}
  };
  function isHuggingFaceEndpoint(endpoint){return /(?:^|\.)huggingface\.co(?:\/|$)/i.test(String(endpoint||''));}
  function getStoredHuggingFaceKey(){try{return String(localStorage.getItem(HF_KEY_STORAGE)||'').trim();}catch(_){return '';}}
  function setStoredHuggingFaceKey(key){try{if(key)localStorage.setItem(HF_KEY_STORAGE,key);else localStorage.removeItem(HF_KEY_STORAGE);}catch(_){}}
  function cleanModel(model) {
    model = model && typeof model === 'object' ? model : {};
    let protocol = String(model.protocol || '').trim();
    const kind = String(model.kind || '').trim();
    if (!protocol) protocol = kind === 'gradio-space' ? 'gradio-space' : 'openai-chat';
    if (!PROTOCOLS[protocol]) protocol = inferProtocol(model.endpoint) || '';
    const local = protocol === 'local-transformers' || !!model.local;
    return {
      id:String(model.id || '').trim(), provider:String(model.provider || '').trim(), name:String(model.name || model.model || 'Unnamed Model').trim(),
      kind:protocol, protocol, endpoint:String(model.endpoint || '').trim(),
      remoteModel:String(model.remoteModel || model.model || '').trim(), model:String(model.model || model.remoteModel || '').trim(),
      apiKey:String(model.apiKey || ''), anonymousAuth:String(model.anonymousAuth || ''), rememberKey:!!model.rememberKey,
      requiresKey:model.requiresKey !== undefined ? !!model.requiresKey : !local,
      supportsTools:model.supportsTools !== false, supportsAgentTools:!!model.supportsAgentTools,
      supportsReasoning:model.supportsReasoning !== false, supportsStreaming:model.supportsStreaming !== false,
      public:!!model.public, useSharedKeys:model.useSharedKeys !== false, local, builtInLocal:!!model.builtInLocal
    };
  }
  function inferProtocol(endpoint) {
    const url=String(endpoint || '').toLowerCase();
    if (!url) return '';
    if (url.includes('api.anthropic.com')) return 'anthropic-messages';
    if (url.includes('generativelanguage.googleapis.com')) return 'google-gemini';
    if (url.includes('api.cohere.com')) return 'cohere-v2';
    if (url.includes('/responses') || url.includes('api.openai.com')) return 'openai-responses';
    if (url.includes('hf.space')) return 'gradio-space';
    if (/chat\/completions|\/v1(?:\/)?$/i.test(url) || /openrouter|groq|together|fireworks|deepseek|mistral|x\.ai|xai|blockrun|huggingface|ollama/i.test(url)) return 'openai-chat';
    return '';
  }
  function loadModels() {
    let parsed=null;
    try { parsed=JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) {}
    if (!parsed) {
      try { const old=JSON.parse(localStorage.getItem('editor.aiModels.v1') || 'null'); if (old) parsed=old; } catch (_) {}
    }
    const stored=Array.isArray(parsed?.models) ? parsed.models.map(cleanModel).filter(x=>x.id && x.protocol && (x.protocol==='local-transformers' ? x.model : x.endpoint)) : [];
    const builtinDefaults=(root.LOCAL_MODELS||[]).map(cleanModel);
    const allBuiltinIds=new Set(builtinDefaults.map(x=>x.id));
    const disabledBuiltInIds=new Set(Array.isArray(parsed?.disabledBuiltInIds)?parsed.disabledBuiltInIds.map(String):[]);
    const storedById=new Map(stored.filter(x=>allBuiltinIds.has(x.id)).map(x=>[x.id,x]));
    let builtins=builtinDefaults.filter(base=>!disabledBuiltInIds.has(base.id)).map(base=>{
      const saved=storedById.get(base.id);
      return saved ? cleanModel({...base,name:saved.name||base.name,model:saved.model||base.model,remoteModel:saved.model||base.model}) : base;
    });
    const custom=stored.filter(x=>!allBuiltinIds.has(x.id));
    let models=[...builtins,...custom];
    if(!models.length){
      disabledBuiltInIds.clear();
      builtins=builtinDefaults;
      models=[...builtins];
    }
    const huggingFaceApiKey=String(parsed?.huggingFaceApiKey || getStoredHuggingFaceKey() || '').trim();
    let active=parsed?.activeModelId;
    if(!active || !models.some(x=>x.id===active)) active=models[0]?.id||'';
    return {activeModelId:active,models,disabledBuiltInIds:[...disabledBuiltInIds],huggingFaceApiKey,huggingFaceRememberKey:!!parsed?.huggingFaceRememberKey};
  }
  function saveModels(settings) {
    const builtinDefaults=(root.LOCAL_MODELS||[]).map(cleanModel);
    const allBuiltinIds=new Set(builtinDefaults.map(x=>x.id));
    const disabledBuiltInIds=new Set(Array.isArray(settings?.disabledBuiltInIds)?settings.disabledBuiltInIds.map(String):[]);
    const input=(settings?.models || []).map(cleanModel);
    const builtins=builtinDefaults.filter(base=>!disabledBuiltInIds.has(base.id)).map(base=>{
      const edited=input.find(x=>x.id===base.id);
      return edited ? cleanModel({...base,name:edited.name||base.name,model:edited.model||base.model,remoteModel:edited.model||base.model}) : base;
    });
    const builtinOverrides=builtins.filter((model,index)=>{
      const base=builtinDefaults.find(x=>x.id===model.id);
      return base&&(model.name!==base.name||model.model!==base.model);
    });
    const custom=input.filter(x=>x.id && !allBuiltinIds.has(x.id) && x.protocol && (x.protocol==='local-transformers' ? x.model : x.endpoint));
    let models=[...builtins,...custom];
    if(!models.length){
      disabledBuiltInIds.clear();
      models=builtinDefaults;
    }
    const active=models.some(x=>x.id===settings?.activeModelId) ? settings.activeModelId : (models[0]?.id||'');
    const rememberHF=!!settings?.huggingFaceRememberKey;
    const storedModels=[...builtinOverrides,...custom].map(x=>x.rememberKey?x:{...x,apiKey:''});
    const stored={version:4,activeModelId:active,disabledBuiltInIds:[...disabledBuiltInIds],huggingFaceApiKey:rememberHF?String(settings?.huggingFaceApiKey||'').trim():'',huggingFaceRememberKey:rememberHF,models:storedModels};
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(stored)); } catch (_) {}
    return {activeModelId:active,models,disabledBuiltInIds:[...disabledBuiltInIds],huggingFaceApiKey:String(settings?.huggingFaceApiKey||getStoredHuggingFaceKey()||'').trim(),huggingFaceRememberKey:rememberHF};
  }
  function get(settings) { return (settings?.models || []).find(x=>x.id===settings.activeModelId) || settings?.models?.[0] || null; }
  function protocolLabel(id) { return PROTOCOLS[id]?.label || 'Unsupported API format'; }
  class ProviderRegistry {
    constructor(){ this.settings=loadModels(); this.sharedKeyCursor=0; this.settings=saveModels(this.settings); }
    getHuggingFaceApiKey(){return String(this.settings.huggingFaceApiKey||'').trim();}
    setHuggingFaceApiKey(key,remember){const value=String(key||'').trim();this.settings.huggingFaceApiKey=value;this.settings.huggingFaceRememberKey=!!remember;if(remember)setStoredHuggingFaceKey(value);else setStoredHuggingFaceKey('');}
    clearHuggingFaceApiKey(){this.settings.huggingFaceApiKey='';setStoredHuggingFaceKey('');}
    getHuggingFaceKeySource(model){if(model?.apiKey)return 'model';if(this.getHuggingFaceApiKey())return 'user';return 'none';}
    getHuggingFaceRequestKey(custom=''){return String(custom||'').trim() || this.getHuggingFaceApiKey();}
    active(){ return get(this.settings); }
    setActive(id){ if(this.settings.models.some(x=>x.id===id)){this.settings.activeModelId=id;this.settings=saveModels(this.settings);} }
    add(model){
      const protocol=String(model.protocol || model.kind || '').trim() || inferProtocol(model.endpoint);
      if (!PROTOCOLS[protocol]) throw new Error(`Unsupported AI API format. Supported formats: ${Object.values(PROTOCOLS).map(x=>x.label).join(', ')}.`);
      const clean=cleanModel({...model,protocol,kind:protocol,id:model.id || 'model-'+Math.random().toString(36).slice(2)});
      const local=clean.local||clean.protocol==='local-transformers';
      if(!clean.id || (!local&&!clean.endpoint) || !clean.model) throw new Error(local?'A local model needs a name and model ID.':'A model needs a name, endpoint, and model ID.');
      const existing=this.settings.models.findIndex(x=>x.id===clean.id);
      if(existing>=0)this.settings.models[existing]=clean;else this.settings.models.push(clean);
      this.settings=saveModels(this.settings);
      return clean;
    }
    remove(id){
      if(!this.settings.models.some(x=>x.id===id) || this.settings.models.length<=1)return false;
      const builtinIds=new Set((root.LOCAL_MODELS||[]).map(x=>x.id));
      if(builtinIds.has(id)){
        this.settings.disabledBuiltInIds=Array.from(new Set([...(this.settings.disabledBuiltInIds||[]),id]));
      }
      this.settings.models=this.settings.models.filter(x=>x.id!==id);
      if(this.settings.activeModelId===id)this.settings.activeModelId=this.settings.models[0]?.id||'';
      this.settings=saveModels(this.settings);
      return true;
    }
    resetDefaults(){
      const models=(root.LOCAL_MODELS||[]).map(cleanModel);
      const activeModelId=String(root.DEFAULT_LOCAL_MODEL_ID||models[0]?.id||'');
      if(!models.length)throw new Error('No built-in AI models are configured.');
      this.settings={
        activeModelId,
        models,
        disabledBuiltInIds:[],
        huggingFaceApiKey:String(this.settings.huggingFaceApiKey||''),
        huggingFaceRememberKey:!!this.settings.huggingFaceRememberKey
      };
      this.settings=saveModels(this.settings);
      return this.settings;
    }
    save(){this.settings=saveModels(this.settings);return this.settings;}
    exportSettings(options={}){
      const preserveKeys=options.preserveKeys!==false;
      return {version:2,activeModelId:this.settings.activeModelId,disabledBuiltInIds:[...(this.settings.disabledBuiltInIds||[])],huggingFaceApiKey:preserveKeys?String(this.settings.huggingFaceApiKey||''):'',huggingFaceRememberKey:preserveKeys?!!this.settings.huggingFaceRememberKey:false,models:(this.settings.models||[]).map(x=>{const model={...x}; if(preserveKeys) model.apiKey=String(x.apiKey||''); else {model.apiKey=''; model.rememberKey=false;} return model;})};
    }
    importSettings(payload){
      if(!payload || typeof payload!=='object' || !Array.isArray(payload.models)) throw new Error('Invalid AI model settings JSON.');
      const imported=payload.models.map(x=>cleanModel({...x,rememberKey:!!x.rememberKey || !!x.apiKey})).filter(x=>x.id && x.protocol && x.model && (x.protocol==='local-transformers' || x.endpoint));
      if(!imported.length)throw new Error('At least one valid AI model is required.');
      const ids=new Set();
      for(const model of imported){ if(ids.has(model.id)) throw new Error(`Duplicate model ID: ${model.id}`); ids.add(model.id); }
      const active=String(payload.activeModelId||'');
      this.settings={activeModelId:active,models:imported,disabledBuiltInIds:Array.isArray(payload.disabledBuiltInIds)?payload.disabledBuiltInIds.map(String):[],huggingFaceApiKey:String(payload.huggingFaceApiKey||''),huggingFaceRememberKey:!!payload.huggingFaceRememberKey};
      this.settings=saveModels(this.settings);
      if(this.settings.huggingFaceRememberKey) setStoredHuggingFaceKey(this.settings.huggingFaceApiKey);
      else setStoredHuggingFaceKey('');
      return this.settings;
    }
    isHuggingFace(model){return isHuggingFaceEndpoint(model?.endpoint);}
    protocolLabel(id){return protocolLabel(id);}
    inferProtocol(endpoint){return inferProtocol(endpoint);}
    providers(){return {...PROVIDERS};}
    provider(id){return PROVIDERS[id] ? {...PROVIDERS[id]} : null;}
    providerForModel(model){
      if(model?.local || model?.protocol==='local-transformers')return 'local';
      if(model?.provider && PROVIDERS[model.provider])return model.provider;
      const endpoint=String(model?.endpoint||'').toLowerCase();
      if(endpoint.includes('api.groq.com'))return 'groq';
      if(endpoint.includes('generativelanguage.googleapis.com'))return 'google-gemini';
      if(endpoint.includes('router.huggingface.co'))return 'huggingface';
      return 'custom';
    }
      protocols(){return {...PROTOCOLS};}
  }
  root.isHuggingFaceEndpoint=isHuggingFaceEndpoint;
  root.getStoredHuggingFaceKey=getStoredHuggingFaceKey;
  root.AI_PROTOCOLS=PROTOCOLS;
  root.AI_PROVIDERS=PROVIDERS;
  root.ProviderRegistry=ProviderRegistry;
  root.loadModels=loadModels;
  root.saveModels=saveModels;
  root.inferProtocol=inferProtocol;
  root.protocolLabel=protocolLabel;
})();


/* -------------------------------------------------------------------------- */
/* Consolidated module */
(function() {
  const root = window.EditorAI = window.EditorAI || {};
  function activeTab(state) {
    const wb = state?.workbench;
    if (!wb) return null;
    for (const g of wb.groups.values()) {
      const t = g.tabs.find(x => x.id === g.active);
      if (t) return {group:g, tab:t};
    }
    return null;
  }
  function sensitivePath(path) { return /(^|\/)(?:\.env(?:\..*)?|\.editor\/process\.env|.*(?:secret|credential|password|token|private[-_]?key).*)$/i.test(String(path||'')); }
  function build(state, options = {}) {
    const active = activeTab(state);
    const tab = active?.tab;
    const projectFiles = state.fs?.listFilesSync?.() || [];
    let selection = '';
    let activeContent = '';
    if (tab?.kind === 'file') {
      activeContent = tab.editor?.getValue?.() || state.fs?.readFileSync?.(tab.path, 'utf8') || '';
      const sel = tab.editor?.getSelection?.();
      if (sel && tab.editor?.getModel?.()) selection = tab.editor.getModel().getValueInRange(sel) || '';
    }
    const parts = [
      `Project: ${state.projectName || 'Workspace'}`,
      `Files: ${projectFiles.length} files`,
      tab?.kind === 'file' ? `Active file: ${tab.path}` : 'Active file: none'
    ];
    if (activeContent && !sensitivePath(tab?.path) && activeContent.length <= (options.maxFileChars || 20000)) parts.push(`Active file contents:\n${activeContent}`);
    else if (activeContent && sensitivePath(tab?.path)) parts.push('Active file contents are omitted from automatic context because the filename looks sensitive.');
    if (selection) parts.push(`Current selection:\n${selection}`);
    return parts.join('\n\n');
  }
  root.activeEditorTab = activeTab;
  root.buildContext = build;
})();


/* -------------------------------------------------------------------------- */
/* Consolidated module */
(function() {
  const root = window.EditorAI = window.EditorAI || {};
  const STORAGE_KEY = 'editor.aiPermissions.v1';
  const DEFAULTS = {
    readFiles: 'always', searchFiles: 'always', createFiles: 'ask', modifyFiles: 'ask', deleteFiles: 'ask',
    runCommands: 'ask', runScripts: 'ask', runProject: 'ask', readOutput: 'always',
    readEditor: 'always', modifyEditor: 'ask', browser: 'ask', network: 'ask', githubRead: 'ask', githubWrite: 'ask', extensionActions: 'ask'
  };
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return {...DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {})};
    } catch (_) { return {...DEFAULTS}; }
  }
  function save(values) {
    const next = {...DEFAULTS, ...(values || {})};
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (_) {}
    return next;
  }
  class PermissionManager {
    constructor(values) { this.values = {...DEFAULTS, ...(values || load())}; }
    get(name) { return this.values[name] || 'ask'; }
    set(name, value) { this.values[name] = ['always','ask','never'].includes(value) ? value : 'ask'; save(this.values); }
    all() { return {...this.values}; }
    reset() { this.values = {...DEFAULTS}; save(this.values); }
    allows(name) { return this.get(name) === 'always'; }
  }
  root.PermissionManager = PermissionManager;
  root.loadPermissions = load;
  root.savePermissions = save;
  root.permissionDefaults = DEFAULTS;
})();


/* -------------------------------------------------------------------------- */
/* Consolidated module */
(function() {
  const root = window.EditorAI = window.EditorAI || {};
  const PREFS_KEY = 'editor.aiPreferences.v1';
  const ANALYTICS_KEY = 'editor.aiAnalytics.v1';
  const DEFAULTS = { retry429:true, max429Retries:5, baseRetryDelay:1500, retryTransport:true, maxTransportRetries:2, transportRetryDelay:1000, toolRecovery:true, maxToolRecoveryRetries:2, customInstructions:'', agentInstructions:'', showActivity:true };
  function read(key,fallback){try{const v=JSON.parse(localStorage.getItem(key)||'null');return v&&typeof v==='object'?v:fallback;}catch(_){return fallback;}}
  function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(_) {}}
  function getAIPreferences(){return {...DEFAULTS,...read(PREFS_KEY,{})};}
  function setAIPreferences(patch){const next={...getAIPreferences(),...(patch||{})};next.max429Retries=Math.max(0,Math.min(10,Number(next.max429Retries)||0));next.baseRetryDelay=Math.max(250,Math.min(30000,Number(next.baseRetryDelay)||1500));next.maxTransportRetries=Math.max(0,Math.min(10,Number(next.maxTransportRetries)||0));next.transportRetryDelay=Math.max(250,Math.min(30000,Number(next.transportRetryDelay)||1000));next.maxToolRecoveryRetries=Math.max(0,Math.min(10,Number(next.maxToolRecoveryRetries)||0));save(PREFS_KEY,next);return next;}
  function blankAnalytics(){return {version:1,requests:0,retries429:0,transportRetries:0,toolRecoveries:0,inputTokens:0,outputTokens:0,reasoningTokens:0,totalTokens:0,toolCalls:0,runs:0,byModel:{},lastAt:0};}
  function getAnalytics(){const x={...blankAnalytics(),...read(ANALYTICS_KEY,{})};x.byModel=x.byModel&&typeof x.byModel==='object'?x.byModel:{};return x;}
  function recordAnalytics(info={}){
    const a=getAnalytics(),model=info.model||{},id=String(model.id||model.model||'unknown'),u=info.usage||{};
    const input=Number(u.input_tokens??u.prompt_tokens??0)||0, output=Number(u.output_tokens??u.completion_tokens??0)||0, reasoning=Number(u.output_tokens_details?.reasoning_tokens??u.reasoning_tokens??0)||0, total=Number(u.total_tokens??(input+output))||0;
    a.requests+=Number(info.request)||0; a.retries429+=Number(info.retries429)||0; a.transportRetries+=Number(info.transportRetry)||0; a.toolRecoveries+=Number(info.toolRecovery)||0; a.toolCalls+=Number(info.toolCall)||0; a.runs+=Number(info.run)||0;
    a.inputTokens+=input; a.outputTokens+=output; a.reasoningTokens+=reasoning; a.totalTokens+=total; a.lastAt=Date.now();
    const m=a.byModel[id]||{name:model.name||id,requests:0,inputTokens:0,outputTokens:0,reasoningTokens:0,totalTokens:0,retries429:0};
    m.requests+=Number(info.request)||0; m.inputTokens+=input; m.outputTokens+=output; m.reasoningTokens+=reasoning; m.totalTokens+=total; m.retries429+=Number(info.retries429)||0; m.name=model.name||m.name||id; a.byModel[id]=m;
    save(ANALYTICS_KEY,a); return a;
  }
  function resetAnalytics(){const a=blankAnalytics();save(ANALYTICS_KEY,a);return a;}
  function exportPreferences(){return {...getAIPreferences()};}
  function importPreferences(value){return setAIPreferences(value||{});}
  root.getAIPreferences=getAIPreferences; root.setAIPreferences=setAIPreferences; root.exportAIPreferences=exportPreferences; root.importAIPreferences=importPreferences; root.getAIAnalytics=getAnalytics; root.recordAnalytics=recordAnalytics; root.resetAIAnalytics=resetAnalytics;
})();


/* -------------------------------------------------------------------------- */
/* Consolidated module */
(function() {
  const root = window.EditorAI = window.EditorAI || {};
  function normalize(path) {
    const out = [];
    for (const part of String(path || '').replace(/\\/g,'/').split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') { out.pop(); continue; }
      out.push(part);
    }
    return out.join('/');
  }
  function textFile(path) {
    const n = String(path).split('/').pop().toLowerCase();
    const ext = n.includes('.') ? n.slice(n.lastIndexOf('.') + 1) : '';
    return new Set(['js','mjs','cjs','ts','tsx','jsx','json','html','htm','css','md','txt','xml','svg','yaml','yml','py','java','c','h','cpp','hpp','cc','rs','go','wgsl','glsl','vert','frag','shader','toml','ini','env','sh','bat','ps1','vue','svelte']).has(ext) || !ext;
  }
  function quoteCommand(path) { return /[\s"']/.test(path) ? '"' + String(path).replace(/"/g,'\\"') + '"' : String(path); }
  function currentTab(state) {
    if (!state?.workbench) return null;
    for (const instance of Workbench.getInstances?.() || [state.workbench]) for (const g of instance.groups.values()) {
      const t = g.tabs.find(x => x.id === g.active);
      if (t) return t;
    }
    return null;
  }
  function fileDiff(oldText, newText) {
    oldText = String(oldText || ''); newText = String(newText || '');
    if (oldText === newText) return '';
    const oldLines = oldText.split(/\r?\n/), newLines = newText.split(/\r?\n/);
    let start = 0;
    while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start++;
    let oldEnd = oldLines.length - 1, newEnd = newLines.length - 1;
    while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) { oldEnd--; newEnd--; }
    const removed = oldLines.slice(start, oldEnd + 1).slice(0, 80).map(x => '- ' + x);
    const added = newLines.slice(start, newEnd + 1).slice(0, 80).map(x => '+ ' + x);
    return [...removed, ...added].join('\n');
  }
  function makeTools(options) {
    const {state, openFile, onRefresh, runConfigured, ensureNodeRuntime} = options;
    const tools = new Map();
    function add(def) { tools.set(def.name, def); }
    add({name:'exit_early', permission:'none', description:'Finish the task immediately and return the supplied message directly as the final answer. Use when all necessary tool work is complete and no further tool or model turn is needed. Put the complete answer or summary in message; do not leave the message empty.', parameters:{type:'object',properties:{message:{type:'string',description:'Optional final message to show the user.'}},additionalProperties:false}, execute:async args => ({exitEarly:true,message:String(args?.message||'')})});
    add({name:'list_files', permission:'readFiles', description:'List project files and optionally directories.', parameters:{type:'object',properties:{directories:{type:'boolean'}},additionalProperties:false}, execute:async args => ({files:state.fs?.listFilesSync?.() || [], directories:args.directories ? state.fs?.listDirectoriesSync?.() || [] : undefined})});
    add({name:'read_file', permission:'readFiles', description:'Read a UTF-8 text file from the project.', parameters:{type:'object',required:['path'],properties:{path:{type:'string'},startLine:{type:'integer',minimum:1},endLine:{type:'integer',minimum:1},maxChars:{type:'integer',minimum:1000,maximum:500000}},additionalProperties:false}, execute:async args => { const path=normalize(args.path); if(!state.fs?.existsSync(path)) throw new Error(`File not found: ${path}`); const value=state.fs.readFileSync(path,'utf8'); if (value == null) throw new Error(`Unable to read: ${path}`); let content=String(value); const hasRange=args.startLine!=null||args.endLine!=null; if(hasRange){ const lines=content.split(/\r?\n/); const start=Math.max(1,Number(args.startLine)||1); const end=Math.min(lines.length,Math.max(start,Number(args.endLine)||lines.length)); content=lines.slice(start-1,end).join('\n'); } const maxChars=Math.max(1000,Math.min(500000,Number(args.maxChars)||200000)); const truncated=content.length>maxChars; if(truncated)content=content.slice(0,maxChars); return {path,content,startLine:hasRange?Math.max(1,Number(args.startLine)||1):1,endLine:hasRange?Math.min(String(value).split(/\r?\n/).length,Math.max(1,Number(args.endLine)||String(value).split(/\r?\n/).length)):String(value).split(/\r?\n/).length,truncated,totalChars:String(value).length}; }});
    add({name:'search_project', permission:'searchFiles', description:'Search text files in the project, case-insensitive.', parameters:{type:'object',required:['query'],properties:{query:{type:'string'},path:{type:'string'},maxResults:{type:'number',minimum:1,maximum:500}} ,additionalProperties:false}, execute:async args => {
      const query=String(args.query||'').toLowerCase(); if(!query) return {results:[]}; const prefix=normalize(args.path||''); const limit=Math.max(1,Math.min(500,Number(args.maxResults)||100)); const results=[];
      for(const path of state.fs?.listFilesSync?.()||[]) { if(prefix && path!==prefix && !path.startsWith(prefix+'/')) continue; if(!textFile(path)) continue; let content=''; try{content=String(state.fs.readFileSync(path,'utf8')||'')}catch(_){continue;} const lines=content.split(/\r?\n/); for(let i=0;i<lines.length;i++){let from=0;const lower=lines[i].toLowerCase();while(from<lower.length){const col=lower.indexOf(query,from);if(col<0)break;results.push({path,line:i+1,column:col+1,text:lines[i]});if(results.length>=limit)return {results};from=col+Math.max(query.length,1);}}} return {results};
    }});
    add({name:'create_file', permission:'createFiles', description:'Create a new text file in the project.', parameters:{type:'object',required:['path','content'],properties:{path:{type:'string'},content:{type:'string'}},additionalProperties:false}, execute:async args => { const path=normalize(args.path); if(!path)throw new Error('Invalid file path.'); if(state.fs.existsSync(path))throw new Error(`File already exists: ${path}`); state.fs.writeFileSync(path,String(args.content??'')); state.markDirty?.(path); onRefresh?.(); return {path,created:true}; }});
    add({name:'write_file', permission:'modifyFiles', description:'Create a new text file or replace the contents of an existing file.', parameters:{type:'object',required:['path','content'],properties:{path:{type:'string'},content:{type:'string'}},additionalProperties:false}, execute:async args => { const path=normalize(args.path); if(!path)throw new Error('Invalid file path.'); const exists=!!state.fs.existsSync(path); const old=exists?String(state.fs.readFileSync(path,'utf8')||''):''; const content=String(args.content??''); state.fs.writeFileSync(path,content); state.markDirty?.(path); onRefresh?.(); return {path,created:!exists,changed:!exists||old!==content,diff:exists?fileDiff(old,content):null}; }});
    add({name:'delete_file', permission:'deleteFiles', description:'Delete a file or directory from the project.', parameters:{type:'object',required:['path'],properties:{path:{type:'string'},directory:{type:'boolean'}},additionalProperties:false}, execute:async args => { const path=normalize(args.path); if(!path)throw new Error('Cannot delete the project root.'); const isDir=!!args.directory || state.fs.isDirectorySync?.(path); const ok=isDir ? state.fs.deleteDirectorySync(path) : state.fs.deleteFileSync(path); if(!ok)throw new Error(`Nothing deleted at ${path}`); state.markDirty?.(path); onRefresh?.(); return {path,deleted:true,directory:isDir}; }});
    add({name:'move_file', permission:'modifyFiles', description:'Move or rename a file or directory without reading its contents into the agent.', parameters:{type:'object',required:['source','destination'],properties:{source:{type:'string',description:'Existing file or directory path.'},destination:{type:'string',description:'New file or directory path.'}},additionalProperties:false}, execute:async args => { const source=normalize(args.source); const destination=normalize(args.destination); if(!source)throw new Error('Source path is required.'); if(!destination)throw new Error('Destination path is required.'); if(source===destination)return {source,destination,moved:false}; if(!state.fs?.existsSync(source) && !state.fs?.isDirectorySync?.(source))throw new Error(`Path not found: ${source}`); const isDir=!!state.fs.isDirectorySync?.(source); state.fs.moveSync(source,destination); state.markDirty?.(source); state.markDirty?.(destination); state.fileManager?.onMove?.(source,destination,isDir); onRefresh?.(); return {source,destination,moved:true,directory:isDir}; }});    add({name:'copy_file', permission:'modifyFiles', description:'Copy a file or directory without reading its contents into the agent.', parameters:{type:'object',required:['source','destination'],properties:{source:{type:'string',description:'Existing file or directory path.'},destination:{type:'string',description:'New file or directory path.'}},additionalProperties:false}, execute:async args => { const source=normalize(args.source); const destination=normalize(args.destination); if(!source)throw new Error('Source path is required.'); if(!destination)throw new Error('Destination path is required.'); if(!state.fs?.existsSync(source) && !state.fs?.isDirectorySync?.(source))throw new Error(`Path not found: ${source}`); if(state.fs.existsSync(destination) || state.fs.isDirectorySync?.(destination))throw new Error(`Destination already exists: ${destination}`); if(source===destination)throw new Error('Source and destination are the same.'); if(destination.startsWith(source+'/'))throw new Error('Cannot copy a path into itself.'); const isDir=!!state.fs.isDirectorySync?.(source); const files=(isDir ? state.fs.listFilesSync().filter(path=>path===source||path.startsWith(source+'/')) : [source]); for(const path of files){ const target=destination+path.slice(source.length); state.fs.writeFileSync(target,state.fs.readFileSync(path,'binary')); } state.markDirty?.(destination); onRefresh?.(); return {source,destination,copied:true,directory:isDir,files:files.length}; }});
    add({name:'get_file_info', permission:'readFiles', description:'Get filesystem metadata without reading a file into the agent.', parameters:{type:'object',required:['path'],properties:{path:{type:'string'}},additionalProperties:false}, execute:async args => { const path=normalize(args.path); if(!path)throw new Error('Path is required.'); const isDir=!!state.fs?.isDirectorySync?.(path); if(!state.fs?.existsSync(path) && !isDir)throw new Error(`Path not found: ${path}`); if(isDir){ const prefix=path+'/'; const files=(state.fs.listFilesSync?.()||[]).filter(p=>p===path||p.startsWith(prefix)); const dirs=(state.fs.listDirectoriesSync?.()||[]).filter(p=>p===path||p.startsWith(prefix)); return {path,type:'directory',fileCount:files.length,directoryCount:dirs.length}; } const data=state.fs.readFileSync(path,'binary'); const bytes=data?.byteLength ?? data?.length ?? 0; return {path,type:'file',size:bytes,extension:(path.match(/\.([^.\/]+)$/)?.[1]||'').toLowerCase(),textFile:textFile(path)}; }});
    add({name:'find_files', permission:'searchFiles', description:'Find project files by glob-like path pattern without reading their contents.', parameters:{type:'object',properties:{pattern:{type:'string'},path:{type:'string'},extension:{type:'string'},maxResults:{type:'number',minimum:1,maximum:2000}},additionalProperties:false}, execute:async args => { const pattern=String(args.pattern||'').trim(); const prefix=normalize(args.path||''); const extension=String(args.extension||'').trim().toLowerCase(); const limit=Math.max(1,Math.min(2000,Number(args.maxResults)||500)); const files=state.fs?.listFilesSync?.()||[]; const globToRegex=g=>{let out='';for(let i=0;i<g.length;i++){const c=g[i];if(c==='*'){if(g[i+1]==='*'){out+='.*';i++;}else out+='[^/]*';}else if(c==='?')out+='[^/]';else out+=c.replace(/[\\^$+?.()|{}\[\]]/g,'\\$&');}return new RegExp('^'+out+'$','i');}; const re=pattern?globToRegex(pattern):null; const results=[]; for(const file of files){if(prefix&&file!==prefix&&!file.startsWith(prefix+'/'))continue;if(extension&&!file.toLowerCase().endsWith(extension.startsWith('.')?extension:'.'+extension))continue;if(re&&!re.test(file))continue;results.push(file);if(results.length>=limit)break;} return {pattern:pattern||null,results}; }});
    add({name:'replace_in_files', permission:'modifyFiles', description:'Replace text across selected project files without requiring the agent to rewrite whole files.', parameters:{type:'object',required:['search','replace'],properties:{search:{type:'string'},replace:{type:'string'},path:{type:'string'},regex:{type:'boolean'},caseSensitive:{type:'boolean'},maxFiles:{type:'number'},dryRun:{type:'boolean'}},additionalProperties:false}, execute:async args => { const search=String(args.search??''); if(!search)throw new Error('Search text is required.'); const replacement=String(args.replace??''); const prefix=normalize(args.path||''); const maxFiles=Math.max(1,Math.min(500,Number(args.maxFiles)||100)); let matcher; try { matcher=args.regex ? new RegExp(search,args.caseSensitive?'g':'gi') : new RegExp(search.replace(/[\\^$.*+?()[\]{}|]/g,'\\$&'),args.caseSensitive?'g':'gi'); } catch(e){throw new Error(`Invalid search pattern: ${e.message}`);} const changes=[]; for(const path of state.fs?.listFilesSync?.()||[]){if(changes.length>=maxFiles)break;if(prefix&&path!==prefix&&!path.startsWith(prefix+'/'))continue;if(!textFile(path))continue;let old='';try{old=String(state.fs.readFileSync(path,'utf8')||'')}catch(_){continue;} matcher.lastIndex=0;const matches=old.match(matcher);if(!matches?.length)continue;const next=old.replace(matcher,replacement);changes.push({path,count:matches.length,changed:old!==next});if(!args.dryRun&&old!==next){state.fs.writeFileSync(path,next);state.markDirty?.(path);}} if(!args.dryRun)onRefresh?.(); return {changed:changes.filter(x=>x.changed).length,files:changes,dryRun:!!args.dryRun}; }});


    add({name:'get_active_file', permission:'readEditor', description:'Get the active editor file, cursor, and selection.', parameters:{type:'object',properties:{includeContent:{type:'boolean'}},additionalProperties:false}, execute:async args => { const t=currentTab(state); if(!t || t.kind!=='file')return {path:null}; const model=t.editor?.getModel?.(); const selection=t.editor?.getSelection?.(); const result={path:t.path,view:t.view||null}; if(t.editor?.getPosition)result.cursor=t.editor.getPosition(); if(selection && model)result.selection=model.getValueInRange(selection); if(args.includeContent)result.content=String(t.editor?.getValue?.()||state.fs.readFileSync(t.path,'utf8')||''); return result; }});
    add({name:'open_file', permission:'readEditor', description:'Open a file in the editor.', parameters:{type:'object',required:['path'],properties:{path:{type:'string'}}}, execute:async args => { const path=normalize(args.path); if(!state.fs?.existsSync(path))throw new Error(`File not found: ${path}`); openFile?.(path); return {opened:path}; }});
    add({name:'insert_code', permission:'modifyEditor', description:'Insert code at the current editor selection or cursor.', parameters:{type:'object',required:['code'],properties:{code:{type:'string'}}}, execute:async args => { const t=currentTab(state); if(!t?.editor)throw new Error('There is no active text editor.'); const editor=t.editor; const model=editor.getModel?.(); if(!model)throw new Error('The active editor has no model.'); const selection=editor.getSelection?.(); const range=selection || {startLineNumber:1,startColumn:1,endLineNumber:1,endColumn:1}; editor.executeEdits('ai',[{range,text:String(args.code),forceMoveMarkers:true}]); state.markDirty?.(t.path); state.updateStatus?.(); return {path:t.path,inserted:true}; }});
    add({name:'run_command', permission:'runCommands', description:"Run a short-lived command in the editor's virtual Node runtime, not a real OS shell. Do not include the terminal prompt character ($). Supported commands are pwd, cd, cat, echo, printf, true, false, whoami, hostname, env, which, ls/dir, node, and npm. Do not use this tool to start a long-running server or watcher such as 'node server.js', 'npm start', 'npm run start', or 'npm run dev'; use run_project for the configured project instead. Shell features such as pipes and redirection are not supported; use the project/editor tools for filesystem operations instead.", parameters:{type:'object',required:['command'],properties:{command:{type:'string',description:'Command only, without a leading shell prompt such as $. Supported commands: pwd, cd, cat, echo, printf, true, false, whoami, hostname, env, which, ls/dir, node, npm.'}}}, execute:async args => {
      const runner=await ensureNodeRuntime?.();
      if(!runner)throw new Error('Node runtime is unavailable for this project.');
      attachOutput(runner);
      const command=String(args.command||'').trim();
      if(!command)throw new Error('Command is empty.');
      const longRunning=/^(?:(?:npm|npx)\s+(?:run\s+)?(?:start|dev|serve|watch)\b|node(?:js)?\s+.+)$/i.test(command);
      if(longRunning) throw new Error('This command appears to start a long-running process. Use run_project to run the configured application instead of run_command.');
      const start=outputBuffer.length;
      const result=await runner.terminalCommand(command);
      return {command,result,output:outputBuffer.slice(start)};
    }});
    add({name:'run_script', permission:'runScripts', description:'Run a project JavaScript file with the virtual Node runtime.', parameters:{type:'object',required:['path'],properties:{path:{type:'string'}}}, execute:async args => { const runner=await ensureNodeRuntime?.(); if(!runner)throw new Error('Node runtime is unavailable for this project.'); attachOutput(runner); const path=normalize(args.path); if(!state.fs?.existsSync(path))throw new Error(`File not found: ${path}`); const start=outputBuffer.length; const result=await runner.terminalCommand('node '+quoteCommand(path)); return {path,result,output:outputBuffer.slice(start)}; }});
    add({name:'run_project', permission:'runProject', description:'Run the configured project and open its browser preview.', parameters:{type:'object',properties:{},additionalProperties:false}, execute:async () => { await runConfigured?.(); return {running:true}; }});
    const outputBuffer = [];
    let attachedRunner = null;
    let onConsole = null;
    let onError = null;
    function attachOutput(runner) {
      if(attachedRunner===runner)return;
      if(attachedRunner){attachedRunner.removeEventListener?.('console',onConsole);attachedRunner.removeEventListener?.('error',onError);}
      attachedRunner=runner; if(!runner)return;
      onConsole=(method,args)=>{outputBuffer.push({type:method,args:Array.isArray(args)?args:[]});if(outputBuffer.length>250)outputBuffer.splice(0,outputBuffer.length-250);};
      onError=(error,source)=>{outputBuffer.push({type:'error',args:[error?.message||String(error),source||'']});if(outputBuffer.length>250)outputBuffer.splice(0,outputBuffer.length-250);};
      runner.addEventListener?.('console',onConsole);runner.addEventListener?.('error',onError);
    }
    add({name:'get_runtime_output', permission:'readOutput', description:'Read recent output/errors from the Node runtime.', parameters:{type:'object',properties:{clear:{type:'boolean'}},additionalProperties:false}, execute:async args => { const runner=state.nodeEmulator; if(runner)attachOutput(runner); const result=outputBuffer.slice(-100); if(args.clear)outputBuffer.length=0; return {running:!!runner,output:result}; }});
    add({name:'get_browser_state', permission:'browser', description:'Inspect the editor browser preview.', parameters:{type:'object',properties:{},additionalProperties:false}, execute:async () => { const info=state.browserFrame; if(!info)return {available:false}; let url='';let title='';try{url=info.contentWindow?.getStartupUrl?.()||info.contentWindow?.location?.href||''}catch(_){} try{title=info.contentWindow?.document?.title||''}catch(_){} return {available:true,url,title}; }});
    function getBrowserFrame() {
      let active = null;
      try { active = currentTab(state); } catch (_) {}
      if (active?.kind === 'builtin' && active.builtin === 'browser') {
        const info = state.browserTabs?.get(active.id);
        if (info?.frame?.contentWindow) return info.frame;
      }
      if (state.browserFrame?.contentWindow) return state.browserFrame;
      for (const info of state.browserTabs?.values?.() || []) if (info?.frame?.contentWindow) return info.frame;
      return null;
    }
    function getBrowserWindow() {
      const frame = getBrowserFrame();
      return frame?.contentWindow || null;
    }
    add({name:'get_browser_tabs', permission:'browser', description:'List tabs in the active editor Browser, including the active tab.', parameters:{type:'object',properties:{},additionalProperties:false}, execute:async () => { const win=getBrowserWindow(); if(!win)return {available:false,tabs:[]}; return {available:true,tabs:win.getAIBrowserTabs?.()||[]}; }});
    add({name:'open_browser_tab', permission:'browser', description:'Open a new tab in the editor Browser.', parameters:{type:'object',required:['url'],properties:{url:{type:'string'},activate:{type:'boolean'}},additionalProperties:false}, execute:async args => { const win=getBrowserWindow(); if(!win?.openAIBrowserTab)throw new Error('Browser tab controls are unavailable.'); const id=win.openAIBrowserTab(String(args.url||''),args.activate!==false); if(!id)throw new Error('Browser tab could not be opened.'); return {opened:true,id}; }});
    add({name:'switch_browser_tab', permission:'browser', description:'Switch the active tab in the editor Browser.', parameters:{type:'object',required:['tabId'],properties:{tabId:{type:'string'}}}, execute:async args => { const win=getBrowserWindow(); if(!win?.switchAIBrowserTab)throw new Error('Browser tab controls are unavailable.'); return await win.switchAIBrowserTab(String(args.tabId)); }});
    add({name:'navigate_browser_tab', permission:'browser', description:'Navigate an existing Browser tab to a URL.', parameters:{type:'object',required:['tabId','url'],properties:{tabId:{type:'string'},url:{type:'string'}}}, execute:async args => { const win=getBrowserWindow(); if(!win?.navigateAIBrowserTab)throw new Error('Browser navigation controls are unavailable.'); return await win.navigateAIBrowserTab(String(args.tabId),String(args.url||'')); }});
    add({name:'close_browser_tab', permission:'browser', description:'Close a Browser tab.', parameters:{type:'object',required:['tabId'],properties:{tabId:{type:'string'}}}, execute:async args => { const win=getBrowserWindow(); if(!win?.closeAIBrowserTab)throw new Error('Browser tab controls are unavailable.'); return win.closeAIBrowserTab(String(args.tabId)); }});
    add({name:'reload_browser_tab', permission:'browser', description:'Reload a Browser tab.', parameters:{type:'object',properties:{tabId:{type:'string'}},additionalProperties:false}, execute:async args => { const win=getBrowserWindow(); if(!win?.reloadAIBrowserTab)throw new Error('Browser tab controls are unavailable.'); return await win.reloadAIBrowserTab(args.tabId?String(args.tabId):null); }});
    add({name:'get_browser_html', permission:'browser', description:'Read the rendered HTML of a Browser tab. This is the sanitized page DOM visible to the emulated page, not editor internals.', parameters:{type:'object',properties:{tabId:{type:'string'},maxChars:{type:'number'}},additionalProperties:false}, execute:async args => { const win=getBrowserWindow(); if(!win?.getAIBrowserHTML)throw new Error('Browser HTML inspection is unavailable.'); return win.getAIBrowserHTML(args.tabId?String(args.tabId):null,args.maxChars); }});
    add({name:'run_browser_console', permission:'browser', description:'Run JavaScript in a Browser tab using its DevTools-style console execution context and return the result.', parameters:{type:'object',required:['code'],properties:{tabId:{type:'string'},code:{type:'string'}},additionalProperties:false}, execute:async args => { const win=getBrowserWindow(); if(!win?.runAIBrowserConsole)throw new Error('Browser console is unavailable.'); return await win.runAIBrowserConsole(args.tabId?String(args.tabId):null,String(args.code||'')); }});
    add({name:'browser_network_request', permission:'network', description:'Make an arbitrary HTTP request through the editor Network API. The request uses the normal Network endpoint chain, so proxy/direct fallback rules still apply. Returns status, headers, and textual/JSON response data.', parameters:{type:'object',required:['url'],properties:{url:{type:'string'},method:{type:'string'},headers:{type:'object'},body:{type:'string'},maxChars:{type:'number'}},additionalProperties:false}, execute:async args => { const network=state.browserNetwork||window.__sharedBrowserNetwork; if(!network?.request)throw new Error('Network API is unavailable.'); const url=String(args.url||'').trim(); if(!url)throw new Error('URL is required.'); const method=String(args.method||'GET').toUpperCase(); const headers={...(args.headers&&typeof args.headers==='object'?args.headers:{})}; const init={method,headers}; if(args.body!=null && !['GET','HEAD'].includes(method))init.body=String(args.body); const response=await network.request(new Request(url,init),'ai'); if(!response)throw new Error('No endpoint returned a response.'); const maxChars=Math.max(1000,Math.min(500000,Number(args.maxChars)||100000)); const raw=await response.text(); let json=null; try{json=JSON.parse(raw);}catch(_){} return {url:response.url||url,status:response.status,statusText:response.statusText,ok:response.ok,headers:Object.fromEntries(response.headers.entries()),text:raw.slice(0,maxChars),json,truncated:raw.length>maxChars,totalLength:raw.length}; }});
    add({name:'get_browser_output', permission:'browser', description:'Read recent console errors and output from emulated browser pages.', parameters:{type:'object',properties:{limit:{type:'number'},clear:{type:'boolean'}},additionalProperties:false}, execute:async args => { const win=state.browserFrame?.contentWindow; if(!win)return {available:false,output:[]}; const output=win.getAIBrowserOutput?.({limit:Math.max(1,Math.min(200,Number(args.limit)||100))}) || []; if(args.clear)win.clearAIBrowserOutput?.(); return {available:true,output}; }});
    // Built-in GitHub tools. These use the editor's existing OAuth session and are
    // deliberately permission-gated separately from generic network access.
    const github = window.GitHubService;
    const requireGitHub = () => {
      if (!github?.isSignedIn?.()) throw new Error('Sign in to GitHub from the editor Profile before using GitHub tools.');
      return github;
    };
    add({name:'github_status', permission:'githubRead', description:'Check whether the user is signed in to GitHub and return the signed-in account.', parameters:{type:'object',properties:{},additionalProperties:false}, execute:async () => {
      const service=github;
      if (!service?.isSignedIn?.()) return {signedIn:false,user:null};
      const user=service.getUser?.() || null;
      return {signedIn:true,user:user ? {login:user.login,name:user.name,avatarUrl:user.avatar_url||user.avatarUrl||''} : null};
    }});
    add({name:'github_list_repositories', permission:'githubRead', description:'List repositories available to the signed-in GitHub account.', parameters:{type:'object',properties:{},additionalProperties:false}, execute:async () => {
      return requireGitHub().listRepositories();
    }});
    add({name:'github_get_repository', permission:'githubRead', description:'Get metadata for a GitHub repository.', parameters:{type:'object',required:['owner','repo'],properties:{owner:{type:'string'},repo:{type:'string'}},additionalProperties:false}, execute:async args => {
      return requireGitHub().getRepository(String(args.owner||''),String(args.repo||''));
    }});
    add({name:'github_create_repository', permission:'githubWrite', description:'Create a GitHub repository for the signed-in user.', parameters:{type:'object',required:['name'],properties:{name:{type:'string'},description:{type:'string'},privateRepo:{type:'boolean'},autoInit:{type:'boolean'}},additionalProperties:false}, execute:async args => {
      const result=await requireGitHub().createRepository({name:String(args.name||''),description:String(args.description||''),privateRepo:!!args.privateRepo,autoInit:args.autoInit!==false});
      return {id:result?.id,name:result?.name,fullName:result?.full_name,url:result?.html_url,defaultBranch:result?.default_branch};
    }});
    add({name:'github_list_branches', permission:'githubRead', description:'List branches in a GitHub repository.', parameters:{type:'object',required:['owner','repo'],properties:{owner:{type:'string'},repo:{type:'string'}},additionalProperties:false}, execute:async args => {
      return requireGitHub().listBranches(String(args.owner||''),String(args.repo||''));
    }});
    add({name:'github_list_commits', permission:'githubRead', description:'List recent commits for a GitHub repository branch.', parameters:{type:'object',required:['owner','repo'],properties:{owner:{type:'string'},repo:{type:'string'},branch:{type:'string'},count:{type:'integer',minimum:1,maximum:100}},additionalProperties:false}, execute:async args => {
      return requireGitHub().listCommits(String(args.owner||''),String(args.repo||''),String(args.branch||'main'),Math.max(1,Math.min(100,Number(args.count)||20)));
    }});
    add({name:'github_compare_working_tree', permission:'githubRead', description:'Compare the current editor workspace with a GitHub repository branch and report added, modified, and deleted files.', parameters:{type:'object',required:['owner','repo','branch'],properties:{owner:{type:'string'},repo:{type:'string'},branch:{type:'string'}},additionalProperties:false}, execute:async args => {
      const service=requireGitHub();
      const remote=await service.getRemoteState(String(args.owner||''),String(args.repo||''),String(args.branch||'main'));
      const changes=await service.compareWorkingTree(state.fs,remote.tree);
      return {remoteCommitSha:remote.commitSha,changes:changes.map(x=>({path:x.path,type:x.type}))};
    }});
    add({name:'github_commit_and_push', permission:'githubWrite', description:'Commit the current editor workspace changes to a GitHub repository branch and push them. This changes the remote repository.', parameters:{type:'object',required:['owner','repo','branch','message'],properties:{owner:{type:'string'},repo:{type:'string'},branch:{type:'string'},message:{type:'string'}},additionalProperties:false}, execute:async args => {
      const result=await requireGitHub().commitAndPush({owner:String(args.owner||''),repo:String(args.repo||''),branch:String(args.branch||'main'),message:String(args.message||''),fs:state.fs});
      return {changed:!!result.changed,commitSha:result.commitSha,changes:(result.changes||[]).map(x=>({path:x.path,type:x.type}))};
    }});
    add({name:'github_read_file', permission:'githubRead', description:'Read a text file from a GitHub repository using the signed-in account.', parameters:{type:'object',required:['owner','repo','path'],properties:{owner:{type:'string'},repo:{type:'string'},path:{type:'string'}},additionalProperties:false}, execute:async args => {
      const service=requireGitHub();
      const path=String(args.path||'').replace(/^\/+/, '');
      const data=await service.request('/repos/'+encodeURIComponent(String(args.owner||''))+'/'+encodeURIComponent(String(args.repo||''))+'/contents/'+path.split('/').map(encodeURIComponent).join('/'));
      if(Array.isArray(data)) return {directory:true,entries:data.map(x=>({name:x.name,path:x.path,type:x.type,sha:x.sha}))};
      if(!data?.content) throw new Error('GitHub returned no file content.');
      const binary=atob(String(data.content).replace(/\s/g,''));
      const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
      const content=new TextDecoder().decode(bytes);
      return {path:data.path,sha:data.sha,content};
    }});
    add({name:'github_write_file', permission:'githubWrite', description:'Create or replace a text file in a GitHub repository. This changes the remote repository.', parameters:{type:'object',required:['owner','repo','path','content','message'],properties:{owner:{type:'string'},repo:{type:'string'},path:{type:'string'},content:{type:'string'},message:{type:'string'},sha:{type:'string',description:'Current blob SHA when replacing an existing file. If omitted, the tool reads it first.'}},additionalProperties:false}, execute:async args => {
      const service=requireGitHub();
      const owner=String(args.owner||''), repoName=String(args.repo||''), path=String(args.path||'').replace(/^\/+/, '');
      let sha=String(args.sha||'');
      if(!sha){
        try {
          const current=await service.request('/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repoName)+'/contents/'+path.split('/').map(encodeURIComponent).join('/'));
          sha=String(current?.sha||'');
        } catch(e) {
          if(e?.status!==404) throw e;
        }
      }
      const bytes=new TextEncoder().encode(String(args.content??''));
      let binary=''; for(let p=0;p<bytes.length;p+=0x8000) binary+=String.fromCharCode(...bytes.subarray(p,Math.min(p+0x8000,bytes.length)));
      const body={message:String(args.message||''),content:btoa(binary)}; if(sha) body.sha=sha;
      const result=await service.request('/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repoName)+'/contents/'+path.split('/').map(encodeURIComponent).join('/'),{method:'PUT',body:JSON.stringify(body)});
      return {written:true,path,sha:result?.content?.sha||null,commitSha:result?.commit?.sha||null};
    }});
    add({name:'github_delete_file', permission:'githubWrite', description:'Delete a file from a GitHub repository. This changes the remote repository.', parameters:{type:'object',required:['owner','repo','path','message'],properties:{owner:{type:'string'},repo:{type:'string'},path:{type:'string'},message:{type:'string'},sha:{type:'string',description:'The current blob SHA. If omitted, the tool reads the file first.'}},additionalProperties:false}, execute:async args => {
      const service=requireGitHub();
      const owner=String(args.owner||''), repoName=String(args.repo||''), path=String(args.path||'').replace(/^\/+/, '');
      let sha=String(args.sha||'');
      if(!sha){ const current=await service.request('/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repoName)+'/contents/'+path.split('/').map(encodeURIComponent).join('/')); sha=String(current?.sha||''); }
      if(!sha) throw new Error('A current file SHA is required to delete a GitHub file.');
      const result=await service.request('/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repoName)+'/contents/'+path.split('/').map(encodeURIComponent).join('/'),{method:'DELETE',body:JSON.stringify({message:String(args.message||''),sha})});
      return {deleted:true,path,commitSha:result?.commit?.sha||null};
    }});
    for (const extensionTool of window.EditorExtensionAPI?.getAITools?.() || []) add(extensionTool);
    return {map:tools, list:()=>[...tools.values()]};
  }
  root.makeAITools = makeTools;
})();


/* -------------------------------------------------------------------------- */
/* Consolidated module */
(function() {
  const root = window.EditorAI = window.EditorAI || {};
  function toolSchema(tools) { return tools.list().map(t => ({type:'function',function:{name:t.name,description:t.description,parameters:t.parameters||{type:'object',properties:{}}}})); }
  function parseToolProtocol(text) {
    const out=[]; const re=/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g; let m;
    while((m=re.exec(text))){try{const x=JSON.parse(m[1]);if(x?.name)out.push({id:'proto-'+Math.random().toString(36).slice(2),name:x.name,arguments:x.arguments||{}})}catch(_){} }
    return out;
  }
  function stripToolProtocol(text) { return String(text||'').replace(/<tool_call>[\s\S]*?<\/tool_call>/g,'').trim(); }
  function visibleToolProtocolText(text) {
    const value=String(text||'');
    const start=value.indexOf('<tool_call>');
    if(start>=0) return value.slice(0,start).trimEnd();
    return value;
  }
  function stringifyResult(value, maxChars=120000) {
    let text;
    try { text=JSON.stringify(value); } catch(_) { text=String(value); }
    text=String(text ?? '');
    if(text.length<=maxChars)return text;
    return text.slice(0,maxChars)+`\n… [truncated ${text.length-maxChars} characters]`;
  }
  class AIAgent {
    constructor(options) { Object.assign(this,options); this.maxSteps=options.maxSteps||24; this.running=false; }
    async runExtensionHook(name,payload) {
      try {
        return await this.extensionAPI?.runAIHook?.(name,payload) || payload;
      } catch (e) {
        this.emit?.({type:'extension_hook_error',name,error:e?.message||String(e)});
        return payload;
      }
    }
    async permission(tool,args,resultPreview) {
      const name=tool.permission || 'ask'; if(name==='none')return true; const manager=this.permissions;
      const policy=manager?.get(name) || 'ask';
      if(policy==='always')return true;
      if(policy==='never')throw new Error(`Permission denied: ${tool.name}`);
      if(typeof this.requestPermission!=='function')throw new Error(`Permission required: ${tool.name}`);
      const decision=await this.requestPermission({tool,args,preview:resultPreview});
      if(decision==='always')manager?.set(name,'always');
      if(decision==='deny' || decision===false)throw new Error(`Permission denied: ${tool.name}`);
      return true;
    }
    async executeTool(call) {
      const started=performance.now?.() ?? Date.now();
      let tool=this.tools.map.get(call?.name);
      let args={};
      try {
        if(!tool) throw new Error(`Unknown tool: ${call?.name || 'unnamed tool'}`);
        args=typeof call.arguments==='string' ? JSON.parse(call.arguments||'{}') : (call.arguments||{});
        if(!args || typeof args!=='object' || Array.isArray(args)) throw new Error('Tool arguments must be a JSON object.');
        const before=await this.runExtensionHook?.('ai.beforeTool',{tool,args}) || {args};
        args=before?.args && typeof before.args==='object' ? before.args : args;
        this.emit?.({type:'tool_call',name:tool.name,args});
        await this.permission(tool,args,call.preview || args);
        let result=await tool.execute(args);
        const after=await this.runExtensionHook?.('ai.afterTool',{tool,args,result}) || {result};
        if(after && Object.prototype.hasOwnProperty.call(after,'result')) result=after.result;
        const durationMs=Math.max(0,Math.round((performance.now?.() ?? Date.now())-started));
        this.emit?.({type:'tool_result',name:tool.name,args,result,ok:true,durationMs});
        return result;
      } catch(e) {
        const durationMs=Math.max(0,Math.round((performance.now?.() ?? Date.now())-started));
        const error={error:e?.message||String(e)};
        if(!tool) error.tool=call?.name||'';
        if(/Permission denied|Permission required/.test(error.error)) error.permissionDenied=true;
        this.emit?.({type:'tool_result',name:tool?.name||call?.name||'unknown',args,result:error,ok:false,durationMs});
        return error;
      }
    }
    async run(messages, options={}) {
      if(this.running)throw new Error('An AI task is already running.');
      this.running=true;
      try {
        const model=this.chatAI?.getModel?.() || this.client.model();
        const provider=this.chatAI?.getProvider?.(model?.id) || this.client;
        const toolDefs=toolSchema(this.tools);
        const canNative=!!model.supportsTools;
        const working=messages.map(x=>({role:x.role,content:x.content,...(x.tool_call_id?{tool_call_id:x.tool_call_id}:{}),...(x.name?{name:x.name}:{}),...(Array.isArray(x.tool_calls)?{tool_calls:x.tool_calls}:{}),...(x.role==='assistant'&&x._geminiContent?{_geminiContent:x._geminiContent}:{}),...(x._geminiCallId?{_geminiCallId:x._geminiCallId}: {})}));
        if(!canNative){
          const instructions = '\n\nYou have access to project tools. When a tool is needed, output exactly one or more tags in this format:\n<tool_call>{"name":"read_file","arguments":{"path":"file.js"}}</tool_call>\nDo not put tool calls inside Markdown code fences. Use valid JSON arguments matching the schemas below. After receiving tool results, continue the task.\n\nTool schemas:\n' + this.tools.list().map(t => JSON.stringify({name:t.name,description:t.description,parameters:t.parameters||{type:'object',properties:{}}})).join('\n');
          if(working[0]?.role === 'system') working[0] = {...working[0], content:working[0].content + instructions};
          else working.unshift({role:'system',content:(options.systemPrompt||'') + instructions});
        }
        let finalText=''; let reasoning='';
        for(let step=0;step<this.maxSteps;step++){
          this.emit?.({type:'step',step:step+1,maxSteps:this.maxSteps});
          if(canNative){
            this.emit?.({type:'request_start',model:model.model||model.id||'model',protocol:model.protocol||model.kind||'unknown',step:step+1,maxSteps:this.maxSteps});
            const msg=await provider.complete(working,{model,tools:toolDefs,systemPrompt:options.systemPrompt,thinking:true,maxTokens:options.maxTokens,onRetry:options.onRetry,max429Retries:options.max429Retries,baseRetryDelay:options.baseRetryDelay,retry429:options.retry429,retryTransport:options.retryTransport,maxTransportRetries:options.maxTransportRetries,transportRetryDelay:options.transportRetryDelay,onResponse:info=>this.emit?.({type:'request_response',...info})});
            const think=msg.reasoning_content||msg.reasoning||''; if(think){reasoning+=think;this.emit?.({type:msg.reasoning_kind==='summary'?'reasoning_summary':'reasoning',text:think});}
            const calls=Array.isArray(msg.tool_calls)?msg.tool_calls.map((x,i)=>({id:x.id||x._geminiCallId||`tool-${Date.now()}-${i}`,name:x.function?.name,arguments:x.function?.arguments||'{}',_geminiCallId:x._geminiCallId||null})).filter(x=>x.name):[];
            if(!calls.length){ finalText=String(msg.content||''); working.push({role:'assistant',content:finalText}); this.emit?.({type:'final',text:finalText,reasoning}); return {text:finalText,reasoning}; }
             const narration=String(msg.content||'').trim();if(narration)this.emit?.({type:'assistant_activity',text:narration});
            working.push({role:'assistant',content:msg.content||'',tool_calls:msg.tool_calls,_geminiContent:msg._geminiContent||null});
            for(const call of calls){ const result=await this.executeTool(call); if(result?.exitEarly===true){ finalText=String(result.message||''); this.emit?.({type:'final',text:finalText,reasoning,exitedEarly:true}); return {text:finalText,reasoning,exitedEarly:true}; } working.push({role:'tool',tool_call_id:call.id,_geminiCallId:call._geminiCallId,name:call.name,content:stringifyResult(result)}); }
          } else {
            let text=''; let lastReasoning='';
            this.emit?.({type:'request_start',model:model.model||model.id||'model',protocol:model.protocol||model.kind||'unknown',step:step+1,maxSteps:this.maxSteps});
            const streamOptions={model,systemPrompt:options.systemPrompt,thinking:true,maxTokens:options.maxTokens,onRetry:options.onRetry,max429Retries:options.max429Retries,baseRetryDelay:options.baseRetryDelay,retry429:options.retry429};
            for await(const chunk of provider.stream(working,streamOptions)){text=chunk.text||text; if(chunk.reasoning&&chunk.reasoning!==lastReasoning){const delta=chunk.reasoning.slice(lastReasoning.length);if(delta){reasoning+=delta;this.emit?.({type:chunk.reasoningKind==='summary'?'reasoning_summary':'reasoning',text:delta});}lastReasoning=chunk.reasoning;}}
            const calls=parseToolProtocol(text);
            if(!calls.length){finalText=stripToolProtocol(text);this.emit?.({type:'assistant',text:finalText});this.emit?.({type:'final',text:finalText,reasoning});return {text:finalText,reasoning};}
            const clean=stripToolProtocol(text);if(clean)this.emit?.({type:'assistant_activity',text:clean});working.push({role:'assistant',content:clean});
            for(const call of calls){const result=await this.executeTool(call);if(result?.exitEarly===true){finalText=String(result.message||'');this.emit?.({type:'final',text:finalText,reasoning,exitedEarly:true});return {text:finalText,reasoning,exitedEarly:true};}working.push({role:'user',content:`Tool result for ${call.name}:\n${stringifyResult(result)}`});}
          }
        }
        // Tool steps are limited, but the agent still gets a final response pass
        // using the results it already collected. This pass has no tools, so it
        // cannot consume another tool step.
        this.emit?.({
          type:'request_start',
          model:model.model||model.id||'model',
          protocol:model.protocol||model.kind||'unknown',
          final:true
        });
        const finalMsg=await provider.complete(working,{
          model,
          systemPrompt:(options.systemPrompt||'') + '\n\nYou have reached the tool-step limit. Do not call tools. Give the user the best final answer using the tool results already collected.',
          thinking:true,
          maxTokens:options.maxTokens,
          onRetry:options.onRetry,
          max429Retries:options.max429Retries,
          baseRetryDelay:options.baseRetryDelay,
          retry429:options.retry429,
          retryTransport:options.retryTransport,
          maxTransportRetries:options.maxTransportRetries,
          transportRetryDelay:options.transportRetryDelay,
          onResponse:info=>this.emit?.({type:'request_response',...info})
        });
        const finalThink=finalMsg.reasoning_content||finalMsg.reasoning||'';
        if(finalThink){
          reasoning+=finalThink;
          this.emit?.({
            type:finalMsg.reasoning_kind==='summary'?'reasoning_summary':'reasoning',
            text:finalThink
          });
        }
        finalText=stripToolProtocol(String(finalMsg.content||''));
        this.emit?.({type:'final',text:finalText,reasoning,stepLimitReached:true});
        return {text:finalText,reasoning,stepLimitReached:true};
      } finally { this.running=false; }
    }
  }
  root.AIAgent=AIAgent;
})();


/* -------------------------------------------------------------------------- */
/* Consolidated module */
(function (global) {
  'use strict';

  // Framework layer: provider and conversation contracts. This module deliberately
  // contains no DOM/UI code; applications supply storage, networking and tools.
  const root = global.ChatAIFramework = global.ChatAIFramework || {};
  const editorRoot = global.EditorAI = global.EditorAI || {};

  class ProviderAI {
    constructor(options = {}) {
      this.id = String(options.id || 'provider');
      this.label = String(options.label || this.id);
      this.kind = options.kind || 'base';
      this.capabilities = Object.freeze({
        streaming: options.capabilities?.streaming !== false,
        tools: !!options.capabilities?.tools,
        reasoning: !!options.capabilities?.reasoning,
        vision: !!options.capabilities?.vision,
        structuredOutput: !!options.capabilities?.structuredOutput,
        ...(options.capabilities || {})
      });
    }
    supports(capability, model) { return this.getCapabilities(model)[capability] === true; }
    getCapabilities(model) {
      if (!model) return {...this.capabilities};
      return {...this.capabilities,
        tools:model.supportsTools === true || model.supportsAgentTools === true,
        reasoning:model.supportsReasoning === true,
        streaming:model.supportsStreaming !== false,
        vision:model.supportsVision === true,
        structuredOutput:model.supportsStructuredOutput === true
      };
    }
    async complete() { throw new Error(this.constructor.name + '.complete() is not implemented.'); }
    async *stream() { throw new Error(this.constructor.name + '.stream() is not implemented.'); }
    cancel() {}
    dispose() {}
  }

  class ConversationAI {
    constructor(chat, options = {}) {
      if (!chat) throw new TypeError('ConversationAI requires a ChatAI instance.');
      this.chat = chat;
      this.id = String(options.id || ('conversation-' + Math.random().toString(36).slice(2)));
      this.modelId = options.modelId || null;
      this.systemPrompt = String(options.systemPrompt || '');
      this.messages = Array.isArray(options.messages) ? options.messages : [];
      this.metadata = {...(options.metadata || {})};
      this.createdAt = Number(options.createdAt) || Date.now();
      this.updatedAt = Number(options.updatedAt) || this.createdAt;
      this.running = false;
    }
    getMessages() { return this.messages; }
    setMessages(messages) {
      if (!Array.isArray(messages)) throw new TypeError('Conversation messages must be an array.');
      this.messages = messages;
      this.updatedAt = Date.now();
      return this;
    }
    addMessage(message) {
      if (!message || typeof message !== 'object' || !message.role) throw new TypeError('A message with a role is required.');
      this.messages.push({...message});
      this.updatedAt = Date.now();
      return this.messages[this.messages.length - 1];
    }
    clear() { this.messages = []; this.updatedAt = Date.now(); return this; }
    getProvider() { return this.chat.getProvider(this.modelId); }
    async complete(options = {}) {
      return this.chat.complete(this.messages, {...options, modelId:this.modelId, systemPrompt:options.systemPrompt ?? this.systemPrompt});
    }
    stream(options = {}) {
      return this.chat.stream(this.messages, {...options, modelId:this.modelId, systemPrompt:options.systemPrompt ?? this.systemPrompt});
    }
    async send(content, options = {}) {
      if (this.running) throw new Error('This conversation is already generating a response.');
      const userMessage = this.addMessage({role:'user', content});
      this.running = true;
      try {
        const prompt = options.systemPrompt ?? this.systemPrompt;
        const messages = [...(prompt ? [{role:'system', content:prompt}] : []), ...this.messages];
        let text = '';
        for await (const chunk of this.chat.stream(messages, {...options, modelId:this.modelId})) {
          text = chunk.text ?? text;
          options.onChunk?.(chunk);
        }
        const assistant = this.addMessage({role:'assistant', content:text});
        return {userMessage, message:assistant, text};
      } catch (error) {
        throw error;
      } finally { this.running = false; }
    }
    cancel() { this.chat.cancel(); }
    toJSON() {
      return {id:this.id, modelId:this.modelId, systemPrompt:this.systemPrompt, messages:this.messages,
        metadata:this.metadata, createdAt:this.createdAt, updatedAt:this.updatedAt};
    }
  }

  class ChatAI {
    constructor(options = {}) {
      this.registry = options.registry || null;
      this.providers = new Map();
      this.conversations = new Map();
      this.defaultProviderId = options.defaultProviderId || 'remote';
      this.agent = options.agent || null;
      if (options.remoteProvider || options.client) {
        const RemoteProvider = root.RemoteProviderAI;
        if (!options.remoteProvider && typeof RemoteProvider !== 'function') throw new Error('Remote chat provider has not been loaded.');
        this.registerProvider(options.remoteProvider || new RemoteProvider({id:'remote',label:'Remote AI',client:options.client,registry:this.registry,capabilities:options.remoteCapabilities||{}}));
      }
      if (options.localProvider || options.localManager) {
        const LocalProvider = root.LocalProviderAI;
        if (!options.localProvider && typeof LocalProvider !== 'function') throw new Error('Local chat provider has not been loaded.');
        this.registerProvider(options.localProvider || new LocalProvider({id:'local',label:'Local AI',client:options.client,runtime:options.localManager,registry:this.registry,capabilities:options.localCapabilities||{}}));
      }
    }
    registerProvider(provider) {
      if (!(provider instanceof ProviderAI)) throw new TypeError('Providers must extend ProviderAI.');
      this.providers.set(provider.id, provider);
      return provider;
    }
    unregisterProvider(id) {
      const provider = this.providers.get(String(id));
      if (!provider) return false;
      provider.dispose?.();
      this.providers.delete(String(id));
      return true;
    }
    getModel(modelId) {
      if (!this.registry) return null;
      if (modelId) return this.registry.settings?.models?.find(model => model.id === modelId) || null;
      return this.registry.active?.() || null;
    }
    getCapabilities(modelId) { return this.getProvider(modelId).getCapabilities(this.getModel(modelId)); }
    getProvider(modelId) {
      const model = this.getModel(modelId);
      const id = model && (model.local || model.protocol === 'local-transformers') ? 'local' : this.defaultProviderId;
      const provider = this.providers.get(id);
      if (!provider) throw new Error('No ' + id + ' AI provider is registered.');
      return provider;
    }
    createConversation(options = {}) {
      const conversation = new ConversationAI(this, options);
      if (this.conversations.has(conversation.id)) throw new Error('Conversation already exists: ' + conversation.id);
      this.conversations.set(conversation.id, conversation);
      return conversation;
    }
    openConversation(options = {}) {
      const id = String(options.id || '');
      if (id && this.conversations.has(id)) {
        const existing = this.conversations.get(id);
        if (Array.isArray(options.messages)) existing.setMessages(options.messages);
        if (options.modelId !== undefined) existing.modelId = options.modelId;
        return existing;
      }
      return this.createConversation(options);
    }
    getConversation(id) { return this.conversations.get(String(id)) || null; }
    closeConversation(id) {
      const conversation = this.getConversation(id);
      if (!conversation) return false;
      if (conversation.running) conversation.cancel();
      this.conversations.delete(String(id));
      return true;
    }
    async complete(messages, options = {}) {
      return this.getProvider(options.modelId).complete(messages, {...options, model:this.getModel(options.modelId)});
    }
    stream(messages, options = {}) {
      return this.getProvider(options.modelId).stream(messages, {...options, model:this.getModel(options.modelId)});
    }
    async runAgent(messages, options = {}) {
      if (!this.agent) throw new Error('No agent runner has been configured.');
      return this.agent.run(messages, options);
    }
    cancel() { for (const provider of this.providers.values()) provider.cancel?.(); }
    dispose() {
      this.cancel();
      for (const provider of this.providers.values()) provider.dispose?.();
      this.providers.clear();
      this.conversations.clear();
    }
  }

  root.ProviderAI = ProviderAI;
  root.ConversationAI = ConversationAI;
  root.ChatAI = ChatAI;
  Object.assign(editorRoot, {ProviderAI, ConversationAI, ChatAI});
})(window);
