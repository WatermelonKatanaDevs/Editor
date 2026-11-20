// MV3 proxy worker. Streams response bodies to the content-script bridge.
function bytesToBase64(bytes){let s="";for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s)}
function decodeBody(s){const b=atob(String(s||""));const a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
function cleanHeaders(entries){const h=new Headers(entries||[]);for(const n of Array.from(h.keys()))if(["host","origin","referer","content-length","cookie","cookie2","connection","proxy-authorization"].includes(n.toLowerCase())||n.toLowerCase().startsWith("sec-"))h.delete(n);return h}
async function streamRequest(message,signal,port){
 const target=new URL(String(message.url||""));if(!["http:","https:"].includes(target.protocol))throw new TypeError("Only HTTP and HTTPS requests can be proxied.");
 const method=String(message.method||"GET").toUpperCase(),opts={method,headers:cleanHeaders(message.headers),credentials:["omit","same-origin","include"].includes(message.credentials)?message.credentials:"same-origin",cache:["default","no-store","reload","no-cache","force-cache"].includes(message.cache)?message.cache:"default",redirect:["follow","error","manual"].includes(message.redirect)?message.redirect:"follow",signal};
 if(method!=="GET"&&method!=="HEAD"&&message.body!=null)opts.body=decodeBody(message.body);
 if(message.referrerPolicy)opts.referrerPolicy=message.referrerPolicy;if(message.integrity)opts.integrity=String(message.integrity);
 const response=await fetch(target.href,opts);if(response.type==="opaqueredirect")throw new TypeError("Manual cross-origin redirects cannot be exposed by the extension proxy.");
 const headers=Array.from(response.headers.entries()).filter(([n])=>!["content-encoding","transfer-encoding","connection","set-cookie","set-cookie2"].includes(n.toLowerCase()));
 port.postMessage({type:"HEADERS",status:response.status,statusText:response.statusText,url:response.url||target.href,headers});
 if(!response.body){port.postMessage({type:"DONE"});return}
 const reader=response.body.getReader();try{while(true){if(signal.aborted)throw new DOMException("Aborted","AbortError");const part=await reader.read();if(part.done)break;if(part.value?.byteLength)port.postMessage({type:"CHUNK",data:bytesToBase64(part.value)})}port.postMessage({type:"DONE"})}finally{try{reader.releaseLock()}catch(_){}}
}
chrome.runtime.onConnect.addListener(port=>{
 if(port.name!=="EDITOR_BROWSER_PROXY_STREAM")return;let controller=null,done=false;
 const finish=()=>{done=true};
 port.onMessage.addListener(msg=>{
  if(msg?.type==="ABORT"){controller?.abort();finish();try{port.disconnect()}catch(_){};return}
  if(msg?.type!=="REQUEST"||controller)return;
  controller=new AbortController();
  streamRequest(msg.request||{},controller.signal,port).catch(e=>{if(!done)try{port.postMessage({type:"ERROR",error:e?.message||String(e),name:e?.name||"Error"})}catch(_){}}).finally(finish);
 });
 port.onDisconnect.addListener(()=>{controller?.abort();finish()});
});
