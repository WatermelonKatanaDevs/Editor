(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LocalAI = Object.assign(root.LocalAI || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const DEFAULT_SCHEMA = {type:'object',properties:{}};
  const EVENT_ALIASES = {
    tool_call: 'tool:start',
    tool_result: 'tool:complete',
    request_start: 'request:start',
    final: 'message'
  };

  function cloneMessage(message) {
    const out = {...message};
    if (Array.isArray(message.tool_calls)) out.tool_calls = message.tool_calls.map(call => ({...call, function:call.function ? {...call.function} : call.function}));
    return out;
  }

  function validateValue(value, schema, path) {
    if (!schema || typeof schema !== 'object') return;
    const type = schema.type;
    const fail = message => { throw new Error('Invalid tool arguments at ' + path + ': ' + message); };
    if (type === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) fail('expected an object');
      for (const key of schema.required || []) if (!Object.prototype.hasOwnProperty.call(value, key)) fail('missing required property "' + key + '"');
      const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
      for (const [key, child] of Object.entries(value)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          if (schema.additionalProperties === false) fail('unknown property "' + key + '"');
          if (schema.additionalProperties && typeof schema.additionalProperties === 'object') validateValue(child, schema.additionalProperties, path + '.' + key);
          continue;
        }
        validateValue(child, properties[key], path + '.' + key);
      }
    } else if (type === 'array') {
      if (!Array.isArray(value)) fail('expected an array');
      if (Number.isFinite(schema.minItems) && value.length < schema.minItems) fail('must contain at least ' + schema.minItems + ' items');
      if (Number.isFinite(schema.maxItems) && value.length > schema.maxItems) fail('must contain no more than ' + schema.maxItems + ' items');
      if (schema.items) value.forEach((item, index) => validateValue(item, schema.items, path + '[' + index + ']'));
    } else if (type === 'string') {
      if (typeof value !== 'string') fail('expected a string');
      if (Number.isFinite(schema.minLength) && value.length < schema.minLength) fail('is too short');
      if (Number.isFinite(schema.maxLength) && value.length > schema.maxLength) fail('is too long');
      if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) fail('does not match the required pattern');
    } else if (type === 'integer') {
      if (!Number.isInteger(value)) fail('expected an integer');
    } else if (type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) fail('expected a finite number');
    } else if (type === 'boolean') {
      if (typeof value !== 'boolean') fail('expected a boolean');
    } else if (type === 'null') {
      if (value !== null) fail('expected null');
    }
    if (Array.isArray(schema.enum) && !schema.enum.some(item => Object.is(item, value))) fail('must be one of the allowed values');
    if (typeof value === 'number') {
      if (Number.isFinite(schema.minimum) && value < schema.minimum) fail('must be at least ' + schema.minimum);
      if (Number.isFinite(schema.maximum) && value > schema.maximum) fail('must be no greater than ' + schema.maximum);
    }
  }

  class EventEmitter {
    constructor() { this.listeners = new Map(); }
    on(type, listener) {
      if (typeof listener !== 'function') throw new TypeError('Event listener must be a function.');
      const key = String(type || '*');
      if (!this.listeners.has(key)) this.listeners.set(key, new Set());
      this.listeners.get(key).add(listener);
      return () => this.off(key, listener);
    }
    off(type, listener) {
      const set = this.listeners.get(String(type || '*'));
      if (!set) return false;
      const removed = set.delete(listener);
      if (!set.size) this.listeners.delete(String(type || '*'));
      return removed;
    }
    emit(type, value) {
      const event = value && typeof value === 'object' ? {...value, type:value.type || type} : {type, value};
      const names = new Set([String(type), '*']);
      const alias = EVENT_ALIASES[String(type)];
      if (alias) names.add(alias);
      for (const name of names) {
        for (const listener of [...(this.listeners.get(name) || [])]) {
          try { listener(event); } catch (error) {
            if (typeof console !== 'undefined' && console.warn) console.warn('AI event listener failed:', error);
          }
        }
      }
      return event;
    }
    removeAllListeners() { this.listeners.clear(); }
  }

  class ToolRegistry {
    constructor(initialTools = []) {
      this.map = new Map();
      for (const tool of initialTools || []) this.register(tool);
    }
    register(definition, options = {}) {
      if (!definition || typeof definition !== 'object') throw new TypeError('A tool definition is required.');
      const name = String(definition.name || '').trim();
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name)) throw new Error('Tool names must be 1–64 characters and contain only letters, numbers, underscores or hyphens.');
      if (typeof definition.execute !== 'function') throw new TypeError('Tool "' + name + '" must provide an execute(args) function.');
      if (this.map.has(name) && options.replace !== true) throw new Error('Tool "' + name + '" is already registered.');
      const parameters = definition.parameters == null ? DEFAULT_SCHEMA : definition.parameters;
      if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) throw new TypeError('Tool parameters must be a JSON Schema object.');
      const tool = {...definition, name, description:String(definition.description || ''), parameters};
      this.map.set(name, tool);
      return tool;
    }
    unregister(name) { return this.map.delete(String(name || '')); }
    get(name) { return this.map.get(String(name || '')) || null; }
    has(name) { return this.map.has(String(name || '')); }
    list() { return [...this.map.values()]; }
    clear() { this.map.clear(); }
    get size() { return this.map.size; }
  }

  function toRegistry(tools) {
    if (tools instanceof ToolRegistry) return tools;
    if (tools && typeof tools.list === 'function' && tools.map instanceof Map) return tools;
    if (tools instanceof Map) return new ToolRegistry([...tools.values()]);
    return new ToolRegistry(Array.isArray(tools) ? tools : []);
  }

  function toolSchema(tools) {
    return tools.list().map(tool => ({
      type:'function',
      function:{
        name:tool.name,
        description:tool.description,
        parameters:tool.parameters || DEFAULT_SCHEMA
      }
    }));
  }

  function parseToolProtocol(text) {
    const calls = [];
    const re = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
    let match;
    while ((match = re.exec(String(text || '')))) {
      try {
        const item = JSON.parse(match[1]);
        if (item && item.name) calls.push({id:'protocol-' + Math.random().toString(36).slice(2), name:item.name, arguments:item.arguments || {}});
      } catch (_) {}
    }
    return calls;
  }

  function stripToolProtocol(text) {
    return String(text || '').replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').trim();
  }

  function stringifyResult(value, maxChars = 120000) {
    let result;
    try { result = JSON.stringify(value); } catch (_) { result = String(value); }
    result = String(result == null ? '' : result);
    return result.length <= maxChars ? result : result.slice(0, maxChars) + '\n… [truncated ' + (result.length - maxChars) + ' characters]';
  }

  class Agent extends EventEmitter {
    constructor(options = {}) {
      super();
      if (!options.client || typeof options.client.model !== 'function') throw new TypeError('Agent requires a client with a model() method.');
      this.client = options.client;
      this.tools = toRegistry(options.tools);
      this.permissions = options.permissions || null;
      this.requestPermission = options.requestPermission || null;
      this.hooks = options.hooks || null;
      this.extensionAPI = options.extensionAPI || null;
      this.maxSteps = Math.max(1, Math.min(100, Number(options.maxSteps) || 24));
      this.running = false;
      this.onEvent = typeof options.onEvent === 'function' ? options.onEvent : null;
    }
    emit(type, value) {
      const event = super.emit(type, value);
      try { this.onEvent?.(event); } catch (error) {
        if (typeof console !== 'undefined' && console.warn) console.warn('AI event callback failed:', error);
      }
      return event;
    }
    async runHook(name, payload) {
      try {
        const shortName = name === 'ai.beforeTool' ? 'beforeTool' : name === 'ai.afterTool' ? 'afterTool' : name;
        const hook = this.hooks?.[name] || this.hooks?.[shortName];
        if (typeof hook === 'function') return await hook(payload) || payload;
        return await this.extensionAPI?.runAIHook?.(name, payload) || payload;
      } catch (error) {
        this.emit('extension_hook_error', {name, error:error?.message || String(error)});
        return payload;
      }
    }
    async checkPermission(tool, args, preview) {
      const name = tool.permission;
      if (!name || name === 'none') return true;
      const policy = this.permissions?.get?.(name) || 'ask';
      if (policy === 'always') return true;
      if (policy === 'never') throw new Error('Permission denied: ' + tool.name);
      if (typeof this.requestPermission !== 'function') throw new Error('Permission required: ' + tool.name);
      const decision = await this.requestPermission({tool, args, preview});
      if (decision === 'always') this.permissions?.set?.(name, 'always');
      if (decision === 'deny' || decision === false) throw new Error('Permission denied: ' + tool.name);
      return true;
    }
    async executeTool(call) {
      const started = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      let tool = this.tools.get(call?.name);
      let args = {};
      try {
        if (!tool) throw new Error('Unknown tool: ' + (call?.name || 'unnamed tool'));
        args = typeof call.arguments === 'string' ? JSON.parse(call.arguments || '{}') : (call.arguments || {});
        if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Tool arguments must be a JSON object.');
        validateValue(args, tool.parameters || DEFAULT_SCHEMA, 'arguments');
        const before = await this.runHook('ai.beforeTool', {tool, args}) || {args};
        args = before?.args && typeof before.args === 'object' ? before.args : args;
        validateValue(args, tool.parameters || DEFAULT_SCHEMA, 'arguments');
        this.emit('tool_call', {name:tool.name, args});
        await this.checkPermission(tool, args, call.preview || args);
        let result = await tool.execute(args);
        const after = await this.runHook('ai.afterTool', {tool, args, result}) || {result};
        if (after && Object.prototype.hasOwnProperty.call(after, 'result')) result = after.result;
        const ended = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        this.emit('tool_result', {name:tool.name, args, result, ok:true, durationMs:Math.max(0, Math.round(ended - started))});
        return result;
      } catch (error) {
        const ended = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        const message = error?.message || String(error);
        const result = {error:message};
        if (!tool) result.tool = call?.name || '';
        if (/Permission denied|Permission required/.test(message)) result.permissionDenied = true;
        this.emit('tool_result', {name:tool?.name || call?.name || 'unknown', args, result, ok:false, durationMs:Math.max(0, Math.round(ended - started))});
        return result;
      }
    }
    async run(messages, options = {}) {
      if (this.running) {
        const error = new Error('An AI task is already running.');
        this.emit('error', {error, message:error.message});
        throw error;
      }
      this.running = true;
      const maxSteps = Math.max(1, Math.min(100, Number(options.maxSteps) || this.maxSteps));
      try {
        const model = this.client.model();
        if (!model) throw new Error('The AI client did not provide an active model.');
        const definitions = toolSchema(this.tools);
        const canNative = !!model.supportsTools;
        const working = (messages || []).map(cloneMessage);
        if (!canNative) {
          const instructions = '\n\nYou have access to tools. When a tool is needed, output one or more tags in this format:\n<tool_call>{"name":"tool_name","arguments":{"example":"value"}}</tool_call>\nDo not put tool calls inside Markdown code fences. Use valid JSON arguments matching the schemas below. After receiving tool results, continue the task.\n\nTool schemas:\n' +
            this.tools.list().map(tool => JSON.stringify({name:tool.name, description:tool.description, parameters:tool.parameters || DEFAULT_SCHEMA})).join('\n');
          if (working[0]?.role === 'system') working[0] = {...working[0], content:String(working[0].content || '') + instructions};
          else working.unshift({role:'system', content:(options.systemPrompt || '') + instructions});
        }
        let finalText = '';
        let reasoning = '';
        for (let step = 0; step < maxSteps; step++) {
          this.emit('step', {step:step + 1, maxSteps});
          this.emit('request_start', {model:model.model || model.id || 'model', protocol:model.protocol || model.kind || 'unknown', step:step + 1, maxSteps});
          if (canNative) {
            const message = await this.client.complete(working, {
              ...options, model, tools:definitions, systemPrompt:options.systemPrompt,
              onResponse:info => this.emit('request_response', info)
            });
            const think = message.reasoning_content || message.reasoning || '';
            if (think) { reasoning += think; this.emit(message.reasoning_kind === 'summary' ? 'reasoning_summary' : 'reasoning', {text:think}); }
            const calls = Array.isArray(message.tool_calls) ? message.tool_calls.map((call, index) => ({
              id:call.id || call._geminiCallId || 'tool-' + Date.now() + '-' + index,
              name:call.function?.name,
              arguments:call.function?.arguments || '{}',
              _geminiCallId:call._geminiCallId || null
            })).filter(call => call.name) : [];
            if (!calls.length) {
              finalText = String(message.content || '');
              working.push({role:'assistant', content:finalText});
              this.emit('final', {text:finalText, reasoning});
              return {text:finalText, reasoning};
            }
            const narration = String(message.content || '').trim();
            if (narration) this.emit('assistant_activity', {text:narration});
            working.push({role:'assistant', content:message.content || '', tool_calls:message.tool_calls, _geminiContent:message._geminiContent || null});
            for (const call of calls) {
              const result = await this.executeTool(call);
              if (result?.exitEarly === true) {
                finalText = String(result.message || '');
                this.emit('final', {text:finalText, reasoning, exitedEarly:true});
                return {text:finalText, reasoning, exitedEarly:true};
              }
              working.push({role:'tool', tool_call_id:call.id, _geminiCallId:call._geminiCallId, name:call.name, content:stringifyResult(result)});
            }
          } else {
            let text = '';
            let lastReasoning = '';
            if (typeof this.client.stream === 'function') {
              const streamOptions = {...options, model, systemPrompt:options.systemPrompt};
              for await (const chunk of this.client.stream(working, streamOptions)) {
                text = chunk.text || text;
                if (chunk.reasoning && chunk.reasoning !== lastReasoning) {
                  const delta = chunk.reasoning.slice(lastReasoning.length);
                  if (delta) { reasoning += delta; this.emit(chunk.reasoningKind === 'summary' ? 'reasoning_summary' : 'reasoning', {text:delta}); }
                  lastReasoning = chunk.reasoning;
                }
              }
            } else {
              const message = await this.client.complete(working, {...options, model});
              text = String(message.content || '');
              if (message.reasoning_content || message.reasoning) {
                reasoning += String(message.reasoning_content || message.reasoning);
                this.emit('reasoning', {text:String(message.reasoning_content || message.reasoning)});
              }
            }
            const calls = parseToolProtocol(text);
            if (!calls.length) {
              finalText = stripToolProtocol(text);
              this.emit('assistant', {text:finalText});
              this.emit('final', {text:finalText, reasoning});
              return {text:finalText, reasoning};
            }
            const clean = stripToolProtocol(text);
            if (clean) this.emit('assistant_activity', {text:clean});
            working.push({role:'assistant', content:clean});
            for (const call of calls) {
              const result = await this.executeTool(call);
              if (result?.exitEarly === true) {
                finalText = String(result.message || '');
                this.emit('final', {text:finalText, reasoning, exitedEarly:true});
                return {text:finalText, reasoning, exitedEarly:true};
              }
              working.push({role:'user', content:'Tool result for ' + call.name + ':\n' + stringifyResult(result)});
            }
          }
        }
        this.emit('request_start', {model:model.model || model.id || 'model', protocol:model.protocol || model.kind || 'unknown', final:true});
        const finalMessage = await this.client.complete(working, {
          ...options, model,
          tools:undefined,
          systemPrompt:(options.systemPrompt || '') + '\n\nYou have reached the tool-step limit. Do not call tools. Give the user the best final answer using the tool results already collected.',
          onResponse:info => this.emit('request_response', info)
        });
        const finalThink = finalMessage.reasoning_content || finalMessage.reasoning || '';
        if (finalThink) { reasoning += finalThink; this.emit(finalMessage.reasoning_kind === 'summary' ? 'reasoning_summary' : 'reasoning', {text:finalThink}); }
        finalText = stripToolProtocol(String(finalMessage.content || ''));
        this.emit('final', {text:finalText, reasoning, stepLimitReached:true});
        return {text:finalText, reasoning, stepLimitReached:true};
      } catch (error) {
        this.emit('error', {error, message:error?.message || String(error)});
        throw error;
      } finally {
        this.running = false;
      }
    }
    cancel() { this.client.cancel?.(); }
  }

  class Conversation extends EventEmitter {
    constructor(agent, options = {}) {
      super();
      if (!(agent instanceof Agent) && (!agent || typeof agent.run !== 'function')) throw new TypeError('Conversation requires an Agent.');
      this.agent = agent;
      this.systemPrompt = String(options.systemPrompt || '');
      this.messages = Array.isArray(options.messages) ? options.messages.map(cloneMessage) : [];
      this.busy = false;
      this._activeUnsubscribe = null;
    }
    getMessages() { return this.messages.map(cloneMessage); }
    setMessages(messages) {
      if (!Array.isArray(messages)) throw new TypeError('Conversation messages must be an array.');
      this.messages = messages.map(cloneMessage);
      return this.getMessages();
    }
    clear() { if (this.busy) throw new Error('Cannot clear a conversation while it is running.'); this.messages = []; this.emit('clear', {}); }
    async send(input, options = {}) {
      if (this.busy) throw new Error('This conversation is already running.');
      const content = typeof input === 'string' ? input : String(input?.content || '');
      if (!content.trim()) throw new Error('Message cannot be empty.');
      this.busy = true;
      const userMessage = {role:'user', content};
      this.messages.push(userMessage);
      this.emit('user_message', userMessage);
      this._activeUnsubscribe = this.agent.on('*', event => {
        this.emit(event.type, event);
      });
      try {
        const prompt = options.systemPrompt !== undefined ? String(options.systemPrompt || '') : this.systemPrompt;
        const history = [...(prompt ? [{role:'system', content:prompt}] : []), ...this.messages].map(cloneMessage);
        const result = await this.agent.run(history, {...options, systemPrompt:prompt});
        const assistantMessage = {role:'assistant', content:String(result.text || '')};
        this.messages.push(assistantMessage);
        this.emit('assistant_message', {...assistantMessage, result});
        return result;
      } catch (error) {
        throw error;
      } finally {
        this._activeUnsubscribe?.();
        this._activeUnsubscribe = null;
        this.busy = false;
      }
    }
    cancel() { this.agent.cancel(); }
    dispose() {
      this._activeUnsubscribe?.();
      this._activeUnsubscribe = null;
      this.removeAllListeners();
      this._onDispose?.();
      this._onDispose = null;
    }
  }

  class Runtime extends EventEmitter {
    constructor(options = {}) {
      super();
      if (!options.client) throw new TypeError('Runtime requires a client adapter. See the runtime README for the client contract.');
      this.tools = options.tools instanceof ToolRegistry || (options.tools && typeof options.tools.register === 'function' && typeof options.tools.list === 'function')
        ? options.tools
        : new ToolRegistry(options.tools || []);
      this.agent = new Agent({
        client:options.client,
        tools:this.tools,
        permissions:options.permissions,
        requestPermission:options.requestPermission,
        hooks:options.hooks,
        extensionAPI:options.extensionAPI,
        maxSteps:options.maxSteps,
        onEvent:event => this.emit(event.type, event)
      });
      this._conversations = new Set();
    }
    registerTool(definition, options) { return this.tools.register(definition, options); }
    unregisterTool(name) { return this.tools.unregister(name); }
    getTools() { return this.tools.list(); }
    createConversation(options = {}) {
      let conversation;
      conversation = new Conversation(this.agent, options);
      conversation._onDispose = () => this._conversations.delete(conversation);
      this._conversations.add(conversation);
      return conversation;
    }
    run(messages, options = {}) { return this.agent.run(messages, options); }
    cancel() { this.agent.cancel(); }
    dispose() {
      this.cancel();
      for (const conversation of this._conversations) conversation.dispose();
      this._conversations.clear();
      this.agent.removeAllListeners();
      this.removeAllListeners();
    }
  }

  return {version:'1.0.0', EventEmitter, ToolRegistry, Agent, Conversation, Runtime, createRuntime:options => new Runtime(options)};
});

