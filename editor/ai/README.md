# AI framework

The AI framework is a UI-independent API for applications that need model inference and conversations. The Editor chat is a consumer of this API; it owns presentation, project context, permissions, tool definitions, and project-specific chat persistence.

## Layers

- `ProviderAI`: provider contract. Implementations expose `complete()`, `stream()`, cancellation, and model capabilities.
- `RemoteProviderAI`: adapter for remote inference. In the Editor it wraps the remote-protocol `AIClient`.
- `LocalProviderAI`: adapter for local inference. In the Editor it delegates to `LocalModelManager`, independently of the remote client.
- `ConversationAI`: UI-free conversation state and message operations.
- `ChatAI`: provider registration/selection, conversation lifecycle, inference routing, and optional agent orchestration.

The framework does not create DOM, read editor state, choose a UI, or persist conversations automatically. Consumers own persistence and may serialize conversations with `toJSON()`.

## Browser API

The framework is exposed as `window.ChatAIFramework`. The Editor also aliases the classes onto `window.EditorAI` for compatibility with its existing scripts.

A consumer can provide its own provider:

```js
const { ProviderAI, ChatAI } = window.ChatAIFramework;

class ExampleProvider extends ProviderAI {
  constructor() {
    super({ id: 'remote', capabilities: { streaming: true } });
  }

  async complete(messages, options) {
    // Return a normalized assistant message.
    return { role: 'assistant', content: 'Hello!' };
  }

  async *stream(messages, options) {
    yield { text: 'Hello!', delta: 'Hello!' };
  }
}

const ai = new ChatAI({ remoteProvider: new ExampleProvider() });
const conversation = ai.createConversation({ systemPrompt: 'Be concise.' });
const result = await conversation.send('Hello!');
console.log(result.text);
```

## Main API

```js
const ai = new ChatAI({
  registry,             // optional model registry
  client,               // optional remote client adapter
  localManager,         // optional local runtime adapter
  remoteProvider,       // optional custom ProviderAI
  localProvider,        // optional custom ProviderAI
  defaultProviderId: 'remote'
});

ai.registerProvider(provider);
ai.getProvider(modelId);
ai.getCapabilities(modelId);
ai.createConversation({ id, modelId, systemPrompt, messages });
ai.openConversation({ id, modelId, messages });
ai.getConversation(id);
ai.closeConversation(id);
ai.complete(messages, options);
ai.stream(messages, options);
ai.runAgent(messages, options); // only when an agent runner is supplied
ai.cancel();
ai.dispose();
```

A `ConversationAI` exposes `getMessages()`, `setMessages()`, `addMessage()`, `clear()`, `complete()`, `stream()`, `send()`, `cancel()`, and `toJSON()`.

Capabilities are queried programmatically with `ai.getCapabilities(modelId)` or `provider.getCapabilities(model)`. Provider and model capabilities are descriptive; callers should still handle unsupported operations gracefully.

## Editor integration

`editor/builtins/ai.js` is the presentation adapter. It keeps the existing chat UI and project-backed chat store, while using `ChatAI` for provider selection, plain streaming, agent dispatch, and conversation identity. Editor-only concerns remain outside the framework.
