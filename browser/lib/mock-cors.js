/*
 * Mock CORS for the WatermelonKatana browser emulator.
 * This models browser CORS behavior for project development; it is not a
 * security boundary and does not remove the emulator's relaxed networking.
 */
(function (global) {
  const SAFE_METHODS = new Set(["GET", "HEAD", "POST"]);
  const SAFE_HEADERS = new Set(["accept", "accept-language", "content-language", "content-type", "range"]);
  const EXPOSED_HEADERS = new Set(["cache-control", "content-language", "content-length", "content-type", "expires", "last-modified", "pragma"]);
  const INTERNAL_HEADERS = new Set(["x-wk-cors-metadata", "x-final-url"]);
  const PREFLIGHT_CACHE = new Map();
  const MAX_CACHE_SECONDS = 7200;

  function originOf(value) {
    if (!value) return null;
    if (value === "null") return "null";
    try { return new URL(String(value)).origin; } catch (_) { return null; }
  }
  function getHeader(headers, name) {
    if (!headers || typeof headers.get !== "function") return null;
    const lower = String(name).toLowerCase();
    if (headers.get("x-wk-cors-metadata") === "upstream") return headers.get("x-wk-upstream-" + lower);
    return headers.get(lower);
  }
  function inferMode(type, options = {}) {
    if (options && ["cors", "no-cors", "same-origin", "navigate"].includes(options.mode)) return options.mode;
    const name = String(type || "").toLowerCase();
    if (["fetch", "xhr", "import", "module", "worker-fetch", "module-script"].includes(name)) return "cors";
    if (["page-load", "iframe", "embed", "navigation", "download", "favicon", "cors-preflight"].includes(name)) return "navigate";
    return "no-cors";
  }
  function getPolicy(request, type, initiatorOrigin) {
    let target = null, targetUrl = null, protocol = "";
    try { const url = new URL(request.url); target = url.origin; targetUrl = url.href.split("#", 1)[0]; protocol = url.protocol; } catch (_) {}
    const origin = originOf(initiatorOrigin);
    const credentials = request.credentials || "same-origin";
    return {
      origin, targetOrigin:target, targetUrl,
      mode:request.__wkCorsMode || inferMode(type, request),
      credentials, credentialed:credentials === "include",
      crossOrigin:!!origin && !!target && ["http:","https:"].includes(protocol) && origin !== target,
      requestType:String(type || "")
    };
  }
  function isSafelistedHeader(name, value) {
    const lower=String(name).toLowerCase(), text=String(value || "");
    if (!SAFE_HEADERS.has(lower) || /[\x00-\x08\x0a-\x1f\x7f]/.test(text) || text.length>128) return false;
    if (lower==="content-type") return ["application/x-www-form-urlencoded","multipart/form-data","text/plain"].includes(text.split(";",1)[0].trim().toLowerCase());
    if (lower==="range") return /^bytes=\d+-\d*$/.test(text);
    if (lower==="accept" && /[\x00-\x08\x0a-\x1f\x7f"():<>?@[\]{}]/.test(text)) return false;
    return true;
  }
  function requestHeaders(request) {
    const out=[], headers=request && request.headers;
    if (headers && typeof headers.forEach==="function") headers.forEach((v,k)=>out.push([String(k).toLowerCase(),String(v)]));
    else if (headers && typeof headers==="object") Object.entries(headers).forEach(([k,v])=>out.push([k.toLowerCase(),String(v)]));
    return out;
  }
  function unsafeHeaderNames(request) {
    return requestHeaders(request).filter(([k,v])=>!isSafelistedHeader(k,v)).map(([k])=>k).filter((k,i,a)=>a.indexOf(k)===i).sort();
  }
  function needsPreflight(request) { return !SAFE_METHODS.has(String(request.method||"GET").toUpperCase()) || unsafeHeaderNames(request).length>0; }
  function cacheKey(policy,request) {
    return [policy.origin,policy.targetUrl||policy.targetOrigin,String(request.method||"GET").toUpperCase(),unsafeHeaderNames(request).join(","),policy.credentialed?"include":"omit"].join("|");
  }
  function isCached(policy,request) {
    const key=cacheKey(policy,request), expiry=PREFLIGHT_CACHE.get(key)||0;
    if(expiry<=Date.now()){PREFLIGHT_CACHE.delete(key);return false;} return true;
  }
  function cachePreflight(policy,request,response) {
    const seconds=Math.max(0,Math.min(MAX_CACHE_SECONDS,Number(getHeader(response.headers,"access-control-max-age"))||0));
    if(seconds) PREFLIGHT_CACHE.set(cacheKey(policy,request),Date.now()+seconds*1000);
  }
  function createPreflightRequest(request,policy) {
    const headers=new Headers();
    headers.set("Access-Control-Request-Method",String(request.method||"GET").toUpperCase());
    const names=unsafeHeaderNames(request);
    if(names.length) headers.set("Access-Control-Request-Headers",names.join(", "));
    const preflight=new Request(request.url,{method:"OPTIONS",headers,credentials:"omit",redirect:"follow"});
    preflight.__wkInitiatorOrigin=policy.origin; preflight.__wkCorsMode="cors";
    return preflight;
  }
  function checkAllowOrigin(response,policy) {
    const allowed=getHeader(response.headers,"access-control-allow-origin");
    if(!allowed) return {ok:false,reason:"The response is missing Access-Control-Allow-Origin."};
    if(policy.credentialed){
      if(allowed.trim()!==policy.origin) return {ok:false,reason:"Credentialed CORS requests require an exact Access-Control-Allow-Origin match."};
      if(String(getHeader(response.headers,"access-control-allow-credentials")||"").trim()!=="true") return {ok:false,reason:"The response must include Access-Control-Allow-Credentials: true."};
      return {ok:true};
    }
    if(allowed.trim()!=="*" && allowed.trim()!==policy.origin) return {ok:false,reason:"Access-Control-Allow-Origin does not allow "+policy.origin+"."};
    return {ok:true};
  }
  function tokenList(value){return String(value||"").split(",").map(v=>v.trim()).filter(Boolean);}
  function evaluateActualResponse(response,policy){
    if(!response) return {ok:false,reason:"No response was received."};
    return checkAllowOrigin(response,policy);
  }
  function evaluatePreflight(response,request,policy){
    if(!response || response.status<200 || response.status>=300) return {ok:false,reason:"The CORS preflight request did not receive a successful response."};
    const originCheck=checkAllowOrigin(response,policy); if(!originCheck.ok)return originCheck;
    const method=String(request.method||"GET").toUpperCase(), methods=tokenList(getHeader(response.headers,"access-control-allow-methods"));
    if(!methods.includes(method) && !(methods.includes("*")&&!policy.credentialed)) return {ok:false,reason:"Access-Control-Allow-Methods does not allow "+method+"."};
    const allowed=tokenList(getHeader(response.headers,"access-control-allow-headers")).map(v=>v.toLowerCase());
    for(const name of unsafeHeaderNames(request)){
      if(!allowed.includes(name) && !(allowed.includes("*")&&!policy.credentialed&&name!=="authorization")) return {ok:false,reason:"Access-Control-Allow-Headers does not allow "+name+"."};
    }
    return {ok:true};
  }
  function filterHeaders(headers,policy){
    const output=new Headers(), exposed=new Set(tokenList(getHeader(headers,"access-control-expose-headers")).map(v=>v.toLowerCase()));
    const wildcard=exposed.has("*")&&!policy.credentialed;
    if(headers&&typeof headers.forEach==="function") headers.forEach((value,name)=>{
      const lower=name.toLowerCase();
      if(lower.startsWith("x-wk-upstream-")||INTERNAL_HEADERS.has(lower)||lower.startsWith("access-control-")||lower==="set-cookie"||lower==="set-cookie2")return;
      if(EXPOSED_HEADERS.has(lower)||exposed.has(lower)||wildcard)output.set(name,value);
    });
    return output;
  }
  function filterResponse(response,policy){
    const headers=filterHeaders(response.headers,policy);
    if(!(response instanceof Response)){response.headers=headers;return response;}
    const copy=response.clone(), body=[204,205,304].includes(copy.status)?null:copy.body;
    const filtered=new Response(body,{status:copy.status,statusText:copy.statusText,headers});
    for(const key of ["url","redirected","source_url","requested_url","request_type","__devtoolsSourceTextPromise"]){
      try{if(key in response)Object.defineProperty(filtered,key,{configurable:true,value:response[key]});}catch(_){}
    }
    try{Object.defineProperty(filtered,"type",{configurable:true,value:"cors"});}catch(_){}
    return filtered;
  }
  function createOpaqueResponse(){
    const response=new Response(null);
    for(const [key,value] of Object.entries({type:"opaque",status:0,statusText:"",ok:false,url:"",redirected:false})){
      try{Object.defineProperty(response,key,{configurable:true,value});}catch(_){}
    }
    response.clone=createOpaqueResponse; return response;
  }
  function validateNoCorsRequest(request){
    const method=String(request.method||"GET").toUpperCase();
    if(!SAFE_METHODS.has(method))return{ok:false,reason:"no-cors mode only permits GET, HEAD, and POST requests."};
    const unsafe=unsafeHeaderNames(request);
    if(unsafe.length)return{ok:false,reason:"no-cors mode does not permit these request headers: "+unsafe.join(", ")+"."};
    return{ok:true};
  }
  global.MockCORS={inferMode,getPolicy,needsPreflight,createPreflightRequest,evaluateActualResponse,evaluatePreflight,filterResponse,filterHeaders,createOpaqueResponse,validateNoCorsRequest,isCached,cachePreflight,clearCache(){PREFLIGHT_CACHE.clear();},getHeader,originOf};
})(window);
