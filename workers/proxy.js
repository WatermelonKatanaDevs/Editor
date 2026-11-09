// ============================================================
// CONFIGURATION
// ============================================================


// Enable/disable Corsfix fallback.
const USE_CORSFIX_FALLBACK = true;

// Corsfix endpoint.
const CORSFIX_PROXY = "https://proxy.corsfix.com/?";

// HTTP statuses where we should try Corsfix instead.
const CORSFIX_RETRY_STATUSES = new Set([
  403,
  408,
  419,
  429,
  500,
  502,
  503,
  504
]);


// ============================================================
// WORKER
// ============================================================


const ISOLATION_ROUTE = "/isolation/";
const ISOLATED_ASSET_ORIGIN = "https://assets.opendaw.studio";
const ISOLATION_POLICY = "isolate-and-credentialless";
const ISOLATION_SESSION_TTL = 86400;

function isolationCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "*",
    "Access-Control-Max-Age": "86400"
  };
}

function isolationJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...isolationCorsHeaders(),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function validateIsolatedTarget(target, workerOrigin) {
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs can be isolated.");
  }
  if (target.username || target.password) throw new Error("URLs containing credentials are not allowed.");
  if (target.origin === workerOrigin) throw new Error("The isolation proxy cannot proxy itself.");

  const hostname = target.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname.includes(".") && !hostname.includes(":")) {
    throw new Error("Single-label and local network hosts are not allowed.");
  }
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    hostname.endsWith(".home") ||
    hostname.endsWith(".intranet")
  ) {
    throw new Error("Private and local network hosts are not allowed.");
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    const octets = hostname.split(".").map(Number);
    if (octets.some(value => value < 0 || value > 255)) throw new Error("Invalid IP address.");
    const [a, b] = octets;
    if (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 192 && b === 0) ||
      (a === 198 && b === 51 && octets[2] === 100) ||
      (a === 203 && b === 0 && octets[2] === 113)
    ) {
      throw new Error("Private, reserved, and loopback IP addresses are not allowed.");
    }
  }

  if (hostname.includes(":")) {
    if (
      hostname === "::" ||
      hostname === "::1" ||
      /^f[cd]/i.test(hostname) ||
      /^fe[89ab]/i.test(hostname) ||
      /^::ffff:(?:127\.|10\.|192\.168\.|169\.254\.)/i.test(hostname)
    ) {
      throw new Error("Private, reserved, and loopback IP addresses are not allowed.");
    }
  }

  if (target.port && !["80", "443", "8080", "8443"].includes(target.port)) {
    throw new Error("This destination port is not allowed.");
  }
}

function validateIsolationId(id) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(String(id || ""));
}

function isolationAssetPath(id, relativePath, search = "") {
  const path = String(relativePath || "").replace(/^\/+/, "");
  return ISOLATION_ROUTE + encodeURIComponent(id) + "/" + path + search;
}

function getIsolatedTargetUrl(value, base, sessionId) {
  const raw = String(value || "").trim();
  if (
    !raw ||
    raw.startsWith("#") ||
    /^(?:data:|blob:|javascript:|mailto:|tel:|about:)/i.test(raw) ||
    raw.startsWith(ISOLATION_ROUTE)
  ) return value;

  try {
    const resolved = new URL(raw, base);
    if (resolved.origin === ISOLATED_ASSET_ORIGIN) {
      const assetPath = resolved.pathname.slice(1);
      return isolationAssetPath(sessionId, "__opendaw_assets/" + assetPath, resolved.search) + resolved.hash;
    }
    if (resolved.origin !== base.origin || !resolved.pathname.startsWith(base.pathname)) return value;
    const relative = resolved.pathname.slice(base.pathname.length);
    return isolationAssetPath(sessionId, relative, resolved.search) + resolved.hash;
  } catch (_) {
    return value;
  }
}

