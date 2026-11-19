import { HF_REPO, modelFiles, loadModel } from "./engine.js";
import { ENCODER, encoderFiles, loadTextEncoder } from "./text.js";

const { AssetProviderAI } = window.StudioAIFramework;
const MODEL_REVISION = "0a29494e9fc020a26feb6f97ec2047fc207ce898";
const MODEL_BASE = "https://huggingface.co/" + HF_REPO + "/resolve/" + MODEL_REVISION;
const ENCODER_BASE = "https://huggingface.co/" + ENCODER.repo + "/resolve/" + ENCODER.revision;
const ORT_URL = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/ort.webgpu.min.mjs";
const TOKENIZERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/tokenizers@0.2.0/dist/tokenizers.min.mjs";
const CACHE_NAME = "studio-ai-pixel-sprite-model-v1";

function progress(onProgress, phase, loaded, total) {
  onProgress?.({ phase, loaded: loaded || 0, total: total || 0, progress: total ? loaded / total : null });
}

async function prepareOfflineSupport() {
  if (!("serviceWorker" in navigator)) throw new Error("Offline runtime caching requires service-worker support. Open the Editor over HTTPS in a supported browser.");
  const scriptUrl = new URL("../../../../studio-ai-sw.js", import.meta.url);
  const scope = new URL("../../../../", import.meta.url).pathname;
  await navigator.serviceWorker.register(scriptUrl.href, { scope, updateViaCache:"none" });
  await navigator.serviceWorker.ready;
  const isControlled = () => navigator.serviceWorker.controller?.scriptURL === scriptUrl.href;
  if (!isControlled()) {
    await new Promise((resolve,reject) => {
      const timeout = setTimeout(() => {
        navigator.serviceWorker.removeEventListener("controllerchange",finish);
        reject(new Error("The offline runtime cache is installing. Reload the Editor and press Load model again."));
      },10000);
      const finish = () => {
        clearTimeout(timeout);
        if (isControlled()) resolve();
        else reject(new Error("The Editor is controlled by a different service worker. Reload the Editor and try loading the model again."));
      };
      navigator.serviceWorker.addEventListener("controllerchange",finish,{once:true});
      if (navigator.serviceWorker.controller) finish();
    });
  }
}

async function fetchBytes(url, onProgress) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(url);
  if (cached) return new Uint8Array(await cached.arrayBuffer());
  const response = await fetch(url);
  if (!response.ok) throw new Error("Model download failed (" + response.status + "): " + url);
  const total = Number(response.headers.get("content-length")) || 0;
  let bytes;
  if (onProgress && response.body) {
    const reader = response.body.getReader(), chunks = [];
    let received = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      chunks.push(part.value);
      received += part.value.length;
      onProgress(received, total);
    }
    bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  } else bytes = new Uint8Array(await response.arrayBuffer());
  try { await cache.put(url, new Response(bytes)); }
  catch (error) { throw new Error("Could not cache model data for offline use. Check browser storage availability. " + error.message); }
  return bytes;
}

async function chooseBackend(ort) {
  if (!navigator.gpu) return "wasm";
  for (const powerPreference of ["high-performance", "low-power"]) {
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference });
      if (!adapter) continue;
      ort.env.webgpu.powerPreference = powerPreference;
      return "webgpu";
    } catch (_) {}
  }
  return "wasm";
}

function canvasBlob(model, indices, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: false });
  const image = context.createImageData(size, size);
  image.data.set(model.rgba(indices));
  context.putImageData(image, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not encode generated sprite as PNG.")), "image/png"));
}

function deviceBatch(backend, rowsPerSprite, count) {
  const memory = Number(navigator.deviceMemory);
  const cores = navigator.hardwareConcurrency || 4;
  const lowMemory = Number.isFinite(memory) && memory > 0 ? memory <= 4 : cores <= 4;
  const rowBudget = backend === "webgpu" && memory >= 8 && cores >= 8 ? 12 : lowMemory ? 4 : 8;
  return Math.max(1, Math.min(count, Math.floor(rowBudget / rowsPerSprite)));
}