/* Provider client: request protocols, streaming, auth injection and retries. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = Object.assign(module.exports || {}, api);
  if (root) root.LocalAI = Object.assign(root.LocalAI || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

function createProviderClient(options = {}) {
  const deps = options;
  function normalizeHeaders(value) {
    if (!value) return {};
    if (typeof value.forEach === 'function') {
      const result = {};
      value.forEach((item, key) => { result[key] = item; });
      return result;
    }
    return {...value};
  }
  function getPreferences() {
    try { return typeof deps.getPreferences === 'function' ? (deps.getPreferences() || {}) : (deps.preferences || {}); }
    catch (_) { return deps.preferences || {}; }
  }
  function recordAnalytics(info) {
    try { deps.analytics?.(info); } catch (error) { emitEvent('analytics:error', {error, info}); }
  }
  function emitEvent(type, payload) {
    try {
      if (typeof deps.events === 'function') deps.events(type, payload);
      else deps.events?.emit?.(type, payload);
      deps.onEvent?.({type, ...(payload || {})});
    } catch (_) {}
  }
  function random() {
    const value = typeof deps.random === 'function' ? Number(deps.random()) : Math.random();
    return Number.isFinite(value) ? Math.max(0, Math.min(.999999, value)) : Math.random();
  }
  function abortError() {
    const error = new Error('Aborted');
    error.name = 'AbortError';
    return error;
  }
  function pause(ms, signal) {
    if (signal?.aborted) return Promise.reject(abortError());
    if (typeof deps.sleep === 'function') return Promise.resolve(deps.sleep(ms, {signal})).then(() => {
      if (signal?.aborted) throw abortError();
    });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(finish, ms);
      function cleanup() { clearTimeout(timer); signal?.removeEventListener?.('abort', onAbort); }
      function finish() { cleanup(); resolve(); }
      function onAbort() { cleanup(); reject(abortError()); }
      signal?.addEventListener?.('abort', onAbort, {once:true});
    });
  }
function trimEndpoint(url){return String(url || '').replace(/\/+$/,'');}
  function appendPath(endpoint,path){const base=trimEndpoint(endpoint);return new RegExp(path.replace('/','\\/')+'$','i').test(base)?base:base+path;}
  function completionUrl(model){return appendPath(model.endpoint,'/chat/completions');}
  function responseUrl(model){return appendPath(model.endpoint,'/responses');}
  function anthropicUrl(model){const base=trimEndpoint(model.endpoint);if(/\/v1\/messages$/i.test(base))return base;if(/\/v1$/i.test(base))return base+'/messages';return base+'/v1/messages';}
  function cohereUrl(model){const base=trimEndpoint(model.endpoint);return /\/v2\/chat$/i.test(base)?base:base.replace(/\/v2$/i,'')+'/v2/chat';}
  function googleUrl(model,stream){
    let endpoint=trimEndpoint(model.endpoint), modelId=encodeURIComponent(String(model.model||'').replace(/^models\//,''));
    if(/:(?:streamGenerateContent|generateContent)$/i.test(endpoint)) return endpoint;
    endpoint=endpoint.replace(/\/v1beta(?:\/models)?$/i,'').replace(/\/models$/i,'');
    return endpoint+'/v1beta/models/'+modelId+':'+(stream?'streamGenerateContent?alt=sse':'generateContent');
  }

  function parseSSEBlock(block){const data=String(block||'').split(/\r?\n/).filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).join('\n');if(!data||data==='[DONE]')return null;try{return JSON.parse(data);}catch(_){return data;}}
  async function* streamResponse(response,signal){
    if(!response.body){const text=await response.text();yield text;return;}
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
    while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const parts=buffer.split(/\r?\n\r?\n/);buffer=parts.pop()||'';for(const part of parts)yield part;if(signal?.aborted)throw abortError();}
    buffer+=decoder.decode();if(buffer.trim())yield buffer;
  }
  function textOf(value){
    if(typeof value==='string')return value;
    if(Array.isArray(value))return value.map(x=>typeof x==='string'?x:(x?.text||x?.content||'')).join('');
    if(value?.text)return String(value.text);
    return '';
  }
  function normalizeToolCalls(calls){
    if(!Array.isArray(calls))return [];
    return calls.map((x,i)=>{
      const fn=x?.function || x?.functionCall || x?.function_call || x;
      const name=fn?.name || x?.name;
      const args=fn?.arguments ?? fn?.args ?? x?.arguments ?? x?.input ?? {};
      if(!name)return null;
      return {id:String(x?.id || x?.call_id || ('call-'+i+'-'+Math.random().toString(36).slice(2))),type:'function',function:{name:String(name),arguments:typeof args==='string'?args:JSON.stringify(args)}};
    }).filter(Boolean);
  }
  function normalizeChatData(data){
    const msg=data?.choices?.[0]?.message;
    if(msg)return {role:'assistant',content:textOf(msg.content),tool_calls:normalizeToolCalls(msg.tool_calls),reasoning_content:msg.reasoning_content||msg.reasoning||'',reasoning_kind:(msg.reasoning||msg.reasoning_content)?'reasoning':'',_usage:data?.usage||null};
    return {role:'assistant',content:textOf(data?.output_text || data?.text || ''),tool_calls:[],reasoning_content:data?.reasoning_content||'',_usage:data?.usage||null};
  }
  function normalizeResponsesData(data){
    const output=Array.isArray(data?.output)?data.output:[];let content=String(data?.output_text || '');const calls=[];let reasoning='';
    for(const item of output){
      if(item?.type==='message'){
        const parts=Array.isArray(item.content)?item.content:[];
        for(const part of parts) if(part?.type==='output_text') content += content ? (part.text===content?'':part.text) : (part.text||'');
      } else if(item?.type==='function_call') calls.push({id:item.call_id||item.id,type:'function',function:{name:item.name,arguments:typeof item.arguments==='string'?item.arguments:JSON.stringify(item.arguments||{})}});
      else if(item?.type==='reasoning') reasoning += textOf(item.summary || item.content || '');
    }
    return {role:'assistant',content,tool_calls:calls,reasoning_content:reasoning,reasoning_kind:reasoning?'summary':'',_usage:data?.usage||null};
  }
  function normalizeAnthropicData(data){
    let content='',calls=[];
    for(const item of data?.content || []){
      if(item?.type==='text')content+=item.text||'';
      else if(item?.type==='tool_use')calls.push({id:item.id,type:'function',function:{name:item.name,arguments:JSON.stringify(item.input||{})}});
    }
    return {role:'assistant',content,tool_calls:calls,reasoning_content:'',_usage:data?.usage||null};
  }
  function normalizeGeminiData(data){
    let content='',calls=[];
    const parts=data?.candidates?.[0]?.content?.parts || [];
    for(const p of parts){
      if(p?.text)content+=p.text;
      if(p?.functionCall?.name){
        calls.push({id:p.functionCall.id||('call-'+Math.random().toString(36).slice(2)),type:'function',function:{name:p.functionCall.name,arguments:JSON.stringify(p.functionCall.args||{})},_gemini:p,_geminiCallId:p.functionCall.id||null});
      }
    }
    return {role:'assistant',content,tool_calls:calls,reasoning_content:'',reasoning_kind:'',_geminiContent:data?.candidates?.[0]?.content||null};
  }
  function normalizeCohereData(data){
    const msg=data?.message || {};let content=textOf(msg.content);let calls=normalizeToolCalls(msg.tool_calls || msg.toolCalls);return {role:'assistant',content,tool_calls:calls,reasoning_content:'',_usage:data?.usage||null};
  }
  function openAIToolCall(c){return {id:c?.id,type:'function',function:{name:c?.function?.name||c?.name||'',arguments:typeof c?.function?.arguments==='string'?c.function.arguments:JSON.stringify(c?.function?.arguments||{})}};}
  function openAIChatMessages(messages){return messages.map(m=>{if(m.role==='tool')return {role:'tool',tool_call_id:m.tool_call_id||m.id,name:m.name,content:String(m.content||'')};return {role:m.role,content:String(m.content||''),...(Array.isArray(m.tool_calls)&&m.tool_calls.length?{tool_calls:m.tool_calls.map(openAIToolCall)}:{})};});}
  function responseInput(messages){
    return messages.flatMap(m=>{
      if(m.role==='tool')return [{type:'function_call_output',call_id:m.tool_call_id||m.id,output:String(m.content||'')}];
      const role=m.role==='assistant'?'assistant':m.role==='system'?'developer':'user';
      return [{type:'message',role,content:[{type:'input_text',text:String(m.content||'')}]}].concat((m.tool_calls||[]).map(c=>({type:'function_call',call_id:c.id,name:c.function?.name,arguments:c.function?.arguments||'{}'})));
    });
  }
  function anthropicMessages(messages){
    let system='';const out=[];
    for(const m of messages){
      if(m.role==='system'){system+=(system?'\n\n':'')+String(m.content||'');continue;}
      if(m.role==='tool'){
        const block={type:'tool_result',tool_use_id:m.tool_call_id||m.id,content:String(m.content||'')};
        const last=out[out.length-1];if(last?.role==='user' && Array.isArray(last.content))last.content.push(block);else out.push({role:'user',content:[block]});continue;
      }
      if(m.role==='assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length){
        const content=[];if(m.content)content.push({type:'text',text:String(m.content)});for(const c of m.tool_calls)content.push({type:'tool_use',id:c.id,name:c.function?.name,input:parseJSON(c.function?.arguments)});out.push({role:'assistant',content});
      } else out.push({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'')});
    }
    return {system,messages:out};
  }
  function geminiMessages(messages){
    let system='';const contents=[];
    for(const m of messages){
      if(m.role==='system'){system+=(system?'\n\n':'')+String(m.content||'');continue;}
      if(m.role==='tool'){
        const response={functionResponse:{name:m.name||'',response:parseJSON(m.content)}};
        if(m._geminiCallId)response.functionResponse.id=m._geminiCallId;
        contents.push({role:'user',parts:[response]});continue;
      }
      if(m.role==='assistant' && m._geminiContent){
        contents.push(m._geminiContent);
        continue;
      }
      const parts=[];if(m.content)parts.push({text:String(m.content)});for(const c of m.tool_calls||[])parts.push({functionCall:{...(c._gemini?.functionCall||{}),name:c.function?.name,args:parseJSON(c.function?.arguments)}});
      contents.push({role:m.role==='assistant'?'model':'user',parts:parts.length?parts:[{text:''}]});
    }
    return {system,contents};
  }
  function cohereMessages(messages){return messages.map(m=>m.role==='tool'?{role:'tool',content:[{type:'tool_result',tool_call_id:m.tool_call_id||m.id,content:String(m.content||'')}]}:{role:m.role,content:String(m.content||''),...(m.tool_calls?.length?{tool_calls:m.tool_calls}:{} )});}
  function parseJSON(text){try{return JSON.parse(text||'{}');}catch(_){return {value:String(text||'')};}}
  function toolsFor(model,tools){
    if(!Array.isArray(tools)||!tools.length)return undefined;
    const protocol=model.protocol;
    if(protocol==='anthropic-messages')return tools.map(t=>({name:t.function?.name,description:t.function?.description,input_schema:t.function?.parameters||{type:'object',properties:{}}}));
    if(protocol==='google-gemini')return [{functionDeclarations:tools.map(t=>{
      const parameters=t.function?.parameters||{type:'object',properties:{}};
      return {name:t.function?.name,description:t.function?.description||'',parametersJsonSchema:JSON.parse(JSON.stringify(parameters))};
    })}];
    if(protocol==='openai-responses')return tools.map(t=>({type:'function',name:t.function?.name,description:t.function?.description,parameters:t.function?.parameters||{type:'object',properties:{}}}));
    return tools;
  }
  function modelAuthKey(model,registry){
    if (typeof deps.resolveAuth === 'function') {
      const resolved = deps.resolveAuth(model, {registry});
      if (resolved !== undefined && resolved !== null) return String(resolved).trim();
    }
    if(model?.apiKey)return model.apiKey;
    if(deps.isHuggingFaceEndpoint?.(model?.endpoint)){
      const userKey=registry?.getHuggingFaceApiKey?.()||'';
      if(userKey)return userKey;
      if(model.useSharedKeys!==false)return registry?.nextSharedHuggingFaceKey?.()||'';
    }
    return model?.anonymousAuth||'';
  }
  function supportsOpenAIReasoningSummary(model){
    const endpoint=String(model?.endpoint||'').toLowerCase();
    return model?.protocol==='openai-responses' && /(?:^|\/\/)api\.openai\.com(?:\/|$)/i.test(endpoint);
  }
  function providerDefinition(model,registry){
    const explicit=String(model?.provider||'').trim();
    const inferred=registry?.providerForModel?.(explicit==='custom'?{...model,provider:''}:model) || '';
    const id=explicit && explicit!=='custom' ? explicit : inferred;
    if (!id) return {};
    if (typeof deps.getProviderDefinition === 'function') return deps.getProviderDefinition(id, model) || {};
    const definitions=deps.providerDefinitions;
    if (definitions && typeof definitions === 'object' && definitions[id]) return definitions[id];
    return registry?.provider?.(id) || {};
  }
  function chatProviderOptions(model,registry){
    const rules=providerDefinition(model,registry).chatOptions;
    if(!Array.isArray(rules)) return {};
    const id=String(model?.model||'');
    const rule=rules.find(x=>{
      const matcher=x?.match;
      if(!matcher)return false;
      try { if('lastIndex' in matcher) matcher.lastIndex=0; return typeof matcher.test==='function' ? !!matcher.test(id) : false; } catch(_) { return false; }
    });
    return rule?.body && typeof rule.body==='object' ? {...rule.body} : {};
  }
  function toolCallRecoveryDefinition(model,registry){
    const value=providerDefinition(model,registry).toolCallRecovery;
    return value && typeof value==='object' ? value : null;
  }
  async function detectToolCallParseFailure(response,model,registry){
    const strategy=toolCallRecoveryDefinition(model,registry);
    if(!strategy || response?.status!==Number(strategy.status||400)) return null;
    try {
      const data=await response.clone().json();
      const code=String(data?.error?.code||'');
      const message=String(data?.error?.message||'');
      const codes=Array.isArray(strategy.errorCodes)?strategy.errorCodes.map(String):[];
      if(!codes.includes(code) && !codes.some(x=>x && message.toLowerCase().includes(x.toLowerCase()))) return null;
      return {strategy,data};
    } catch(_) { return null; }
  }
  function nextRecoveryTemperature(current,strategy){
    const value=Number.isFinite(Number(current)) ? Number(current) : .7;
    const factor=Number.isFinite(Number(strategy?.factor)) ? Number(strategy.factor) : .5;
    const min=Number.isFinite(Number(strategy?.minTemperature)) ? Number(strategy.minTemperature) : .2;
    return Math.max(min,Math.min(1,value*factor));
  }
  function authHeaders(model,extra={},registry){const headers={'Content-Type':'application/json',...extra};const key=modelAuthKey(model,registry);if(key){if(model.protocol==='google-gemini')headers['x-goog-api-key']=key;else if(model.protocol==='anthropic-messages')headers['x-api-key']=key;else headers.Authorization='Bearer '+key;}return headers;}
  function requestConfig(model,messages,options,stream,registry){
    const tools=model.supportsTools===false ? undefined : toolsFor(model,options.tools), maxTokens=Math.max(16, options.maxTokens ?? 2048), temperature=options.temperature ?? .7;
    switch(model.protocol){
      case 'openai-chat':return {url:completionUrl(model),headers:authHeaders(model,{},registry),body:{model:model.model,messages:openAIChatMessages(messages),temperature,max_tokens:maxTokens,stream,...(stream?{stream_options:{include_usage:true}}:{}),...chatProviderOptions(model,registry),...(tools?{tools,tool_choice:options.tool_choice||'auto'}:{})}};
      case 'openai-responses':return {url:responseUrl(model),headers:authHeaders(model,{},registry),body:{model:model.model,input:responseInput(messages),stream,...(supportsOpenAIReasoningSummary(model)?{reasoning:{summary:'auto'}}:{}),...(tools?{tools,tool_choice:options.tool_choice||'auto'}:{})}};
      case 'anthropic-messages':{const x=anthropicMessages(messages);return {url:anthropicUrl(model),headers:authHeaders(model,{'anthropic-version':'2023-06-01'},registry),body:{model:model.model,max_tokens:maxTokens,system:x.system,messages:x.messages,stream,temperature,...(tools?{tools,tool_choice:{type:'auto'}}:{})}};}
      case 'google-gemini':{const x=geminiMessages(messages);return {url:googleUrl(model,stream),headers:authHeaders(model,{},registry),body:{contents:x.contents,...(x.system?{systemInstruction:{parts:[{text:x.system}]} }:{}),...(tools?{tools}:{}),generationConfig:{maxOutputTokens:maxTokens}}};}
      case 'cohere-v2':return {url:cohereUrl(model),headers:authHeaders(model,{},registry),body:{model:model.model,messages:cohereMessages(messages),stream,temperature,max_tokens:maxTokens,...(tools?{tools}:{})}};
      default:throw new Error(`Unsupported AI API format "${model.protocol||model.kind||'unknown'}". Open Settings and choose a supported API format.`);
    }
  }
  async function responseErrorMessage(response,prefix='AI request failed'){
    const status=Number(response?.status)||0;
    let raw=''; try{raw=await response.text();}catch(_){}
    let detail='';
    try{const data=JSON.parse(raw);const err=data?.error||data;if(err?.message)detail=String(err.message);if(err?.code)detail+=(detail?' ':'')+`[${String(err.code)}]`;}catch(_){}
    if(!detail)detail=raw.trim();
    if(detail.length>8000)detail=detail.slice(0,8000)+'…';
    return `${prefix} (${status}): ${detail || response?.statusText || 'Unknown error'}`;
  }
  function parseRateLimitReset(value){
    const text=String(value||'').trim();
    if(!text)return 0;
    const m=text.match(/([0-9]+(?:\.[0-9]+)?)\s*(ms|s|m)?/i);
    if(!m)return 0;
    const n=Number(m[1]);
    if(!Number.isFinite(n))return 0;
    const unit=(m[2]||'s').toLowerCase();
    return unit==='ms'?n/1000:unit==='m'?n*60:n;
  }
  class ProviderClient {
    constructor() {
      this.registry = options.providers || options.providerRegistry || options.registry || null;
      this.transport = options.transport || options.fetch || null;
      this.localExecutor = options.localExecutor || options.localManager || null;
      this.abortController = null;
    }
    model() {
      if (typeof deps.getModel === 'function') return deps.getModel();
      return this.registry?.active?.() || deps.model || null;
    }
    emit(type, payload) { emitEvent(type, payload); }
    async request(url,options={}){
      const init={...options};
      if(!this.transport || (typeof this.transport!=='function' && typeof this.transport.request!=='function')) throw new Error('AI transport is not configured.');
      const model=options.model||this.model();
      const requestInit={...init,headers:normalizeHeaders(init.headers)};
      for (const key of ['onRetry','onResponse','max429Retries','baseRetryDelay','retry429','retryTransport','maxTransportRetries','transportRetryDelay','model']) delete requestInit[key];
      const prefs=getPreferences();
      const maxRetries=Math.max(0,Math.min(10,Number(options.max429Retries ?? prefs.max429Retries ?? 5)));
      const retryEnabled=options.retry429 !== false && prefs.retry429 !== false;
      const maxTransportRetries=Math.max(0,Math.min(10,Number(options.maxTransportRetries ?? prefs.maxTransportRetries ?? 2)));
      const retryTransport=options.retryTransport !== false && prefs.retryTransport !== false;
      const transportDelay=Math.max(250,Math.min(30000,Number(options.transportRetryDelay ?? prefs.transportRetryDelay ?? 1000)));
      let attempt=0,transportAttempt=0;
      while(true){
        if(options.signal?.aborted) throw abortError();
        let response=null, transportError=null;
        try {
          response = typeof this.transport === 'function'
            ? await this.transport(url, requestInit, {channel:'ai', model, attempt:transportAttempt + 1, signal:options.signal})
            : await this.transport.request(url, requestInit, {channel:'ai', model, attempt:transportAttempt + 1, signal:options.signal});
        } catch(e) { transportError=e; }
        if(options.signal?.aborted) throw abortError();
        if(!response){
          if(retryTransport && transportAttempt<maxTransportRetries){
            transportAttempt++;
            const waitMs=Math.min(30000,transportDelay*Math.pow(2,transportAttempt-1)+Math.floor(random()*250));
            recordAnalytics({model,transportRetry:1,request:1});
            const retryInfo={kind:'transport_retry',attempt:transportAttempt,maxRetries:maxTransportRetries,waitMs,status:0,model,error:transportError?.message||'No endpoint returned a response.'};
            this.emit('retry', retryInfo);
            options.onRetry?.(retryInfo);
            await pause(waitMs, options.signal);
            continue;
          }
          if(transportError) throw transportError;
          throw new Error('AI network request failed: no endpoint returned a response.');
        }
        const responseInfo={status:response.status,ok:response.ok,url:response.url||url,attempt:transportAttempt+1,model};
        options.onResponse?.(responseInfo);
        this.emit('response', responseInfo);
        if(response.status!==429 || !retryEnabled || attempt>=maxRetries) return response;
        const retryAfter=Number(response.headers?.get?.('retry-after')||0);
        const reset=String(response.headers?.get?.('x-ratelimit-reset-tokens')||'');
        const resetSeconds=parseRateLimitReset(reset);
        const base=Math.max(250,Number(options.baseRetryDelay ?? prefs.baseRetryDelay ?? 1500));
        const exponential=Math.min(30000,base*Math.pow(2,attempt));
        const waitMs=Math.max(250,Math.min(60000, (retryAfter>0?retryAfter*1000:resetSeconds>0?resetSeconds*1000:exponential) + Math.floor(random()*350)));
        attempt++;
        recordAnalytics({model,retries429:1});
        const retryInfo={kind:'rate_limit_retry',attempt,maxRetries,waitMs,status:429,model};
        this.emit('retry', retryInfo);
        options.onRetry?.(retryInfo);
        try { await response.text(); } catch(_) {}
        await pause(waitMs, options.signal);
      }
    }
    cancel(){this.abortController?.abort();this.abortController=null;this.localExecutor?.cancel?.();}
    async complete(messages,options={}){
      const model=options.model||this.model();
      if(model.protocol==='local-transformers'){
        if(!this.localExecutor)throw new Error('Local AI runtime is not initialized.');
        return await this.localExecutor.complete(messages,options);
      }
      if(model.protocol==='gradio-space')return await this.completeGradio(messages,options,model);
      let temperature=options.temperature??.7;
      let response=null;
      const prefs=getPreferences();
      const recovery=toolCallRecoveryDefinition(model,this.registry);
      const recoveryEnabled=options.toolRecovery!==false && prefs.toolRecovery!==false && !!recovery;
      const recoveryRetries=Math.max(0,Math.min(10,Number(options.maxToolRecoveryRetries??prefs.maxToolRecoveryRetries??recovery?.maxRetries??0)));
      for(let parseAttempt=0;parseAttempt<=recoveryRetries;parseAttempt++){
        const requestOptions={...options,temperature};
        const cfg=requestConfig(model,messages,requestOptions,false,this.registry);
        response=await this.request(cfg.url,{method:'POST',headers:cfg.headers,signal:options.signal,body:JSON.stringify(cfg.body),onRetry:options.onRetry,onResponse:options.onResponse,max429Retries:options.max429Retries,baseRetryDelay:options.baseRetryDelay,retry429:options.retry429,retryTransport:options.retryTransport,maxTransportRetries:options.maxTransportRetries,transportRetryDelay:options.transportRetryDelay});
        if(response.ok) break;
        const parseFailure=recoveryEnabled ? await detectToolCallParseFailure(response,model,this.registry) : null;
        if(!parseFailure || parseAttempt>=recoveryRetries || recovery?.strategy!=='lower-temperature') break;
        temperature=nextRecoveryTemperature(temperature,recovery);
        recordAnalytics({model,toolRecovery:1}); options.onRetry?.({kind:'tool_parse_recovery',attempt:parseAttempt+1,maxRetries:recoveryRetries,waitMs:0,status:response.status,model,text:`Tool-call parsing failed; retrying with temperature ${temperature.toFixed(2)} (attempt ${parseAttempt+2}/${recoveryRetries+1}).`});
      }
      if(!response?.ok)throw new Error(await responseErrorMessage(response));
      const data=await response.json();
      let result;
      if(model.protocol==='openai-responses')result=normalizeResponsesData(data);
      else if(model.protocol==='anthropic-messages')result=normalizeAnthropicData(data);
      else if(model.protocol==='google-gemini')result=normalizeGeminiData(data);
      else if(model.protocol==='cohere-v2')result=normalizeCohereData(data);
      else result=normalizeChatData(data);
      recordAnalytics({model,usage:result._usage,request:1});
      return result;
    }
    async completeGradio(messages,options,model){const result={role:'assistant',content:'',reasoning_content:''};for await(const chunk of this.streamGradio(messages,options,model)){result.content=chunk.text||result.content;result.reasoning_content=chunk.reasoning||result.reasoning_content;}return result;}
    async *stream(messages,options={}){
      const model=options.model||this.model();
      if(model.protocol==='local-transformers'){
        if(!this.localExecutor)throw new Error('Local AI runtime is not initialized.');
        yield* this.localExecutor.stream(messages,options);return;
      }
      this.cancel();const controller=new AbortController();this.abortController=controller;
      try {
        if(model.protocol==='gradio-space')yield* this.streamGradio(messages,{...options,signal:controller.signal},model);
        else if(model.supportsStreaming===false) { const result=await this.complete(messages,{...options,signal:controller.signal}); yield {text:result.content||'',delta:result.content||'',reasoning:result.reasoning_content||''}; }
        else if(['openai-chat','openai-responses','anthropic-messages','google-gemini'].includes(model.protocol))yield* this.streamNative(messages,{...options,signal:controller.signal},model);
        else {const result=await this.complete(messages,{...options,signal:controller.signal});yield {text:result.content||'',delta:result.content||'',reasoning:result.reasoning_content||''};}
      } finally {if(this.abortController===controller)this.abortController=null;}
    }
    async *streamNative(messages,options,model){
      let temperature=options.temperature??.7;
      let response=null;
      const prefs=getPreferences();
      const recovery=toolCallRecoveryDefinition(model,this.registry);
      const recoveryEnabled=options.toolRecovery!==false && prefs.toolRecovery!==false && !!recovery;
      const recoveryRetries=Math.max(0,Math.min(10,Number(options.maxToolRecoveryRetries??prefs.maxToolRecoveryRetries??recovery?.maxRetries??0)));
      for(let parseAttempt=0;parseAttempt<=recoveryRetries;parseAttempt++){
        const requestOptions={...options,temperature};
        const cfg=requestConfig(model,messages,requestOptions,true,this.registry);
        response=await this.request(cfg.url,{method:'POST',headers:cfg.headers,signal:options.signal,body:JSON.stringify(cfg.body),onRetry:options.onRetry,onResponse:options.onResponse,max429Retries:options.max429Retries,baseRetryDelay:options.baseRetryDelay,retry429:options.retry429,retryTransport:options.retryTransport,maxTransportRetries:options.maxTransportRetries,transportRetryDelay:options.transportRetryDelay});
        if(response.ok) break;
        const parseFailure=recoveryEnabled ? await detectToolCallParseFailure(response,model,this.registry) : null;
        if(!parseFailure || parseAttempt>=recoveryRetries || recovery?.strategy!=='lower-temperature') break;
        temperature=nextRecoveryTemperature(temperature,recovery);
        recordAnalytics({model,toolRecovery:1}); options.onRetry?.({kind:'tool_parse_recovery',attempt:parseAttempt+1,maxRetries:recoveryRetries,waitMs:0,status:response.status,model,text:`Tool-call parsing failed; retrying with temperature ${temperature.toFixed(2)} (attempt ${parseAttempt+2}/${recoveryRetries+1}).`});
      }
      if(!response?.ok)throw new Error(await responseErrorMessage(response));
      let full='',reasoning='',lastReasoning='',usage=null;
      for await(const block of streamResponse(response,options.signal)){
        let data=parseSSEBlock(block); if(data==null){try{data=JSON.parse(String(block).trim())}catch(_){continue;}}
        usage=data?.usage||data?.usageMetadata||data?.response?.usage||usage;
        if(model.protocol==='openai-chat'){
          const delta=data?.choices?.[0]?.delta||{};const text=delta.content||'';const think=delta.reasoning_content||delta.reasoning||'';
          if(text){full+=text;yield {text:full,delta:text,reasoning};} if(think){reasoning+=think;yield {text:full,delta:'',reasoning,reasoningKind:'reasoning'};}
        } else if(model.protocol==='openai-responses'){
          const type=data?.type||'';if(type==='response.output_text.delta'){const text=data.delta||'';full+=text;yield {text:full,delta:text,reasoning};} else if(type==='response.reasoning_summary_text.delta'){const delta=data.delta||'';if(delta){reasoning+=delta;yield {text:full,delta:'',reasoning,reasoningKind:'summary'};}} else if(type==='response.reasoning_summary_text.done'){const text=data.text||'';if(text){reasoning=text;yield {text:full,delta:'',reasoning,reasoningKind:'summary'};}}
        } else if(model.protocol==='anthropic-messages'){
          const type=data?.type||'';if(type==='content_block_delta'){const d=data.delta||{};if(d.type==='text_delta'&&d.text){full+=d.text;yield {text:full,delta:d.text,reasoning};}else if(d.type==='thinking_delta'&&d.thinking){reasoning+=d.thinking;yield {text:full,delta:'',reasoning};}}
        } else if(model.protocol==='google-gemini'){
          const parts=data?.candidates?.[0]?.content?.parts||[];for(const p of parts){if(p?.text){full+=p.text;yield {text:full,delta:p.text,reasoning};}}
        }
        if(reasoning!==lastReasoning){lastReasoning=reasoning;}
      }
      if(usage){recordAnalytics({model,usage,request:1});yield {text:full,delta:'',reasoning,usage};}
    }
    async *streamGradio(messages,options,model){
      const endpoint=trimEndpoint(model.endpoint),history=[];
      for(const m of messages){if(m.role==='user')history.push([m.content,'']);else if(m.role==='assistant'){const last=history[history.length-1];if(last&&last[1]==='')last[1]=typeof m.content==='string'?m.content:'';else history.push(['',typeof m.content==='string'?m.content:'']);}}
      const lastUser=[...messages].reverse().find(x=>x.role==='user')?.content||'',cleanedHistory=history.slice(0,-1),thinkingMode=options.thinking===false?'⚡ Fast Mode  (direct answer)':'🧠 Thinking Mode  (chain-of-thought reasoning)';
      const payload={data:[typeof lastUser==='string'?lastUser:JSON.stringify(lastUser),cleanedHistory,model.remoteModel||model.model,thinkingMode,'',options.systemPrompt||'',options.maxTokens||2048,options.temperature??.7,options.topP??.9]};let submit=null,usedPath='';
      for(const path of ['/gradio/gradio_api/call/chat','/gradio_api/call/chat']){const response=await this.request(endpoint+path,{method:'POST',headers:authHeaders(model,{},this.registry),body:JSON.stringify(payload),signal:options.signal});if(response.status===404)continue;if(!response.ok)throw new Error(`Public model request failed (${response.status}): ${await response.text()}`);submit=await response.json();usedPath=path;break;}
      if(!submit?.event_id)throw new Error('Public model did not return a Gradio event ID.');
      const eventResponse=await this.request(endpoint+usedPath+'/'+encodeURIComponent(submit.event_id),{signal:options.signal,headers:model.apiKey?{'Authorization':'Bearer '+model.apiKey}:{}});if(!eventResponse.ok)throw new Error(`Public model stream failed (${eventResponse.status}): ${await eventResponse.text()}`);
      let previous='',reasoning='';
      for await(const block of streamResponse(eventResponse,options.signal)){const event=parseSSEBlock(block);if(!event)continue;const type=String(event.event||''),parsed=event.data!==undefined?event.data:event;let value=parsed;if(typeof value==='string'){try{value=JSON.parse(value)}catch(_){}}if(type==='error')throw new Error(Array.isArray(value)?value.join(' '):String(value));let text=value;if(Array.isArray(text))text=text[0];if(text&&typeof text==='object'&&text.data!==undefined)text=text.data;if(Array.isArray(text))text=text[0];if(typeof text!=='string')continue;if(text===previous)continue;if(text.length>=previous.length&&text.startsWith(previous))previous=text;else previous=text;const match=previous.match(/<details>\s*<summary>.*?<\/summary>[\s\S]*?<\/details>\s*/i);if(match){reasoning=match[0].replace(/<[^>]+>/g,'').replace(/^\s*Reasoning Chain.*?\n/i,'').trim();yield {text:previous,delta:'',reasoning};}else yield {text:previous,delta:previous,reasoning};}
    }
  }
  return new ProviderClient();
}

return {createProviderClient, SUPPORTED_PROTOCOLS:Object.freeze(['openai-chat','openai-responses','anthropic-messages','google-gemini','cohere-v2','gradio-space','local-transformers'])};
});