function rewriteIsolatedHtml(source, base, sessionId) {
  const rootPath = ISOLATION_ROUTE + encodeURIComponent(sessionId) + "/";
  let output = source.replace(
    /\b(src|href|action|poster|data|formaction|cite|manifest|xlink:href|background)\s*=\s*(["'])(.*?)\2/gi,
    (match, name, quote, value) => name + "=" + quote + getIsolatedTargetUrl(value, base, sessionId) + quote
  );

  output = output.replace(/\bsrcset\s*=\s*(["'])(.*?)\1/gi, (match, quote, value) => {
    if (/^\s*data:/i.test(value)) return match;
    const rewritten = value.split(",").map(candidate => {
      const parts = candidate.trim().split(/\s+/, 2);
      parts[0] = getIsolatedTargetUrl(parts[0], base, sessionId);
      return parts.join(" ");
    }).join(", ");
    return "srcset=" + quote + rewritten + quote;
  });

  const baseTag = '<base href="' + rootPath + '">';
  if (/<base\b[^>]*>/i.test(output)) {
    output = output.replace(/<base\b[^>]*>/i, tag => {
      if (/\bhref\s*=/i.test(tag)) return tag.replace(/\bhref\s*=\s*(["']).*?\1/i, 'href="' + rootPath + '"');
      return tag.replace(/>$/, ' href="' + rootPath + '">');
    });
  } else if (/<head\b[^>]*>/i.test(output)) {
    output = output.replace(/<head\b[^>]*>/i, tag => tag + baseTag);
  } else {
    output = baseTag + output;
  }

  output = output.replace(/(["'])((?:https?:\/\/[^"'\s<>]+)|\/(?!\/)[^"'\s<>]+)\1/g,
    (match, quote, value) => quote + getIsolatedTargetUrl(value, base, sessionId) + quote);
  return output;
}

function rewriteIsolatedCss(source, base, sessionId) {
  const rewriteAbsolute = value => {
    const raw = String(value || "").trim();
    if (!raw.startsWith("/") && !/^https?:\/\//i.test(raw)) return value;
    return getIsolatedTargetUrl(raw, base, sessionId);
  };
  let output = source.replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi,
    (match, quote, value) => "url(" + quote + rewriteAbsolute(value) + quote + ")");
  output = output.replace(/@import\s+(["'])(.*?)\1/gi,
    (match, quote, value) => "@import " + quote + rewriteAbsolute(value) + quote);
  return output;
}

function rewriteIsolatedScript(source, base, sessionId) {
  return source.replace(/(["'])((?:https?:\/\/[^"'\s<>]+)|\/(?!\/)[^"'\s<>]+)\1/g,
    (match, quote, value) => quote + getIsolatedTargetUrl(value, base, sessionId) + quote);
}

async function handleIsolationSetup(requestUrl, env) {
  const corsHeaders = isolationCorsHeaders();
  const rawUrl = requestUrl.searchParams.get("url");
  const id = requestUrl.searchParams.get("id");
  if (!rawUrl) return isolationJson({error:"Missing url parameter."}, 400);
  if (!validateIsolationId(id)) return isolationJson({error:"Missing or invalid isolation id."}, 400);
  if (!env?.ISOLATION_SESSIONS) {
    return isolationJson({error:"The Worker is missing its ISOLATION_SESSIONS KV binding."}, 503);
  }

  let base;
  try {
    base = new URL(rawUrl);
    validateIsolatedTarget(base, requestUrl.origin);
    base.hash = "";
    if (!base.pathname.endsWith("/")) base.pathname += "/";
  } catch (error) {
    return isolationJson({error:error.message || "Invalid isolation URL."}, 400);
  }

  try {
    await env.ISOLATION_SESSIONS.put("isolation:" + id, JSON.stringify({
      baseUrl:base.href,
      origin:base.origin,
      basePath:base.pathname,
      createdAt:Date.now()
    }), {expirationTtl:ISOLATION_SESSION_TTL});
  } catch (error) {
    return isolationJson({error:"Could not save the isolation session: " + (error.message || String(error))}, 500);
  }

  return isolationJson({
    ok:true,
    id,
    url:requestUrl.origin + ISOLATION_ROUTE + encodeURIComponent(id) + "/",
    expiresIn:ISOLATION_SESSION_TTL
  }, 201);
}

async function handleIsolationAsset(request, requestUrl, env) {
  const corsHeaders = isolationCorsHeaders();
  if (request.method === "OPTIONS") return new Response(null, {status:204, headers:corsHeaders});
  if (!["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    return new Response("Method not allowed.", {status:405, headers:corsHeaders});
  }
  if (!env?.ISOLATION_SESSIONS) {
    return new Response("The Worker is missing its ISOLATION_SESSIONS KV binding.", {status:503, headers:corsHeaders});
  }

  const route = requestUrl.pathname.slice(ISOLATION_ROUTE.length);
  const slash = route.indexOf("/");
  const id = slash < 0 ? route : route.slice(0, slash);
  const relativePath = slash < 0 ? "" : route.slice(slash + 1);
  if (!validateIsolationId(id)) return new Response("Invalid isolation id.", {status:400, headers:corsHeaders});

  let session;
  try {
    session = await env.ISOLATION_SESSIONS.get("isolation:" + id, {type:"json"});
  } catch (error) {
    return new Response("Could not read the isolation session: " + (error.message || String(error)), {status:500, headers:corsHeaders});
  }
  if (!session?.baseUrl || !session?.basePath) {
    return new Response("This isolation session does not exist or has expired. Reopen the isolated document.", {status:404, headers:corsHeaders});
  }

  let base;
  let target;
  const isOpenDawAsset = relativePath.startsWith("__opendaw_assets/");
  try {
    base = new URL(session.baseUrl);
    if (isOpenDawAsset) {
      if (request.method !== "GET" && request.method !== "HEAD") throw new Error("Only GET and HEAD are allowed for openDAW assets.");
      target = new URL(relativePath.slice("__opendaw_assets/".length), ISOLATED_ASSET_ORIGIN + "/");
      if (target.origin !== ISOLATED_ASSET_ORIGIN) throw new Error("Invalid openDAW asset path.");
    } else {
      target = relativePath ? new URL(relativePath, base) : base;
      if (target.origin !== session.origin || !target.pathname.startsWith(session.basePath)) {
        throw new Error("The requested path is outside this isolation session's base directory.");
      }
    }
    if (requestUrl.search) target.search = requestUrl.search;
    validateIsolatedTarget(target, requestUrl.origin);
  } catch (error) {
    return new Response(error.message || "Invalid isolated asset path.", {status:403, headers:corsHeaders});
  }

  const upstreamHeaders = new Headers(request.headers);
  [
    "host", "cookie", "cookie2", "authorization", "proxy-authorization",
    "origin", "referer", "content-length",
    "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest", "sec-fetch-user",
    "cf-connecting-ip", "cf-ray", "cf-visitor", "cf-ipcountry", "cf-worker",
    "x-forwarded-for", "x-forwarded-proto", "x-real-ip"
  ].forEach(name => upstreamHeaders.delete(name));

  if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
    upstreamHeaders.set("Origin", target.origin);
    try {
      return await fetch(target.href, {method:"GET", headers:upstreamHeaders});
    } catch (error) {
      return new Response("Isolated proxy WebSocket failed: " + (error.message || String(error)), {status:502, headers:corsHeaders});
    }
  }

  const init = {
    method:request.method,
    headers:upstreamHeaders,
    redirect:"manual"
  };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = await request.arrayBuffer();

  let upstream;
  try {
    upstream = await fetch(target.href, init);
  } catch (error) {
    return new Response("Isolated proxy fetch failed: " + (error.message || String(error)), {status:502, headers:corsHeaders});
  }

  // openDAW uses client-side routes. If an extensionless route is reloaded,
  // serve the Studio app shell instead of returning a static-host 404.
  if (!isOpenDawAsset && upstream.status === 404 && request.method === "GET" && relativePath && !relativePath.split("/").pop().includes(".")) {
    try {
      target = new URL(base.href);
      upstream = await fetch(target.href, {...init, body:undefined});
    } catch (error) {
      return new Response("Could not load the openDAW app shell: " + (error.message || String(error)), {status:502, headers:corsHeaders});
    }
  }

  const responseHeaders = new Headers(upstream.headers);
  for (const name of [
    "set-cookie", "set-cookie2", "content-length", "content-encoding", "content-md5",
    "cross-origin-embedder-policy", "cross-origin-opener-policy",
    "cross-origin-embedder-policy-report-only", "cross-origin-opener-policy-report-only"
  ]) responseHeaders.delete(name);

  const location = upstream.headers.get("Location");
  if (location && upstream.status >= 300 && upstream.status < 400) {
    try {
      const redirectedTarget = new URL(location, target);
      if (isOpenDawAsset && redirectedTarget.origin === ISOLATED_ASSET_ORIGIN) {
        responseHeaders.set("Location", isolationAssetPath(id, "__opendaw_assets/" + redirectedTarget.pathname.slice(1), redirectedTarget.search) + redirectedTarget.hash);
      } else if (redirectedTarget.origin === base.origin && redirectedTarget.pathname.startsWith(session.basePath)) {
        const redirectedPath = redirectedTarget.pathname.slice(session.basePath.length);
        responseHeaders.set("Location", isolationAssetPath(id, redirectedPath, redirectedTarget.search) + redirectedTarget.hash);
      } else {
        validateIsolatedTarget(redirectedTarget, requestUrl.origin);
        responseHeaders.set("Location", redirectedTarget.href);
      }
    } catch (error) {
      return new Response("Blocked upstream redirect: " + (error.message || String(error)), {status:502, headers:corsHeaders});
    }
    for (const [name, value] of Object.entries(corsHeaders)) responseHeaders.set(name, value);
    return new Response(null, {status:upstream.status, statusText:upstream.statusText, headers:responseHeaders});
  }

  const contentType = (responseHeaders.get("content-type") || "").toLowerCase();
  const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
  const isCss = contentType.includes("text/css");
  const isScript = contentType.includes("javascript") || contentType.includes("ecmascript");
  let body = upstream.body;

  if (isHtml || isCss || isScript) {
    let source = await upstream.text();
    if (isHtml) {
      source = rewriteIsolatedHtml(source, base, id);
      responseHeaders.set("Document-Isolation-Policy", ISOLATION_POLICY);
    } else if (isCss) {
      source = rewriteIsolatedCss(source, base, id);
    } else {
      source = rewriteIsolatedScript(source, base, id);
    }
    body = source;
    responseHeaders.delete("etag");
    responseHeaders.delete("last-modified");
  }

  for (const [name, value] of Object.entries(corsHeaders)) responseHeaders.set(name, value);
  return new Response(body, {
    status:upstream.status,
    statusText:upstream.statusText,
    headers:responseHeaders
  });
}

async function handleIsolationRequest(request, requestUrl, env) {
  if (request.method === "OPTIONS") return new Response(null, {status:204, headers:isolationCorsHeaders()});
  if (requestUrl.pathname === "/isolate") {
    if (request.method !== "GET") return new Response("Method not allowed.", {status:405, headers:isolationCorsHeaders()});
    return handleIsolationSetup(requestUrl, env);
  }
  return handleIsolationAsset(request, requestUrl, env);
}

export default {

  async fetch(request, env) {
    const routeUrl = new URL(request.url);
    if (routeUrl.pathname === "/isolate" || routeUrl.pathname.startsWith("/isolation/")) {
      return handleIsolationRequest(request, routeUrl, env);
    }


    // ========================================================
    // CORS HEADERS
    // ========================================================

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods":
        "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Expose-Headers": "*",
      "Access-Control-Max-Age": "86400"
    };


    // ========================================================
    // CORS PREFLIGHT
    // ========================================================

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }


    // ========================================================
    // 1. GET AND DECODE TARGET URL
    // ========================================================

    const url = new URL(request.url);

    let targetUrl = url.searchParams.get("url");

    const base64Param =
      url.searchParams.get("base64_url");


    // --------------------------------------------------------
    // Decode URL-safe Base64
    // --------------------------------------------------------

    if (!targetUrl && base64Param) {

      try {

        let normalizedBase64 = base64Param
          .replace(/-/g, "+")
          .replace(/_/g, "/");


        // Restore Base64 padding
        while (normalizedBase64.length % 4) {
          normalizedBase64 += "=";
        }


        // Decode Base64
        const decodedBinary =
          atob(normalizedBase64);


        // Decode UTF-8 safely
        const bytes = Uint8Array.from(
          decodedBinary,
          c => c.charCodeAt(0)
        );

        targetUrl =
          new TextDecoder().decode(bytes);

      } catch (e) {

        return new Response(
          "Invalid base64 encoding",
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }
    }


    // ========================================================
    // TARGET URL REQUIRED
    // ========================================================

    if (!targetUrl) {

      return new Response(
        "Missing url or base64_url parameter",
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }


    // ========================================================
    // 2. VALIDATE TARGET URL
    // ========================================================

    let target;

    try {

      target = new URL(targetUrl);

      if (
        target.protocol !== "http:" &&
        target.protocol !== "https:"
      ) {

        return new Response(
          "Invalid target protocol",
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

    } catch (e) {

      return new Response(
        "Invalid target URL",
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }


    // ========================================================
    // 3. CLONE INCOMING REQUEST HEADERS
    // ========================================================

    const newHeaders = new Headers(request.headers);

    [
      "host",
      "origin",
      "referer",

      // Browser request context
      "sec-fetch-site",
      "sec-fetch-mode",
      "sec-fetch-dest",
      "sec-fetch-user",

      // Cloudflare
      "cf-connecting-ip",
      "cf-ray",
      "cf-visitor",
      "cf-ipcountry",
      "cf-worker",

      // Proxy chain
      "x-forwarded-for",
      "x-forwarded-proto",
      "x-real-ip"
    ].forEach(h => newHeaders.delete(h));

    // A page cannot reliably set the forbidden User-Agent header in Fetch.
    // The editor carries its selected identity in this ordinary header.
    // Apply it here before making the upstream request.
    const emulatedUserAgent = newHeaders.get("x-wk-emulated-user-agent");
    newHeaders.delete("x-wk-emulated-user-agent");

    const isMobileEmulation =
      typeof emulatedUserAgent === "string" &&
      emulatedUserAgent.length <= 512 &&
      /\b(?:Android|iPhone|iPad|iPod|Mobile)\b/i.test(emulatedUserAgent);

    if (isMobileEmulation) {
      newHeaders.set("user-agent", emulatedUserAgent);

      // Do not mix the host browser's desktop Client Hints into a mobile UA.
      // Chromium Android receives a matching mobile hint set; iOS Safari
      // does not advertise Chromium Client Hints.
      for (const name of Array.from(newHeaders.keys())) {
        if (name.toLowerCase().startsWith("sec-ch-ua")) {
          newHeaders.delete(name);
        }
      }

      const isAndroid = emulatedUserAgent.includes("Android");
      const isChromium = emulatedUserAgent.includes("Chrome/");
      if (isAndroid && isChromium) {
        const platformVersion = emulatedUserAgent.includes("Android 14")
          ? "14.0.0"
          : emulatedUserAgent.includes("Android 10")
            ? "10.0.0"
            : "14.0.0";

        newHeaders.set("sec-ch-ua", '"Chromium";v="120", "Google Chrome";v="120", "Not_A Brand";v="99"');
        newHeaders.set("sec-ch-ua-mobile", "?1");
        newHeaders.set("sec-ch-ua-platform", '"Android"');
        newHeaders.set("sec-ch-ua-platform-version", '"' + platformVersion + '"');
        if (emulatedUserAgent.includes("Pixel 7")) {
          newHeaders.set("sec-ch-ua-model", '"Pixel 7"');
        }
      }
    }

    // Use a desktop default only when no emulation identity was supplied.
    if (!newHeaders.has("user-agent")) {
      newHeaders.set(
        "user-agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/141.0.0.0 Safari/537.36"
      );
    }


    // ========================================================
    // 6. WEBSOCKET
    // ========================================================

    const isWebSocket =
      request.headers.get("Upgrade")?.toLowerCase() ===
      "websocket";


    if (isWebSocket) {

      try {

        return await fetch(target.toString(), {

          method: request.method,

          headers: newHeaders

        });

      } catch (err) {

        return new Response(
          `WebSocket Proxy Error: ${err.message}`,
          {
            status: 502,
            headers: corsHeaders
          }
        );
      }
    }


    // ========================================================
    // 7. PREPARE NORMAL HTTP REQUEST
    // ========================================================

    const init = {

      method: request.method,

      headers: newHeaders,

      redirect: "follow"
    };


    // --------------------------------------------------------
    // Forward request body
    // --------------------------------------------------------

    if (
      request.method !== "GET" &&
      request.method !== "HEAD"
    ) {

      init.body =
        await request.arrayBuffer();
    }


    // ========================================================
    // 8. DIRECT TARGET FETCH
    // ========================================================

    let response;

    let directFetchFailed = false;


    try {

      response =
        await fetch(target.toString(), init);

    } catch (err) {

      directFetchFailed = true;

      response = null;
    }


    // ========================================================
    // 9. CORSFIX FALLBACK
    // ========================================================

    const shouldUseCorsfix =
      USE_CORSFIX_FALLBACK &&
      (
        directFetchFailed ||
        (
          response &&
          CORSFIX_RETRY_STATUSES.has(
            response.status
          )
        )
      );


    if (shouldUseCorsfix) {

      try {

        // ----------------------------------------------------
        // Corsfix URL
        //
        // Example:
        //
        // https://proxy.corsfix.com/?https://example.com
        // ----------------------------------------------------

        const corsfixUrl =
          CORSFIX_PROXY +
          target.toString();


        // ----------------------------------------------------
        // IMPORTANT:
        //
        // We need a fresh body because the original
        // request body may already have been consumed
        // by the direct fetch.
        // ----------------------------------------------------

        let corsfixBody = undefined;

        if (
          request.method !== "GET" &&
          request.method !== "HEAD"
        ) {

          corsfixBody =
            await request.clone().arrayBuffer();
        }


        // ----------------------------------------------------
        // Build Corsfix headers
        // ----------------------------------------------------

        const corsfixHeaders =
          new Headers(newHeaders);


        // Add Corsfix API key if configured.
        if (env.CORSFIX_API_KEY) {

          corsfixHeaders.set(
            "x-corsfix-key",
            env.CORSFIX_API_KEY
          );
        }


        // ----------------------------------------------------
        // Fetch through Corsfix
        // ----------------------------------------------------

        const corsfixResponse =
          await fetch(corsfixUrl, {

            method: request.method,

            headers: corsfixHeaders,

            body: corsfixBody,

            redirect: "follow"
          });

          console.log(corsfixUrl);


        // Use Corsfix response if it worked,
        // or if the direct request never worked.
        if (
          corsfixResponse.ok ||
          directFetchFailed
        ) {

          response = corsfixResponse;
        }

      } catch (err) {

        // If Corsfix itself fails and we have a
        // direct response, keep the direct response.

        if (!response) {

          return new Response(
            `Proxy Error: ${err.message}`,
            {
              status: 502,
              headers: corsHeaders
            }
          );
        }
      }
    }


    // ========================================================
    // 10. IF NOTHING WORKED
    // ========================================================

    if (!response) {

      return new Response(
        "Proxy request failed",
        {
          status: 502,
          headers: corsHeaders
        }
      );
    }


    // ========================================================
    // 11. COPY RESPONSE HEADERS
    // ========================================================

    const responseHeaders =
      new Headers();


    for (const [key, value] of response.headers) {

      const lower =
        key.toLowerCase();


      // Remove upstream CORS headers.
      // We provide our own below.

      if (
        lower ===
          "access-control-allow-origin" ||

        lower ===
          "access-control-allow-credentials" ||

        lower ===
          "access-control-allow-methods" ||

        lower ===
          "access-control-allow-headers" ||

        lower ===
          "access-control-expose-headers" ||

        lower ===
          "access-control-max-age"
      ) {

        continue;
      }


      responseHeaders.set(
        key,
        value
      );
    }


    // ========================================================
    // 12. ADD OUR CORS HEADERS
    // ========================================================

    for (
      const [key, value]
      of Object.entries(corsHeaders)
    ) {

      responseHeaders.set(
        key,
        value
      );
    }


    // ========================================================
    // 13. RETURN RESPONSE
    // ========================================================

    return new Response(
      response.body,
      {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      }
    );
  }
};