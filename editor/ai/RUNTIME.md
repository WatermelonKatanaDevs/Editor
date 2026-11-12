# LocalAI

`localai.js` is the complete reusable LocalAI library in one distributable JavaScript file. It combines the agent runtime, tool registry, conversations, provider client, protocol adapters, response normalization, streaming, cancellation, retries, and reasoning extraction.

It does not depend on the Editor, `window.EditorAI`, browser storage, DOM elements, or an Editor networking layer. The host application supplies transport, credentials, provider metadata, preferences, analytics/events, and a local inference adapter.

## Use the single file

Browser:

~~~html
<script src="localai.js"></script>
<script>
  const client = LocalAI.createProviderClient({
    model: {
      id: 'my-model',
      model: 'my-model-id',
      endpoint: 'https://api.example.com/v1',
      protocol: 'openai-chat',
      supportsTools: true,
      supportsStreaming: true
    },
    transport: (url, init) => fetch(url, init),
    resolveAuth: model => getApiKey(model.id)
  });

  const ai = LocalAI.createRuntime({client});
  ai.registerTool({
    name: 'get_time',
    description: 'Return the current time.',
    parameters: {type:'object', properties:{}, additionalProperties:false},
    execute: async () => new Date().toISOString()
  });

  const chat = ai.createConversation({systemPrompt:'You are a helpful assistant.'});
  const result = await chat.send('What time is it?');
  console.log(result.text);
</script>
~~~

CommonJS:

~~~js
const LocalAI = require('./localai.js');

const client = LocalAI.createProviderClient({
  model: {model:'my-model', protocol:'openai-chat', endpoint:'https://api.example.com/v1'},
  transport: (url, init) => fetch(url, init),
  resolveAuth: () => process.env.AI_API_KEY
});

const ai = LocalAI.createRuntime({client});
~~~

## Exports

- `createProviderClient(options)` — create the multi-provider model client.
- `createRuntime(options)` — create the tool-using agent runtime.
- `Agent`, `Runtime`, `Conversation`, `ToolRegistry`, `EventEmitter` — lower-level building blocks.
- `SUPPORTED_PROTOCOLS` — supported protocol identifiers.

The provider client implements the runtime client contract: `model()`, `complete(messages, options)`, `stream(messages, options)`, `cancel()`, and retry-aware `request(url, options)`.

## Provider client dependencies

| Option | Purpose |
| --- | --- |
| `transport` or `fetch` | Function `(url, init, context) => Promise<Response|null>`, or object with `request(url, init, context)`. The transport receives the abort signal. |
| `model` or `getModel()` | Fixed model descriptor or active-model resolver. |
| `providers`, `providerRegistry`, or `registry` | Optional registry with `active()`, `providerForModel(model)`, and `provider(id)`. |
| `resolveAuth(model, context)` | Resolve API keys or provider authentication. |
| `getProviderDefinition(id, model)` or `providerDefinitions` | Model-specific request options and tool-call parse-recovery configuration. |
| `getPreferences()` or `preferences` | Retry and recovery settings. |
| `analytics(info)` | Receives usage and retry counters. |
| `events(type, payload)` or `onEvent(event)` | Receives response, retry, and error notifications. |
| `localExecutor` | Host adapter with `complete()`, optional `stream()`, and optional `cancel()` for local models. |
| `sleep(ms, context)`, `random()` | Optional deterministic retry timing dependencies. |

A model descriptor uses a `protocol` from `SUPPORTED_PROTOCOLS`, a `model` ID, and (for remote models) an `endpoint`. Credentials are supplied by `resolveAuth` or the model's `apiKey` / `anonymousAuth` fields.

## Supported protocols

| Protocol | Behavior |
| --- | --- |
| `openai-chat` | OpenAI Chat Completions-compatible requests and streaming |
| `openai-responses` | OpenAI Responses requests and streaming |
| `anthropic-messages` | Anthropic Messages requests and streaming |
| `google-gemini` | Gemini `generateContent` requests and streaming |
| `cohere-v2` | Cohere Chat v2 requests; non-streaming fallback |
| `gradio-space` | Gradio Space queue/call and event streaming |
| `local-transformers` | Delegates to the injected `localExecutor` |

Normalized assistant messages retain the agent contract:
`{role:'assistant', content, tool_calls, reasoning_content}`.
Tool calls use the OpenAI-compatible shape:
`{id, type:'function', function:{name, arguments}}`.

The provider engine retains provider-specific request formats and authentication, reasoning extraction, Groq model-specific reasoning options and tool-call parse recovery, HTTP 429 retries, transport retries, and cancellation.

## Tools and conversations

A tool has a name, description, JSON Schema parameters, and an `execute(args)` function:

~~~js
const ai = LocalAI.createRuntime({client});
ai.registerTool({
  name: 'lookup',
  description: 'Look up an item.',
  parameters: {
    type: 'object',
    properties: {id:{type:'string'}},
    required: ['id'],
    additionalProperties: false
  },
  execute: async ({id}) => ({id, found:true})
});

const chat = ai.createConversation({systemPrompt:'You are helpful.'});
chat.on('tool:start', event => console.log('Tool:', event.name));
const result = await chat.send('Look up item A');
~~~

Tools can be added or removed with `registerTool()` and `unregisterTool()`. Conversations support `send()`, `getMessages()`, `setMessages()`, `clear()`, `cancel()`, and `dispose()`. Persistence remains the host application's responsibility.

Arguments are validated against the supported JSON Schema subset before execution. Tool implementations must still enforce their own authorization, path restrictions, and safeguards for destructive operations.

## Local models

The reusable client accepts a `localExecutor` instead of bundling a framework-specific model loader. This keeps Transformers.js loading, device selection, model caching, progress UI, and model-settings persistence with the host application. Supply an adapter implementing `complete(messages, options)`, and optionally `stream(messages, options)` and `cancel()`.

The Editor uses its existing Transformers.js model manager through this adapter. Another application can use its own local inference engine without changing `localai.js`.

## Tests

Run the mocked protocol suite with Node.js 18 or newer:

~~~sh
node editor/ai/tests/localai.test.js
~~~

All provider responses are mocked; the suite does not contact live endpoints.
