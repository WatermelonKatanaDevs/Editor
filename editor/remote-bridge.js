/* Generic asynchronous RPC membrane for cross-origin editor hosts.
 * Exposes nested objects, methods, callbacks, events, and object references over
 * a dedicated MessagePort. Remote property reads are explicitly async via
 * $get(); method calls can use normal call syntax.
 */
(function(global) {
  'use strict';

  const PROTOCOL = 'watermelonkatanadevs.editor-bridge.v1';
  const proxyMetadata = new WeakMap();

  function serializeError(error) {
    return {
      name: String(error?.name || 'Error'),
      message: String(error?.message || error || 'Remote operation failed'),
      stack: typeof error?.stack === 'string' ? error.stack : ''
    };
  }

  function reviveError(data) {
    const error = new Error(data?.message || 'Remote operation failed');
    error.name = data?.name || 'Error';
    if (data?.stack) error.stack = data.stack;
    return error;
  }

  function isPlainObject(value) {
    if (!value || Object.prototype.toString.call(value) !== '[object Object]') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function createBridge(port, localObjects, options = {}) {
    if (!port) throw new TypeError('A MessagePort is required.');

    const objects = new Map();
    const objectIds = new WeakMap();
    const pending = new Map();
    const remoteRefCounts = new Map();
    let nextObjectId = 1;
    let nextRequestId = 1;
    let closed = false;
    const onError = typeof options.onError === 'function' ? options.onError : error => console.error('[EditorRemoteBridge]', error);

    const root = localObjects && typeof localObjects === 'object' ? localObjects : {};
    objects.set(0, root);
    objectIds.set(root, 0);

    function objectId(value) {
      if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
        throw new TypeError('Only objects and functions can be exported by reference.');
      }
      let id = objectIds.get(value);
      if (id !== undefined && objects.has(id)) return id;
      id = nextObjectId++;
      objectIds.set(value, id);
      objects.set(id, value);
      return id;
    }

    function pack(value, seen = new WeakSet()) {
      if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;

      const remote = proxyMetadata.get(value);
      if (remote) return { __editorRemoteRef: remote.id, path: remote.path, kind: remote.kind };

      if (typeof value === 'function') {
        return { __editorRemoteRef: objectId(value), kind: 'function', path: [] };
      }

      if (typeof Blob !== 'undefined' && value instanceof Blob) return value;
      if (typeof File !== 'undefined' && value instanceof File) return value;
      if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value;
      if (value instanceof Date || value instanceof RegExp) return value;
      if (value instanceof Map || value instanceof Set) return value;

      if (seen.has(value)) {
        return { __editorRemoteRef: objectId(value), kind: 'object', path: [] };
      }

      if (Array.isArray(value) || isPlainObject(value)) {
        seen.add(value);
        const result = Array.isArray(value) ? [] : Object.create(null);
        for (const key of Object.keys(value)) result[key] = pack(value[key], seen);
        seen.delete(value);
        return result;
      }

      return { __editorRemoteRef: objectId(value), kind: 'object', path: [] };
    }

    function unpack(value) {
      if (!value || typeof value !== 'object') return value;
      if (Object.prototype.hasOwnProperty.call(value, '__editorRemoteRef')) {
        return makeProxy(value.__editorRemoteRef, value.path || [], value.kind || 'object');
      }
      if (Array.isArray(value)) return value.map(unpack);
      if (isPlainObject(value)) {
        const result = {};
        for (const key of Object.keys(value)) result[key] = unpack(value[key]);
        return result;
      }
      return value;
    }

    function request(operation) {
      if (closed) return Promise.reject(new Error('The remote bridge is closed.'));
      const id = nextRequestId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        try {
          port.postMessage({ protocol: PROTOCOL, type: 'request', id, operation: pack(operation) });
        } catch (error) {
          pending.delete(id);
          reject(error);
        }
      });
    }

    const referenceFinalizer = typeof FinalizationRegistry === 'function'
      ? new FinalizationRegistry(id => {
          const count = (remoteRefCounts.get(id) || 1) - 1;
          if (count <= 0) {
            remoteRefCounts.delete(id);
            request({op:'release', id}).catch(onError);
          } else {
            remoteRefCounts.set(id, count);
          }
        })
      : null;

    async function resolvePath(id, path) {
      let value = objects.get(id);
      if (value === undefined) throw new ReferenceError('Unknown remote object reference: ' + id);
      for (const key of path || []) {
        if (value == null) throw new TypeError('Cannot read ' + String(key) + ' from ' + value);
        value = value[key];
      }
      return value;
    }

    async function handleOperation(operation) {
      const op = operation?.op;
      const id = operation?.id;
      const path = Array.isArray(operation?.path) ? operation.path : [];
      if (op === 'release') {
        if (id !== 0) objects.delete(id);
        return true;
      }
      if (op === 'callRef') {
        const fn = objects.get(id);
        if (typeof fn !== 'function') throw new TypeError('Remote reference is not callable.');
        return await Reflect.apply(fn, undefined, unpack(operation.args || []));
      }
      if (op === 'call') {
        const fn = await resolvePath(id, path);
        if (typeof fn !== 'function') throw new TypeError('Remote property is not callable: ' + path.join('.'));
        const receiver = path.length ? await resolvePath(id, path.slice(0, -1)) : undefined;
        return await Reflect.apply(fn, receiver, unpack(operation.args || []));
      }
      if (op === 'construct') {
        const constructor = await resolvePath(id, path);
        if (typeof constructor !== 'function') throw new TypeError('Remote value is not constructable.');
        return Reflect.construct(constructor, unpack(operation.args || []));
      }
      if (op === 'get') return await resolvePath(id, path);
      if (op === 'set') {
        if (!path.length) throw new TypeError('Cannot replace a bridge root.');
        const receiver = await resolvePath(id, path.slice(0, -1));
        if (receiver == null) throw new TypeError('Cannot set a property on ' + receiver);
        receiver[path[path.length - 1]] = unpack(operation.value);
        return true;
      }
      if (op === 'delete') {
        if (!path.length) return false;
        const receiver = await resolvePath(id, path.slice(0, -1));
        if (receiver == null) return false;
        return Reflect.deleteProperty(receiver, path[path.length - 1]);
      }
      if (op === 'keys') {
        const value = await resolvePath(id, path);
        return Reflect.ownKeys(value).filter(key => typeof key === 'string');
      }
      if (op === 'has') {
        if (!path.length) return true;
        const receiver = await resolvePath(id, path.slice(0, -1));
        return receiver != null && path[path.length - 1] in Object(receiver);
      }
      throw new Error('Unsupported remote operation: ' + String(op));
    }

    function makeProxy(id, path, kind) {
      const target = kind === 'function' || path.length ? function remoteCallable() {} : {};
      const meta = { id, path: path.slice(), kind: kind || 'object' };
      const proxy = new Proxy(target, {
        get(localTarget, property) {
          if (property === 'then') return undefined;
          if (property === '__editorRemoteProxy') return meta;
          if (property === Symbol.toStringTag) return 'RemoteObject';
          if (property === 'toString') return () => '[Remote ' + meta.kind + ' ' + meta.id + ':' + meta.path.join('.') + ']';
          if (property === 'valueOf') return () => proxy;
          if (property === '$get') return key => request({op:'get', id, path:key === undefined ? path : path.concat(String(key))});
          if (property === '$set') return function(key, value) {
            const hasKey = arguments.length > 1;
            return request({op:'set', id, path:hasKey ? path.concat(String(key)) : path, value:pack(hasKey ? value : key)});
          };
          if (property === '$call') return (...args) => request({op:path.length ? 'call' : 'callRef', id, path, args:pack(args)});
          if (property === '$construct') return (...args) => request({op:'construct', id, path, args:pack(args)});
          if (property === '$keys') return () => request({op:'keys', id, path});
          if (property === '$has') return key => request({op:'has', id, path:path.concat(String(key))});
          if (property === '$delete') return key => request({op:'delete', id, path:path.concat(String(key))});
          if (typeof property === 'symbol') return undefined;
          if (Reflect.has(localTarget, property)) return Reflect.get(localTarget, property);
          return makeProxy(id, path.concat(String(property)), 'function');
        },
        set(localTarget, property, value) {
          if (typeof property === 'symbol') return false;
          request({op:'set', id, path:path.concat(String(property)), value:pack(value)}).catch(onError);
          return true;
        },
        deleteProperty(localTarget, property) {
          if (typeof property === 'symbol') return false;
          request({op:'delete', id, path:path.concat(String(property))}).catch(onError);
          return true;
        },
        has(localTarget, property) {
          return Reflect.has(localTarget, property) || property !== 'then';
        },
        ownKeys(localTarget) {
          return Reflect.ownKeys(localTarget);
        },
        getOwnPropertyDescriptor(localTarget, property) {
          return Reflect.getOwnPropertyDescriptor(localTarget, property);
        },
        apply(_target, _thisArg, args) {
          const operation = path.length ? {op:'call', id, path, args:pack(args)} : {op:'callRef', id, args:pack(args)};
          return request(operation);
        },
        construct(_target, args) {
          return request({op:'construct', id, path, args:pack(args)});
        }
      });
      proxyMetadata.set(proxy, meta);
      if (id !== 0 && referenceFinalizer) {
        remoteRefCounts.set(id, (remoteRefCounts.get(id) || 0) + 1);
        referenceFinalizer.register(proxy, id);
      }
      return proxy;
    }

    function onMessage(event) {
      const message = event?.data;
      if (!message || message.protocol !== PROTOCOL) return;

      if (message.type === 'response') {
        const item = pending.get(message.id);
        if (!item) return;
        pending.delete(message.id);
        if (message.ok) item.resolve(unpack(message.value));
        else item.reject(reviveError(message.error));
        return;
      }

      if (message.type === 'request') {
        Promise.resolve()
          .then(() => handleOperation(unpack(message.operation)))
          .then(value => port.postMessage({protocol:PROTOCOL,type:'response',id:message.id,ok:true,value:pack(value)}))
          .catch(error => port.postMessage({protocol:PROTOCOL,type:'response',id:message.id,ok:false,error:serializeError(error)}));
      }
    }

    port.addEventListener ? port.addEventListener('message', onMessage) : (port.onmessage = onMessage);
    if (port.start) port.start();

    const remote = makeProxy(0, [], 'object');
    return {
      remote,
      request,
      close() {
        if (closed) return;
        closed = true;
        for (const item of pending.values()) item.reject(new Error('The remote bridge was closed.'));
        pending.clear();
        objects.clear();
        remoteRefCounts.clear();
        try { port.close(); } catch (_) {}
      }
    };
  }

  function connect(targetWindow, options = {}) {
    if (!targetWindow || typeof targetWindow.postMessage !== 'function') {
      return Promise.reject(new TypeError('A target window is required.'));
    }
    const targetOrigin = String(options.targetOrigin || '');
    if (!targetOrigin || targetOrigin === '*') {
      return Promise.reject(new TypeError('A specific targetOrigin is required.'));
    }
    if (typeof MessageChannel !== 'function') {
      return Promise.reject(new Error('MessageChannel is not supported in this browser.'));
    }

    const channel = new MessageChannel();
    const bridge = createBridge(channel.port1, options.localObjects || {}, options);
    const timeout = Math.max(1000, Number(options.timeout) || 10000);

    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        bridge.close();
        reject(new Error('Timed out waiting for the remote editor bridge.'));
      }, timeout);

      channel.port1.addEventListener('message', function onReady(event) {
        if (event.data?.protocol !== PROTOCOL || event.data?.type !== 'ready') return;
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(bridge);
      });
      if (channel.port1.start) channel.port1.start();

      try {
        targetWindow.postMessage({
          protocol: PROTOCOL,
          type: 'connect',
          config: options.config || {}
        }, targetOrigin, [channel.port2]);
      } catch (error) {
        clearTimeout(timer);
        settled = true;
        bridge.close();
        reject(error);
      }
    });
  }

  function acceptParent() {
    // The same library is also loaded by the embedding page to create the
    // outgoing connection. Only an actual iframe needs the receiver side.
    if (global.parent === global) return;

    const bridgeConfigUrl = new URL('remote-bridge-config.json', global.document.currentScript?.src || global.location.href);
    const bridgeConfigReady = fetch(bridgeConfigUrl, {cache:'no-store'})
      .then(async response => {
        if (!response.ok) throw new Error('Remote bridge config request failed (' + response.status + ').');
        const config = await response.json();
        if (!config || !Array.isArray(config.allowedParentOrigins)) {
          throw new Error('Remote bridge config must define allowedParentOrigins.');
        }
        return config;
      })
      .catch(error => {
        console.error('[EditorRemoteBridge] Unable to load origin allowlist:', error);
        return {allowedParentOrigins:[]};
      });

    global.addEventListener('message', async event => {
      if (event.source !== global.parent || !event.ports?.[0]) return;
      if (event.data?.protocol !== PROTOCOL || event.data?.type !== 'connect') return;

      const config = await bridgeConfigReady;
      const allowedOrigins = new Set(config.allowedParentOrigins.map(value => {
        try { return new URL(value).origin; } catch (_) { return ''; }
      }).filter(Boolean));
      if (!allowedOrigins.has(event.origin)) {
        console.warn('[EditorRemoteBridge] Rejected an untrusted parent origin:', event.origin);
        event.ports[0].close();
        return;
      }

      const hostConfig = event.data.config || {};
      if (hostConfig.origin && hostConfig.origin !== event.origin) {
        console.warn('[EditorRemoteBridge] Rejected a mismatched host origin.');
        event.ports[0].close();
        return;
      }

      const integrationUrl = String(hostConfig.integrationUrl || '');
      if (integrationUrl) {
        let parsedIntegrationUrl;
        try { parsedIntegrationUrl = new URL(integrationUrl); } catch (_) {}
        if (!parsedIntegrationUrl || parsedIntegrationUrl.origin !== event.origin || !/^https?:$/.test(parsedIntegrationUrl.protocol)) {
          console.warn('[EditorRemoteBridge] Rejected an integration script outside the trusted parent origin.');
          event.ports[0].close();
          return;
        }
      }

      const port = event.ports[0];
      const bridge = createBridge(port, {Editor:global});
      global.EditorRemoteBridgeSession?.close?.();
      global.EditorRemoteBridgeSession = bridge;
      global.WKHost = bridge.remote.WKHost;
      global.WKHostConfig = hostConfig;
      port.postMessage({protocol:PROTOCOL,type:'ready'});
      global.dispatchEvent(new CustomEvent('editorhostready', {detail:{bridge,config:global.WKHostConfig}}));

      if (integrationUrl) {
        const script = global.document.createElement('script');
        script.src = integrationUrl;
        script.async = true;
        script.onload = () => global.dispatchEvent(new CustomEvent('wkintegrationloaded'));
        script.onerror = () => console.error('Unable to load the WatermelonKatana editor integration:', integrationUrl);
        global.document.head.appendChild(script);
      }
    });
  }

  global.EditorRemoteBridge = Object.freeze({connect, createBridge, acceptParent, protocol:PROTOCOL});
  acceptParent();
})(window);