export class PixelSpriteProvider extends AssetProviderAI {
  constructor() {
    super({
      id: "pixel-sprite",
      name: "PixelSprite Canvas v2",
      type: "image",
      description: "Browser-local autoregressive pixel-art sprite generation.",
      capabilities: {
        prompt: true, negativePrompt: false, seed: true, batch: true, transparentBackground: true,
        guidedMode: true, fastMode: true, silhouetteConditioning: false,
        outputFormats: ["image/png"], outputDimensions: ["16x16", "32x32"],
        localInference: true, cancellation: true, progress: true
      },
      configuration: {
        fields: [
          { key: "size", label: "Sprite size", type: "select", default: 32, options: [{label:"16 × 16",value:16},{label:"32 × 32",value:32}] },
          { key: "count", label: "Variations", type: "select", default: 8, options: [4,8,12,16].map(value=>({label:String(value),value})) },
          { key: "batch", label: "Inference batch size", type: "select", default: "auto", options: [{label:"Auto · adapt to device",value:"auto"},...Array.from({length:8},(_,i)=>({label:String(i+1),value:String(i+1)}))] },
          { key: "seed", label: "Seed (-1 = random)", type: "number", default: 42, min: -1, step: 1 },
          { key: "mode", label: "Inference mode", type: "select", default: "guided", options: [{label:"Quality · guided",value:"guided"},{label:"Fast",value:"fast"}] },
          { key: "shape", label: "Shape guidance", type: "range", default: 1, min: 0, max: 4, step: 0.25, visibleWhen: { key:"mode", equals:"guided" } },
          { key: "colour", label: "Colour guidance", type: "range", default: 2, min: 0, max: 4, step: 0.25, visibleWhen: { key:"mode", equals:"guided" } }
        ]
      }
    });
    this.ort = null;
    this.model = null;
    this.encoder = null;
    this.backend = "wasm";
    this.loading = null;
  }

  async initialize({ onProgress, configuration = {} } = {}) {
    if (this.model) return { backend: this.backend, offlineModelCache: true };
    if (this.loading) return this.loading;
    this.loading = (async () => {
      progress(onProgress, "Preparing offline runtime cache");
      await prepareOfflineSupport();
      progress(onProgress, "Loading ONNX Runtime Web");
      this.ort = await import(ORT_URL);
      this.ort.env.wasm.numThreads = self.crossOriginIsolated ? 0 : 1;
      this.backend = await chooseBackend(this.ort);
      this.ort.env.wasm.proxy = this.backend === "wasm";
      const loadBackend = async backend => {
        this.backend = backend;
        this.ort.env.wasm.proxy = backend === "wasm";
        progress(onProgress, "Loading sprite model");
        this.model = await loadModel({
          ort: this.ort, files: modelFiles(MODEL_BASE), ep: backend,
          fetchBytes, fixedCache: true,
          onProgress: (loaded,total) => progress(onProgress,"Downloading sprite model",loaded,total)
        });
        progress(onProgress, "Warming up model");
        await this.warmup(configuration);
      };
      try {
        await loadBackend(this.backend);
      } catch (error) {
        if (this.backend !== "webgpu") throw error;
        try { await this.model?.session?.release?.(); } catch (_) {}
        this.model = null;
        await loadBackend("wasm");
      }
      progress(onProgress, "Loading text encoder");
      const { Tokenizer } = await import(TOKENIZERS_URL);
      this.encoder = await loadTextEncoder({
        ort:this.ort, Tokenizer, files:encoderFiles(ENCODER_BASE), fetchBytes,
        onProgress:(loaded,total)=>progress(onProgress,"Downloading text encoder",loaded,total)
      });
      progress(onProgress, "Ready");
      this.initialized = true;
      return { backend:this.backend, offlineModelCache:true };
    })();
    try { return await this.loading; }
    catch (error) { try { await this.model?.session?.release?.(); } catch (_) {} this.model = null; this.encoder = null; throw error; }
    finally { this.loading = null; }
  }

  async warmup(configuration = {}) {
    // Match the original generator's warmup shape. In particular, CPU only
    // needs a tiny cache for its one-step warmup; allocating a full 32x32 KV
    // cache there needlessly reserves hundreds of megabytes.
    const config = { size:32, count:8, mode:"guided", batch:"auto", ...configuration };
    const size = this.backend === "webgpu" ? Number(config.size) || 32 : 16;
    const rowsPerSprite = config.mode === "fast" ? 1 : 2;
    const automatic = deviceBatch(this.backend, rowsPerSprite, Number(config.count) || 8);
    const chunk = config.batch === "auto" ? automatic : Math.max(1,Math.min(8,Number(config.batch)||automatic));
    const batch = this.backend === "webgpu" ? Math.min(Number(config.count)||8,chunk) * rowsPerSprite : 1;
    const cacheLength = this.backend === "webgpu" ? 2 + size + size * size : 4;
    const cache = await this.model.cacheSet(batch, cacheLength);
    const x = new Float32Array(batch * this.model.d);
    for (let row=0; row<batch; row++) this.model.writePixel(x,row*this.model.d,this.model.BOS,0,0,3);
    let output;
    try { output = await this.model.stepFixed(x,batch,0,cache); }
    finally {
      this.model.constructor.release(cache);
      if (output?.cache) this.model.constructor.release(output.cache);
    }
  }

