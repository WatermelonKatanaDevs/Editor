# LocalAI provider client

The provider client is the transport and protocol layer that complements the UI-agnostic LocalAI agent runtime in [RUNTIME.md](./RUNTIME.md). It handles remote-provider request formatting, authentication injection, response normalization, streaming, retries and local-executor delegation. It does not own settings UI, browser storage, model discovery, or editor state.

## Loading

Browser script:

~~~html
<script src="runtime.js"></script>
<script src="provider-client.js"></script>
~~~

The module augments `window.LocalAI`. CommonJS:

~~~js
const LocalAI = require('./provider-client.js');
~~~

When used with the agent runtime in Node, load both modules:

~~~js
const LocalAI = require('./runtime.js');
Object.assign(LocalAI, require('./provider-client.js'));
~~~

## Creating a client

`LocalAI.createProviderClient(options)` returns an object implementing the LocalAI runtime client contract:

- `model()` returns the active model descriptor.
- `complete(messages, options)` resolves to a normalized assistant message.
- `stream(messages, options)` returns an async iterable of cumulative `{ text, delta, reasoning, reasoningKind?, usage? }` chunks.
- `cancel()` aborts an active stream and delegates cancellation to the optional local executor.
- `request(url, options)` exposes the retry-aware transport for host adapters and advanced integrations.

Example:

~~~js
const client = LocalAI.createProviderClient({
  model: {id:'example', model:'example-chat', protocol:'openai-chat', endpoint:'https://api.example.com/v1', supportsTools:true},
  transport: async (url, init, context) => fetch(url, init),
  resolveAuth: model => keyStore.get(model.id),
  getPreferences: () => ({retry429:true, max429Retries:3}),
  analytics: event => analytics.record(event),
  events: (type, event) => eventBus.emit(type, event),
  providerDefinitions: {
    example: {chatOptions:[{match:/reasoning/i, body:{include_reasoning:true}}]}
  }
});
~~~

### Injected dependencies

| Option | Contract |
| --- | --- |
| `transport` or `fetch` | A function `(url, init, context) => Promise<Response|null>`, or an object with `request(url, init, context)`. Use the supplied `AbortSignal`. The client does not construct browser `Request` objects or call global fetch. |
| `providers`, `providerRegistry`, or `registry` | Provider/model registry. It may implement `active()`, `providerForModel(model)`, `provider(id)`, `getHuggingFaceApiKey()`, and `nextSharedHuggingFaceKey()`. |
| `getModel` or `model` | Optional model resolver / fixed model when a registry is not used. |
| `resolveAuth(model, context)` | Optional API-key/auth resolver. Return a string; return `undefined` to use the built-in model-key and Hugging Face registry fallback. |
| `getProviderDefinition(id, model)` or `providerDefinitions` | Optional provider metadata for model-specific chat options and tool-call parse-recovery strategies. |
| `getPreferences()` or `preferences` | Retry and recovery preferences. Includes `retry429`, `max429Retries`, `baseRetryDelay`, `retryTransport`, `maxTransportRetries`, `transportRetryDelay`, `toolRecovery`, and `maxToolRecoveryRetries`. |
| `analytics(info)` | Receives request usage and retry counters. |
| `events(type, payload)`, `events.emit(type, payload)`, or `onEvent(event)` | Optional lifecycle notifications such as `response`, `retry`, and `analytics:error`. |
| `localExecutor` | Host-owned adapter with `complete(messages, options)`, optional `stream(messages, options)`, and optional `cancel()`. Used for `local-transformers` models. |
| `sleep(ms, context)`, `random()` | Optional deterministic retry timing dependencies, useful for tests and non-browser runtimes. |

The provider client has no dependency on `window`, `document`, `localStorage`, `EditorAI`, or the Editor's network service. It uses Fetch-compatible `Response`/stream interfaces returned by the injected transport; it does not access a provider directly.

## Supported protocols

| Protocol | Request format | Streaming |
| --- | --- | --- |
| `openai-chat` | OpenAI Chat Completions-compatible | Yes |
| `openai-responses` | OpenAI Responses | Yes |
| `anthropic-messages` | Anthropic Messages | Yes |
| `google-gemini` | Gemini `generateContent` | Yes |
| `cohere-v2` | Cohere Chat v2 | Complete fallback |
| `gradio-space` | Gradio Space queue/call endpoint | Yes |
| `local-transformers` | Delegated to `localExecutor` | Delegated |

Normalized assistant messages retain the LocalAI agent contract: `{ role:'assistant', content, tool_calls, reasoning_content }`. Tool calls use OpenAI-compatible `{ id, type:'function', function:{ name, arguments } }` objects regardless of the remote protocol.

The provider registry remains a host concern. This keeps provider presets, Hugging Face credentials/shared-key rotation, model settings migration and saved model data under the host application's control. In this repository, `client.js` is a small Editor adapter that injects the existing provider registry, shared browser network, auth resolver, preferences, analytics, and Transformers.js local model manager.

## Retry and cancellation behavior

HTTP 429 retries honor `Retry-After` and `x-ratelimit-reset-tokens` before falling back to bounded exponential delay. Transport failures use a separate bounded retry policy. Both policies can be disabled or tuned through the injected preferences or per-request options. Tool-call parse recovery uses the provider definition's `toolCallRecovery` configuration and can reduce temperature between attempts.

Pass an `AbortSignal` in request options to cancel a completion. `stream()` owns an internal controller; call `cancel()` to abort it. For local models, cancellation is forwarded to the injected local executor.

## Testing

The mocked protocol suite is `tests/provider-client.test.js`. Run it with Node.js 18 or newer:

~~~sh
node editor/ai/tests/provider-client.test.js
~~~

The tests use mocked Fetch-compatible responses and never call real provider endpoints.
