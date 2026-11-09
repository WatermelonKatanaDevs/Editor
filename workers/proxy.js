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


const ISOLATE_ROUTE = "/isolate/";
const ISOLATION_POLICY = "isolate-and-credentialless";

function encodeIsolateOrigin(origin) {
  return btoa(origin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeIsolateOrigin(value) {
  let normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  const decoded = atob(normalized);
  const origin = new URL(decoded);
  if (origin.origin !== decoded || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("Invalid isolated proxy origin.");
  }
  return origin;
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

function isolatedProxyPath(target) {
  return ISOLATE_ROUTE + encodeIsolateOrigin(target.origin) + target.pathname + target.search + target.hash;
}

function rewriteIsolatedUrl(value, target) {
  const raw = String(value || "").trim();
  if (
    !raw ||
    raw.startsWith("#") ||
    /^(?:data:|blob:|javascript:|mailto:|tel:|about:)/i.test(raw) ||
    raw.startsWith("/isolate/")
  ) return value;

  try {
    const resolved = new URL(raw, target);
    if (resolved.origin !== target.origin) return value;
    return ISOLATE_ROUTE + encodeIsolateOrigin(resolved.origin) + resolved.pathname + resolved.search + resolved.hash;
  } catch (_) {
    return value;
  }
}

function rewriteIsolatedHtml(source, target) {
  const basePath = new URL(".", target).pathname;
  const baseHref = ISOLATE_ROUTE + encodeIsolateOrigin(target.origin) + basePath;

  let output = source.replace(
    /\b(src|href|action|poster|data|formaction|cite|manifest|xlink:href|background)\s*=\s*(["'])(.*?)\2/gi,
    (match, name, quote, value) => name + "=" + quote + rewriteIsolatedUrl(value, target) + quote
  );

  output = output.replace(/\bsrcset\s*=\s*(["'])(.*?)\1/gi, (match, quote, value) => {
    if (/^\s*data:/i.test(value)) return match;
    const rewritten = value.split(",").map(candidate => {
      const parts = candidate.trim().split(/\s+/, 2);
      parts[0] = rewriteIsolatedUrl(parts[0], target);
      return parts.join(" ");
    }).join(", ");
    return "srcset=" + quote + rewritten + quote;
  });

  const baseTag = '<base href="' + baseHref + '">';
  if (/<base\b[^>]*>/i.test(output)) {
    output = output.replace(/<base\b[^>]*>/i, tag => {
      if (/\bhref\s*=/i.test(tag)) return tag.replace(/\bhref\s*=\s*(["']).*?\1/i, 'href="' + baseHref + '"');
      return tag.replace(/>$/, ' href="' + baseHref + '">');
    });
  } else if (/<head\b[^>]*>/i.test(output)) {
    output = output.replace(/<head\b[^>]*>/i, tag => tag + baseTag);
  } else {
    output = baseTag + output;
  }

  // Inline scripts and JSON configuration often contain root-relative asset paths.
  output = output.replace(/(["'])((?:https?:\/\/[^"'\s<>]+)|\/(?!\/)[^"'\s<>]+)\1/g,
    (match, quote, value) => quote + rewriteIsolatedUrl(value, target) + quote);
  return output;
}

function rewriteIsolatedCss(source, target) {
  let output = source.replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi,
    (match, quote, value) => "url(" + quote + rewriteIsolatedUrl(value, target) + quote + ")");
  output = output.replace(/@import\s+(["'])(.*?)\1/gi,
    (match, quote, value) => "@import " + quote + rewriteIsolatedUrl(value, target) + quote);
  return output;
}

function rewriteIsolatedScript(source, target) {
  return source.replace(/(["'])((?:https?:\/\/[^"'\s<>]+)|\/(?!\/)[^"'\s<>]+)\1/g,
    (match, quote, value) => quote + rewriteIsolatedUrl(value, target) + quote);
}

async function handleIsolatedProxy(request, requestUrl) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "*",
    "Access-Control-Max-Age": "86400"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, {status:204, headers:corsHeaders});
  }

  let target;
  try {
    if (requestUrl.pathname === "/isolate") {
      const rawUrl = requestUrl.searchParams.get("url");
      if (!rawUrl) return new Response("Missing url parameter.", {status:400, headers:corsHeaders});
      target = new URL(rawUrl);
      validateIsolatedTarget(target, requestUrl.origin);
      const destination = new URL(isolatedProxyPath(target), requestUrl.origin);
      return Response.redirect(destination.href, 307);
    }

    const route = requestUrl.pathname.slice(ISOLATE_ROUTE.length);
    const separator = route.indexOf("/");
    const encodedOrigin = separator < 0 ? route : route.slice(0, separator);
    const path = separator < 0 ? "/" : route.slice(separator) || "/";
    const origin = decodeIsolateOrigin(encodedOrigin);
    target = new URL(path + requestUrl.search, origin);
    validateIsolatedTarget(target, requestUrl.origin);
  } catch (error) {
    return new Response(error.message || "Invalid isolated proxy URL.", {status:400, headers:corsHeaders});
  }

  const upstreamHeaders = new Headers(request.headers);
  [
    "host", "cookie", "cookie2", "authorization", "proxy-authorization",
    "origin", "referer", "content-length",
    "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest", "sec-fetch-user",
    "cf-connecting-ip", "cf-ray", "cf-visitor", "cf-ipcountry", "cf-worker",
    "x-forwarded-for", "x-forwarded-proto", "x-real-ip"
  ].forEach(name => upstreamHeaders.delete(name));

  const init = {
    method:request.method,
    headers:upstreamHeaders,
    redirect:"manual"
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream;
  try {
    upstream = await fetch(target.href, init);
  } catch (error) {
    return new Response("Isolated proxy fetch failed: " + (error.message || String(error)), {status:502, headers:corsHeaders});
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
      validateIsolatedTarget(redirectedTarget, requestUrl.origin);
      responseHeaders.set("Location", isolatedProxyPath(redirectedTarget));
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
      source = rewriteIsolatedHtml(source, target);
      responseHeaders.set("Document-Isolation-Policy", ISOLATION_POLICY);
    } else if (isCss) {
      source = rewriteIsolatedCss(source, target);
    } else {
      source = rewriteIsolatedScript(source, target);
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

export default {

  async fetch(request, env) {
    const routeUrl = new URL(request.url);
    if (routeUrl.pathname === "/isolate" || routeUrl.pathname.startsWith("/isolate/")) {
      return handleIsolatedProxy(request, routeUrl);
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