  async generateImage(request = {}, { signal, onProgress } = {}) {
    if (!this.model || !this.encoder) throw new Error("Load the PixelSprite model before generating.");
    const prompt = String(request.prompt || "").trim();
    if (!prompt) throw new Error("A prompt is required.");
    const config = { size:32, count:8, seed:42, mode:"guided", shape:1, colour:2, batch:"auto", ...(request.parameters || {}) };
    const size = Number(config.size), count = Number(config.count);
    if (![16,32].includes(size)) throw new Error("Sprite size must be 16 or 32.");
    if (![4,8,12,16].includes(count)) throw new Error("Variation count must be 4, 8, 12 or 16.");
    const fast = config.mode === "fast";
    const rowsPerSprite = fast ? 1 : 2;
    const automatic = deviceBatch(this.backend, rowsPerSprite, count);
    const chunk = config.batch === "auto" ? automatic : Math.max(1,Math.min(8,Number(config.batch)||automatic));
    const seed = Number.isFinite(Number(config.seed)) ? Number(config.seed) : 42;
    const shapeGuidance = Number.isFinite(Number(config.shape)) ? Math.max(0,Math.min(4,Number(config.shape))) : 1;
    const colourGuidance = Number.isFinite(Number(config.colour)) ? Math.max(0,Math.min(4,Number(config.colour))) : 2;
    const controller = signal;
    progress(onProgress,"Encoding prompt");
    const vector = await this.encoder.encode(prompt);
    const started = performance.now();
    let assets = new Array(count);
    let assetTasks = [];
    const buildAsset = async (id, indices) => {
      const blob = await canvasBlob(this.model, indices, size);
      const asset = { blob, mimeType:"image/png", width:size, height:size, metadata:{ index:id, seed, prompt } };
      assets[id] = asset;
      request.onAsset?.(asset, id);
      return asset;
    };
    const settings = {
      vector, n:count, size, seed, gShape:fast?1:shapeGuidance, gColour:fast?1:colourGuidance,
      filter:!fast, temperature:1, topP:1, chunk, signal:controller,
      onPixel:(ids,t,images,view) => {
        if ((t+1)%view.S===0 || t+1===view.S*view.S) {
          const row = Math.ceil((t+1)/view.S);
          progress(onProgress, "Drawing row · " + row + " / " + view.S, row, view.S);
        }
      },
      onSprite:(id, indices) => {
        // The original UI received sprites as soon as a batch finished. Preserve
        // that behavior instead of making users wait for the entire generation.
        assetTasks.push(buildAsset(id, indices));
      },
    };
    try {
      let result;
      const run = async () => {
        assetTasks = [];
        result = await this.model.generate(settings);
        await Promise.all(assetTasks);
        // Keep the result envelope complete even if a future engine version omits
        // onSprite for a particular accepted image.
        for (let id = 0; id < result.images.length; id++) {
          if (!assets[id]) await buildAsset(id, result.images[id]);
        }
        return result;
      };
      try { await run(); }
      catch (error) {
        if (error?.name === "AbortError" || this.backend !== "webgpu") throw error;
        await Promise.allSettled(assetTasks);
        try { await this.model.session.release(); } catch (_) {}
        this.backend = "wasm";
        this.ort.env.wasm.proxy = true;
        this.model = await loadModel({ort:this.ort,files:modelFiles(MODEL_BASE),ep:"wasm",fetchBytes,fixedCache:true});
        await this.warmup(config);
        settings.chunk = Math.max(1,Math.min(count,Math.floor(4/rowsPerSprite)));
        assets = new Array(count);
        request.onResetAssets?.();
        await run();
      }
      for (const asset of assets) if (asset) asset.metadata.seed = result.stats.seed;
      return {
        assets,
        metadata:{ provider:this.id, seed:result.stats.seed, sampled:result.stats.sampled, rejected:result.stats.rejected,
          rounds:result.stats.rounds, elapsedMs:performance.now()-started, backend:this.backend,
          mode:fast?"fast":"guided", shapeGuidance:fast?1:shapeGuidance, colourGuidance:fast?1:colourGuidance }
      };
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw error;
    }
  }

  async dispose() {
    try { this.model?.gpuSampler?.embeddings?.destroy?.(); } catch (_) {}
    try { await this.model?.session?.release?.(); } catch (_) {}
    this.model = null; this.encoder = null; this.ort = null;
    this.initialized = false;
  }
}

export function registerPixelSpriteProvider(studioAI = window.StudioAI) {
  const factory = () => new PixelSpriteProvider();
  factory.metadata = { name:"PixelSprite Canvas v2", type:"image", description:"Browser-local pixel-art generation" };
  if (!studioAI.providers.has("pixel-sprite")) studioAI.registerProvider("pixel-sprite",factory);
  return studioAI;
}
