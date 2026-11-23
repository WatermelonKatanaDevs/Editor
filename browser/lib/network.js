
const originalFetch = window.fetch.bind(window);
const originalWebSocket = window.WebSocket;
const originalXMLHttpRequest = window.XMLHttpRequest;
window.wait = t=>new Promise(r=>setTimeout(r,t));

// Network is loaded before browser.js. Keep URL encoding helpers here so the
// editor-owned shared Network can proxy requests before a Browser iframe exists.
function textToBase64(str) {
  try { return btoa(unescape(encodeURIComponent(String(str)))); }
  catch (e) { return btoa(String(str)); }
}
function base64ToText(base64) {
  try {
    const binaryString = atob(base64);
    const bytes = Uint8Array.from(binaryString, char => char.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) { return atob(base64); }
}
window.textToBase64 = textToBase64;
window.base64ToText = base64ToText;


class EventHandler {
  constructor() {
    this.eventListeners = {};
  }
  dispatchEvent(event, ...args) {
    var list = this.eventListeners[event];
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      list[i].callback.apply(this, args);
    }
  }
  addEventListener(event, callback, options) {
    this.eventListeners[event] = this.eventListeners[event] || [];
    this.eventListeners[event].push({callback,options});
    return callback;
  }
  removeEventListener(event, callback) {
    var list = this.eventListeners[event];
    if (!list) return;
    if (!callback) { delete this.eventListeners[event]; return; }
    this.eventListeners[event] = list.filter(item => item.callback !== callback);
    if (!this.eventListeners[event].length) delete this.eventListeners[event];
  }
}

function isLoopbackHostname(hostname) {
  const host = String(hostname || '').toLowerCase().replace("[", "").replace("]", "");
  const parts = host.split(".");
  return host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "::1" ||
    (parts.length === 4 && Number(parts[0]) === 127 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255));
}

function isEmulatedLoopbackRequest(request) {
  try {
    // A loopback URL inside the emulated browser is a virtual origin. This
    // applies even when callers pass a prebuilt Request and omit baseOrigin.
    const target = new URL(request.url);
    return isLoopbackHostname(target.hostname);
  } catch (_) {
    return false;
  }
}

function createSocketAbortError(signal) {
  const reason = signal && signal.reason;
  if (reason instanceof Error) return reason;
  const error = new Error(reason ? String(reason) : 'WebSocket connection was aborted.');
  error.name = 'AbortError';
  return error;
}

function closeSocketQuietly(socket) {
  if (!socket || typeof socket.close !== 'function') return;
  try {
    if (socket.readyState === 0 || socket.readyState === 1) socket.close();
  } catch (_) {
    try { socket.close(); } catch (_) {}
  }
}

function waitForSocketOpen(socket, timeout, signal, url, endpointName) {
  if (signal && signal.aborted) return Promise.reject(createSocketAbortError(signal));
  // The editor also has an internal mock WebSocket backend. It does not use
  // the browser WebSocket readyState/open handshake, so preserve that API.
  if (socket && typeof socket.onClientMessage === 'function') return Promise.resolve(socket);
  if (socket && socket.readyState === 1) return Promise.resolve(socket);
  if (!socket || typeof socket.addEventListener !== 'function') {
    return Promise.reject(new Error('WebSocket endpoint ' + endpointName + ' did not return an event-capable socket for ' + url));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;
    const cleanup = () => {
      if (timer !== null) clearTimeout(timer);
      socket.removeEventListener('open', onOpen);
      socket.removeEventListener('error', onError);
      socket.removeEventListener('close', onClose);
      if (signal) signal.removeEventListener('abort', onAbort);
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(socket);
    };
    const onOpen = () => finish(null);
    const onError = () => finish(new Error('WebSocket handshake failed through ' + endpointName + ' for ' + url));
    const onClose = event => finish(new Error(
      'WebSocket closed before opening through ' + endpointName + ' for ' + url +
      (event && event.code ? ' (code ' + event.code + (event.reason ? ': ' + event.reason : '') + ')' : '')
    ));
    const onAbort = () => finish(createSocketAbortError(signal));

    socket.addEventListener('open', onOpen);
    socket.addEventListener('error', onError);
    socket.addEventListener('close', onClose);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    if (timeout > 0) {
      timer = setTimeout(() => finish(new Error(
        'WebSocket handshake timed out after ' + timeout + 'ms through ' + endpointName + ' for ' + url
      )), timeout);
    }

    // Check after installing listeners so an unusually fast endpoint cannot
    // open between the initial state check and listener registration.
    if (socket.readyState === 1) onOpen();
    else if (socket.readyState === 3) onClose({ code: 1006, reason: 'Socket closed before opening' });
  });
}

