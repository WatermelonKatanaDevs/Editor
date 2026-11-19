# AI chat framework

The editor's AI implementation is consolidated into three runtime files:

- `ai-chat.js` — `ChatAI`, conversations, provider registry, preferences, analytics, agent registry, and generic agent orchestration.
- `local-chat-provider.js` — local model catalogue, IndexedDB model cache, Transformers.js runtime, and the local provider adapter.
- `remote-chat-provider.js` — remote protocol client, request/stream handling, retries, and the remote provider adapter.

The editor UI remains in `editor/builtins/ai.js`. It creates one shared editor agent, registers editor/project tools and permissions on that agent, and associates individual conversations with it when Agent mode is enabled.

## Load order

1. `editor/ai/ai-chat.js`
2. `editor/ai/local-chat-provider.js`
3. `editor/ai/remote-chat-provider.js`

## API

```js
const ai = new EditorAI.ChatAI({registry, client, localManager});
const agent = ai.createAgent({
  id: 'coding',
  name: 'Coding Agent',
  permissions,
  requestPermission,
  toolInstructions: 'Use the application tools when useful.'
});

agent.registerTools([{
  name: 'read_document',
  description: 'Read a document from this application.',
  parameters: {type:'object',required:['id'],properties:{id:{type:'string'}}},
  permission: 'readDocuments',
  execute: async ({id}) => documentStore.read(id)
}]);

const conversation = ai.createConversation({
  systemPrompt: 'Be concise.',
  agent
});

const result = await conversation.send('Inspect this document.');
console.log(result.text);

// Agent mode can also be toggled later:
conversation.setAgent(agent);
conversation.removeAgent();
```

### `ChatAI`

`ChatAI` manages providers, conversations, and registered agents:

- `createAgent(options)`, `registerAgent(agent)`, `getAgent(id)`, `listAgents()`, `removeAgent(id)`
- `registerProvider(provider)`, `getProvider(modelId)`, `getCapabilities(modelId)`
- `createConversation(options)`, `openConversation(options)`, `closeConversation(id)`
- `complete(messages, options)`, `stream(messages, options)`
- `runAgent(messages, {agent|agentId, ...options})`
- `cancel()`, `dispose()`

There is no global tool registry on `ChatAI`. Each agent owns an isolated tool registry and permission interface.

### `AIAgent`

An agent owns its tools, permission manager, instructions, and tool execution hooks:

- `registerTool(definition)`, `registerTools(definitions)`
- `unregisterTool(name)`, `getTool(name)`, `listTools()`
- `setInstructions(text)`, `setPermission(name, policy)`, `getPermission(name)`
- `run(messages, options)`

Tool definitions accept a name, description, JSON-schema parameters, optional permission key, and an `execute(args)` function. The application supplies its own permission manager, permission prompt, and before/after tool hooks.

An agent can be shared by many conversations. Tool definitions and permission policies are shared configuration, while each call to `run()` keeps its event handler, callbacks, step counter, and execution state local to that run. Concurrent runs therefore do not overwrite an agent-wide event callback or a shared running flag.

### `ConversationAI`

A conversation owns its message history, selected model, and optional agent association:

- `setAgent(agentOrId)`, `getAgent()`, `removeAgent()`
- `send(content, options)` streams normally when no agent is attached and runs the attached agent when one is present.
- `runAgent(messages, options)` explicitly invokes its attached agent.
- `toJSON()` includes `agentId` only when an agent is attached.

Applications own conversation persistence. Store the optional agent ID with a conversation and pass it back as `agentId` when reopening it. The framework does not create DOM or select a presentation.
