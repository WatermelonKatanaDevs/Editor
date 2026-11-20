// Main-world fetch replacement. Proxied responses are exposed as ReadableStreams.
(()=>{
 if(window.__editorBrowserProxyPageBootstrap)return;Object.defineProperty(window,"__editorBrowserProxyPageBootstrap",{value:true});
 const C="editor-browser-proxy:v1",pending=new Map(),origin=location.origin,base=location.href;
 const b64=b=>{let s="";const a=new Uint8Array(b);for(let i=0;i<a.length;i+=0x8000)s+=String.fromCharCode(...a.subarray(i,i+0x8000));return btoa(s)};
 const un64=s=>{const x=atob(String(s||"")),a=new Uint8Array(x.length);for(let i=0;i<x.length;i++)a[i]=x.charCodeAt(i);return a};
 const abortError=()=>new DOMException("The operation was aborted.","AbortError");
 function proxiedFetch(req,url){const id=crypto.randomUUID?.()||("ebp-"+Date.now()+"-"+Math.random());return new Promise((resolve,reject)=>{
  if(req.signal.aborted){reject(abortError());return}let ctl=null,settled=false,headersSeen=false;
  const cleanup=()=>{pending.delete(id);req.signal.removeEventListener("abort",onAbort)};
  const fail=e=>{if(!settled){settled=true;cleanup();try{ctl?.error(e)}catch(_){}reject(e)}else{try{ctl?.error(e)}catch(_){}cleanup()}};
  const onAbort=()=>{window.postMessage({channel:C,type:"ABORT",id},"*");fail(abortError())};
  pending.set(id,m=>{
   if(m.type==="HEADERS"){if(settled)return;try{headersSeen=true;const noBody=req.method==="HEAD"||[204,205,304].includes(+m.status);const body=noBody?null:new ReadableStream({start(c){ctl=c},cancel(){window.postMessage({channel:C,type:"ABORT",id},"*");cleanup();settled=true}});const res=new Response(body,{status:+m.status,statusText:m.statusText||"",headers:m.headers||[]});try{Object.defineProperty(res,"url",{value:m.url||url})}catch(_){}settled=true;resolve(res);if(noBody)cleanup()}catch(e){fail(e)}return}
   if(m.type==="CHUNK"){if(headersSeen&&ctl)try{ctl.enqueue(un64(m.data))}catch(e){fail(e)}return}
   if(m.type==="DONE"){try{ctl?.close()}catch(_){}cleanup();return}
   if(m.type==="ERROR"){const e=new TypeError(m.error||"Extension proxy failed");e.name=m.name||"Error";fail(e)}
  });
  req.signal.addEventListener("abort",onAbort,{once:true});
  Promise.resolve().then(async()=>{let body=null;if(!["GET","HEAD"].includes(req.method)&&req.body)body=b64(await req.clone().arrayBuffer());if(!pending.has(id))return;
   const headers=Array.from(req.headers.entries()).filter(([n])=>!["host","origin","referer","content-length","cookie"].includes(n.toLowerCase())&&!n.toLowerCase().startsWith("sec-"));
   window.postMessage({channel:C,type:"FETCH",id,request:{url,method:req.method,headers,body,credentials:req.credentials,cache:req.cache,redirect:req.redirect,referrerPolicy:req.referrerPolicy,integrity:req.integrity}},"*");
  }).catch(fail);
 })}
 window.addEventListener("message",e=>{if(e.source!==window||e.data?.channel!==C||["FETCH","ABORT"].includes(e.data.type))return;pending.get(String(e.data.id||""))?.(e.data)});
 const original=window.fetch;
 if(typeof original==="function"&&!original.__editorBrowserProxyWrapped){const wrapped=function(input,init){let req,target;try{req=new Request(input,init);target=new URL(req.url,base)}catch(_){return original.apply(this,arguments)}if(!["http:","https:"].includes(target.protocol)||target.origin===origin)return original.apply(this,arguments);return proxiedFetch(req,target.href)};Object.defineProperty(wrapped,"__editorBrowserProxyWrapped",{value:true});Object.defineProperty(wrapped,"name",{value:"fetch"});window.fetch=wrapped}
})();