function isHTMLResponse(response) {
  const contentType = String(response && response.headers && response.headers.get('content-type') || '').toLowerCase();
  return contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
}


function syncBodyToArrayBuffer(body) {
  if (body == null) return new ArrayBuffer(0);
  if (Object.prototype.toString.call(body) === '[object ArrayBuffer]') return body.slice(0);
  if (ArrayBuffer.isView(body)) {
    return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
  }
  if (typeof body === 'string') return new TextEncoder().encode(body).buffer;
  return new ArrayBuffer(0);
}

function createSyncNetworkResponse(status, statusText, headers, body, url) {
  const normalizedHeaders = headers instanceof Headers ? new Headers(headers) : new Headers(headers || {});
  const response = {
    status: Number(status) || 0,
    statusText: String(statusText || ''),
    headers: normalizedHeaders,
    body: syncBodyToArrayBuffer(body),
    url: String(url || ''),
    redirected: false,
    ok: Number(status) >= 200 && Number(status) < 300
  };

  // Keep the sync result compatible with the Fetch Response methods used by
  // DevTools' network and Sources panels after the blocking request completes.
  response.clone = () => {
    const copy = createSyncNetworkResponse(
      response.status,
      response.statusText,
      response.headers,
      response.body,
      response.url
    );
    copy.redirected = response.redirected;
    return copy;
  };
  response.arrayBuffer = async () => response.body.slice(0);
  response.text = async () => new TextDecoder('utf-8').decode(response.body);
  response.blob = async () => new Blob(
    [response.body],
    { type: response.headers.get('content-type') || '' }
  );
  return response;
}

function parseSyncXHRHeaders(rawHeaders) {
  const headers = new Headers();
  for (const line of String(rawHeaders || '').split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    try {
      headers.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
    } catch (_) {}
  }
  return headers;
}

function performSynchronousNetworkRequest(request, targetUrl = request.url) {
  if (typeof originalXMLHttpRequest !== 'function') {
    throw new Error('Native XMLHttpRequest is unavailable for synchronous proxy requests.');
  }

  const xhr = new originalXMLHttpRequest();
  const method = String(request.method || 'GET').toUpperCase();
  const url = String(targetUrl || request.url || '');

  try {
    if (request.username != null || request.password != null) {
      xhr.open(method, url, false, request.username || '', request.password || '');
    } else {
      xhr.open(method, url, false);
    }

    if (request.credentials === 'include') xhr.withCredentials = true;

    // Window synchronous XHR cannot set responseType="arraybuffer".
    // x-user-defined preserves each response byte in responseText instead.
    try { xhr.overrideMimeType('text/plain; charset=x-user-defined'); } catch (_) {}

    const headers = request.headers;
    if (headers && typeof headers.forEach === 'function') {
      headers.forEach((value, name) => {
        try { xhr.setRequestHeader(name, value); } catch (_) {}
      });
    } else if (headers && typeof headers === 'object') {
      for (const [name, value] of Object.entries(headers)) {
        try { xhr.setRequestHeader(name, value); } catch (_) {}
      }
    }

    const body = method === 'GET' || method === 'HEAD' ? null : (request.body == null ? null : request.body);
    xhr.send(body);

    if (!xhr.status) return null;

    const rawText = xhr.responseText || '';
    const bytes = new Uint8Array(rawText.length);
    for (let i = 0; i < rawText.length; i++) bytes[i] = rawText.charCodeAt(i) & 0xff;

    let responseUrl = url;
    try { responseUrl = xhr.responseURL || url; } catch (_) {}
    const response = createSyncNetworkResponse(
      xhr.status,
      xhr.statusText,
      parseSyncXHRHeaders(xhr.getAllResponseHeaders()),
      bytes,
      responseUrl
    );
    response.redirected = !!(responseUrl && responseUrl !== url);
    return response;
  } catch (_) {
    // A CORS rejection or unreachable endpoint should allow the next configured
    // endpoint (typically the primary/fallback proxy) to try the request.
    return null;
  }
}

