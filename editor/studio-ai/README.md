# StudioAI

StudioAI is the reusable asset-generation layer. Editor-specific presentation and project-file operations live in the builtin UI, not in providers.

## Provider contract

- `AssetProviderAI` is the base provider contract.
- `AssetProviderRegistry` registers factories for model integrations.
- `StudioAI.createImageProvider(id)` creates an image provider instance.
- Providers expose `getCapabilities()` and `getConfigurationSchema()`.
- Providers implement `initialize({ onProgress })`, `generateImage(request, { signal, onProgress })`, and `dispose()`.

Generation requests use a common envelope while keeping model-specific controls under `parameters`:

```js
{
  prompt: "A tiny red dragon",
  parameters: { /* provider-specific settings */ }
}
```

Image results use a common collection of assets. Each asset has a `blob`, `mimeType`, `width`, `height`, and optional metadata. Providers are free to implement completely different inference pipelines and expose different configuration schemas.

## PixelSprite Canvas v2

The first provider lives in `providers/pixel-sprite/`. The ONNX inference engine and text encoder are ported from DragonFireGames/imagegen's Pixel Foundry experiment. The engine is kept as a separate ES module and is not rewritten to fit the provider contract.

It supports transparent 16×16 and 32×32 PNG sprites, batches of 4/8/12/16, deterministic seeds (or -1 for a random seed), guided and fast inference, shape/colour guidance in guided mode, browser progress, cancellation, WebGPU with CPU fallback, and Cache API storage for model and text-encoder files.

The runtime libraries (ONNX Runtime Web and Hugging Face Tokenizers) are imported from jsDelivr. They may still need to be fetched by a fresh browser session; only model and text-encoder files are explicitly stored in the provider's Cache API cache.

### Licensing

- PixelSprite Canvas v2 model weights: **CC BY-NC 4.0 (non-commercial use only)**. This is a material restriction for downstream use and must be reviewed before any commercial distribution or use.
- Ported inference implementation: Apache-2.0.
- Text encoder: Xenova/paraphrase-multilingual-MiniLM-L12-v2; review its model repository license.
- ONNX Runtime Web: MIT.
- Hugging Face Tokenizers: review the package license.

The UI surfaces the model's non-commercial restriction. Do not interpret the Apache-2.0 license on the inference code as applying to the model weights.
