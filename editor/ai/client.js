(function() {
  const root = window.EditorAI = window.EditorAI || {};
  const LocalAI = window.LocalAI;
  if (!LocalAI || typeof LocalAI.createProviderClient !== 'function') {
    throw new Error('The LocalAI provider client must load before the Editor AI adapter.');
  }

  function AIClient(registry, network, localManager) {
    const browserNetwork = network || window.__sharedBrowserNetwork || null;
    return LocalAI.createProviderClient({
      providers: registry,
      transport: async (url, init, context = {}) => {
        if (!browserNetwork || typeof browserNetwork.request !== 'function') {
          throw new Error('AI network is not initialized.');
        }
        const requestInit = {
          method: init.method || 'GET',
          headers: init.headers || {},
          ...(init.body !== undefined ? {body:init.body} : {}),
          ...(init.signal ? {signal:init.signal} : {})
        };
        return browserNetwork.request(new Request(url, requestInit), context.channel || 'ai');
      },
      resolveAuth: model => {
        if (model?.apiKey) return model.apiKey;
        if (root.isHuggingFaceEndpoint?.(model?.endpoint)) {
          const userKey = registry?.getHuggingFaceApiKey?.() || '';
          if (userKey) return userKey;
          if (model.useSharedKeys !== false) {
            const sharedKey = registry?.nextSharedHuggingFaceKey?.() || '';
            if (sharedKey) return sharedKey;
          }
        }
        return model?.anonymousAuth || '';
      },
      getPreferences: () => root.getAIPreferences?.() || {},
      analytics: info => root.recordAnalytics?.(info),
      getProviderDefinition: id => registry?.provider?.(id) || {},
      isHuggingFaceEndpoint: endpoint => root.isHuggingFaceEndpoint?.(endpoint) || false,
      localExecutor: localManager,
      onEvent: event => root.emitProviderClientEvent?.(event)
    });
  }

  root.AIClient = AIClient;
})();