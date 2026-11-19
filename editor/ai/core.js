(function (global) {
  'use strict';

  // Framework layer: provider and conversation contracts. This module deliberately
  // contains no DOM/UI code; applications supply storage, networking and tools.
  const root = global.EditorAI = global.EditorAI || {};

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
    supports(capability) { return this.capabilities[capability] === true; }
    async complete() { throw new Error(this.constructor.name + '.complete() is not implemented.'); }
    async *stream() { throw new Error(this.constructor.name + '.stream() is not implemented.'); }
    cancel() {}
    dispose() {}
  }

  class RemoteProviderAI extends ProviderAI {
    constructor(options = {}) {
      super({...options, kind:'remote'});
      if (!options.client) throw new TypeError('RemoteProviderAI requires a client adapter.');
      this.client = options.client;
      this.registry = options.registry || null;
    }
    getModel() { return this.registry?.active?.() || this.client.model?.() || null; }
    async complete(messages, options = {}) {
      return this.client.complete(messages, {...options, model:options.model || this.getModel()});
    }
    stream(messages, options = {}) {
      return this.client.stream(messages, {...options, model:options.model || this.getModel()});
    }
    cancel() { this.client.cancel?.(); }
  }

  class LocalProviderAI extends ProviderAI {
    constructor(options = {}) {
      super({...options, kind:'local'});
      if (!options.client) throw new TypeError('LocalProviderAI requires a local client adapter.');
      this.client = options.client;
      this.runtime = options.runtime || null;
      this.registry = options.registry || null;
    }
    getModel() {
      const model = this.registry?.active?.() || this.client.model?.() || null;
      return model && (model.local || model.protocol === 'local-transformers') ? model : null;
    }
    async complete(messages, options = {}) {
      const model = options.model || this.getModel();
      if (!model) throw new Error('The selected model is not a local model.');
      return this.client.complete(messages, {...options, model});
    }
    stream(messages, options = {}) {
      const model = options.model || this.getModel();
      if (!model) throw new Error('The selected model is not a local model.');
      return this.client.stream(messages, {...options, model});
    }
    async load(model = this.getModel(), options = {}) {
      if (!model) throw new Error('No local model is selected.');
      return this.runtime?.load?.(model, options);
    }
    async unload() { return this.runtime?.unload?.(); }
    isLoaded(modelId) { return !!this.runtime?.isLoaded?.(modelId); }
    cancel() { this.runtime?.cancel?.(); }
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
      this.registerProvider(options.remoteProvider || new RemoteProviderAI({
        id:'remote', label:'Remote AI', client:options.client, registry:this.registry,
        capabilities:options.remoteCapabilities || {}
      }));
      if (options.localProvider || options.localManager) {
        this.registerProvider(options.localProvider || new LocalProviderAI({
          id:'local', label:'Local AI', client:options.client, runtime:options.localManager,
          registry:this.registry, capabilities:options.localCapabilities || {}
        }));
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
  root.RemoteProviderAI = RemoteProviderAI;
  root.LocalProviderAI = LocalProviderAI;
  root.ConversationAI = ConversationAI;
  root.ChatAI = ChatAI;
})(window);