function buildProxyRequestURL(proxy, url, obscureURL = true) {
  const absoluteUrl = String(url || '');
  if (absoluteUrl.startsWith('data:') || absoluteUrl.startsWith('blob:')) return absoluteUrl;

  let parameter;
  if (obscureURL) {
    const base64 = textToBase64(absoluteUrl);
    const urlSafeBase64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    parameter = 'base64_url=' + encodeURIComponent(urlSafeBase64);
  } else {
    parameter = 'url=' + encodeURIComponent(absoluteUrl);
  }
  return String(proxy || '') + (String(proxy || '').includes('?') ? '&' : '?') + parameter;
}

class Network extends EventHandler {
  constructor() {
    super();
    this.endpoints = [];
  }
  async request() {
    if (arguments[0] instanceof Request) return await this._requestObject.apply(this,arguments);
    return await this._requestURL.apply(this,arguments);
  }
  requestSync(url, baseOrigin, data = {}, type = 'xhr', filter) {
    const absoluteUrl=resolveNetworkURL(url,baseOrigin);
    const request={
      url:absoluteUrl,method:String(data.method||'GET').toUpperCase(),
      headers:data.headers instanceof Headers?new Headers(data.headers):new Headers(data.headers||{}),
      body:data.body==null?null:data.body,credentials:data.credentials||'same-origin',
      username:data.username,password:data.password,request_type:type,
      __wkInitiatorOrigin:MockCORS.originOf(baseOrigin),__wkCorsMode:data.mode||MockCORS.inferMode(type,data)
    };
    const sendSync=(currentRequest,currentType,responseFilter)=>{
      this.dispatchEvent('requeststart',currentRequest,currentType);
      const currentPolicy=MockCORS.getPolicy(currentRequest,currentType,currentRequest.__wkInitiatorOrigin||null);
      const endpoints=isEmulatedLoopbackRequest(currentRequest)
        ?this.endpoints.filter(endpoint=>endpoint&&!endpoint.__browserDefaultFallback&&!endpoint.__browserProxyEndpoint)
        :currentPolicy.crossOrigin&&currentPolicy.mode==='cors'
          ?this.endpoints.filter(endpoint=>endpoint&&endpoint.__browserProxyEndpoint)
          :this.endpoints;
      const accept=typeof responseFilter==='function'?responseFilter:response=>response.ok;
      let selected=null,fallbackError=null,last=null,lastError=null;
      for(const endpoint of endpoints){
        if(!endpoint||endpoint.enabled===false||typeof endpoint.handleSyncRequest!=='function')continue;
        try{
          endpoint.dispatchEvent('handlerequest',currentRequest,currentType);
          const endpointRequest={...currentRequest,headers:new Headers(currentRequest.headers)};
          const response=endpoint.handleSyncRequest(endpointRequest,currentType);
          if(!response)continue;
          endpoint.dispatchEvent('returnresponse',response,currentRequest,currentType);
          if(accept(response)){selected=response;break;}
          if(endpoint.defaultError)fallbackError=response;
          last=response;
        }catch(error){
          console.log('[networkRequestSync] Endpoint error:',endpoint.constructor?.name||'Endpoint',error&&error.message||error);
          lastError=error;
        }
      }
      selected=selected||fallbackError||last||null;
      if(selected){selected.source_url=currentRequest.url;selected.requested_url=currentRequest.url;selected.request_type=currentType;}
      this.dispatchEvent('requestend',selected,currentRequest,currentType);
      if(!selected&&lastError)throw lastError;
      return selected;
    };
    const policy=MockCORS.getPolicy(request,type,request.__wkInitiatorOrigin);
    if(policy.crossOrigin&&policy.mode==='same-origin')throw new TypeError('Fetch mode same-origin blocked a cross-origin request.');
    if(!policy.crossOrigin||policy.mode==='navigate'||policy.mode==='no-cors'){
      const response=sendSync(request,type,filter);
      if(response&&policy.crossOrigin&&policy.mode==='no-cors'&&type==='fetch')return MockCORS.createOpaqueResponse();
      return response;
    }
    if(policy.mode!=='cors')return sendSync(request,type,filter);
    if(MockCORS.needsPreflight(request)&&!MockCORS.isCached(policy,request)){
      const preflight=MockCORS.createPreflightRequest(request,policy);
      const preflightResponse=sendSync(preflight,'cors-preflight',()=>true);
      const result=MockCORS.evaluatePreflight(preflightResponse,request,policy);
      if(!result.ok)throw new TypeError('CORS preflight failed: '+result.reason);
      MockCORS.cachePreflight(policy,request,preflightResponse);
    }
    const response=sendSync(request,type,filter||(()=>true));
    if(!response)return null;
    const result=MockCORS.evaluateActualResponse(response,policy);
    if(!result.ok)throw new TypeError('CORS request failed: '+result.reason);
    response.headers=MockCORS.filterHeaders(response.headers,policy);
    return response;
  }
  async _requestURL(url,baseOrigin,data,type,filter) {
    const absoluteUrl=resolveNetworkURL(url,baseOrigin);
    const request=new Request(absoluteUrl,data);
    request.__wkInitiatorOrigin=MockCORS.originOf(baseOrigin);
    request.__wkCorsMode=data&&data.mode||MockCORS.inferMode(type,data||{});
    return await this._requestObject(request,type,filter);
  }
  async _requestObject(request,type,filter) {
    const policy=MockCORS.getPolicy(request,type,request.__wkInitiatorOrigin||null);
    if(policy.crossOrigin&&policy.mode==='same-origin')throw new TypeError('Fetch mode same-origin blocked a cross-origin request.');
    if(!policy.crossOrigin||policy.mode==='navigate')return await this._requestObjectRaw(request,type,filter);
    if(policy.mode==='no-cors'){
      const validity=MockCORS.validateNoCorsRequest(request);
      if(!validity.ok)throw new TypeError(validity.reason);
      const response=await this._requestObjectRaw(request,type,filter||(()=>true));
      if(response&&type==='fetch')return MockCORS.createOpaqueResponse();
      return response;
    }
    if(policy.mode!=='cors')return await this._requestObjectRaw(request,type,filter);
    if(MockCORS.needsPreflight(request)&&!MockCORS.isCached(policy,request)){
      const preflight=MockCORS.createPreflightRequest(request,policy);
      const preflightResponse=await this._requestObjectRaw(preflight,'cors-preflight',()=>true);
      const preflightResult=MockCORS.evaluatePreflight(preflightResponse,request,policy);
      if(!preflightResult.ok)throw new TypeError('CORS preflight failed: '+preflightResult.reason);
      MockCORS.cachePreflight(policy,request,preflightResponse);
    }
    // Fetch resolves for HTTP errors; only network or CORS failures reject it.
    const response=await this._requestObjectRaw(request,type,filter||(()=>true));
    if(!response)return null;
    const result=MockCORS.evaluateActualResponse(response,policy);
    if(!result.ok)throw new TypeError('CORS request failed: '+result.reason);
    return MockCORS.filterResponse(response,policy);
  }
  async _requestObjectRaw(request,type,filter) {
    request.__original_url=request.url;request.request_type=type;
    this.dispatchEvent('requeststart',request,type);
    const corsPolicy=MockCORS.getPolicy(request,type,request.__wkInitiatorOrigin||null);
    const endpoints=isEmulatedLoopbackRequest(request)
      ?this.endpoints.filter(endpoint=>endpoint&&!endpoint.__browserDefaultFallback&&!endpoint.__browserProxyEndpoint)
      :corsPolicy.crossOrigin&&corsPolicy.mode==='cors'
        ?this.endpoints.filter(endpoint=>endpoint&&endpoint.__browserProxyEndpoint)
        :this.endpoints;
    const response=await this.searchEndpoints(async function(endpoint){
      endpoint.dispatchEvent('handlerequest',request,type);
      const endpointRequest=request.clone();
      if(request.__wkInitiatorOrigin)endpointRequest.__wkInitiatorOrigin=request.__wkInitiatorOrigin;
      if(request.__wkCorsMode)endpointRequest.__wkCorsMode=request.__wkCorsMode;
      const endpointResponse=await endpoint.handleRequest(endpointRequest,type);
      if(!endpointResponse)return null;
      endpoint.dispatchEvent('returnresponse',endpointResponse,request,type);
      return endpointResponse;
    },filter||(r=>r.ok),endpoints,response=>type==='page-load'&&isHTMLResponse(response));
    if(response){
      response.source_url=request.url;response.requested_url=request.__original_url||request.url;response.request_type=type;
      if(type==='import'||type==='script[src]'||type==='link[rel=stylesheet]'||type==='link[rel="stylesheet"]'){
        try{Object.defineProperty(response,'__devtoolsSourceTextPromise',{value:response.clone().text().catch(()=>null),configurable:true});}catch(e){}
      }
    }
    this.dispatchEvent('requestend',response,request,type);
    return response;
  }
  async socket(url,baseOrigin,protocols,filter,options = {}) {
    const absoluteUrl = resolveNetworkURL(url,baseOrigin);
    const signal = options && options.signal;
    const timeout = Number.isFinite(options && options.timeout)
      ? Math.max(0, options.timeout)
      : (this.socketTimeout || 10000);
    const acceptSocket = typeof filter === 'function' ? filter : (() => true);
    this.dispatchEvent('socketstart',absoluteUrl,protocols);

    // Preserve the configured Network order. The browser installs the direct
    // endpoint first, followed by the primary and optional fallback proxies.
    const endpoints = this.endpoints.slice();
    let lastError = null;

    for (const endp of endpoints) {
      if (!endp || endp.enabled === false) continue;
      if (signal && signal.aborted) break;

      let response = null;
      const endpointName = endp.constructor && endp.constructor.name || 'Network endpoint';
      try {
        endp.dispatchEvent('handlesocket',absoluteUrl,protocols);
        response = await endp.handleSocket(absoluteUrl,protocols);
        if (!response) continue;

        if (options && options.binaryType && 'binaryType' in response) {
          try { response.binaryType = options.binaryType; } catch (_) {}
        }

        await waitForSocketOpen(response,timeout,signal,absoluteUrl,endpointName);
        if (!acceptSocket(response)) {
          closeSocketQuietly(response);
          continue;
        }

        endp.dispatchEvent('returnsocket',response,absoluteUrl,protocols);
        this.dispatchEvent('socketend',response,absoluteUrl,protocols);
        return response;
      } catch (error) {
        closeSocketQuietly(response);
        if (signal && signal.aborted) break;
        console.log('[networkSocket] Endpoint error:', endpointName, error && error.message || error);
        lastError = error;
      }
    }

    this.dispatchEvent('socketend',null,absoluteUrl,protocols);
    if (signal && signal.aborted) throw createSocketAbortError(signal);
    if (lastError) throw lastError;
    return null;
  }
  setEndpoints(endpoints) {
    this.endpoints = endpoints;
    this.dispatchEvent('endpointschange', this.endpoints);
  }
  prependEndpoint(endpoint) {
    this.endpoints.unshift(endpoint);
    this.dispatchEvent('endpointschange', this.endpoints);
    return endpoint;
  }
  appendEndpoint(endpoint) {
    this.endpoints.push(endpoint);
    this.dispatchEvent('endpointschange', this.endpoints);
    return endpoint;
  }
  removeEndpoint(endpoint) {
    const index = this.endpoints.indexOf(endpoint);
    if (index < 0) return false;
    this.endpoints.splice(index, 1);
    this.dispatchEvent('endpointschange', this.endpoints);
    return true;
  }
  replaceRuntimeEndpoint(endpoint) {
    const old = this.endpoints.filter(item => item && item.__editorRuntimeEndpoint);
    for (const item of old) {
      const index = this.endpoints.indexOf(item);
      if (index >= 0) this.endpoints.splice(index, 1);
    }
    if (endpoint) {
      endpoint.__editorRuntimeEndpoint = true;
      this.endpoints.unshift(endpoint);
    }
    this.dispatchEvent('endpointschange', this.endpoints);
    return endpoint || null;
  }
  getEndpointInfo() {
    return this.endpoints.map((endpoint, index) => ({
      index,
      name: endpoint?.constructor?.name || 'Endpoint',
      enabled: endpoint?.enabled !== false,
      runtime: !!endpoint?.__editorRuntimeEndpoint,
      proxy: endpoint?.proxy || null,
      domain: endpoint?.domain || null,
      path: endpoint?.path || null,
      rootfolder: endpoint?.rootfolder || null
    }));
  }
  async searchEndpoints(callback, filter, endpointList = this.endpoints, fallbackFilter = null) {
    await wait(1);
    var responseError = null;
    var firstFallbackResponse = null;
    var lastResponse = null;
    var lastError = null;
    for (var i = 0; i < endpointList.length; i++) {
      var endp = endpointList[i];
      if (endp?.enabled == false) continue;
      try {
        var response = await callback.call(this, endp);
        if (!response) continue;
        // A later successful endpoint always wins over an earlier HTML error
        // page. Keep only the first eligible fallback while continuing the
        // chain so endpoint priority remains deterministic.
        if (filter(response)) return response;
        if (!firstFallbackResponse && fallbackFilter && fallbackFilter(response)) {
          firstFallbackResponse = response;
        }
        if (endp.defaultError) responseError = response;
        lastResponse = response;
      } catch (e) {
        console.log('[networkRequest] Endpoint error:', e && e.message || e);
        lastError = e;
      }
    }
    if (firstFallbackResponse || responseError || lastResponse) {
      return firstFallbackResponse || responseError || lastResponse;
    }
    if (lastError) throw lastError;
  }
}

