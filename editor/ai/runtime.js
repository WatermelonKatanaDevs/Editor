(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WatermelonAI = Object.assign(root.WatermelonAI || {}, api);
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
