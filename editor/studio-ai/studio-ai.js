(function () {
  class AssetProviderAI {
    constructor(metadata = {}) {
      this.id = metadata.id || "";
      this.name = metadata.name || this.id;
      this.type = metadata.type || "image";
      this.description = metadata.description || "";
      this._capabilities = metadata.capabilities || {};
      this._configuration = metadata.configuration || {};
      this.initialized = false;
    }
    getCapabilities() { return structuredClone(this._capabilities); }
    getConfigurationSchema() { return structuredClone(this._configuration); }
    async initialize() { this.initialized = true; }
    async dispose() { this.initialized = false; }
  }

  class AssetProviderRegistry {
    constructor() { this.factories = new Map(); }
    register(id, factory) {
      id = String(id || "").trim();
      if (!id || typeof factory !== "function") throw new TypeError("A provider ID and factory are required.");
      if (this.factories.has(id)) throw new Error("Asset provider already registered: " + id);
      this.factories.set(id, factory);
      return () => this.unregister(id);
    }
    unregister(id) { return this.factories.delete(String(id)); }
    has(id) { return this.factories.has(String(id)); }
    list(type) {
      return Array.from(this.factories, ([id, factory]) => {
        const info = factory.metadata || {};
        return { id, name: info.name || id, type: info.type || "image", description: info.description || "" };
      }).filter(x => !type || x.type === type);
    }
    create(id) {
      const factory = this.factories.get(String(id));
      if (!factory) throw new Error("Unknown asset provider: " + id);
      const provider = factory();
      if (!(provider instanceof AssetProviderAI)) throw new TypeError("Provider factory must return an AssetProviderAI.");
      return provider;
    }
  }

  class StudioAI {
    constructor(options = {}) {
      this.providers = options.registry || new AssetProviderRegistry();
      this.instances = new Set();
    }
    registerProvider(id, factory) { return this.providers.register(id, factory); }
    unregisterProvider(id) { return this.providers.unregister(id); }
    listProviders(type) { return this.providers.list(type); }
    createImageProvider(id) {
      const provider = this.providers.create(id);
      if (provider.type !== "image") throw new TypeError("Provider " + id + " does not generate images.");
      this.instances.add(provider);
      const dispose = provider.dispose.bind(provider);
      provider.dispose = async (...args) => { try { return await dispose(...args); } finally { this.instances.delete(provider); } };
      return provider;
    }
    async dispose() {
      await Promise.allSettled(Array.from(this.instances, provider => provider.dispose()));
      this.instances.clear();
    }
  }

  window.StudioAIFramework = Object.freeze({ AssetProviderAI, AssetProviderRegistry, StudioAI });
  window.StudioAI = window.StudioAI || new StudioAI();
})();