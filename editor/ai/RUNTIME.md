# LocalAI runtime

The standalone runtime is the UI-independent agent core. It has no dependency on the editor, the DOM, browser storage, or the Editor global namespace. It can be loaded as a browser script or required as a CommonJS module.

## Loading

Browser:

~~~html
<script src="runtime.js"></script>
~~~

The API is exposed as window.LocalAI.

CommonJS:

~~~js
const LocalAI = require('./runtime.js');
~~~

## Creating a runtime

The runtime deliberately accepts a model client adapter instead of owning provider configuration. That keeps API keys, provider-specific request formatting, networking and local-model execution outside the agent orchestration layer.

The client contract is:

- model() returns the active model descriptor. At minimum it should include model (or id) and supportsTools.
- complete(messages, options) returns a normalized assistant message: { content, tool_calls, reasoning_content }. Native tool calls use the OpenAI-compatible shape { id, function: { name, arguments } }.
- stream(messages, options) is optional and returns an async iterable of cumulative { text, reasoning, reasoningKind } chunks. It is used for models with supportsTools: false; without it, the runtime falls back to complete() and the model can use the text-based tool-call protocol.
- cancel() is optional.

Example:

~~~js
const client = {
  model() {
    return {
      model: 'my-model',
      protocol: 'openai-chat',
      supportsTools: true
    };
  },

  async complete(messages, options) {
    const response = await fetch('https://api.example.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY
      },
      body: JSON.stringify({
        model: this.model().model,
        messages,
        tools: options.tools,
        tool_choice: 'auto'
      }),
      signal: options.signal
    });

    if (!response.ok) {
      throw new Error('Model request failed (' + response.status + '): ' + await response.text());
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message || {};
    return {
      role: 'assistant',
      content: message.content || '',
      tool_calls: message.tool_calls || [],
      reasoning_content: message.reasoning_content || ''
    };
  }
};

const ai = LocalAI.createRuntime({ client, maxSteps: 20 });
~~~

The provider layer is reusable separately as documented in [PROVIDER_CLIENT.md](./PROVIDER_CLIENT.md). The Editor supplies its existing multi-provider registry, shared network, auth resolver, preferences, analytics and local Transformers.js manager through a thin host adapter, so its existing saved model settings and provider behavior remain host-owned.

## Registering tools

A tool has a name, description, JSON Schema parameters and an async execution function:

~~~js
ai.registerTool({
  name: 'get_project',
  description: 'Return project details.',
  parameters: {
    type: 'object',
    properties: {},
    additionalProperties: false
  },
  execute: async () => ({
    name: 'Example project',
    files: ['index.html', 'app.js']
  })
});
~~~

Tools can be added or removed at any time with registerTool() and unregisterTool(). Duplicate names are rejected unless registerTool(definition, { replace: true }) is explicitly used. The registry is also available as ai.tools and exposes get(), has(), list(), clear() and size.

Arguments are checked against the supported JSON Schema subset before execution: object properties, required keys, additional properties, strings, numbers, integers, booleans, arrays, enums and basic numeric/string/array limits. Applications should still validate sensitive operations inside their own tool implementations.

## Conversations and events

createConversation() creates an in-memory conversation. Persistence is intentionally left to the host application:

~~~js
const chat = ai.createConversation({
  systemPrompt: 'You are a helpful project assistant.'
});

chat.on('tool:start', event => {
  console.log('Running', event.name, event.args);
});

chat.on('tool:complete', event => {
  console.log('Finished', event.name, event.result, event.ok);
});

chat.on('message', event => {
  console.log('Assistant:', event.text);
});

const result = await chat.send('Inspect this project');
console.log(result.text);

// The host can persist and restore this array itself.
const savedMessages = chat.getMessages();
~~~

Conversations also support setMessages(messages), clear(), cancel() and dispose(). A conversation stores user/assistant messages in memory; it does not write to localStorage or a project filesystem.

The runtime emits events including step, request:start, tool:start, tool:complete, reasoning, assistant_activity, message and error. Use ai.on(eventName, callback) for runtime-wide events or chat.on(eventName, callback) for one conversation.

## Permissions and hooks

Tools are unrestricted by default when they do not declare a permission field. Set permission to a capability name to require a permission manager and request callback:

~~~js
const ai = LocalAI.createRuntime({
  client,
  permissions: {
    get: capability => 'ask', // 'always', 'ask' or 'never'
    set: (capability, value) => savePermission(capability, value)
  },
  requestPermission: async ({ tool, args }) => {
    return await showPermissionPrompt(tool.name, args); // 'allow', 'always' or 'deny'
  }
});
~~~

Optional lifecycle hooks can be supplied as hooks.beforeTool({ tool, args }) and hooks.afterTool({ tool, args, result }). They may return modified payloads. The Editor uses this integration point to retain its existing extension hooks.

## Security boundary

Registering a tool grants model-generated arguments access to that tool's execution function. Treat all arguments as untrusted input. Permission prompts are policy gates, not a sandbox: tool implementations must enforce path restrictions, authorization, confirmation for destructive actions and any other application-specific safety checks.

The runtime does not implement chat UI, conversation persistence, provider settings, model discovery, API-key storage or project context. Those remain host-application responsibilities.