class NetworkEndpoint extends EventHandler {
  constructor(enabled = true, defaultError = false) {
    super();
    this.enabled = enabled;
    this.defaultError = defaultError;
  }
  async handleRequest(request,type) {
    return await originalFetch(request);
  }
  handleSyncRequest(request) {
    // Specialized endpoints must explicitly implement sync behavior. Only the
    // plain default endpoint should fall through to a direct native request.
    if (this.constructor !== NetworkEndpoint) return null;
    return performSynchronousNetworkRequest(request, request.url);
  }
  async handleSocket(url,protocols) {
    return protocols ? new originalWebSocket(url, protocols) : new originalWebSocket(url);
  }
}

function buildProxyRequestURLForNetwork(proxy,request,type,obscureURL=true){
  const url=new URL(buildProxyRequestURL(proxy,request.url,obscureURL));
  let targetOrigin=null;
  try{targetOrigin=new URL(request.url).origin;}catch(_){}
  if(request.__wkCorsMode==='cors'&&request.__wkInitiatorOrigin&&targetOrigin&&targetOrigin!==request.__wkInitiatorOrigin){
    url.searchParams.set('wk_origin',request.__wkInitiatorOrigin);
  }
  if(type==='cors-preflight'){
    url.searchParams.set('wk_cors_preflight','1');
    url.searchParams.set('wk_cors_request_method',request.headers?.get?.('Access-Control-Request-Method')||'GET');
    const requestedHeaders=request.headers?.get?.('Access-Control-Request-Headers');
    if(requestedHeaders)url.searchParams.set('wk_cors_request_headers',requestedHeaders);
  }
  return url.href;
}

