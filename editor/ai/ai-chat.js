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
/* -------------------------------------------------------------------------- */
/* Consolidated module */
(function() {
  const root = window.EditorAI = window.EditorAI || {};
  function toolSchema(tools) { return tools.map(t => ({type:'function',function:{name:t.name,description:t.description,parameters:t.parameters||{type:'object',properties:{}}}})); }
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
    constructor(options={}) {
      Object.assign(this,options);
      this.id=String(options.id||('agent-'+Math.random().toString(36).slice(2)));
      this.name=String(options.name||this.id);
      this.chatAI=options.chatAI||null;
      this.maxSteps=Math.max(1,Math.min(100,Number(options.maxSteps)||24));
      this.tools=new Map();
      if(Array.isArray(options.tools))this.registerTools(options.tools);
    }
    registerTool(definition) {
      if(!definition||typeof definition!=='object')throw new TypeError('A tool definition is required.');
      const name=String(definition.name||'').trim();
      if(!name||typeof definition.execute!=='function')throw new TypeError('A tool needs a name and execute function.');
      const tool={...definition,name,parameters:definition.parameters||{type:'object',properties:{}}};
      this.tools.set(name,tool);return tool;
    }
    registerTools(definitions=[]) { return Array.from(definitions,definition=>this.registerTool(definition)); }
    unregisterTool(name) { return this.tools.delete(String(name)); }
    getTool(name) { return this.tools.get(String(name))||null; }
    listTools() { return [...this.tools.values()]; }
    setInstructions(value) { this.toolInstructions=String(value||'');return this; }
    setPermission(name,policy) {
      if(!this.permissions||typeof this.permissions.set!=='function')throw new Error('This agent does not have a configurable permission manager.');
      this.permissions.set(String(name),policy);return this;
    }
    getPermission(name) { return this.permissions?.get?.(String(name))||'ask'; }
    async permission(tool,args,resultPreview,runOptions={}) {
      const name=tool.permission||'ask';if(name==='none')return true;
      const manager=runOptions.permissions||this.permissions,policy=manager?.get(name)||'ask';
      if(policy==='always')return true;
      if(policy==='never')throw new Error('Permission denied: '+tool.name);
      const requestPermission=runOptions.requestPermission||this.requestPermission;
      if(typeof requestPermission!=='function')throw new Error('Permission required: '+tool.name);
      const decision=await requestPermission({tool,args,preview:resultPreview,agent:this});
      if(decision==='always')manager?.set(name,'always');
      if(decision==='deny'||decision===false)throw new Error('Permission denied: '+tool.name);
      return true;
    }
    async executeTool(call,runOptions={}) {
      const started=performance.now?.()??Date.now(),emit=runOptions.emit||this.emit;
      const tool=this.getTool(call?.name);let args={};
      try {
        if(!tool)throw new Error("Unknown tool: "+(call?.name||'unnamed tool'));
        args=typeof call.arguments==='string'?JSON.parse(call.arguments||'{}'):(call.arguments||{});
        if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('Tool arguments must be a JSON object.');
        const beforeTool=runOptions.beforeTool||this.beforeTool;
        const before=await beforeTool?.({tool,args,agent:this})||{args};
        args=before?.args&&typeof before.args==='object'?before.args:args;
        emit?.({type:'tool_call',name:tool.name,args});
        await this.permission(tool,args,call.preview||args,runOptions);
        let result=await tool.execute(args);
        const afterTool=runOptions.afterTool||this.afterTool;
        const after=await afterTool?.({tool,args,result,agent:this})||{result};
        if(after&&Object.prototype.hasOwnProperty.call(after,'result'))result=after.result;
        const durationMs=Math.max(0,Math.round((performance.now?.()??Date.now())-started));
        emit?.({type:'tool_result',name:tool.name,args,result,ok:true,durationMs});return result;
      } catch(e) {
        const durationMs=Math.max(0,Math.round((performance.now?.()??Date.now())-started));
        const error={error:e?.message||String(e)};
        if(!tool)error.tool=call?.name||'';
        if(/Permission denied|Permission required/.test(error.error))error.permissionDenied=true;
        emit?.({type:'tool_result',name:tool?.name||call?.name||'unknown',args,result:error,ok:false,durationMs});return error;
      }
    }
    async run(messages,options={}) {
      const emit=typeof options.emit==='function'?options.emit:this.emit;
      const sendEvent=event=>{try{emit?.(event);}catch(error){console.error('AI agent event handler failed:',error);}};
      const maxSteps=Math.max(1,Math.min(100,Number(options.maxSteps??this.maxSteps)||24));
      const model=this.chatAI?.getModel?.(options.modelId)||this.client?.model?.();
      if(!model)throw new Error('No AI model is selected.');
      const provider=this.chatAI?.getProvider?.(model.id)||this.client;
      if(!provider)throw new Error('No AI provider is available.');
      const registeredTools=this.listTools(),toolDefs=toolSchema(registeredTools);
      const canNative=!!model.supportsTools&&registeredTools.length>0;
      const runOptions={emit:sendEvent,permissions:options.permissions||this.permissions,requestPermission:options.requestPermission||this.requestPermission,beforeTool:options.beforeTool||this.beforeTool,afterTool:options.afterTool||this.afterTool};
      const working=messages.map(x=>({role:x.role,content:x.content,...(x.tool_call_id?{tool_call_id:x.tool_call_id}:{}),...(x.name?{name:x.name}:{}),...(Array.isArray(x.tool_calls)?{tool_calls:x.tool_calls}:{}),...(x.role==='assistant'&&x._geminiContent?{_geminiContent:x._geminiContent}:{}),...(x._geminiCallId?{_geminiCallId:x._geminiCallId}:{})}));
      if(!canNative) {
        const instructions=String(options.toolInstructions||this.toolInstructions||'')+(registeredTools.length?'\n\nAvailable tool schemas:\n'+registeredTools.map(t=>JSON.stringify({name:t.name,description:t.description,parameters:t.parameters||{type:'object',properties:{}}})).join('\n'):'');
        if(working[0]?.role==='system')working[0]={...working[0],content:working[0].content+instructions};
        else working.unshift({role:'system',content:(options.systemPrompt||'')+instructions});
      }
      let finalText='',reasoning='';
      for(let step=0;step<maxSteps;step++) {
        if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
        sendEvent({type:'step',step:step+1,maxSteps});
        if(canNative) {
          sendEvent({type:'request_start',model:model.model||model.id||'model',protocol:model.protocol||model.kind||'unknown',step:step+1,maxSteps});
          const msg=await provider.complete(working,{model,tools:toolDefs,signal:options.signal,systemPrompt:options.systemPrompt,thinking:true,maxTokens:options.maxTokens,onRetry:options.onRetry,max429Retries:options.max429Retries,baseRetryDelay:options.baseRetryDelay,retry429:options.retry429,retryTransport:options.retryTransport,maxTransportRetries:options.maxTransportRetries,transportRetryDelay:options.transportRetryDelay,onResponse:info=>sendEvent({type:'request_response',...info})});
          const think=msg.reasoning_content||msg.reasoning||'';
          if(think){reasoning+=think;sendEvent({type:msg.reasoning_kind==='summary'?'reasoning_summary':'reasoning',text:think});}
          const calls=Array.isArray(msg.tool_calls)?msg.tool_calls.map((x,i)=>({id:x.id||x._geminiCallId||('tool-'+Date.now()+'-'+i),name:x.function?.name,arguments:x.function?.arguments||'{}',_geminiCallId:x._geminiCallId||null})).filter(x=>x.name):[];
          if(!calls.length){finalText=String(msg.content||'');working.push({role:'assistant',content:finalText});sendEvent({type:'final',text:finalText,reasoning});return {text:finalText,reasoning};}
          const narration=String(msg.content||'').trim();if(narration)sendEvent({type:'assistant_activity',text:narration});
          working.push({role:'assistant',content:msg.content||'',tool_calls:msg.tool_calls,_geminiContent:msg._geminiContent||null});
          for(const call of calls){const result=await this.executeTool(call,runOptions);if(result?.exitEarly===true){finalText=String(result.message||'');sendEvent({type:'final',text:finalText,reasoning,exitedEarly:true});return {text:finalText,reasoning,exitedEarly:true};}working.push({role:'tool',tool_call_id:call.id,_geminiCallId:call._geminiCallId,name:call.name,content:stringifyResult(result)});}
        } else {
          let text='',lastReasoning='';
          sendEvent({type:'request_start',model:model.model||model.id||'model',protocol:model.protocol||model.kind||'unknown',step:step+1,maxSteps});
          const streamOptions={model,signal:options.signal,systemPrompt:options.systemPrompt,thinking:true,maxTokens:options.maxTokens,onRetry:options.onRetry,max429Retries:options.max429Retries,baseRetryDelay:options.baseRetryDelay,retry429:options.retry429,retryTransport:options.retryTransport,maxTransportRetries:options.maxTransportRetries,transportRetryDelay:options.transportRetryDelay};
          for await(const chunk of provider.stream(working,streamOptions)){text=chunk.text||text;if(chunk.reasoning&&chunk.reasoning!==lastReasoning){const delta=chunk.reasoning.slice(lastReasoning.length);if(delta){reasoning+=delta;sendEvent({type:chunk.reasoningKind==='summary'?'reasoning_summary':'reasoning',text:delta});}lastReasoning=chunk.reasoning;}}
          const calls=parseToolProtocol(text);
          if(!calls.length){finalText=stripToolProtocol(text);sendEvent({type:'assistant',text:finalText});sendEvent({type:'final',text:finalText,reasoning});return {text:finalText,reasoning};}
          const clean=stripToolProtocol(text);if(clean)sendEvent({type:'assistant_activity',text:clean});working.push({role:'assistant',content:clean});
          for(const call of calls){const result=await this.executeTool(call,runOptions);if(result?.exitEarly===true){finalText=String(result.message||'');sendEvent({type:'final',text:finalText,reasoning,exitedEarly:true});return {text:finalText,reasoning,exitedEarly:true};}working.push({role:'user',content:'Tool result for '+call.name+':\n'+stringifyResult(result)});}
        }
      }
      sendEvent({type:'request_start',model:model.model||model.id||'model',protocol:model.protocol||model.kind||'unknown',final:true});
      const finalMsg=await provider.complete(working,{model,signal:options.signal,systemPrompt:(options.systemPrompt||'')+(options.finalInstructions||this.finalInstructions||''),thinking:true,maxTokens:options.maxTokens,onRetry:options.onRetry,max429Retries:options.max429Retries,baseRetryDelay:options.baseRetryDelay,retry429:options.retry429,retryTransport:options.retryTransport,maxTransportRetries:options.maxTransportRetries,transportRetryDelay:options.transportRetryDelay,onResponse:info=>sendEvent({type:'request_response',...info})});
      const finalThink=finalMsg.reasoning_content||finalMsg.reasoning||'';
      if(finalThink){reasoning+=finalThink;sendEvent({type:finalMsg.reasoning_kind==='summary'?'reasoning_summary':'reasoning',text:finalThink});}
      finalText=stripToolProtocol(String(finalMsg.content||''));sendEvent({type:'final',text:finalText,reasoning,stepLimitReached:true});return {text:finalText,reasoning,stepLimitReached:true};
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
    constructor(chat,options={}) {
      if(!chat)throw new TypeError('ConversationAI requires a ChatAI instance.');
      this.chat=chat;this.id=String(options.id||('conversation-'+Math.random().toString(36).slice(2)));
      this.modelId=options.modelId||null;this.systemPrompt=String(options.systemPrompt||'');
      this.messages=Array.isArray(options.messages)?options.messages:[];this.metadata={...(options.metadata||{})};
      this.createdAt=Number(options.createdAt)||Date.now();this.updatedAt=Number(options.updatedAt)||this.createdAt;this.running=false;
      const agent=Object.prototype.hasOwnProperty.call(options,'agent')?options.agent:options.agentId;
      if(agent)this.setAgent(agent);
    }
    getMessages() { return this.messages; }
    setMessages(messages) { if(!Array.isArray(messages))throw new TypeError('Conversation messages must be an array.');this.messages=messages;this.updatedAt=Date.now();return this; }
    addMessage(message) { if(!message||typeof message!=='object'||!message.role)throw new TypeError('A message with a role is required.');this.messages.push({...message});this.updatedAt=Date.now();return this.messages[this.messages.length-1]; }
    clear() { this.messages=[];this.updatedAt=Date.now();return this; }
    getAgent() { return this.agent||null; }
    setAgent(agentOrId) {
      const agent=typeof agentOrId==='string'?this.chat.getAgent(agentOrId):agentOrId;
      if(!agent||typeof agent.run!=='function')throw new Error('The requested conversation agent is not registered with ChatAI.');
      if(agent.chatAI!==this.chat)throw new Error('A conversation agent must belong to the same ChatAI instance.');
      this.agent=agent;this.updatedAt=Date.now();return this;
    }
    removeAgent() { delete this.agent;this.updatedAt=Date.now();return this; }
    getProvider() { return this.chat.getProvider(this.modelId); }
    async complete(options={}) { return this.chat.complete(this.messages,{...options,modelId:this.modelId,systemPrompt:options.systemPrompt??this.systemPrompt}); }
    stream(options={}) { return this.chat.stream(this.messages,{...options,modelId:this.modelId,systemPrompt:options.systemPrompt??this.systemPrompt}); }
    runAgent(messages,options={}) { const agent=this.getAgent();if(!agent)throw new Error('This conversation does not have an agent attached.');return agent.run(messages,{...options,modelId:this.modelId}); }
    async send(content,options={}) {
      if(this.running)throw new Error('This conversation is already generating a response.');
      const userMessage=this.addMessage({role:'user',content});this.running=true;
      try {
        const prompt=options.systemPrompt??this.systemPrompt,messages=[...(prompt?[{role:'system',content:prompt}]:[]),...this.messages];
        if(this.getAgent()){const result=await this.runAgent(messages,options);const assistant=this.addMessage({role:'assistant',content:String(result?.text||'')});return {userMessage,message:assistant,text:assistant.content,result};}
        let text='';for await(const chunk of this.chat.stream(messages,{...options,modelId:this.modelId})){text=chunk.text??text;options.onChunk?.(chunk);}
        const assistant=this.addMessage({role:'assistant',content:text});return {userMessage,message:assistant,text};
      } finally { this.running=false; }
    }
    cancel() { this.chat.cancel(); }
    toJSON() { return {id:this.id,modelId:this.modelId,systemPrompt:this.systemPrompt,messages:this.messages,metadata:this.metadata,createdAt:this.createdAt,updatedAt:this.updatedAt,...(this.agent?.id?{agentId:this.agent.id}:{})}; }
  }

  class ChatAI {
    constructor(options={}) {
      this.registry=options.registry||null;this.providers=new Map();this.conversations=new Map();this.agents=new Map();
      this.defaultProviderId=options.defaultProviderId||'remote';
      if(options.remoteProvider||options.client){const RemoteProvider=root.RemoteProviderAI;if(!options.remoteProvider&&typeof RemoteProvider!=='function')throw new Error('Remote chat provider has not been loaded.');this.registerProvider(options.remoteProvider||new RemoteProvider({id:'remote',label:'Remote AI',client:options.client,registry:this.registry,capabilities:options.remoteCapabilities||{}}));}
      if(options.localProvider||options.localManager){const LocalProvider=root.LocalProviderAI;if(!options.localProvider&&typeof LocalProvider!=='function')throw new Error('Local chat provider has not been loaded.');this.registerProvider(options.localProvider||new LocalProvider({id:'local',label:'Local AI',client:options.client,runtime:options.localManager,registry:this.registry,capabilities:options.localCapabilities||{}}));}
      if(options.agent)this.registerAgent(options.agent);
      if(options.agentOptions)this.createAgent(options.agentOptions);
    }
    createAgent(options={}) {
      const AgentRunner=editorRoot.AIAgent;if(typeof AgentRunner!=='function')throw new Error('Agent mode is unavailable.');
      const agent=options instanceof AgentRunner?options:new AgentRunner({...options,chatAI:this});agent.chatAI=this;return this.registerAgent(agent);
    }
    registerAgent(agent) {
      const AgentRunner=editorRoot.AIAgent;if(typeof AgentRunner!=='function'||!(agent instanceof AgentRunner))throw new TypeError('Agents must be AIAgent instances.');
      if(!agent.id)agent.id='agent-'+Math.random().toString(36).slice(2);
      if(this.agents.has(agent.id)&&this.agents.get(agent.id)!==agent)throw new Error('Agent already exists: '+agent.id);
      agent.chatAI=this;this.agents.set(agent.id,agent);return agent;
    }
    getAgent(id) { return this.agents.get(String(id||''))||null; }
    listAgents() { return [...this.agents.values()]; }
    removeAgent(id) { const agent=this.getAgent(id);if(!agent)return false;for(const conversation of this.conversations.values())if(conversation.getAgent?.()===agent)conversation.removeAgent();this.agents.delete(agent.id);return true; }
    registerProvider(provider) { if(!(provider instanceof ProviderAI))throw new TypeError('Providers must extend ProviderAI.');this.providers.set(provider.id,provider);return provider; }
    unregisterProvider(id) { const provider=this.providers.get(String(id));if(!provider)return false;provider.dispose?.();this.providers.delete(String(id));return true; }
    getModel(modelId) { if(!this.registry)return null;if(modelId)return this.registry.settings?.models?.find(model=>model.id===modelId)||null;return this.registry.active?.()||null; }
    getCapabilities(modelId) { return this.getProvider(modelId).getCapabilities(this.getModel(modelId)); }
    getProvider(modelId) { const model=this.getModel(modelId),id=model&&(model.local||model.protocol==='local-transformers')?'local':this.defaultProviderId,provider=this.providers.get(id);if(!provider)throw new Error('No '+id+' AI provider is registered.');return provider; }
    createConversation(options={}) { const conversation=new ConversationAI(this,options);if(this.conversations.has(conversation.id))throw new Error('Conversation already exists: '+conversation.id);this.conversations.set(conversation.id,conversation);return conversation; }
    openConversation(options={}) {
      const id=String(options.id||'');
      if(id&&this.conversations.has(id)){
        const existing=this.conversations.get(id);if(Array.isArray(options.messages))existing.setMessages(options.messages);if(options.modelId!==undefined)existing.modelId=options.modelId;
        if(Object.prototype.hasOwnProperty.call(options,'agent')||Object.prototype.hasOwnProperty.call(options,'agentId')){const requested=Object.prototype.hasOwnProperty.call(options,'agent')?options.agent:options.agentId;if(requested)existing.setAgent(requested);else existing.removeAgent();}
        return existing;
      }
      return this.createConversation(options);
    }
    getConversation(id) { return this.conversations.get(String(id))||null; }
    closeConversation(id) { const conversation=this.getConversation(id);if(!conversation)return false;if(conversation.running)conversation.cancel();this.conversations.delete(String(id));return true; }
    async complete(messages,options={}) { return this.getProvider(options.modelId).complete(messages,{...options,model:this.getModel(options.modelId)}); }
    stream(messages,options={}) { return this.getProvider(options.modelId).stream(messages,{...options,model:this.getModel(options.modelId)}); }
    runAgent(messages,options={}) { const agent=options.agent&&typeof options.agent.run==='function'?options.agent:this.getAgent(options.agentId||options.agent);if(!agent)throw new Error('No agent was specified. Pass an agent instance or registered agent ID.');if(agent.chatAI!==this)throw new Error('The requested agent belongs to a different ChatAI instance.');return agent.run(messages,options); }
    cancel() { for(const provider of this.providers.values())provider.cancel?.(); }
    dispose() { this.cancel();for(const provider of this.providers.values())provider.dispose?.();this.providers.clear();this.conversations.clear();this.agents.clear(); }
  }

  root.ProviderAI = ProviderAI;
  root.ConversationAI = ConversationAI;
  root.ChatAI = ChatAI;
  Object.assign(editorRoot, {ProviderAI, ConversationAI, ChatAI});
})(window);
