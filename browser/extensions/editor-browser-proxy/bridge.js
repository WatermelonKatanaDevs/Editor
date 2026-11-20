// Isolated-world streaming bridge.
(()=>{
 const C="editor-browser-proxy:v1",ports=new Map();
 const relay=(id,m)=>window.postMessage({channel:C,id,...m},"*");
 window.addEventListener("message",e=>{
  if(e.source!==window||e.data?.channel!==C)return;const m=e.data,id=String(m.id||"");
  if(m.type==="ABORT"){const p=ports.get(id);if(p){try{p.postMessage({type:"ABORT"});p.disconnect()}catch(_){}ports.delete(id)}return}
  if(m.type!=="FETCH"||!id||!m.request||ports.has(id))return;
  let p;try{
   p=chrome.runtime.connect({name:"EDITOR_BROWSER_PROXY_STREAM"});ports.set(id,p);
   p.onMessage.addListener(result=>{relay(id,result||{});if(result?.type==="DONE"||result?.type==="ERROR"){ports.delete(id);try{p.disconnect()}catch(_){}}});
   p.onDisconnect.addListener(()=>{if(ports.get(id)===p){ports.delete(id);relay(id,{type:"ERROR",error:"Extension proxy connection closed unexpectedly.",name:"NetworkError"})}});
   p.postMessage({type:"REQUEST",id,request:m.request});
  }catch(err){ports.delete(id);relay(id,{type:"ERROR",error:err?.message||String(err),name:"Error"})}
 });
})();
