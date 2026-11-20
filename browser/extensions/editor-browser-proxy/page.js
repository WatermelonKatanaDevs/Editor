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

 // Patch native XMLHttpRequest as well as fetch. Asynchronous cross-origin XHR
 // uses the same extension streaming bridge; synchronous XHR remains native
 // because MV3 service-worker messaging cannot complete synchronously.
 (function installXMLHttpRequestProxy(){
  const NativeXHR=window.XMLHttpRequest,proto=NativeXHR?.prototype;
  if(!proto||proto.__editorBrowserProxyXHRWrapped)return;

  const methods={
   open:proto.open,send:proto.send,abort:proto.abort,
   setRequestHeader:proto.setRequestHeader,
   getResponseHeader:proto.getResponseHeader,
   getAllResponseHeaders:proto.getAllResponseHeaders,
   overrideMimeType:proto.overrideMimeType
  };
  const propertyNames=["readyState","status","statusText","response","responseText","responseXML","responseURL","responseType","withCredentials","timeout"];
  const descriptors={};
  function findDescriptor(object,name){
   for(let current=object;current;current=Object.getPrototypeOf(current)){
    const descriptor=Object.getOwnPropertyDescriptor(current,name);
    if(descriptor)return descriptor;
   }
   return null;
  }
  for(const name of propertyNames)descriptors[name]=findDescriptor(proto,name);
  const states=new WeakMap();

  function nativeValue(xhr,name){
   const descriptor=descriptors[name];
   if(descriptor?.get)return descriptor.get.call(xhr);
   return undefined;
  }
  function emit(target,type,loaded,total,computable){
   let event;
   try{
    event=new ProgressEvent(type,{
     lengthComputable:!!computable,
     loaded:Number(loaded)||0,
     total:Number(total)||0
    });
   }catch(_){event=new Event(type)}
   try{target.dispatchEvent(event)}catch(_){}
  }
  function emitState(xhr,state,value){
   state.readyState=value;
   try{xhr.dispatchEvent(new Event("readystatechange"))}catch(_){}
  }
  function clearStateTimer(state){
   if(state.timer!==null){clearTimeout(state.timer);state.timer=null}
  }
  function resetResponse(state){
   state.status=0;state.statusText="";state.responseURL="";
   state.headers=new Headers();state.bytes=new Uint8Array(0);
   state.text="";state.document=null;state.mimeType="";
  }
  function bodySize(body){
   try{
    if(typeof body==="string")return new TextEncoder().encode(body).byteLength;
    if(body instanceof Blob)return body.size;
    if(body instanceof ArrayBuffer)return body.byteLength;
    if(ArrayBuffer.isView(body))return body.byteLength;
    if(body instanceof URLSearchParams)return new TextEncoder().encode(body.toString()).byteLength;
   }catch(_){}
   return 0;
  }
  function cancelProxyRequest(xhr,state){
   if(!state?.proxied)return;
   const wasInFlight=state.sending&&!state.finished;
   clearStateTimer(state);
   if(wasInFlight){
    state.aborted=true;state.finished=true;
    try{state.controller?.abort()}catch(_){}
    resetResponse(state);
    emitState(xhr,state,0);
    emit(xhr,"abort");
    emit(xhr,"loadend");
    if(state.hasUpload){emit(xhr.upload,"abort");emit(xhr.upload,"loadend")}
   }else if(state.readyState!==0){
    state.finished=true;resetResponse(state);emitState(xhr,state,0);
   }
  }
  function decodeResponseText(bytes,mimeType){
   const charset=String(mimeType||"").match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1];
   try{return new TextDecoder(charset||"utf-8").decode(bytes)}catch(_){return new TextDecoder("utf-8").decode(bytes)}
  }
  function getResponseDocument(state,responseType){
   if(state.document)return state.document;
   const mime=String(state.mimeType||"").toLowerCase();
   const isDocument=responseType==="document";
   const isXML=mime.includes("xml")||mime.includes("html");
   if(!isDocument&&!(responseType===""&&isXML))return null;
   if(typeof DOMParser!=="function")return null;
   try{
    const contentType=mime.includes("html")?"text/html":"application/xml";
    state.document=new DOMParser().parseFromString(state.text,contentType);
    return state.document;
   }catch(_){return null}
  }
  function responseValue(xhr,state){
   if(state.readyState!==4)return null;
   const type=String(nativeValue(xhr,"responseType")||"");
   if(type===""||type==="text")return state.text;
   if(type==="arraybuffer")return state.bytes.buffer.slice(state.bytes.byteOffset,state.bytes.byteOffset+state.bytes.byteLength);
   if(type==="blob")return new Blob([state.bytes],{type:String(state.mimeType).split(";")[0].trim()});
   if(type==="json"){try{return JSON.parse(state.text)}catch(_){return null}}
   if(type==="document")return getResponseDocument(state,type);
   return null;
  }
  function finishFailure(xhr,state,error){
   if(state.finished||state.aborted||state.timedOut)return;
   state.finished=true;clearStateTimer(state);resetResponse(state);
   emitState(xhr,state,4);
   emit(xhr,"error");
   emit(xhr,"loadend");
   if(state.hasUpload){emit(xhr.upload,"error");emit(xhr.upload,"loadend")}
   if(error)try{console.warn("[Editor Browser Proxy] XMLHttpRequest failed:",state.url,error?.message||error)}catch(_){}
  }
  function finishTimeout(xhr,state){
   if(state.finished||state.aborted)return;
   state.timedOut=true;state.finished=true;
   try{state.controller?.abort()}catch(_){}
   clearStateTimer(state);resetResponse(state);
   emitState(xhr,state,4);
   emit(xhr,"timeout");emit(xhr,"loadend");
   if(state.hasUpload){emit(xhr.upload,"timeout");emit(xhr.upload,"loadend")}
  }
  async function sendProxyRequest(xhr,state,body){
   state.sending=true;state.controller=new AbortController();
   state.hasUpload=body!==null&&body!==undefined;
   const timeout=Number(nativeValue(xhr,"timeout"))||0;
   if(timeout>0)state.timer=setTimeout(()=>finishTimeout(xhr,state),timeout);
   emit(xhr,"loadstart");
   if(state.hasUpload)emit(xhr.upload,"loadstart",0,bodySize(body),bodySize(body)>0);

   try{
    let requestBody=body;
    if(requestBody&&typeof Document!=="undefined"&&requestBody instanceof Document){
     requestBody=new XMLSerializer().serializeToString(requestBody);
    }
    const method=state.method;
    const request=new Request(state.url,{
     method,
     headers:state.headers,
     body:method==="GET"||method==="HEAD"?null:requestBody,
     credentials:nativeValue(xhr,"withCredentials")?"include":"same-origin",
     signal:state.controller.signal
    });
    const response=await proxiedFetch(request,state.url);
    if(state.aborted||state.timedOut||state.finished)return;

    state.status=response.status;
    state.statusText=response.statusText||"";
    state.responseURL=response.url||state.url;
    state.headers=response.headers;
    state.mimeType=state.mimeOverride||response.headers.get("content-type")||"";
    emitState(xhr,state,2);

    if(state.hasUpload){
     const size=bodySize(body);
     emit(xhr.upload,"progress",size,size,size>0);
     emit(xhr.upload,"load");emit(xhr.upload,"loadend");
    }

    const chunks=[];let length=0;
    if(response.body){
     const reader=response.body.getReader();
     try{
      while(true){
       const part=await reader.read();
       if(part.done)break;
       if(state.aborted||state.timedOut||state.finished){try{await reader.cancel()}catch(_){};return}
       if(!part.value?.byteLength)continue;
       const chunk=new Uint8Array(part.value);
       chunks.push(chunk);length+=chunk.byteLength;
       if(state.readyState!==3)emitState(xhr,state,3);
       const total=Number(response.headers.get("content-length"))||0;
       emit(xhr,"progress",length,total,total>0);
      }
     }finally{try{reader.releaseLock()}catch(_){}}
    }
    if(state.aborted||state.timedOut||state.finished)return;
    if(state.readyState!==3)emitState(xhr,state,3);
    state.bytes=new Uint8Array(length);
    let offset=0;
    for(const chunk of chunks){state.bytes.set(chunk,offset);offset+=chunk.byteLength}
    state.text=decodeResponseText(state.bytes,state.mimeType);
    state.finished=true;clearStateTimer(state);
    emitState(xhr,state,4);
    emit(xhr,"load");emit(xhr,"loadend");
   }catch(error){
    if(state.aborted||state.timedOut||state.finished)return;
    finishFailure(xhr,state,error);
   }
  }

  const originalOpen=methods.open,originalSend=methods.send,originalAbort=methods.abort;
  proto.open=function(method,url,async=true,username=null,password=null){
   const previous=states.get(this);
   if(previous?.proxied)cancelProxyRequest(this,previous);
   states.delete(this);
   const result=originalOpen.apply(this,arguments);
   let target=null;
   try{target=new URL(String(url),base)}catch(_){}
   const asynchronous=arguments.length<3||async!==false;
   const shouldProxy=!!target&&asynchronous&&["http:","https:"].includes(target.protocol)&&target.origin!==origin;
   states.set(this,{
    proxied:shouldProxy,async:asynchronous,
    method:String(method||"GET").toUpperCase(),
    url:target?.href||String(url||""),
    headers:new Headers(),readyState:1,sending:false,finished:false,
    aborted:false,timedOut:false,timer:null,controller:null,
    status:0,statusText:"",responseURL:"",bytes:new Uint8Array(0),
    text:"",document:null,mimeType:"",mimeOverride:"",hasUpload:false
   });
   return result;
  };
  proto.setRequestHeader=function(name,value){
   const result=methods.setRequestHeader.apply(this,arguments);
   const state=states.get(this);
   if(state?.proxied)state.headers.append(String(name),String(value));
   return result;
  };
  proto.overrideMimeType=function(mime){
   const result=methods.overrideMimeType.apply(this,arguments);
   const state=states.get(this);
   if(state?.proxied)state.mimeOverride=String(mime||"");
   return result;
  };
  proto.send=function(body=null){
   const state=states.get(this);
   if(!state?.proxied||!state.async)return originalSend.apply(this,arguments);
   if(state.sending)throw new DOMException("The object's state must be OPENED.","InvalidStateError");
   sendProxyRequest(this,state,body);
   return undefined;
  };
  proto.abort=function(){
   const state=states.get(this);
   if(!state?.proxied)return originalAbort.apply(this,arguments);
   cancelProxyRequest(this,state);
   return undefined;
  };
  proto.getResponseHeader=function(name){
   const state=states.get(this);
   if(!state?.proxied)return methods.getResponseHeader.apply(this,arguments);
   if(state.readyState<2)return null;
   return state.headers.get(String(name||""));
  };
  proto.getAllResponseHeaders=function(){
   const state=states.get(this);
   if(!state?.proxied)return methods.getAllResponseHeaders.apply(this,arguments);
   if(state.readyState<2)return "";
   let output="";
   state.headers.forEach((value,name)=>{output+=name+": "+value+"\r\n"});
   return output;
  };

  const customGetters={
   readyState(state){return state.readyState},
   status(state){return state.status},
   statusText(state){return state.statusText},
   responseURL(state){return state.responseURL},
   responseText(state,xhr){
    const type=String(nativeValue(xhr,"responseType")||"");
    if(type!==""&&type!=="text")throw new DOMException("The responseType is not 'text' or empty.","InvalidStateError");
    return state.readyState<3?"":state.text;
   },
   responseXML(state,xhr){
    const type=String(nativeValue(xhr,"responseType")||"");
    return getResponseDocument(state,type);
   },
   response(state,xhr){return responseValue(xhr,state)}
  };
  for(const [name,getValue] of Object.entries(customGetters)){
   const descriptor=descriptors[name];
   if(!descriptor?.get)continue;
   try{
    Object.defineProperty(proto,name,{
     configurable:true,enumerable:descriptor.enumerable,
     get(){
      const state=states.get(this);
      return state?.proxied?getValue(state,this):descriptor.get.call(this);
     }
    });
   }catch(error){console.warn("[Editor Browser Proxy] Could not wrap XMLHttpRequest."+name,error)}
  }

  try{Object.defineProperty(proto,"__editorBrowserProxyXHRWrapped",{value:true})}catch(_){}
 })();

})();
