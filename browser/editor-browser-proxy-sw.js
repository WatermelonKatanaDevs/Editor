/*
 * Editor Browser Proxy extension
 *
 * This service worker is intentionally message-driven. It does not intercept
 * the browser's fetch event or participate in the Editor Network endpoint
 * chain. Emulated pages send cross-origin fetch requests here explicitly.
 */

const activeRequests = new Map();

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

function encodeBase64Url(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeProxyUrl(endpoint, targetUrl, obscureUrl) {
  const proxyUrl = new URL(endpoint, self.registration.scope);
  if (obscureUrl) {
    proxyUrl.searchParams.set('base64_url', encodeBase64Url(targetUrl));
  } else {
    proxyUrl.searchParams.set('url', targetUrl);
  }
  return proxyUrl.href;
}

async function proxyRequest(data, signal) {
  const targetUrl = new URL(String(data.url || ''));
  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
    throw new TypeError('Only HTTP and HTTPS URLs can be proxied.');
  }

  const endpoints = [data.proxy];
  if (data.useFallback && data.fallbackProxy) endpoints.push(data.fallbackProxy);
  const uniqueEndpoints = [...new Set(endpoints.map(value => String(value || '').trim()).filter(Boolean))];
  if (!uniqueEndpoints.length) {
    throw new Error('Set a CORS Worker Proxy Gateway URL in Proxy Configuration first.');
  }

  const headers = new Headers(Array.isArray(data.headers) ? data.headers : []);
  [
    'host',
    'origin',
    'referer',
    'content-length',
    'sec-fetch-site',
    'sec-fetch-mode',
    'sec-fetch-dest',
    'sec-fetch-user'
  ].forEach(name => headers.delete(name));

  const method = String(data.method || 'GET').toUpperCase();
  const bodyAllowed = method !== 'GET' && method !== 'HEAD';
  let firstResponse = null;
  let lastError = null;

  for (const endpoint of uniqueEndpoints) {
    if (signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
    try {
      const response = await fetch(makeProxyUrl(endpoint, targetUrl.href, !!data.obscureURL), {
        method,
        headers,
        body: bodyAllowed && data.body ? data.body.slice(0) : undefined,
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'follow',
        signal
      });
      if (!firstResponse) firstResponse = response;
      if (response.ok) return response;
    } catch (error) {
      if (signal.aborted) throw error;
      lastError = error;
    }
  }

  if (firstResponse) return firstResponse;
  throw lastError || new Error('Every configured proxy endpoint failed.');
}

self.addEventListener('message', event => {
  const data = event.data || {};

  if (data.type === 'EDITOR_BROWSER_PROXY_ABORT') {
    activeRequests.get(String(data.id || ''))?.abort();
    return;
  }

  if (data.type !== 'EDITOR_BROWSER_PROXY_FETCH') return;
  const port = event.ports && event.ports[0];
  if (!port) return;

  const id = String(data.id || '');
  const controller = new AbortController();
  if (id) activeRequests.set(id, controller);

  const task = (async () => {
    try {
      const response = await proxyRequest(data, controller.signal);
      const body = response.body === null ? null : await response.arrayBuffer();
      const responseHeaders = Array.from(response.headers.entries()).filter(([name]) => {
        return !['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'set-cookie'].includes(name.toLowerCase());
      });

      const message = {
        ok: true,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body
      };
      if (body instanceof ArrayBuffer) port.postMessage(message, [body]);
      else port.postMessage(message);
    } catch (error) {
      try {
        port.postMessage({
          ok: false,
          error: error && error.message ? error.message : String(error || 'Proxy request failed')
        });
      } catch (_) {}
    } finally {
      if (id) activeRequests.delete(id);
      try { port.close(); } catch (_) {}
    }
  })();

  event.waitUntil(task);
});