class ProxyNetworkEndpoint extends NetworkEndpoint {
  constructor(proxy, obscureURL = true, enabled) {
    super(enabled);
    this.proxy = proxy;
    this.obscureURL = obscureURL;
    this.__browserProxyEndpoint = true;
  }
  async handleRequest(request,type) {
    const targetProxyUrl = buildProxyRequestURLForNetwork(this.proxy, request, type, this.obscureURL);
    try {
      const proxyRequest = type === 'cors-preflight'
        ? new Request(targetProxyUrl, { method: 'GET', credentials: 'omit', redirect: 'follow' })
        : new Request(targetProxyUrl, request);
      let response = await originalFetch(proxyRequest);
      //if (!response.ok) throw new Error(\`HTTP Error \${response.status}\`);
      const finalUrl = response.headers.get('X-Final-URL') || request.url;
      try { Object.defineProperty(response, 'url', { configurable: true, get: () => finalUrl }); } catch (_) {}
      try { Object.defineProperty(response, 'redirected', { configurable: true, value: finalUrl !== request.url }); } catch (_) {}
      return response;
    } catch (err) {
      return null;
    }
  }
  handleSyncRequest(request, type) {
    const targetProxyUrl = buildProxyRequestURLForNetwork(this.proxy, request, type, this.obscureURL);
    const proxyRequest = type === 'cors-preflight'
      ? { url: request.url, method: 'GET', headers: new Headers(), body: null, credentials: 'omit' }
      : { ...request, headers: new Headers(request.headers || {}) };
    return performSynchronousNetworkRequest(proxyRequest, targetProxyUrl);
  }
  async handleSocket(absoluteUrl, protocols) {
    // Switch the HTTP proxy URL to its WebSocket endpoint using the same
    // target URL encoding as ordinary HTTP proxy requests.
    const proxyBaseUrl = this.proxy.replace(/^http/, 'ws');
    const targetProxyUrl = buildProxyRequestURL(proxyBaseUrl, absoluteUrl, this.obscureURL);
    return protocols
      ? new originalWebSocket(targetProxyUrl, protocols)
      : new originalWebSocket(targetProxyUrl);
  }
}

