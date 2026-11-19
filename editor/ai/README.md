# AI chat framework

The editor's AI implementation is consolidated into three runtime files:

- `ai-chat.js` — `ChatAI`, conversations, model/provider registry, preferences, analytics, generic tool registration/execution API, and optional agent orchestration.
- `local-chat-provider.js` — local model catalogue, IndexedDB model cache, Transformers.js runtime, and the local provider adapter.
- `remote-chat-provider.js` — remote protocol client, request/stream handling, retries, and the remote provider adapter.

The editor UI remains in `editor/builtins/ai.js`. It adapts the existing DOM and project-backed chat persistence to the UI-independent `ChatAI` API. The refactor does not change the visible chat interface.

## Load order

Load the three framework scripts in this order:

1. `editor/ai/ai-chat.js`
2. `editor/ai/local-chat-provider.js`
3. `editor/ai/remote-chat-provider.js`

The editor loads these before starting the application. The builtin AI UI may be declared earlier because it only constructs the framework when the editor starts.

## API

The framework is exposed as `window.ChatAIFramework`; editor compatibility aliases are also available on `window.EditorAI`.

```js
const ai = new EditorAI.ChatAI({
  registry,
  client,       // AIClient, used by the remote provider
  localManager  // LocalModelManager, used by the local provider
});

const conversation = ai.createConversation({
  systemPrompt: 'Be concise.'
});

const result = await conversation.send('Hello!');
console.log(result.text);
```

A `ChatAI` instance manages provider registration and selection, conversation lifecycle, completion, streaming, cancellation, and optional agent mode:

- `registerProvider(provider)`
- `getProvider(modelId)`
- `getCapabilities(modelId)`
- `createConversation(options)` / `openConversation(options)`
- `complete(messages, options)` / `stream(messages, options)`
- `runAgent(messages, options)` when an agent-mode runner is configured
- `cancel()` / `dispose()`

Agent mode is an optional chat execution mode, not a separate framework layer. `ChatAI` exposes `registerTool()`, `registerTools()`, `unregisterTool()`, `getTool()`, and `listTools()`. Applications register their own actions through this API and supply agent/tool instructions when configuring the agent. The generic agent loop handles tool schemas, execution, permissions, streaming, and completion without embedding application-specific tools or instructions. The editor's `editor/builtins/ai.js` registers project/editor/GitHub actions and supplies its coding-agent instructions.

Consumers own conversation persistence and may serialize conversations with `toJSON()`. The framework does not create DOM or select a presentation.