function resolveNetworkURL(url, baseOrigin) {
  const raw = (url instanceof URL) ? url.href : String(url == null ? '' : url);
  const candidates = [];
  if (baseOrigin) candidates.push(String(baseOrigin));
  try {
    if (typeof getReliablePageURL === 'function') candidates.push(getReliablePageURL());
  } catch (_) {}
  try {
    if (typeof CURRENT_PAGE_URL !== 'undefined') candidates.push(CURRENT_PAGE_URL);
  } catch (_) {}
  candidates.push('http://127.0.0.1/');

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw)) {
    try { return new URL(raw).href; } catch (_) {}
  }
  if (raw.startsWith('//')) {
    for (const base of candidates) {
      try { return new URL(raw, base).href; } catch (_) {}
    }
  }
  for (const base of candidates) {
    try {
      if (!base || !/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(base)) continue;
      return new URL(raw, base).href;
    } catch (_) {}
  }
  return raw;
}



function globalSingularInstance(prop) {
  const localConstructor = window[prop];
  if (typeof localConstructor !== 'function') return;

  Object.defineProperty(localConstructor, Symbol.hasInstance, {
    value: function(instance) {
      if (!instance || (typeof instance !== 'object' && typeof instance !== 'function')) return false;

      const visited = new Set();

      function checkWindow(win) {
        if (!win || visited.has(win)) return false;
        visited.add(win);

        try {
          const Constructor = win[prop];
          if (
            typeof Constructor === 'function' &&
            Constructor.prototype &&
            Object.prototype.isPrototypeOf.call(Constructor.prototype, instance)
          ) {
            return true;
          }

          for (let i = 0; i < win.frames.length; i++) {
            if (checkWindow(win.frames[i])) return true;
          }
        } catch (e) {}

        return false;
      }

      // Start at the highest ancestor we can actually inspect. window.top may
      // belong to an unrelated origin when the Editor is embedded; touching
      // its properties throws and would otherwise make every instanceof
      // check fail, including checks for objects from this very frame.
      let root = window;
      while (true) {
        let parent = null;
        try {
          const candidate = root.parent;
          if (candidate && candidate !== root) {
            // Reading document verifies that the parent is same-origin.
            void candidate.document;
            parent = candidate;
          }
        } catch (e) {}

        if (!parent || visited.has(parent)) break;
        root = parent;
      }

      return checkWindow(root);
    },
    configurable: true
  });
}
globalSingularInstance("Request");
globalSingularInstance("Response");
