(function(){"use strict";const Yt=e=>e!=null,jf=e=>e===null,Sn=(e,t="asDefined failed")=>e??$t(Wt(t)),Kf=e=>typeof e=="function",Wt=e=>Kf(e)?e():e,Zf=(e,...t)=>e?.apply(null,t),Xf=e=>{throw new Error(`Unhandled ${e}`)},$t=e=>{throw typeof e=="string"?new Error(e):e},kn=(e,t)=>e?void 0:$t(Wt(t)),wr=e=>new Proxy({},{get(){return $t(e)}});class Qf{value;status="success";constructor(t){this.value=t}error=wr("Cannot access error when succeeded")}class Yf{error;status="failure";constructor(t){this.error=t}value=wr("Cannot access value when failed")}const Jf=e=>{try{return new Qf(e())}catch(t){return new Yf(t)}},si=()=>{};var vt;(function(e){e.wrap=r=>Yt(r)?new t(r):e.None,e.from=r=>e.wrap(r()),e.tryCatch=r=>{try{return e.wrap(r())}catch{return e.None}},e.execute=(r,...i)=>e.wrap(r?.apply(null,i)),e.async=r=>r.then(i=>e.wrap(i),()=>e.None);class t{#e;constructor(i){this.#e=Sn(i)}unwrap(){return this.#e}unwrapOrElse(i){return this.#e}unwrapOrNull(){return this.#e}unwrapOrUndefined(){return this.#e}contains(i){return i===this.#e}match(i){return i.some(this.#e)}ifSome(i){return i(this.#e)}ifAbsent(i){}isEmpty(){return!1}nonEmpty(){return!0}map(i){return e.wrap(i(this.#e))}mapOr(i,a){return i(this.#e)}flatMap(i){return i(this.#e)}equals(i){return this.unwrapOrNull()===i.unwrapOrNull()}assert(i){return this}toString(){return`{Option.Some(${this.#e})}`}get[Symbol.toStringTag](){return this.toString()}}e.Some=t,e.None=new class{unwrap=r=>$t(Yt(r)?Wt(r):"unwrap failed");unwrapOrElse=r=>Wt(r);unwrapOrNull=()=>null;unwrapOrUndefined=()=>{};contains=r=>!1;match=r=>r.none();ifSome=r=>{};ifAbsent=r=>r(void 0);isEmpty=()=>!0;nonEmpty=()=>!1;map=r=>e.None;mapOr=(r,i)=>Wt(i);flatMap=r=>e.None;equals=r=>r.isEmpty();assert=r=>$t(Wt(r)??"assert failed");toString=()=>"{Option.None}";get[Symbol.toStringTag](){return this.toString()}}})(vt||(vt={}));const em=Object.freeze({Empty:{terminate:si},create:e=>({terminate:e}),many:(...e)=>({terminate:()=>{for(;e.length>0;)e.pop().terminate()}})}),tm=(()=>{let e=vt.None;return{info:t=>e.match({none:()=>Promise.resolve(),some:r=>r.info(t)}),approve:t=>e.match({none:()=>Promise.resolve(!0),some:r=>r.approve(t)}),progress:t=>e.match({none:()=>({message:"",terminate:si}),some:r=>r.progress(t)}),notify:t=>e.match({none:si,some:r=>r.notify(t)}),install:t=>{kn(e.isEmpty(),"RuntimeNotification already installed"),e=vt.wrap(t)}}})();class me{static createEstimator=()=>{const t=performance.now();let r=me.millis(Number.POSITIVE_INFINITY),i=0;return a=>{if(a===0)return me.POSITIVE_INFINITY;if(a>=1)return me.millis(0);const s=performance.now()-t;return s>i*1e3&&(r=me.millis(s/a-s),i++),r}};static POSITIVE_INFINITY=new me(Number.POSITIVE_INFINITY);static millis=t=>new me(t);static seconds=t=>new me(t*me.#e);static minutes=t=>new me(t*me.#r);static hours=t=>new me(t*me.#a);static days=t=>new me(t*me.#n);static toHHMMSS=t=>((t/3600|0)+100).toString().slice(1)+":"+((t/60|0)%60+100).toString().slice(1)+":"+(t%60+100).toString().slice(1);static#e=1e3;static#r=6e4;static#a=36e5;static#n=864e5;#t;constructor(t){this.#t=t}millis(){return this.#t}absSeconds(){return Math.abs(this.#t)/me.#e}absMinutes(){return Math.abs(this.#t)/me.#r}absHours(){return Math.abs(this.#t)/me.#a}absDays(){return Math.abs(this.#t)/me.#n}split(){return{d:Math.floor(this.absDays()),h:Math.floor(this.absHours())%24,m:Math.floor(this.absMinutes())%60,s:Math.floor(this.absSeconds())%60}}isNow(){return this.#t===0}isPast(){return this.#t<0}isFuture(){return this.#t>0}toUnitString(){let t,r;const i=Math.floor(Math.abs(this.#t)/1e3),a=Math.floor(i/60),s=Math.floor(a/60),n=Math.floor(s/24);return i<60?(t=i,r="second"):a<60?(t=a,r="minute"):s<24?(t=s,r="hour"):(t=n,r="day"),new Intl.RelativeTimeFormat("en",{numeric:"auto",style:"long"}).format(t*Math.sign(this.#t),r)}toString(){if(isNaN(this.#t))return"NaN";if(!isFinite(this.#t))return"∞";const{d:t,h:r,m:i,s:a}=this.split();return t>0?[me.#i("d",t),me.#i("h",r),me.#i("m",i),me.#i("s",a)].join(", "):r>0?[me.#i("h",r),me.#i("m",i),me.#i("s",a)].join(", "):i>0?[me.#i("m",i),me.#i("s",a)].join(", "):a>0?me.#i("s",a):"now"}static#i=(t,r)=>{switch(t){case"d":return`${r} ${r<2?"day":"days"}`;case"h":return`${r} ${r<2?"hour":"hours"}`;case"m":return`${r} ${r<2?"minute":"minutes"}`;case"s":return`${r} ${r<2?"second":"seconds"}`;default:return Xf(t)}}}var $r;(function(e){e.frame=()=>new Promise(t=>requestAnimationFrame(()=>t())),e.frames=t=>new Promise(r=>{let i=t;const a=()=>{--i<=0?r():requestAnimationFrame(a)};requestAnimationFrame(a)}),e.timeSpan=(t,...r)=>new Promise(i=>setTimeout(i,t.millis(),...r)),e.event=(t,r)=>new Promise(i=>t.addEventListener(r,i,{once:!0})),e.observable=t=>new Promise(r=>{const i=t.subscribe(()=>{i.terminate(),r()})}),e.complete=t=>new Promise((r,i)=>{const a=setInterval(()=>{const{status:s,value:n,error:u}=Jf(()=>t.next());if(s==="success"){const{done:l,value:p}=n;l&&(clearInterval(a),r(p))}else clearInterval(a),i(u)},0)})})($r||($r={}));class rm{maxRetry;timeSpan;#e=0;constructor(t,r){this.maxRetry=t,this.timeSpan=r}retry(t,r){return++this.#e===this.maxRetry?!1:(console.debug(`${t} > will retry in ${this.timeSpan.toString()}`),setTimeout(r,this.timeSpan.millis()),!0)}}var oi;(function(e){class t{value;status="resolved";constructor(u){this.value=u}error=wr("Cannot access error when promise is resolved")}e.ResolveResult=t;class r{error;status="rejected";constructor(u){this.error=u}value=wr("Cannot access value when promise is rejected")}e.RejectedResult=r,e.makeAbortable=async(n,u)=>{let l=!0;return n.own(em.create(()=>l=!1)),new Promise((p,h)=>u.then(c=>{l&&p(c)},c=>{l&&h(c)}))},e.tryCatch=n=>n.then(u=>new t(u),u=>new r(u));const i=new rm(3,me.seconds(3));e.retry=(n,u=i)=>n().catch(l=>new Promise((p,h)=>{const c=g=>{u.retry(g,()=>n().then(_=>p(_),c))||h(g)};c(l)})),e.guardedRetry=(n,u)=>{const l=async(p=0)=>{try{return await n()}catch(h){if(u(h,++p))return console.debug(`retry after failure (online: ${navigator.onLine}):`,h),await $r.timeSpan(me.seconds(1)),l(p);throw new Error(`Failed after ${p} retries: ${h}`)}};return l()},e.approvedRetry=(n,u)=>{const l=async()=>{try{return await n()}catch(p){if(await tm.approve(u(p)))return l();throw p}};return l()},e.delay=(n,u)=>Promise.all([n,$r.timeSpan(u)]).then(([l])=>l),e.fail=(n,u="fail")=>Promise.reject(u),e.timeout=(n,u,l)=>new Promise((p,h)=>{let c=!0;const g=setTimeout(()=>{c=!1,h(new Error(l??"timeout"))},u.millis());n.then(_=>{c&&p(_)},_=>{c&&h(_)}).finally(()=>clearTimeout(g))}),e.sequentialAll=n=>n.reduce((u,l)=>u.then(async p=>[...p,await l()]),Promise.resolve([])),e.sequentialize=n=>{let u=Promise.resolve();return l=>{const p=()=>n(l),h=u.then(p,p);return u=h.catch(()=>{}),h}},e.memoizeAsync=(n,u)=>{let l=null,p=Date.now();return()=>{const h=Date.now();return(jf(l)||Yt(u)&&h-p>u.millis())&&(p=h,l=n(),l.catch(c=>(l=null,c))),l}},e.allWithLimit=async(n,u=1)=>{const l=new Array(n.length);let p=0,h=!1;const c=async()=>{for(;p<n.length&&!h;){const g=p++;try{const _=await n[g]();h||(l[g]=_)}catch(_){throw h=!0,_}}};return await Promise.all(Array.from({length:Math.min(u,n.length)},c)),l},e.allSettledWithLimit=async(n,u=1)=>{const l=new Array(n.length);let p=0;const h=async()=>{for(;p<n.length;){const c=p++;try{const g=await n[c]();l[c]={status:"fulfilled",value:g}}catch(g){l[c]={status:"rejected",reason:g}}}};return await Promise.all(Array.from({length:Math.min(u,n.length)},h)),l};class a{max;#e;#r=0;constructor(u=1){this.max=u,this.#e=[]}async add(u){if(this.#r<this.max)return this.#r++,u().finally(()=>this.#a());{const l=Promise.withResolvers();return this.#e.push([u,l]),l.promise.finally(()=>this.#a())}}#a(){if(kn(this.#r>0,"Internal Error in Promises.Limit"),--this.#r<this.max&&this.#e.length>0){const[u,{resolve:l,reject:p}]=this.#e.shift();this.#r++,u().then(l,p)}}}e.Limit=a;class s{#e;#r;#a;#n=vt.None;constructor(u,l,p){this.#e=u,this.#r=l,this.#a=p}update(u){this.#n=vt.wrap(u),u.then(l=>{this.#n.contains(u)&&this.#e(l)}).catch(l=>{this.#n.contains(u)&&this.#r(l)}).finally(()=>{this.#n.contains(u)&&(this.terminate(),Zf(this.#a))})}terminate(){this.#n=vt.None}}e.Latest=s})(oi||(oi={}));var ui=Object.defineProperty,im=Object.getOwnPropertyDescriptor,am=Object.getOwnPropertyNames,nm=Object.prototype.hasOwnProperty,sm=(e=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(e,{get:(t,r)=>(typeof require<"u"?require:t)[r]}):e)(function(e){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+e+'" is not supported')}),P=(e,t,r)=>()=>{if(r)throw r[0];try{return e&&(t=e(e=0)),t}catch(i){throw r=[i],i}},Vt=(e,t)=>{for(var r in t)ui(e,r,{get:t[r],enumerable:!0})},om=(e,t,r,i)=>{if(t&&typeof t=="object"||typeof t=="function")for(let a of am(t))!nm.call(e,a)&&a!==r&&ui(e,a,{get:()=>t[a],enumerable:!(i=im(t,a))||i.enumerable});return e},Jt=e=>om(ui({},"__esModule",{value:!0}),e),er,lt,Gt,Tn,In,En=P(()=>{"use strict";er=new Map,lt=[],Gt=(e,t,r)=>{if(t&&typeof t.init=="function"&&typeof t.createInferenceSessionHandler=="function"){let i=er.get(e);if(i===void 0)er.set(e,{backend:t,priority:r});else{if(i.priority>r)return;if(i.priority===r&&i.backend!==t)throw new Error(`cannot register backend "${e}" using priority ${r}`)}if(r>=0){let a=lt.indexOf(e);a!==-1&&lt.splice(a,1);for(let s=0;s<lt.length;s++)if(er.get(lt[s]).priority<=r){lt.splice(s,0,e);return}lt.push(e)}return}throw new TypeError("not a valid backend")},Tn=async e=>{let t=er.get(e);if(!t)return"backend not found.";if(t.initialized)return t.backend;if(t.aborted)return t.error;{let r=!!t.initPromise;try{return r||(t.initPromise=t.backend.init(e)),await t.initPromise,t.initialized=!0,t.backend}catch(i){return r||(t.error=`${i}`,t.aborted=!0),t.error}finally{delete t.initPromise}}},In=async e=>{let t=e.executionProviders||[],r=t.map(l=>typeof l=="string"?l:l.name),i=r.length===0?lt:r,a,s=[],n=new Set;for(let l of i){let p=await Tn(l);typeof p=="string"?s.push({name:l,err:p}):(a||(a=p),a===p&&n.add(l))}if(!a)throw new Error(`no available backend found. ERR: ${s.map(l=>`[${l.name}] ${l.err}`).join(", ")}`);for(let{name:l,err:p}of s)r.includes(l)&&console.warn(`removing requested execution provider "${l}" from session options because it is not available: ${p}`);let u=t.filter(l=>n.has(typeof l=="string"?l:l.name));return[a,new Proxy(e,{get:(l,p)=>p==="executionProviders"?u:Reflect.get(l,p)})]}}),um=P(()=>{"use strict";En()}),zn,lm=P(()=>{"use strict";zn="1.30.0"}),li,Ce,Cn=P(()=>{"use strict";lm(),li="warning",Ce={wasm:{},webgl:{},webgpu:{},versions:{common:zn},set logLevel(e){if(e!==void 0){if(typeof e!="string"||["verbose","info","warning","error","fatal"].indexOf(e)===-1)throw new Error(`Unsupported logging level: ${e}`);li=e}},get logLevel(){return li}},Object.defineProperty(Ce,"logLevel",{enumerable:!0})}),be,dm=P(()=>{"use strict";Cn(),be=Ce}),An,On,pm=P(()=>{"use strict";An=(e,t)=>{let r=typeof document<"u"?document.createElement("canvas"):new OffscreenCanvas(1,1);r.width=e.dims[3],r.height=e.dims[2];let i=r.getContext("2d");if(i!=null){let a,s;t?.tensorLayout!==void 0&&t.tensorLayout==="NHWC"?(a=e.dims[2],s=e.dims[3]):(a=e.dims[3],s=e.dims[2]);let n=t?.format!==void 0?t.format:"RGB",u=t?.norm,l,p;u===void 0||u.mean===void 0?l=[255,255,255,255]:typeof u.mean=="number"?l=[u.mean,u.mean,u.mean,u.mean]:(l=[u.mean[0],u.mean[1],u.mean[2],0],u.mean[3]!==void 0&&(l[3]=u.mean[3])),u===void 0||u.bias===void 0?p=[0,0,0,0]:typeof u.bias=="number"?p=[u.bias,u.bias,u.bias,u.bias]:(p=[u.bias[0],u.bias[1],u.bias[2],0],u.bias[3]!==void 0&&(p[3]=u.bias[3]));let h=s*a,c=0,g=h,_=h*2,y=-1;n==="RGBA"?(c=0,g=h,_=h*2,y=h*3):n==="RGB"?(c=0,g=h,_=h*2):n==="RBG"&&(c=0,_=h,g=h*2);for(let $=0;$<s;$++)for(let S=0;S<a;S++){let x=(e.data[c++]-p[0])*l[0],b=(e.data[g++]-p[1])*l[1],E=(e.data[_++]-p[2])*l[2],k=y===-1?255:(e.data[y++]-p[3])*l[3];i.fillStyle="rgba("+x+","+b+","+E+","+k+")",i.fillRect(S,$,1,1)}if("toDataURL"in r)return r.toDataURL();throw new Error("toDataURL is not supported")}else throw new Error("Can not access image data")},On=(e,t)=>{let r=typeof document<"u"?document.createElement("canvas").getContext("2d"):new OffscreenCanvas(1,1).getContext("2d"),i;if(r!=null){let a,s,n;t?.tensorLayout!==void 0&&t.tensorLayout==="NHWC"?(a=e.dims[2],s=e.dims[1],n=e.dims[3]):(a=e.dims[3],s=e.dims[2],n=e.dims[1]);let u=t!==void 0&&t.format!==void 0?t.format:"RGB",l=t?.norm,p,h;l===void 0||l.mean===void 0?p=[255,255,255,255]:typeof l.mean=="number"?p=[l.mean,l.mean,l.mean,l.mean]:(p=[l.mean[0],l.mean[1],l.mean[2],255],l.mean[3]!==void 0&&(p[3]=l.mean[3])),l===void 0||l.bias===void 0?h=[0,0,0,0]:typeof l.bias=="number"?h=[l.bias,l.bias,l.bias,l.bias]:(h=[l.bias[0],l.bias[1],l.bias[2],0],l.bias[3]!==void 0&&(h[3]=l.bias[3]));let c=s*a;if(t!==void 0&&(t.format!==void 0&&n===4&&t.format!=="RGBA"||n===3&&t.format!=="RGB"&&t.format!=="BGR"))throw new Error("Tensor format doesn't match input tensor dims");let g=4,_=0,y=1,$=2,S=3,x=0,b=c,E=c*2,k=-1;u==="RGBA"?(x=0,b=c,E=c*2,k=c*3):u==="RGB"?(x=0,b=c,E=c*2):u==="RBG"&&(x=0,E=c,b=c*2),i=r.createImageData(a,s);for(let I=0;I<s*a;_+=g,y+=g,$+=g,S+=g,I++)i.data[_]=(e.data[x++]-h[0])*p[0],i.data[y]=(e.data[b++]-h[1])*p[1],i.data[$]=(e.data[E++]-h[2])*p[2],i.data[S]=k===-1?255:(e.data[k++]-h[3])*p[3]}else throw new Error("Can not access image data");return i}}),vr,Rn,Bn,Nn,Mn,Dn,cm=P(()=>{"use strict";pi(),vr=(e,t)=>{if(e===void 0)throw new Error("Image buffer must be defined");if(t.height===void 0||t.width===void 0)throw new Error("Image height and width must be defined");if(t.tensorLayout==="NHWC")throw new Error("NHWC Tensor layout is not supported yet");let{height:r,width:i}=t,a=t.norm??{mean:255,bias:0},s,n;typeof a.mean=="number"?s=[a.mean,a.mean,a.mean,a.mean]:s=[a.mean[0],a.mean[1],a.mean[2],a.mean[3]??255],typeof a.bias=="number"?n=[a.bias,a.bias,a.bias,a.bias]:n=[a.bias[0],a.bias[1],a.bias[2],a.bias[3]??0];let u=t.format!==void 0?t.format:"RGBA",l=t.tensorFormat!==void 0&&t.tensorFormat!==void 0?t.tensorFormat:"RGB",p=r*i,h=l==="RGBA"?new Float32Array(p*4):new Float32Array(p*3),c=4,g=0,_=1,y=2,$=3,S=0,x=p,b=p*2,E=-1;u==="RGB"&&(c=3,g=0,_=1,y=2,$=-1),l==="RGBA"?E=p*3:l==="RBG"?(S=0,b=p,x=p*2):l==="BGR"&&(b=0,x=p,S=p*2);for(let k=0;k<p;k++,g+=c,y+=c,_+=c,$+=c)h[S++]=(e[g]+n[0])/s[0],h[x++]=(e[_]+n[1])/s[1],h[b++]=(e[y]+n[2])/s[2],E!==-1&&$!==-1&&(h[E++]=(e[$]+n[3])/s[3]);return l==="RGBA"?new Me("float32",h,[1,4,r,i]):new Me("float32",h,[1,3,r,i])},Rn=async(e,t)=>{let r=typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement,i=typeof ImageData<"u"&&e instanceof ImageData,a=typeof ImageBitmap<"u"&&e instanceof ImageBitmap,s=typeof e=="string",n,u=t??{},l=()=>{if(typeof document<"u")return document.createElement("canvas");if(typeof OffscreenCanvas<"u")return new OffscreenCanvas(1,1);throw new Error("Canvas is not supported")},p=h=>typeof HTMLCanvasElement<"u"&&h instanceof HTMLCanvasElement||h instanceof OffscreenCanvas?h.getContext("2d"):null;if(r){let h=l();h.width=e.width,h.height=e.height;let c=p(h);if(c!=null){let g=e.height,_=e.width;if(t!==void 0&&t.resizedHeight!==void 0&&t.resizedWidth!==void 0&&(g=t.resizedHeight,_=t.resizedWidth),t!==void 0){if(u=t,t.tensorFormat!==void 0)throw new Error("Image input config format must be RGBA for HTMLImageElement");u.tensorFormat="RGBA",u.height=g,u.width=_}else u.tensorFormat="RGBA",u.height=g,u.width=_;c.drawImage(e,0,0),n=c.getImageData(0,0,_,g).data}else throw new Error("Can not access image data")}else if(i){let h,c;if(t!==void 0&&t.resizedWidth!==void 0&&t.resizedHeight!==void 0?(h=t.resizedHeight,c=t.resizedWidth):(h=e.height,c=e.width),t!==void 0&&(u=t),u.format="RGBA",u.height=h,u.width=c,t!==void 0){let g=l();g.width=c,g.height=h;let _=p(g);if(_!=null)_.putImageData(e,0,0),n=_.getImageData(0,0,c,h).data;else throw new Error("Can not access image data")}else n=e.data}else if(a){if(t===void 0)throw new Error("Please provide image config with format for Imagebitmap");let h=l();h.width=e.width,h.height=e.height;let c=p(h);if(c!=null){let g=e.height,_=e.width;return c.drawImage(e,0,0,_,g),n=c.getImageData(0,0,_,g).data,u.height=g,u.width=_,vr(n,u)}else throw new Error("Can not access image data")}else{if(s)return new Promise((h,c)=>{let g=l(),_=p(g);if(!e||!_)return c();let y=new Image;y.crossOrigin="Anonymous",y.src=e,y.onload=()=>{g.width=y.width,g.height=y.height,_.drawImage(y,0,0,g.width,g.height);let $=_.getImageData(0,0,g.width,g.height);u.height=g.height,u.width=g.width,h(vr($.data,u))}});throw new Error("Input data provided is not supported - aborted tensor creation")}if(n!==void 0)return vr(n,u);throw new Error("Input data provided is not supported - aborted tensor creation")},Bn=(e,t)=>{let{width:r,height:i,download:a,dispose:s}=t,n=[1,i,r,4];return new Me({location:"texture",type:"float32",texture:e,dims:n,download:a,dispose:s})},Nn=(e,t)=>{let{dataType:r,dims:i,download:a,dispose:s}=t;return new Me({location:"gpu-buffer",type:r??"float32",gpuBuffer:e,dims:i,download:a,dispose:s})},Mn=(e,t)=>{let{dataType:r,dims:i,download:a,dispose:s}=t;return new Me({location:"ml-tensor",type:r??"float32",mlTensor:e,dims:i,download:a,dispose:s})},Dn=(e,t,r)=>new Me({location:"cpu-pinned",type:e,data:t,dims:r??[t.length]})}),xt,tr,di,Un,hm=P(()=>{"use strict";xt=new Map([["float32",Float32Array],["uint8",Uint8Array],["int8",Int8Array],["uint16",Uint16Array],["int16",Int16Array],["int32",Int32Array],["bool",Uint8Array],["float64",Float64Array],["uint32",Uint32Array],["int4",Uint8Array],["uint4",Uint8Array]]),tr=new Map([[Float32Array,"float32"],[Uint8Array,"uint8"],[Int8Array,"int8"],[Uint16Array,"uint16"],[Int16Array,"int16"],[Int32Array,"int32"],[Float64Array,"float64"],[Uint32Array,"uint32"]]),di=!1,Un=()=>{if(!di){di=!0;let e=typeof BigInt64Array<"u"&&BigInt64Array.from,t=typeof BigUint64Array<"u"&&BigUint64Array.from,r=globalThis.Float16Array,i=typeof r<"u"&&r.from;e&&(xt.set("int64",BigInt64Array),tr.set(BigInt64Array,"int64")),t&&(xt.set("uint64",BigUint64Array),tr.set(BigUint64Array,"uint64")),i?(xt.set("float16",r),tr.set(r,"float16")):xt.set("float16",Uint16Array)}}}),Pn,qn,fm=P(()=>{"use strict";pi(),Pn=e=>{let t=1;for(let r=0;r<e.length;r++){let i=e[r];if(typeof i!="number"||!Number.isSafeInteger(i))throw new TypeError(`dims[${r}] must be an integer, got: ${i}`);if(i<0)throw new RangeError(`dims[${r}] must be a non-negative integer, got: ${i}`);t*=i}return t},qn=(e,t)=>{switch(e.location){case"cpu":return new Me(e.type,e.data,t);case"cpu-pinned":return new Me({location:"cpu-pinned",data:e.data,type:e.type,dims:t});case"texture":return new Me({location:"texture",texture:e.texture,type:e.type,dims:t});case"gpu-buffer":return new Me({location:"gpu-buffer",gpuBuffer:e.gpuBuffer,type:e.type,dims:t});case"ml-tensor":return new Me({location:"ml-tensor",mlTensor:e.mlTensor,type:e.type,dims:t});default:throw new Error(`tensorReshape: tensor location ${e.location} is not supported`)}}}),Me,pi=P(()=>{"use strict";pm(),cm(),hm(),fm(),Me=class{constructor(e,t,r){Un();let i,a;if(typeof e=="object"&&"location"in e)switch(this.dataLocation=e.location,i=e.type,a=e.dims,e.location){case"cpu-pinned":{let n=xt.get(i);if(!n)throw new TypeError(`unsupported type "${i}" to create tensor from pinned buffer`);if(!(e.data instanceof n))throw new TypeError(`buffer should be of type ${n.name}`);this.cpuData=e.data;break}case"texture":{if(i!=="float32")throw new TypeError(`unsupported type "${i}" to create tensor from texture`);this.gpuTextureData=e.texture,this.downloader=e.download,this.disposer=e.dispose;break}case"gpu-buffer":{if(i!=="float32"&&i!=="float16"&&i!=="int32"&&i!=="int64"&&i!=="uint32"&&i!=="uint8"&&i!=="bool"&&i!=="uint4"&&i!=="int4")throw new TypeError(`unsupported type "${i}" to create tensor from gpu buffer`);this.gpuBufferData=e.gpuBuffer,this.downloader=e.download,this.disposer=e.dispose;break}case"ml-tensor":{if(i!=="float32"&&i!=="float16"&&i!=="int32"&&i!=="int64"&&i!=="uint32"&&i!=="uint64"&&i!=="int8"&&i!=="uint8"&&i!=="bool"&&i!=="uint4"&&i!=="int4")throw new TypeError(`unsupported type "${i}" to create tensor from MLTensor`);this.mlTensorData=e.mlTensor,this.downloader=e.download,this.disposer=e.dispose;break}default:throw new Error(`Tensor constructor: unsupported location '${this.dataLocation}'`)}else{let n,u;if(typeof e=="string")if(i=e,u=r,e==="string"){if(!Array.isArray(t))throw new TypeError("A string tensor's data must be a string array.");n=t}else{let l=xt.get(e);if(l===void 0)throw new TypeError(`Unsupported tensor type: ${e}.`);if(Array.isArray(t)){if(e==="float16"&&l===Uint16Array||e==="uint4"||e==="int4")throw new TypeError(`Creating a ${e} tensor from number array is not supported. Please use ${l.name} as data.`);e==="uint64"||e==="int64"?n=l.from(t,BigInt):n=l.from(t)}else if(t instanceof l)n=t;else if(t instanceof Uint8ClampedArray)if(e==="uint8")n=Uint8Array.from(t);else throw new TypeError("A Uint8ClampedArray tensor's data must be type of uint8");else if(e==="float16"&&t instanceof Uint16Array&&l!==Uint16Array)n=new globalThis.Float16Array(t.buffer,t.byteOffset,t.length);else throw new TypeError(`A ${i} tensor's data must be type of ${l}`)}else if(u=t,Array.isArray(e)){if(e.length===0)throw new TypeError("Tensor type cannot be inferred from an empty array.");let l=typeof e[0];if(l==="string")i="string",n=e;else if(l==="boolean")i="bool",n=Uint8Array.from(e);else throw new TypeError(`Invalid element type of data array: ${l}.`)}else if(e instanceof Uint8ClampedArray)i="uint8",n=Uint8Array.from(e);else{let l=tr.get(e.constructor);if(l===void 0)throw new TypeError(`Unsupported type for tensor data: ${e.constructor}.`);i=l,n=e}if(u===void 0)u=[n.length];else if(!Array.isArray(u))throw new TypeError("A tensor's dims must be a number array");a=u,this.cpuData=n,this.dataLocation="cpu"}let s=Pn(a);if(this.cpuData&&s!==this.cpuData.length&&!((i==="uint4"||i==="int4")&&Math.ceil(s/2)===this.cpuData.length))throw new Error(`Tensor's size(${s}) does not match data length(${this.cpuData.length}).`);this.type=i,this.dims=a,this.size=s}static async fromImage(e,t){return Rn(e,t)}static fromTexture(e,t){return Bn(e,t)}static fromGpuBuffer(e,t){return Nn(e,t)}static fromMLTensor(e,t){return Mn(e,t)}static fromPinnedBuffer(e,t,r){return Dn(e,t,r)}toDataURL(e){return An(this,e)}toImageData(e){return On(this,e)}get data(){if(this.ensureValid(),!this.cpuData)throw new Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");return this.cpuData}get location(){return this.dataLocation}get texture(){if(this.ensureValid(),!this.gpuTextureData)throw new Error("The data is not stored as a WebGL texture.");return this.gpuTextureData}get gpuBuffer(){if(this.ensureValid(),!this.gpuBufferData)throw new Error("The data is not stored as a WebGPU buffer.");return this.gpuBufferData}get mlTensor(){if(this.ensureValid(),!this.mlTensorData)throw new Error("The data is not stored as a WebNN MLTensor.");return this.mlTensorData}async getData(e){switch(this.ensureValid(),this.dataLocation){case"cpu":case"cpu-pinned":return this.data;case"texture":case"gpu-buffer":case"ml-tensor":{if(!this.downloader)throw new Error("The current tensor is not created with a specified data downloader.");if(this.isDownloading)throw new Error("The current tensor is being downloaded.");try{this.isDownloading=!0;let t=await this.downloader();return this.downloader=void 0,this.dataLocation="cpu",this.cpuData=t,e&&this.disposer&&(this.disposer(),this.disposer=void 0),t}finally{this.isDownloading=!1}}default:throw new Error(`cannot get data from location: ${this.dataLocation}`)}}dispose(){if(this.isDownloading)throw new Error("The current tensor is being downloaded.");this.disposer&&(this.disposer(),this.disposer=void 0),this.cpuData=void 0,this.gpuTextureData=void 0,this.gpuBufferData=void 0,this.mlTensorData=void 0,this.downloader=void 0,this.isDownloading=void 0,this.dataLocation="none"}ensureValid(){if(this.dataLocation==="none")throw new Error("The tensor is disposed.")}reshape(e){if(this.ensureValid(),this.downloader||this.disposer)throw new Error("Cannot reshape a tensor that owns GPU resource.");return qn(this,e)}}}),Pe,Ln=P(()=>{"use strict";pi(),Pe=Me}),xr,ci,Qe,Ve,St,kt,Wn=P(()=>{"use strict";Cn(),xr=(e,t)=>{(typeof Ce.trace>"u"?!Ce.wasm.trace:!Ce.trace)||console.timeStamp(`${e}::ORT::${t}`)},ci=(e,t)=>{let r=new Error().stack?.split(/\r\n|\r|\n/g)||[],i=!1;for(let a=0;a<r.length;a++){if(i&&!r[a].includes("TRACE_FUNC")){let s=`FUNC_${e}::${r[a].trim().split(" ")[1]}`;t&&(s+=`::${t}`),xr("CPU",s);return}r[a].includes("TRACE_FUNC")&&(i=!0)}},Qe=e=>{(typeof Ce.trace>"u"?!Ce.wasm.trace:!Ce.trace)||ci("BEGIN",e)},Ve=e=>{(typeof Ce.trace>"u"?!Ce.wasm.trace:!Ce.trace)||ci("END",e)},St=e=>{(typeof Ce.trace>"u"?!Ce.wasm.trace:!Ce.trace)||console.time(`ORT::${e}`)},kt=e=>{(typeof Ce.trace>"u"?!Ce.wasm.trace:!Ce.trace)||console.timeEnd(`ORT::${e}`)}}),Vn,mm=P(()=>{"use strict";En(),Ln(),Wn(),Vn=class Hf{constructor(t){this.handler=t}async run(t,r,i){Qe(),St("InferenceSession.run");let a={},s={};if(typeof t!="object"||t===null||t instanceof Pe||Array.isArray(t))throw new TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");let n=!0;if(typeof r=="object"){if(r===null)throw new TypeError("Unexpected argument[1]: cannot be null.");if(r instanceof Pe)throw new TypeError("'fetches' cannot be a Tensor");if(Array.isArray(r)){if(r.length===0)throw new TypeError("'fetches' cannot be an empty array.");n=!1;for(let p of r){if(typeof p!="string")throw new TypeError("'fetches' must be a string array or an object.");if(this.outputNames.indexOf(p)===-1)throw new RangeError(`'fetches' contains invalid output name: ${p}.`);a[p]=null}if(typeof i=="object"&&i!==null)s=i;else if(typeof i<"u")throw new TypeError("'options' must be an object.")}else{let p=!1,h=Object.getOwnPropertyNames(r);for(let c of this.outputNames)if(h.indexOf(c)!==-1){let g=r[c];(g===null||g instanceof Pe)&&(p=!0,n=!1,a[c]=g)}if(p){if(typeof i=="object"&&i!==null)s=i;else if(typeof i<"u")throw new TypeError("'options' must be an object.")}else s=r}}else if(typeof r<"u")throw new TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");for(let p of this.inputNames)if(typeof t[p]>"u")throw new Error(`input '${p}' is missing in 'feeds'.`);if(n)for(let p of this.outputNames)a[p]=null;let u=await this.handler.run(t,a,s),l={};for(let p in u)if(Object.hasOwnProperty.call(u,p)){let h=u[p];h instanceof Pe?l[p]=h:l[p]=new Pe(h.type,h.data,h.dims)}return kt("InferenceSession.run"),Ve(),l}async release(){return this.handler.dispose()}static async create(t,r,i,a){Qe(),St("InferenceSession.create");let s,n={};if(typeof t=="string"){if(s=t,typeof r=="object"&&r!==null)n=r;else if(typeof r<"u")throw new TypeError("'options' must be an object.")}else if(t instanceof Uint8Array){if(s=t,typeof r=="object"&&r!==null)n=r;else if(typeof r<"u")throw new TypeError("'options' must be an object.")}else if(t instanceof ArrayBuffer||typeof SharedArrayBuffer<"u"&&t instanceof SharedArrayBuffer){let h=t,c=0,g=t.byteLength;if(typeof r=="object"&&r!==null)n=r;else if(typeof r=="number"){if(c=r,!Number.isSafeInteger(c))throw new RangeError("'byteOffset' must be an integer.");if(c<0||c>=h.byteLength)throw new RangeError(`'byteOffset' is out of range [0, ${h.byteLength}).`);if(g=t.byteLength-c,typeof i=="number"){if(g=i,!Number.isSafeInteger(g))throw new RangeError("'byteLength' must be an integer.");if(g<=0||c+g>h.byteLength)throw new RangeError(`'byteLength' is out of range (0, ${h.byteLength-c}].`);if(typeof a=="object"&&a!==null)n=a;else if(typeof a<"u")throw new TypeError("'options' must be an object.")}else if(typeof i<"u")throw new TypeError("'byteLength' must be a number.")}else if(typeof r<"u")throw new TypeError("'options' must be an object.");s=new Uint8Array(h,c,g)}else throw new TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");let[u,l]=await In(n),p=await u.createInferenceSessionHandler(s,l);return kt("InferenceSession.create"),Ve(),new Hf(p)}startProfiling(){this.handler.startProfiling()}endProfiling(){this.handler.endProfiling()}get inputNames(){return this.handler.inputNames}get outputNames(){return this.handler.outputNames}get inputMetadata(){return this.handler.inputMetadata}get outputMetadata(){return this.handler.outputMetadata}}}),hi,gm=P(()=>{"use strict";mm(),hi=Vn}),ym=P(()=>{"use strict"}),_m=P(()=>{"use strict"}),bm=P(()=>{"use strict"}),wm=P(()=>{"use strict"}),$m={};Vt($m,{InferenceSession:()=>hi,TRACE:()=>xr,TRACE_EVENT_BEGIN:()=>St,TRACE_EVENT_END:()=>kt,TRACE_FUNC_BEGIN:()=>Qe,TRACE_FUNC_END:()=>Ve,Tensor:()=>Pe,env:()=>be,registerBackend:()=>Gt});var qe=P(()=>{"use strict";um(),dm(),gm(),Ln(),ym(),_m(),Wn(),bm(),wm()}),fi=P(()=>{"use strict"}),Gn={};Vt(Gn,{default:()=>Hn});var mi,gi,Hn,vm=P(()=>{"use strict";Mc(),Tt(),vi(),mi="ort-wasm-proxy-worker",gi=globalThis.self?.name===mi,gi&&(self.onmessage=e=>{let{type:t,in:r}=e.data;try{switch(t){case"init-wasm":ki(r.wasm).then(()=>{qa(r).then(()=>{postMessage({type:t})},i=>{postMessage({type:t,err:i})})},i=>{postMessage({type:t,err:i})});break;case"init-ep":{let{epName:i,env:a}=r;La(a,i).then(()=>{postMessage({type:t})},s=>{postMessage({type:t,err:s})});break}case"copy-from":{let{buffer:i}=r,a=Vr(i);postMessage({type:t,out:a});break}case"create":{let{model:i,options:a}=r;Va(i,a).then(s=>{postMessage({type:t,out:s})},s=>{postMessage({type:t,err:s})});break}case"release":Ga(r),postMessage({type:t});break;case"run":{let{sessionId:i,inputIndices:a,inputs:s,outputIndices:n,options:u}=r;Fa(i,a,s,n,new Array(n.length).fill(null),u).then(l=>{l.some(p=>p[3]!=="cpu")?postMessage({type:t,err:"Proxy does not support non-cpu tensor location."}):postMessage({type:t,out:l},Ka([...s,...l]))},l=>{postMessage({type:t,err:l})});break}case"end-profiling":ja(r),postMessage({type:t});break;default:}}catch(i){postMessage({type:t,err:i})}}),Hn=gi?null:e=>new Worker(e??De,{type:"module",name:mi})}),Fn={};Vt(Fn,{default:()=>Kn});async function jn(e={}){var t=e,r=!!globalThis.window,i=!!globalThis.WorkerGlobalScope,a=i&&self.name?.startsWith("em-pthread");t.mountExternalData=(o,d)=>{o.startsWith("./")&&(o=o.substring(2)),(t.ad||(t.ad=new Map)).set(o,d)},t.unmountExternalData=()=>{delete t.ad,delete t.Yd,delete t.Xd,delete t.be},globalThis.SharedArrayBuffer??new WebAssembly.Memory({initial:0,maximum:0,shared:!0}).buffer.constructor;let s=o=>async(...d)=>{try{if(t.$c)throw Error("Session already started");let m=t.$c={Nd:d[0],errors:[]},f=await o(...d);if(t.$c!==m)throw Error("Session mismatch");t.hd?.flush();let w=m.errors;if(0<w.length){let T=await Promise.all(w);if(T=T.filter(C=>C),0<T.length)throw Error(T.join(`
`))}return f}finally{t.$c=null}};t.jsepInit=(o,d)=>{if(o==="webgpu"){[t.hd,t.Dd,t.Hd,t.jd,t.Gd,t.bc,t.Id,t.Kd,t.Ed,t.Fd,t.Jd]=d;let m=t.hd;t.jsepRegisterBuffer=(f,w,T,C)=>m.registerBuffer(f,w,T,C),t.jsepGetBuffer=f=>m.getBuffer(f),t.jsepCreateDownloader=(f,w,T)=>m.createDownloader(f,w,T),t.jsepOnCreateSession=f=>{m.onCreateSession(f)},t.jsepOnReleaseSession=f=>{m.onReleaseSession(f)},t.jsepOnRunStart=f=>m.onRunStart(f),t.Ld=(f,w)=>{m.upload(f,w)}}else if(o==="webnn"){let m=d[0];[t.Vd,t.vd,t.webnnEnsureTensor,t.wd,t.webnnDownloadTensor,t.Ud,t.webnnEnableTraceEvent]=d.slice(1),t.webnnReleaseTensorId=t.vd,t.webnnUploadTensor=t.wd,t.webnnRegisterMLContext=t.Ud,t.webnnOnRunStart=f=>m.onRunStart(f),t.webnnOnRunEnd=m.onRunEnd.bind(m),t.webnnOnReleaseSession=f=>{m.onReleaseSession(f)},t.webnnCreateMLTensorDownloader=(f,w)=>m.createMLTensorDownloader(f,w),t.webnnRegisterMLTensor=(f,w,T,C)=>m.registerMLTensor(f,w,T,C),t.webnnCreateMLContext=f=>m.createMLContext(f),t.webnnRegisterGraphInput=m.registerGraphInput.bind(m),t.webnnIsGraphInput=m.isGraphInput.bind(m),t.webnnRegisterGraphOutput=m.registerGraphOutput.bind(m),t.webnnIsGraphOutput=m.isGraphOutput.bind(m),t.webnnCreateTemporaryTensor=m.createTemporaryTensor.bind(m),t.webnnIsGraphInputOutputTypeSupported=m.isGraphInputOutputTypeSupported.bind(m)}};let n=()=>{let o=d=>(...m)=>{let f=tt;return m=d(...m),tt!=f?new Promise((w,T)=>{pn={resolve:w,reject:T}}):m};(()=>{for(let d of["_OrtAppendExecutionProvider","_OrtCreateSession","_OrtRun","_OrtRunWithBinding","_OrtBindInput"])t[d]=o(t[d])})(),s!==void 0&&(t._OrtRun=s(t._OrtRun),t._OrtRunWithBinding=s(t._OrtRunWithBinding)),n=void 0};t.asyncInit=()=>{n?.()};var u,l,p=(o,d)=>{throw d},h=self.location.href,c="";if(r||i){try{c=new URL(".",h).href}catch{}i&&(l=o=>{var d=new XMLHttpRequest;return d.open("GET",o,!1),d.responseType="arraybuffer",d.send(null),new Uint8Array(d.response)}),u=async o=>{if(A(o))return new Promise((m,f)=>{var w=new XMLHttpRequest;w.open("GET",o,!0),w.responseType="arraybuffer",w.onload=()=>{w.status==200||w.status==0&&w.response?m(w.response):f(w.status)},w.onerror=f,w.send(null)});var d=await fetch(o,{credentials:"same-origin"});if(d.ok)return d.arrayBuffer();throw Error(d.status+" : "+d.url)}}var g,_,y,$,S,x,b=console.log.bind(console),E=console.error.bind(console),k=b,I=E,z=!1,A=o=>o.startsWith("file://");function v(){gt.buffer!=q.buffer&&Y()}if(a){let o=function(d){try{var m=d.data,f=m.Vc;if(f==="load"){let w=[];self.onmessage=T=>w.push(T),x=()=>{postMessage({Vc:"loaded"});for(let T of w)o(T);self.onmessage=o};for(let T of m.Ad)t[T]&&!t[T].proxy||(t[T]=(...C)=>{postMessage({Vc:"callHandler",yd:T,args:C})},T=="print"&&(k=t[T]),T=="printErr"&&(I=t[T]));gt=m.Rd,Y(),_=m.Sd,Oe(),ai()}else if(f==="run"){(function(w){var T=(v(),M)[w+52>>>2>>>0];w=(v(),M)[w+56>>>2>>>0],Jh(T,T-w),oe(T)})(m.Uc),gn(m.Uc,0,0,1,0,0),Jc(),un(m.Uc),D||(jh(),D=!0);try{Mg(m.Pd,m.ed)}catch(w){if(w!="unwind")throw w}}else m.target!=="setimmediate"&&(f==="checkMailbox"?D&&Qr():f&&(I(`worker: received unknown command ${f}`),I(m)))}catch(w){throw Kh(),w}};var D=!1;self.onunhandledrejection=d=>{throw d.reason||d},self.onmessage=o}var q,Q,F,K,R,M,H,J,te,re,ne,U=!1;function Y(){var o=gt.buffer;t.HEAP8=q=new Int8Array(o),F=new Int16Array(o),t.HEAPU8=Q=new Uint8Array(o),K=new Uint16Array(o),t.HEAP32=R=new Int32Array(o),t.HEAPU32=M=new Uint32Array(o),H=new Float32Array(o),J=new Float64Array(o),te=new BigInt64Array(o),re=new BigUint64Array(o)}function X(){U=!0,a?x():ut.ub()}function V(o){throw I(o="Aborted("+o+")"),z=!0,o=new WebAssembly.RuntimeError(o+". Build with -sASSERTIONS for more info."),S?.(o),o}function Ie(){return{a:{ma:ny,hb:ay,g:Dg,J:Ug,f:Pg,o:qg,i:Lg,$:Wg,b:Vg,S:Gg,Ha:nh,n:Hg,aa:lh,Ya:dh,Da:ph,Fa:ch,Za:hh,Wa:fh,Pa:mh,Va:gh,ka:yh,Ea:_h,Ba:bh,Xa:wh,Ca:$h,cb:Fg,fa:jg,wa:Kg,ua:Xg,ea:Yg,N:Jg,H:e0,va:t0,_:u0,xa:l0,Sa:d0,za:c0,Ia:h0,sa:f0,ga:m0,Ra:un,$a:g0,Q:w0,r:k0,c:sn,ib:T0,y:I0,M:E0,D:z0,l:C0,s:zh,jb:A0,I:O0,R:R0,j:B0,u:N0,q:M0,k:D0,Ma:U0,Na:P0,Oa:q0,Ka:Rh,La:Bh,ta:Nh,eb:W0,bb:G0,v:H0,ba:F0,ha:j0,ab:V0,V:K0,_a:Z0,Aa:X0,F:L0,U:Q0,la:ri,ya:J0,gb:Y0,fb:ey,Ta:Ph,Ua:qh,Ga:en,T:Lh,Ja:Wh,ja:Vh,Qa:Gh,ia:Hh,lb:Wy,na:Dy,mb:Ly,oa:My,G:ky,e:ly,t:oy,w:sy,B:by,nb:Ry,Z:Oy,x:cy,pa:By,X:Uy,ca:Ay,ob:Cy,pb:zy,O:wy,qb:Iy,qa:Ey,rb:Ty,L:xy,Y:Ny,d:uy,A:py,m:dy,kb:Vy,p:fy,z:my,C:hy,E:gy,K:$y,ra:Sy,P:Py,da:vy,W:qy,sb:_y,tb:yy,h:ry,a:gt,db:Ja}}}async function Oe(){function o(f,w){var T=ut=f.exports;f={};for(let[C,N]of Object.entries(T))typeof N=="function"?(T=y0(N),f[C]=T):f[C]=N;return ut=f,ut=(function(){var C=ut,N=W=>se=>W(se)>>>0,L=W=>()=>W()>>>0;return(C=Object.assign({},C)).vb=N(C.vb),C.Zb=L(C.Zb),C.$b=N(C.$b),C.nc=N(C.nc),C.oc=L(C.oc),C.sc=N(C.sc),C})(),Qc.push(ut.ac),Fh=(f=ut).vb,jh=f.wb,t._OrtInit=f.xb,t._OrtGetLastError=f.yb,t._OrtCreateSessionOptions=f.zb,t._OrtAppendExecutionProvider=f.Ab,t._OrtAddFreeDimensionOverride=f.Bb,t._OrtAddSessionConfigEntry=f.Cb,t._OrtReleaseSessionOptions=f.Db,t._OrtCreateSession=f.Eb,t._OrtReleaseSession=f.Fb,t._OrtGetInputOutputCount=f.Gb,t._OrtGetInputOutputMetadata=f.Hb,t._OrtFree=f.Ib,t._OrtCreateTensor=f.Jb,t._OrtGetTensorData=f.Kb,t._OrtReleaseTensor=f.Lb,t._OrtCreateRunOptions=f.Mb,t._OrtAddRunConfigEntry=f.Nb,t._OrtReleaseRunOptions=f.Ob,t._OrtCreateBinding=f.Pb,t._OrtBindInput=f.Qb,t._OrtBindOutput=f.Rb,t._OrtClearBoundOutputs=f.Sb,t._OrtReleaseBinding=f.Tb,t._OrtRunWithBinding=f.Ub,t._OrtRun=f.Vb,t._OrtEndProfiling=f.Wb,t._JsepOutput=f.Xb,t._JsepGetNodeName=f.Yb,ii=f.Zb,rt=t._free=f._b,_r=t._malloc=f.$b,gn=f.cc,Kh=f.dc,Zh=f.ec,Xh=f.fc,yn=f.gc,Qh=f.hc,Yh=f.ic,le=f.jc,br=f.kc,Jh=f.lc,oe=f.mc,_n=f.nc,ue=f.oc,ef=f.pc,bn=f.qc,tf=f.rc,rf=f.sc,af=f.tc,wn=f.uc,nf=f.vc,sf=f.wc,of=f.xc,uf=f.yc,lf=f.zc,df=f.Ac,pf=f.Bc,cf=f.Cc,hf=f.Dc,ff=f.Ec,mf=f.Fc,gf=f.Gc,yf=f.Hc,_f=f.Ic,bf=f.Jc,wf=f.Kc,$f=f.Lc,vf=f.Mc,xf=f.Nc,Sf=f.Oc,kf=f.Pc,Tf=f.Qc,If=f.Sc,Ef=f.Tc,zf=f.cd,Cf=f.dd,Af=f.id,Of=f.nd,Rf=f.od,Bf=f.pd,Nf=f.qd,Mf=f.rd,Df=f.sd,Uf=f.td,Pf=f.ud,qf=f.zd,Lf=f.Zd,Wf=f._d,Vf=f.$d,Gf=f.ae,_=w,ut}var d,m=Ie();return t.instantiateWasm?new Promise(f=>{t.instantiateWasm(m,(w,T)=>{f(o(w,T))})}):a?o(new WebAssembly.Instance(_,Ie()),_):(ne??=t.locateFile?t.locateFile?t.locateFile("ort-wasm-simd-threaded.jsep.wasm",c):c+"ort-wasm-simd-threaded.jsep.wasm":new URL(""+new URL("ort-wasm-simd-threaded.jsep-MDYUKy93.wasm",self.location.href).href,self.location.href).href,d=await(async function(f){var w=ne;if(!g&&!A(w))try{var T=fetch(w,{credentials:"same-origin"});return await WebAssembly.instantiateStreaming(T,f)}catch(C){I(`wasm streaming compile failed: ${C}`),I("falling back to ArrayBuffer instantiation")}return(async function(C,N){try{var L=await(async function(W){if(!g)try{var se=await u(W);return new Uint8Array(se)}catch{}if(W==ne&&g)W=new Uint8Array(g);else{if(!l)throw"both async and sync fetching of the wasm failed";W=l(W)}return W})(C);return await WebAssembly.instantiate(L,N)}catch(W){I(`failed to asynchronously prepare wasm: ${W}`),V(W)}})(w,f)})(m),o(d.instance,d.module))}class xe{name="ExitStatus";constructor(d){this.message=`Program terminated with exit(${d})`,this.status=d}}var Re=o=>{o.terminate(),o.onmessage=()=>{}},ge=[],$e=0,Ne=null,Fr=o=>{mt.length==0&&(th(),eh(mt[0]));var d=mt.pop();if(!d)return 6;gr.push(d),Pt[o.Uc]=d,d.Uc=o.Uc;var m={Vc:"run",Pd:o.Od,ed:o.ed,Uc:o.Uc};return d.postMessage(m,o.md),0},Je=0,ve=(o,d,...m)=>{var f,w=16*m.length,T=ue(),C=_n(w),N=C>>>3;for(f of m)typeof f=="bigint"?((v(),te)[N++>>>0]=1n,(v(),te)[N++>>>0]=f):((v(),te)[N++>>>0]=0n,(v(),J)[N++>>>0]=f);return o=Zh(o,0,w,C,d),oe(T),o};function Ja(o){if(a)return ve(0,1,o);if(y=o,!(0<Je)){for(var d of gr)Re(d);for(d of mt)Re(d);mt=[],gr=[],Pt={},z=!0}p(0,new xe(o))}function Xc(o){if(a)return ve(1,0,o);en(o)}var en=o=>{if(y=o,a)throw Xc(o),"unwind";Ja(o)},mt=[],gr=[],Qc=[],Pt={},Yc=o=>{var d=o.Uc;delete Pt[d],mt.push(o),gr.splice(gr.indexOf(o),1),o.Uc=0,Xh(d)};function Jc(){Qc.forEach(o=>o())}var eh=o=>new Promise(d=>{o.onmessage=w=>{var T=w.data;if(w=T.Vc,T.bd&&T.bd!=ii()){var C=Pt[T.bd];C?C.postMessage(T,T.md):I(`Internal error! Worker sent a message "${w}" to target pthread ${T.bd}, but that thread no longer exists!`)}else w==="checkMailbox"?Qr():w==="spawnThread"?Fr(T):w==="cleanupThread"?Xr(()=>{Yc(Pt[T.Qd])}):w==="loaded"?(o.loaded=!0,d(o)):T.target==="setimmediate"?o.postMessage(T):w==="uncaughtException"?o.onerror(T.error):w==="callHandler"?t[T.yd](...T.args):w&&I(`worker sent an unknown command ${w}`)},o.onerror=w=>{throw I(`worker sent an error! ${w.filename}:${w.lineno}: ${w.message}`),w};var m,f=[];for(m of[])t.propertyIsEnumerable(m)&&f.push(m);o.postMessage({Vc:"load",Ad:f,Rd:gt,Sd:_})});function th(){var o=new Worker((()=>{let d=URL;return self.location.href>"file:"&&self.location.href<"file;"?new d("ort.bundle.min.mjs",self.location.href):new URL(self.location.href)})(),{type:"module",workerData:"em-pthread",name:"em-pthread"});mt.push(o)}var gt,Mg=(o,d)=>{Je=0,o=wn(o,d),0<Je?y=o:yn(o)},jr=[],Kr=0;function Dg(o){var d=new tn(o>>>=0);return(v(),q)[d.Wc+12>>>0]==0&&(rh(d,!0),Kr--),ih(d,!1),jr.push(d),rf(o)}var Xt=0,Ug=()=>{le(0,0);var o=jr.pop();ef(o.gd),Xt=0};function rh(o,d){d=d?1:0,(v(),q)[o.Wc+12>>>0]=d}function ih(o,d){d=d?1:0,(v(),q)[o.Wc+13>>>0]=d}class tn{constructor(d){this.gd=d,this.Wc=d-24}}var rn=o=>{var d=Xt;if(!d)return br(0),0;var m=new tn(d);(v(),M)[m.Wc+16>>>2>>>0]=d;var f=(v(),M)[m.Wc+4>>>2>>>0];if(!f)return br(0),d;for(var w of o){if(w===0||w===f)break;if(tf(w,f,m.Wc+16))return br(w),d}return br(f),d};function Pg(){return rn([])}function qg(o){return rn([o>>>0])}function Lg(o,d,m,f){return rn([o>>>0,d>>>0,m>>>0,f>>>0])}var Wg=()=>{var o=jr.pop();o||V("no exception to throw");var d=o.gd;throw(v(),q)[o.Wc+13>>>0]==0&&(jr.push(o),ih(o,!0),rh(o,!1),Kr++),bn(d),Xt=d};function Vg(o,d,m){var f=new tn(o>>>=0);throw d>>>=0,m>>>=0,(v(),M)[f.Wc+16>>>2>>>0]=0,(v(),M)[f.Wc+4>>>2>>>0]=d,(v(),M)[f.Wc+8>>>2>>>0]=m,bn(o),Kr++,Xt=o}var Gg=()=>Kr;function ah(o,d,m,f){return a?ve(2,1,o,d,m,f):nh(o,d,m,f)}function nh(o,d,m,f){if(o>>>=0,d>>>=0,m>>>=0,f>>>=0,!globalThis.SharedArrayBuffer)return 6;var w=[];return a&&w.length===0?ah(o,d,m,f):(o={Od:m,Uc:o,ed:f,md:w},a?(o.Vc="spawnThread",postMessage(o,w),0):Fr(o))}function Hg(o){throw Xt||=o>>>0,Xt}var sh=globalThis.TextDecoder&&new TextDecoder,oh=(o,d,m,f)=>{if(m=d+m,f)return m;for(;o[d]&&!(d>=m);)++d;return d},uh=(o,d=0,m,f)=>{if(16<(m=oh(o,d>>>=0,m,f))-d&&o.buffer&&sh)return sh.decode(o.buffer instanceof ArrayBuffer?o.subarray(d,m):o.slice(d,m));for(f="";d<m;){var w=o[d++];if(128&w){var T=63&o[d++];if((224&w)==192)f+=String.fromCharCode((31&w)<<6|T);else{var C=63&o[d++];65536>(w=(240&w)==224?(15&w)<<12|T<<6|C:(7&w)<<18|T<<12|C<<6|63&o[d++])?f+=String.fromCharCode(w):(w-=65536,f+=String.fromCharCode(55296|w>>10,56320|1023&w))}}else f+=String.fromCharCode(w)}return f},Te=(o,d,m)=>(o>>>=0)?uh((v(),Q),o,d,m):"";function lh(o,d,m){return a?ve(3,1,o,d,m):0}function dh(o,d){if(a)return ve(4,1,o,d)}function ph(o,d){if(a)return ve(5,1,o,d)}function ch(o,d,m){if(a)return ve(6,1,o,d,m)}function hh(o,d,m){return a?ve(7,1,o,d,m):0}function fh(o,d){if(a)return ve(8,1,o,d)}function mh(o,d,m){if(a)return ve(9,1,o,d,m)}function gh(o,d,m,f){if(a)return ve(10,1,o,d,m,f)}function yh(o,d,m,f){if(a)return ve(11,1,o,d,m,f)}function _h(o,d,m,f){if(a)return ve(12,1,o,d,m,f)}function bh(o){if(a)return ve(13,1,o)}function wh(o,d){if(a)return ve(14,1,o,d)}function $h(o,d,m){if(a)return ve(15,1,o,d,m)}var Fg=()=>V(""),et=o=>{o>>>=0;for(var d="";;){var m=(v(),Q)[o++>>>0];if(!m)return d;d+=String.fromCharCode(m)}},an={},nn={},Qt=class extends Error{constructor(o){super(o),this.name="BindingError"}};function ot(o,d,m={}){return(function(f,w,T={}){var C=w.name;if(!f)throw new Qt(`type "${C}" must have a positive integer typeid pointer`);if(nn.hasOwnProperty(f)){if(T.Bd)return;throw new Qt(`Cannot register type '${C}' twice`)}nn[f]=w,an.hasOwnProperty(f)&&(w=an[f],delete an[f],w.forEach(N=>N()))})(o,d,m)}var vh=(o,d,m)=>{switch(d){case 1:return m?f=>(v(),q)[f>>>0]:f=>(v(),Q)[f>>>0];case 2:return m?f=>(v(),F)[f>>>1>>>0]:f=>(v(),K)[f>>>1>>>0];case 4:return m?f=>(v(),R)[f>>>2>>>0]:f=>(v(),M)[f>>>2>>>0];case 8:return m?f=>(v(),te)[f>>>3>>>0]:f=>(v(),re)[f>>>3>>>0];default:throw new TypeError(`invalid integer width (${d}): ${o}`)}};function jg(o,d,m,f,w){o>>>=0,m>>>=0,d=et(d>>>0);let T=C=>C;if(f=f===0n){let C=8*m;T=N=>BigInt.asUintN(C,N),w=T(w)}ot(o,{name:d,Rc:T,Yc:(C,N)=>(typeof N=="number"&&(N=BigInt(N)),N),Xc:vh(d,m,!f),Zc:null})}function Kg(o,d,m,f){ot(o>>>=0,{name:d=et(d>>>0),Rc:function(w){return!!w},Yc:function(w,T){return T?m:f},Xc:function(w){return this.Rc((v(),Q)[w>>>0])},Zc:null})}var xh=[],qt=[0,1,,1,null,1,!0,1,!1,1];function sn(o){9<(o>>>=0)&&--qt[o+1]===0&&(qt[o]=void 0,xh.push(o))}var We=o=>{if(!o)throw new Qt(`Cannot use deleted val. handle = ${o}`);return qt[o]},Xe=o=>{switch(o){case void 0:return 2;case null:return 4;case!0:return 6;case!1:return 8;default:let d=xh.pop()||qt.length;return qt[d]=o,qt[d+1]=1,d}};function on(o){return this.Rc((v(),M)[o>>>2>>>0])}var Zg={name:"emscripten::val",Rc:o=>{var d=We(o);return sn(o),d},Yc:(o,d)=>Xe(d),Xc:on,Zc:null};function Xg(o){return ot(o>>>0,Zg)}var Qg=(o,d)=>{switch(d){case 4:return function(m){return this.Rc((v(),H)[m>>>2>>>0])};case 8:return function(m){return this.Rc((v(),J)[m>>>3>>>0])};default:throw new TypeError(`invalid float width (${d}): ${o}`)}};function Yg(o,d,m){m>>>=0,ot(o>>>=0,{name:d=et(d>>>0),Rc:f=>f,Yc:(f,w)=>w,Xc:Qg(d,m),Zc:null})}function Jg(o,d,m,f,w){o>>>=0,m>>>=0,d=et(d>>>0);let T=N=>N;if(f===0){var C=32-8*m;T=N=>N<<C>>>C,w=T(w)}ot(o,{name:d,Rc:T,Yc:(N,L)=>L,Xc:vh(d,m,f!==0),Zc:null})}function e0(o,d,m){function f(T){var C=(v(),M)[T>>>2>>>0];return T=(v(),M)[T+4>>>2>>>0],new w((v(),q).buffer,T,C)}var w=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array,BigInt64Array,BigUint64Array][d];ot(o>>>=0,{name:m=et(m>>>0),Rc:f,Xc:f},{Bd:!0})}var yt=(o,d,m)=>{var f=(v(),Q);if(d>>>=0,0<m){var w=d;m=d+m-1;for(var T=0;T<o.length;++T){var C=o.codePointAt(T);if(127>=C){if(d>=m)break;f[d++>>>0]=C}else if(2047>=C){if(d+1>=m)break;f[d++>>>0]=192|C>>6,f[d++>>>0]=128|63&C}else if(65535>=C){if(d+2>=m)break;f[d++>>>0]=224|C>>12,f[d++>>>0]=128|C>>6&63,f[d++>>>0]=128|63&C}else{if(d+3>=m)break;f[d++>>>0]=240|C>>18,f[d++>>>0]=128|C>>12&63,f[d++>>>0]=128|C>>6&63,f[d++>>>0]=128|63&C,T++}}f[d>>>0]=0,o=d-w}else o=0;return o},Zr=o=>{for(var d=0,m=0;m<o.length;++m){var f=o.charCodeAt(m);127>=f?d++:2047>=f?d+=2:55296<=f&&57343>=f?(d+=4,++m):d+=3}return d};function t0(o,d){ot(o>>>=0,{name:d=et(d>>>0),Rc(m){var f=(v(),M)[m>>>2>>>0];return f=Te(m+4,f,!0),rt(m),f},Yc(m,f){f instanceof ArrayBuffer&&(f=new Uint8Array(f));var w=typeof f=="string";if(!(w||ArrayBuffer.isView(f)&&f.BYTES_PER_ELEMENT==1))throw new Qt("Cannot pass non-string to std::string");var T=w?Zr(f):f.length,C=_r(4+T+1),N=C+4;return(v(),M)[C>>>2>>>0]=T,w?yt(f,N,T+1):(v(),Q).set(f,N>>>0),m!==null&&m.push(rt,C),C},Xc:on,Zc(m){rt(m)}})}var Sh=globalThis.TextDecoder?new TextDecoder("utf-16le"):void 0,r0=(o,d,m)=>{if(o>>>=1,16<(d=oh((v(),K),o,d/2,m))-o&&Sh)return Sh.decode((v(),K).slice(o,d));for(m="";o<d;++o){var f=(v(),K)[o>>>0];m+=String.fromCharCode(f)}return m},i0=(o,d,m)=>{if(m??=2147483647,2>m)return 0;var f=d;m=(m-=2)<2*o.length?m/2:o.length;for(var w=0;w<m;++w){var T=o.charCodeAt(w);(v(),F)[d>>>1>>>0]=T,d+=2}return(v(),F)[d>>>1>>>0]=0,d-f},a0=o=>2*o.length,n0=(o,d,m)=>{var f="";o>>>=2;for(var w=0;!(w>=d/4);w++){var T=(v(),M)[o+w>>>0];if(!T&&!m)break;f+=String.fromCodePoint(T)}return f},s0=(o,d,m)=>{if(d>>>=0,m??=2147483647,4>m)return 0;var f=d;m=f+m-4;for(var w=0;w<o.length;++w){var T=o.codePointAt(w);if(65535<T&&w++,(v(),R)[d>>>2>>>0]=T,(d+=4)+4>m)break}return(v(),R)[d>>>2>>>0]=0,d-f},o0=o=>{for(var d=0,m=0;m<o.length;++m)65535<o.codePointAt(m)&&m++,d+=4;return d};function u0(o,d,m){if(o>>>=0,d>>>=0,m=et(m>>>=0),d===2)var f=r0,w=i0,T=a0;else f=n0,w=s0,T=o0;ot(o,{name:m,Rc:C=>{var N=(v(),M)[C>>>2>>>0];return N=f(C+4,N*d,!0),rt(C),N},Yc:(C,N)=>{if(typeof N!="string")throw new Qt(`Cannot pass non-string to C++ string type ${m}`);var L=T(N),W=_r(4+L+d);return(v(),M)[W>>>2>>>0]=L/d,w(N,W+4,L+d),C!==null&&C.push(rt,W),W},Xc:on,Zc(C){rt(C)}})}function l0(o,d){ot(o>>>=0,{Cd:!0,name:d=et(d>>>0),Rc:()=>{},Yc:()=>{}})}function d0(o){gn(o>>>0,!i,1,!r,131072,!1),Jc()}var Xr=o=>{if(!z)try{if(o(),!(0<Je))try{a?ii()&&yn(y):en(y)}catch(d){d instanceof xe||d=="unwind"||p(0,d)}}catch(d){d instanceof xe||d=="unwind"||p(0,d)}},p0=!Atomics.waitAsync||globalThis.navigator?.userAgent&&91>Number((navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)||[])[2]);function un(o){o>>>=0,p0||(Atomics.waitAsync((v(),R),o>>>2,o).value.then(Qr),o+=128,Atomics.store((v(),R),o>>>2,1))}var Qr=()=>Xr(()=>{var o=ii();o&&(un(o),Yh())});function c0(o,d){(o>>>=0)==d>>>0?setTimeout(Qr):a?postMessage({bd:o,Vc:"checkMailbox"}):(o=Pt[o])&&o.postMessage({Vc:"checkMailbox"})}var ln=[];function h0(o,d,m,f,w){for(d>>>=0,w>>>=0,ln.length=0,m=w>>>3,f=w+f>>>3;m<f;){var T;T=(v(),te)[m++>>>0]?(v(),te)[m++>>>0]:(v(),J)[m++>>>0],ln.push(T)}return(d?$n[d]:iy[o])(...ln)}var f0=()=>{Je=0};function m0(o){o>>>=0,a?postMessage({Vc:"cleanupThread",Qd:o}):Yc(Pt[o])}function g0(o){}var Yr=o=>{try{o()}catch(d){V(d)}};function y0(o){var d=(...m)=>{Jr.push(o);try{return o(...m)}finally{z||(Jr.pop(),tt&&_t===1&&Jr.length===0&&(_t=0,Je+=1,Yr(Wf),typeof Fibers<"u"&&Fibers.de()))}};return Ih.set(o,d),d}var _t=0,tt=null,kh=0,Jr=[],dn=new Map,Th=new Map,Ih=new Map,_0=0,pn=null,b0=[],Eh=o=>(function(d){if(!z){if(_t===0){var m=!1,f=!1;d((w=0)=>{if(!z&&(kh=w,m=!0,f)){_t=2,Yr(()=>Vf(tt)),typeof MainLoop<"u"&&MainLoop.xd&&MainLoop.resume(),w=!1;try{var T=(function(){var L=(v(),R)[tt+8>>>2>>>0];return L=Th.get(L),L=Ih.get(L),--Je,L()})()}catch(L){T=L,w=!0}var C=!1;if(!tt){var N=pn;N&&(pn=null,(w?N.reject:N.resolve)(T),C=!0)}if(w&&!C)throw T}}),f=!0,m||(_t=1,tt=(function(){var w=_r(65548),T=w+12;if((v(),M)[w>>>2>>>0]=T,(v(),M)[w+4>>>2>>>0]=T+65536,T=Jr[0],!dn.has(T)){var C=_0++;dn.set(T,C),Th.set(C,T)}return T=dn.get(T),(v(),R)[w+8>>>2>>>0]=T,w})(),typeof MainLoop<"u"&&MainLoop.xd&&MainLoop.pause(),Yr(()=>Lf(tt)))}else _t===2?(_t=0,Yr(Gf),rt(tt),tt=null,b0.forEach(Xr)):V(`invalid state: ${_t}`);return kh}})(d=>{o().then(d)});function w0(o){return o>>>=0,Eh(async()=>{var d=await We(o);return Xe(d)})}var cn=[],$0=o=>{var d=cn.length;return cn.push(o),d},v0=(o,d)=>{for(var m=Array(o),f=0;f<o;++f){var w=f,T=(v(),M)[d+4*f>>>2>>>0],C=nn[T];if(C===void 0)throw o=`parameter ${f}`,T=Fh(T),d=et(T),rt(T),new Qt(`${o} has unknown type ${d}`);m[w]=C}return m},x0=(o,d,m)=>{var f=[];return o=o(f,m),f.length&&((v(),M)[d>>>2>>>0]=Xe(f)),o},S0={},ei=o=>{var d=S0[o];return d===void 0?et(o):d};function k0(o,d,m){var[f,...w]=v0(o,d>>>0);d=f.Yc.bind(f);var T=w.map(L=>L.Xc.bind(L));o--;var C={toValue:We};switch(o=T.map((L,W)=>{var se=`argFromPtr${W}`;return C[se]=L,`${se}(args${W?"+"+8*W:""})`}),m){case 0:var N="toValue(handle)";break;case 2:N="new (toValue(handle))";break;case 3:N="";break;case 1:C.getStringOrSymbol=ei,N="toValue(handle)[getStringOrSymbol(methodName)]"}return N+=`(${o})`,f.Cd||(C.toReturnWire=d,C.emval_returnValue=x0,N=`return emval_returnValue(toReturnWire, destructorsRef, ${N})`),N=`return function (handle, methodName, destructorsRef, args) {
  ${N}
  }`,m=new Function(Object.keys(C),N)(...Object.values(C)),N=`methodCaller<(${w.map(L=>L.name)}) => ${f.name}>`,$0(Object.defineProperty(m,"name",{value:N}))}function T0(o,d){return d>>>=0,(o=We(o>>>0))==We(d)}function I0(o){return(o>>>=0)?(o=ei(o),Xe(globalThis[o])):Xe(globalThis)}function E0(o){return o=ei(o>>>0),Xe(t[o])}function z0(o,d){return d>>>=0,o=We(o>>>0),d=We(d),Xe(o[d])}function C0(o){9<(o>>>=0)&&(qt[o+1]+=1)}function zh(o,d,m,f,w){return cn[o>>>0](d>>>0,m>>>0,f>>>0,w>>>0)}function A0(o,d,m,f,w){return zh(o>>>0,d>>>0,m>>>0,f>>>0,w>>>0)}function O0(){return Xe([])}function R0(o){o=We(o>>>0);for(var d=Array(o.length),m=0;m<o.length;m++)d[m]=o[m];return Xe(d)}function B0(o){return Xe(ei(o>>>0))}function N0(){return Xe({})}function M0(o){for(var d=We(o>>>=0);d.length;){var m=d.pop();d.pop()(m)}sn(o)}function D0(o,d,m){d>>>=0,m>>>=0,o=We(o>>>0),d=We(d),m=We(m),o[d]=m}function U0(o,d){o=-9007199254740992>o||9007199254740992<o?NaN:Number(o),d>>>=0,o=new Date(1e3*o),(v(),R)[d>>>2>>>0]=o.getUTCSeconds(),(v(),R)[d+4>>>2>>>0]=o.getUTCMinutes(),(v(),R)[d+8>>>2>>>0]=o.getUTCHours(),(v(),R)[d+12>>>2>>>0]=o.getUTCDate(),(v(),R)[d+16>>>2>>>0]=o.getUTCMonth(),(v(),R)[d+20>>>2>>>0]=o.getUTCFullYear()-1900,(v(),R)[d+24>>>2>>>0]=o.getUTCDay(),o=(o.getTime()-Date.UTC(o.getUTCFullYear(),0,1,0,0,0,0))/864e5|0,(v(),R)[d+28>>>2>>>0]=o}var Ch=o=>o%4==0&&(o%100!=0||o%400==0),Ah=[0,31,60,91,121,152,182,213,244,274,305,335],Oh=[0,31,59,90,120,151,181,212,243,273,304,334];function P0(o,d){o=-9007199254740992>o||9007199254740992<o?NaN:Number(o),d>>>=0,o=new Date(1e3*o),(v(),R)[d>>>2>>>0]=o.getSeconds(),(v(),R)[d+4>>>2>>>0]=o.getMinutes(),(v(),R)[d+8>>>2>>>0]=o.getHours(),(v(),R)[d+12>>>2>>>0]=o.getDate(),(v(),R)[d+16>>>2>>>0]=o.getMonth(),(v(),R)[d+20>>>2>>>0]=o.getFullYear()-1900,(v(),R)[d+24>>>2>>>0]=o.getDay();var m=(Ch(o.getFullYear())?Ah:Oh)[o.getMonth()]+o.getDate()-1|0;(v(),R)[d+28>>>2>>>0]=m,(v(),R)[d+36>>>2>>>0]=-60*o.getTimezoneOffset(),m=new Date(o.getFullYear(),6,1).getTimezoneOffset();var f=new Date(o.getFullYear(),0,1).getTimezoneOffset();o=0|(m!=f&&o.getTimezoneOffset()==Math.min(f,m)),(v(),R)[d+32>>>2>>>0]=o}function q0(o){o>>>=0;var d=new Date((v(),R)[o+20>>>2>>>0]+1900,(v(),R)[o+16>>>2>>>0],(v(),R)[o+12>>>2>>>0],(v(),R)[o+8>>>2>>>0],(v(),R)[o+4>>>2>>>0],(v(),R)[o>>>2>>>0],0),m=(v(),R)[o+32>>>2>>>0],f=d.getTimezoneOffset(),w=new Date(d.getFullYear(),6,1).getTimezoneOffset(),T=new Date(d.getFullYear(),0,1).getTimezoneOffset(),C=Math.min(T,w);return 0>m?(v(),R)[o+32>>>2>>>0]=+(w!=T&&C==f):0<m!=(C==f)&&(w=Math.max(T,w),d.setTime(d.getTime()+6e4*((0<m?C:w)-f))),(v(),R)[o+24>>>2>>>0]=d.getDay(),m=(Ch(d.getFullYear())?Ah:Oh)[d.getMonth()]+d.getDate()-1|0,(v(),R)[o+28>>>2>>>0]=m,(v(),R)[o>>>2>>>0]=d.getSeconds(),(v(),R)[o+4>>>2>>>0]=d.getMinutes(),(v(),R)[o+8>>>2>>>0]=d.getHours(),(v(),R)[o+12>>>2>>>0]=d.getDate(),(v(),R)[o+16>>>2>>>0]=d.getMonth(),(v(),R)[o+20>>>2>>>0]=d.getYear(),o=d.getTime(),BigInt(isNaN(o)?-1:o/1e3)}function Rh(o,d,m,f,w,T,C){return a?ve(16,1,o,d,m,f,w,T,C):-52}function Bh(o,d,m,f,w,T){if(a)return ve(17,1,o,d,m,f,w,T)}var yr={},L0=()=>performance.timeOrigin+performance.now();function Nh(o,d){if(a)return ve(18,1,o,d);if(yr[o]&&(clearTimeout(yr[o].id),delete yr[o]),!d)return 0;var m=setTimeout(()=>{delete yr[o],Xr(()=>Qh(o,performance.timeOrigin+performance.now()))},d);return yr[o]={id:m,ce:d},0}function W0(o,d,m,f){o>>>=0,d>>>=0,m>>>=0,f>>>=0;var w=new Date().getFullYear(),T=new Date(w,0,1).getTimezoneOffset();w=new Date(w,6,1).getTimezoneOffset();var C=Math.max(T,w);(v(),M)[o>>>2>>>0]=60*C,(v(),R)[d>>>2>>>0]=+(T!=w),o=(d=N=>{var L=Math.abs(N);return`UTC${0<=N?"-":"+"}${String(Math.floor(L/60)).padStart(2,"0")}${String(L%60).padStart(2,"0")}`})(T),d=d(w),w<T?(yt(o,m,17),yt(d,f,17)):(yt(o,f,17),yt(d,m,17))}var V0=()=>Date.now();function G0(o,d,m){return m>>>=0,0<=o&&3>=o?(o===0?o=Date.now():o=performance.timeOrigin+performance.now(),o=Math.round(1e6*o),(v(),te)[m>>>3>>>0]=BigInt(o),0):28}var hn=[],Mh=(o,d)=>{hn.length=0;for(var m;m=(v(),Q)[o++>>>0];){var f=m!=105;d+=(f&=m!=112)&&d%8?4:0,hn.push(m==112?(v(),M)[d>>>2>>>0]:m==106?(v(),te)[d>>>3>>>0]:m==105?(v(),R)[d>>>2>>>0]:(v(),J)[d>>>3>>>0]),d+=f?8:4}return hn};function H0(o,d,m){return o>>>=0,d=Mh(d>>>0,m>>>0),$n[o](...d)}function F0(o,d,m){return o>>>=0,d=Mh(d>>>0,m>>>0),$n[o](...d)}var j0=()=>{};function K0(o,d){return I(Te(o>>>0,d>>>0))}var Z0=()=>{throw Je+=1,"unwind"};function X0(){return 4294901760}var Q0=()=>navigator.hardwareConcurrency,Lt={},ti=o=>{var d;return(d=/\bwasm-function\[\d+\]:(0x[0-9a-f]+)/.exec(o))?+d[1]:(d=/:(\d+):\d+(?:\)|$)/.exec(o))?2147483648|+d[1]:0},Dh=o=>{for(var d of o)(o=ti(d))&&(Lt[o]=d)};function Y0(){var o=Error().stack.toString().split(`
`);return o[0]=="Error"&&o.shift(),Dh(o),Lt.kd=ti(o[3]),Lt.Md=o,Lt.kd}function ri(o){if(!(o=Lt[o>>>0]))return 0;var d;if(d=/^\s+at .*\.wasm\.(.*) \(.*\)$/.exec(o))o=d[1];else if(d=/^\s+at (.*) \(.*\)$/.exec(o))o=d[1];else{if(!(d=/^(.+?)@/.exec(o)))return 0;o=d[1]}rt(ri.ld??0),d=Zr(o)+1;var m=_r(d);return m&&yt(o,m,d),ri.ld=m,ri.ld}function J0(o){o>>>=0;var d=(v(),Q).length;if(o<=d||4294901760<o)return!1;for(var m=1;4>=m;m*=2){var f=d*(1+.2/m);f=Math.min(f,o+100663296);e:{f=(Math.min(4294901760,65536*Math.ceil(Math.max(o,f)/65536))-gt.buffer.byteLength+65535)/65536|0;try{gt.grow(f),Y();var w=1;break e}catch{}w=void 0}if(w)return!0}return!1}function ey(o,d,m){if(o>>>=0,d>>>=0,Lt.kd==o)var f=Lt.Md;else(f=Error().stack.toString().split(`
`))[0]=="Error"&&f.shift(),Dh(f);for(var w=3;f[w]&&ti(f[w])!=o;)++w;for(o=0;o<m&&f[o+w];++o)(v(),R)[d+4*o>>>2>>>0]=ti(f[o+w]);return o}var fn,mn={},Uh=()=>{if(!fn){var o,d={USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user",LANG:(globalThis.navigator?.language??"C").replace("-","_")+".UTF-8",_:"./this.program"};for(o in mn)mn[o]===void 0?delete d[o]:d[o]=mn[o];var m=[];for(o in d)m.push(`${o}=${d[o]}`);fn=m}return fn};function Ph(o,d){if(a)return ve(19,1,o,d);o>>>=0,d>>>=0;var m,f=0,w=0;for(m of Uh()){var T=d+f;(v(),M)[o+w>>>2>>>0]=T,f+=yt(m,T,1/0)+1,w+=4}return 0}function qh(o,d){if(a)return ve(20,1,o,d);o>>>=0,d>>>=0;var m=Uh();for(var f of((v(),M)[o>>>2>>>0]=m.length,o=0,m))o+=Zr(f)+1;return(v(),M)[d>>>2>>>0]=o,0}function Lh(o){return a?ve(21,1,o):52}function Wh(o,d,m,f,w){return a?ve(22,1,o,d,m,f,w):52}function Vh(o,d,m,f){return a?ve(23,1,o,d,m,f):52}function Gh(o,d,m,f){return a?ve(24,1,o,d,m,f):70}var ty=[null,[],[]];function Hh(o,d,m,f){if(a)return ve(25,1,o,d,m,f);d>>>=0,m>>>=0,f>>>=0;for(var w=0,T=0;T<m;T++){var C=(v(),M)[d>>>2>>>0],N=(v(),M)[d+4>>>2>>>0];d+=8;for(var L=0;L<N;L++){var W=o,se=(v(),Q)[C+L>>>0],ce=ty[W];se===0||se===10?((W===1?k:I)(uh(ce)),ce.length=0):ce.push(se)}w+=N}return(v(),M)[f>>>2>>>0]=w,0}function ry(o){return o>>>0}a||(function(){for(var o=t.numThreads-1;o--;)th();ge.push(async()=>{var d=(async function(){if(!a)return Promise.all(mt.map(eh))})();$e++,await d,--$e==0&&Ne&&(d=Ne,Ne=null,d())})})(),a||(gt=new WebAssembly.Memory({initial:256,maximum:65536,shared:!0}),Y()),t.wasmBinary&&(g=t.wasmBinary),t.stackSave=()=>ue(),t.stackRestore=o=>oe(o),t.stackAlloc=o=>_n(o),t.setValue=function(o,d,m="i8"){switch(m.endsWith("*")&&(m="*"),m){case"i1":case"i8":(v(),q)[o>>>0]=d;break;case"i16":(v(),F)[o>>>1>>>0]=d;break;case"i32":(v(),R)[o>>>2>>>0]=d;break;case"i64":(v(),te)[o>>>3>>>0]=BigInt(d);break;case"float":(v(),H)[o>>>2>>>0]=d;break;case"double":(v(),J)[o>>>3>>>0]=d;break;case"*":(v(),M)[o>>>2>>>0]=d;break;default:V(`invalid type for setValue: ${m}`)}},t.getValue=function(o,d="i8"){switch(d.endsWith("*")&&(d="*"),d){case"i1":case"i8":return(v(),q)[o>>>0];case"i16":return(v(),F)[o>>>1>>>0];case"i32":return(v(),R)[o>>>2>>>0];case"i64":return(v(),te)[o>>>3>>>0];case"float":return(v(),H)[o>>>2>>>0];case"double":return(v(),J)[o>>>3>>>0];case"*":return(v(),M)[o>>>2>>>0];default:V(`invalid type for getValue: ${d}`)}},t.UTF8ToString=Te,t.stringToUTF8=yt,t.lengthBytesUTF8=Zr;var Fh,jh,ii,rt,_r,gn,Kh,Zh,Xh,yn,Qh,Yh,le,br,Jh,oe,_n,ue,ef,bn,tf,rf,af,wn,nf,sf,of,uf,lf,df,pf,cf,hf,ff,mf,gf,yf,_f,bf,wf,$f,vf,xf,Sf,kf,Tf,If,Ef,zf,Cf,Af,Of,Rf,Bf,Nf,Mf,Df,Uf,Pf,qf,Lf,Wf,Vf,Gf,ut,iy=[Ja,Xc,ah,lh,dh,ph,ch,hh,fh,mh,gh,yh,_h,bh,wh,$h,Rh,Bh,Nh,Ph,qh,Lh,Wh,Vh,Gh,Hh],$n={1086876:(o,d,m,f,w)=>{if(t===void 0||!t.ad)return 1;if((o=Te(Number(o>>>0))).startsWith("./")&&(o=o.substring(2)),!(o=t.ad.get(o)))return 2;if(d=Number(d>>>0),m=Number(m>>>0),f=Number(f>>>0),d+m>o.byteLength)return 3;try{let T=o.subarray(d,d+m);switch(w){case 0:(v(),Q).set(T,f>>>0);break;case 1:t.Td?t.Td(f,T):t.Ld(f,T);break;default:return 4}return 0}catch{return 4}},1087700:(o,d,m)=>{t.wd(o,(v(),Q).subarray(d>>>0,d+m>>>0))},1087764:()=>t.Vd(),1087806:o=>{t.vd(o)},1087843:()=>{t.Ed()},1087874:()=>{t.Fd()},1087903:()=>{t.Jd()},1087928:o=>t.Dd(o),1087961:o=>t.Hd(o),1087993:(o,d,m)=>{t.jd(Number(o),Number(d),Number(m),!0)},1088056:(o,d,m)=>{t.jd(Number(o),Number(d),Number(m))},1088113:()=>typeof wasmOffsetConverter<"u",1088170:o=>{t.bc("Abs",o,void 0)},1088221:o=>{t.bc("Neg",o,void 0)},1088272:o=>{t.bc("Floor",o,void 0)},1088325:o=>{t.bc("Ceil",o,void 0)},1088377:o=>{t.bc("Reciprocal",o,void 0)},1088435:o=>{t.bc("Sqrt",o,void 0)},1088487:o=>{t.bc("Exp",o,void 0)},1088538:o=>{t.bc("Erf",o,void 0)},1088589:o=>{t.bc("Sigmoid",o,void 0)},1088644:(o,d,m)=>{t.bc("HardSigmoid",o,{alpha:d,beta:m})},1088723:o=>{t.bc("HardSwish",o,void 0)},1088780:o=>{t.bc("Log",o,void 0)},1088831:o=>{t.bc("Sin",o,void 0)},1088882:o=>{t.bc("Cos",o,void 0)},1088933:o=>{t.bc("Tan",o,void 0)},1088984:o=>{t.bc("Asin",o,void 0)},1089036:o=>{t.bc("Acos",o,void 0)},1089088:o=>{t.bc("Atan",o,void 0)},1089140:o=>{t.bc("Sinh",o,void 0)},1089192:o=>{t.bc("Cosh",o,void 0)},1089244:o=>{t.bc("Asinh",o,void 0)},1089297:o=>{t.bc("Acosh",o,void 0)},1089350:o=>{t.bc("Atanh",o,void 0)},1089403:o=>{t.bc("Tanh",o,void 0)},1089455:o=>{t.bc("Not",o,void 0)},1089506:(o,d,m)=>{t.bc("Clip",o,{min:d,max:m})},1089575:o=>{t.bc("Clip",o,void 0)},1089627:(o,d)=>{t.bc("Elu",o,{alpha:d})},1089685:o=>{t.bc("Gelu",o,void 0)},1089737:o=>{t.bc("Relu",o,void 0)},1089789:(o,d)=>{t.bc("LeakyRelu",o,{alpha:d})},1089853:(o,d)=>{t.bc("ThresholdedRelu",o,{alpha:d})},1089923:(o,d)=>{t.bc("Cast",o,{to:d})},1089981:o=>{t.bc("Add",o,void 0)},1090032:o=>{t.bc("Sub",o,void 0)},1090083:o=>{t.bc("Mul",o,void 0)},1090134:o=>{t.bc("Div",o,void 0)},1090185:o=>{t.bc("Pow",o,void 0)},1090236:o=>{t.bc("Equal",o,void 0)},1090289:o=>{t.bc("Greater",o,void 0)},1090344:o=>{t.bc("GreaterOrEqual",o,void 0)},1090406:o=>{t.bc("Less",o,void 0)},1090458:o=>{t.bc("LessOrEqual",o,void 0)},1090517:(o,d,m,f,w)=>{t.bc("ReduceMean",o,{keepDims:!!d,noopWithEmptyAxes:!!m,axes:f?Array.from((v(),R).subarray(Number(f)>>>0,Number(w)>>>0)):[]})},1090692:(o,d,m,f,w)=>{t.bc("ReduceMax",o,{keepDims:!!d,noopWithEmptyAxes:!!m,axes:f?Array.from((v(),R).subarray(Number(f)>>>0,Number(w)>>>0)):[]})},1090866:(o,d,m,f,w)=>{t.bc("ReduceMin",o,{keepDims:!!d,noopWithEmptyAxes:!!m,axes:f?Array.from((v(),R).subarray(Number(f)>>>0,Number(w)>>>0)):[]})},1091040:(o,d,m,f,w)=>{t.bc("ReduceProd",o,{keepDims:!!d,noopWithEmptyAxes:!!m,axes:f?Array.from((v(),R).subarray(Number(f)>>>0,Number(w)>>>0)):[]})},1091215:(o,d,m,f,w)=>{t.bc("ReduceSum",o,{keepDims:!!d,noopWithEmptyAxes:!!m,axes:f?Array.from((v(),R).subarray(Number(f)>>>0,Number(w)>>>0)):[]})},1091389:(o,d,m,f,w)=>{t.bc("ReduceL1",o,{keepDims:!!d,noopWithEmptyAxes:!!m,axes:f?Array.from((v(),R).subarray(Number(f)>>>0,Number(w)>>>0)):[]})},1091562:(o,d,m,f,w)=>{t.bc("ReduceL2",o,{keepDims:!!d,noopWithEmptyAxes:!!m,axes:f?Array.from((v(),R).subarray(Number(f)>>>0,Number(w)>>>0)):[]})},1091735:(o,d,m,f,w)=>{t.bc("ReduceLogSum",o,{keepDims:!!d,noopWithEmptyAxes:!!m,axes:f?Array.from((v(),R).subarray(Number(f)>>>0,Number(w)>>>0)):[]})},1091912:(o,d,m,f,w)=>{t.bc("ReduceSumSquare",o,{keepDims:!!d,noopWithEmptyAxes:!!m,axes:f?Array.from((v(),R).subarray(Number(f)>>>0,Number(w)>>>0)):[]})},1092092:(o,d,m,f,w)=>{t.bc("ReduceLogSumExp",o,{keepDims:!!d,noopWithEmptyAxes:!!m,axes:f?Array.from((v(),R).subarray(Number(f)>>>0,Number(w)>>>0)):[]})},1092272:o=>{t.bc("Where",o,void 0)},1092325:(o,d,m)=>{t.bc("Transpose",o,{perm:d?Array.from((v(),R).subarray(Number(d)>>>0,Number(m)>>>0)):[]})},1092449:(o,d,m,f)=>{t.bc("DepthToSpace",o,{blocksize:d,mode:Te(m),format:f?"NHWC":"NCHW"})},1092582:(o,d,m,f)=>{t.bc("DepthToSpace",o,{blocksize:d,mode:Te(m),format:f?"NHWC":"NCHW"})},1092715:(o,d,m,f)=>{t.bc("DFT",o,{axis:d,inverse:m,onesided:f})},1092807:(o,d,m,f,w,T,C,N,L,W,se,ce,ye,we,bt)=>{t.bc("ConvTranspose",o,{format:L?"NHWC":"NCHW",autoPad:d,dilations:[m],group:f,kernelShape:[w],pads:[T,C],strides:[N],wIsConst:()=>!!(v(),q)[W>>>0],outputPadding:se?Array.from((v(),R).subarray(Number(se)>>>0,Number(ce)>>>0)):[],outputShape:ye?Array.from((v(),R).subarray(Number(ye)>>>0,Number(we)>>>0)):[],activation:Te(bt)})},1093240:(o,d,m,f,w,T,C,N,L,W,se,ce,ye,we)=>{t.bc("ConvTranspose",o,{format:N?"NHWC":"NCHW",autoPad:d,dilations:Array.from((v(),R).subarray(Number(m)>>>0,(Number(m)>>>0)+2>>>0)),group:f,kernelShape:Array.from((v(),R).subarray(Number(w)>>>0,(Number(w)>>>0)+2>>>0)),pads:Array.from((v(),R).subarray(Number(T)>>>0,(Number(T)>>>0)+4>>>0)),strides:Array.from((v(),R).subarray(Number(C)>>>0,(Number(C)>>>0)+2>>>0)),wIsConst:()=>!!(v(),q)[L>>>0],outputPadding:W?Array.from((v(),R).subarray(Number(W)>>>0,Number(se)>>>0)):[],outputShape:ce?Array.from((v(),R).subarray(Number(ce)>>>0,Number(ye)>>>0)):[],activation:Te(we)})},1093901:(o,d,m,f,w,T,C,N,L,W,se,ce,ye,we,bt)=>{t.bc("ConvTranspose",o,{format:L?"NHWC":"NCHW",autoPad:d,dilations:[m],group:f,kernelShape:[w],pads:[T,C],strides:[N],wIsConst:()=>!!(v(),q)[W>>>0],outputPadding:se?Array.from((v(),R).subarray(Number(se)>>>0,Number(ce)>>>0)):[],outputShape:ye?Array.from((v(),R).subarray(Number(ye)>>>0,Number(we)>>>0)):[],activation:Te(bt)})},1094334:(o,d,m,f,w,T,C,N,L,W,se,ce,ye,we)=>{t.bc("ConvTranspose",o,{format:N?"NHWC":"NCHW",autoPad:d,dilations:Array.from((v(),R).subarray(Number(m)>>>0,(Number(m)>>>0)+2>>>0)),group:f,kernelShape:Array.from((v(),R).subarray(Number(w)>>>0,(Number(w)>>>0)+2>>>0)),pads:Array.from((v(),R).subarray(Number(T)>>>0,(Number(T)>>>0)+4>>>0)),strides:Array.from((v(),R).subarray(Number(C)>>>0,(Number(C)>>>0)+2>>>0)),wIsConst:()=>!!(v(),q)[L>>>0],outputPadding:W?Array.from((v(),R).subarray(Number(W)>>>0,Number(se)>>>0)):[],outputShape:ce?Array.from((v(),R).subarray(Number(ce)>>>0,Number(ye)>>>0)):[],activation:Te(we)})},1094995:(o,d)=>{t.bc("GlobalAveragePool",o,{format:d?"NHWC":"NCHW"})},1095086:(o,d,m,f,w,T,C,N,L,W,se,ce,ye,we)=>{t.bc("AveragePool",o,{format:we?"NHWC":"NCHW",auto_pad:d,ceil_mode:m,count_include_pad:f,storage_order:w,dilations:T?Array.from((v(),R).subarray(Number(T)>>>0,Number(C)>>>0)):[],kernel_shape:N?Array.from((v(),R).subarray(Number(N)>>>0,Number(L)>>>0)):[],pads:W?Array.from((v(),R).subarray(Number(W)>>>0,Number(se)>>>0)):[],strides:ce?Array.from((v(),R).subarray(Number(ce)>>>0,Number(ye)>>>0)):[]})},1095565:(o,d)=>{t.bc("GlobalAveragePool",o,{format:d?"NHWC":"NCHW"})},1095656:(o,d,m,f,w,T,C,N,L,W,se,ce,ye,we)=>{t.bc("AveragePool",o,{format:we?"NHWC":"NCHW",auto_pad:d,ceil_mode:m,count_include_pad:f,storage_order:w,dilations:T?Array.from((v(),R).subarray(Number(T)>>>0,Number(C)>>>0)):[],kernel_shape:N?Array.from((v(),R).subarray(Number(N)>>>0,Number(L)>>>0)):[],pads:W?Array.from((v(),R).subarray(Number(W)>>>0,Number(se)>>>0)):[],strides:ce?Array.from((v(),R).subarray(Number(ce)>>>0,Number(ye)>>>0)):[]})},1096135:(o,d)=>{t.bc("GlobalMaxPool",o,{format:d?"NHWC":"NCHW"})},1096222:(o,d,m,f,w,T,C,N,L,W,se,ce,ye,we)=>{t.bc("MaxPool",o,{format:we?"NHWC":"NCHW",auto_pad:d,ceil_mode:m,count_include_pad:f,storage_order:w,dilations:T?Array.from((v(),R).subarray(Number(T)>>>0,Number(C)>>>0)):[],kernel_shape:N?Array.from((v(),R).subarray(Number(N)>>>0,Number(L)>>>0)):[],pads:W?Array.from((v(),R).subarray(Number(W)>>>0,Number(se)>>>0)):[],strides:ce?Array.from((v(),R).subarray(Number(ce)>>>0,Number(ye)>>>0)):[]})},1096697:(o,d)=>{t.bc("GlobalMaxPool",o,{format:d?"NHWC":"NCHW"})},1096784:(o,d,m,f,w,T,C,N,L,W,se,ce,ye,we)=>{t.bc("MaxPool",o,{format:we?"NHWC":"NCHW",auto_pad:d,ceil_mode:m,count_include_pad:f,storage_order:w,dilations:T?Array.from((v(),R).subarray(Number(T)>>>0,Number(C)>>>0)):[],kernel_shape:N?Array.from((v(),R).subarray(Number(N)>>>0,Number(L)>>>0)):[],pads:W?Array.from((v(),R).subarray(Number(W)>>>0,Number(se)>>>0)):[],strides:ce?Array.from((v(),R).subarray(Number(ce)>>>0,Number(ye)>>>0)):[]})},1097259:(o,d,m,f,w)=>{t.bc("Gemm",o,{alpha:d,beta:m,transA:f,transB:w})},1097363:o=>{t.bc("MatMul",o,void 0)},1097417:(o,d,m,f)=>{t.bc("ArgMax",o,{keepDims:!!d,selectLastIndex:!!m,axis:f})},1097525:(o,d,m,f)=>{t.bc("ArgMin",o,{keepDims:!!d,selectLastIndex:!!m,axis:f})},1097633:(o,d)=>{t.bc("Softmax",o,{axis:d})},1097696:(o,d)=>{t.bc("Concat",o,{axis:d})},1097756:(o,d,m,f,w)=>{t.bc("Split",o,{axis:d,numOutputs:m,splitSizes:f?Array.from((v(),R).subarray(Number(f)>>>0,Number(w)>>>0)):[]})},1097912:o=>{t.bc("Expand",o,void 0)},1097966:(o,d)=>{t.bc("Gather",o,{axis:Number(d)})},1098037:(o,d)=>{t.bc("GatherElements",o,{axis:Number(d)})},1098116:(o,d)=>{t.bc("GatherND",o,{batch_dims:Number(d)})},1098195:(o,d,m,f,w,T,C,N,L,W,se)=>{t.bc("Resize",o,{antialias:d,axes:m?Array.from((v(),R).subarray(Number(m)>>>0,Number(f)>>>0)):[],coordinateTransformMode:Te(w),cubicCoeffA:T,excludeOutside:C,extrapolationValue:N,keepAspectRatioPolicy:Te(L),mode:Te(W),nearestMode:Te(se)})},1098557:(o,d,m,f,w,T,C)=>{t.bc("Slice",o,{starts:d?Array.from((v(),R).subarray(Number(d)>>>0,Number(m)>>>0)):[],ends:f?Array.from((v(),R).subarray(Number(f)>>>0,Number(w)>>>0)):[],axes:T?Array.from((v(),R).subarray(Number(T)>>>0,Number(C)>>>0)):[]})},1098821:o=>{t.bc("Tile",o,void 0)},1098873:(o,d,m)=>{t.bc("InstanceNormalization",o,{epsilon:d,format:m?"NHWC":"NCHW"})},1098987:(o,d,m)=>{t.bc("InstanceNormalization",o,{epsilon:d,format:m?"NHWC":"NCHW"})},1099101:o=>{t.bc("Range",o,void 0)},1099154:(o,d)=>{t.bc("Einsum",o,{equation:Te(d)})},1099235:(o,d,m,f,w)=>{t.bc("Pad",o,{mode:d,value:m,pads:f?Array.from((v(),R).subarray(Number(f)>>>0,Number(w)>>>0)):[]})},1099378:(o,d,m,f,w,T)=>{t.bc("BatchNormalization",o,{epsilon:d,momentum:m,spatial:!!w,trainingMode:!!f,format:T?"NHWC":"NCHW"})},1099547:(o,d,m,f,w,T)=>{t.bc("BatchNormalization",o,{epsilon:d,momentum:m,spatial:!!w,trainingMode:!!f,format:T?"NHWC":"NCHW"})},1099716:(o,d,m)=>{t.bc("CumSum",o,{exclusive:Number(d),reverse:Number(m)})},1099813:(o,d,m)=>{t.bc("DequantizeLinear",o,{axis:d,blockSize:m})},1099903:(o,d,m,f,w)=>{t.bc("GridSample",o,{align_corners:d,mode:Te(m),padding_mode:Te(f),format:w?"NHWC":"NCHW"})},1100073:(o,d,m,f,w)=>{t.bc("GridSample",o,{align_corners:d,mode:Te(m),padding_mode:Te(f),format:w?"NHWC":"NCHW"})},1100243:(o,d)=>{t.bc("ScatterND",o,{reduction:Te(d)})},1100328:(o,d,m,f,w,T,C,N,L)=>{t.bc("Attention",o,{numHeads:d,isUnidirectional:m,maskFilterValue:f,scale:w,doRotary:T,qkvHiddenSizes:C?Array.from((v(),R).subarray(Number(N)>>>0,Number(N)+C>>>0)):[],pastPresentShareBuffer:!!L})},1100600:o=>{t.bc("BiasAdd",o,void 0)},1100655:o=>{t.bc("BiasSplitGelu",o,void 0)},1100716:o=>{t.bc("FastGelu",o,void 0)},1100772:(o,d,m,f,w,T,C,N,L,W,se,ce,ye,we,bt,vn)=>{t.bc("Conv",o,{format:ce?"NHWC":"NCHW",auto_pad:d,dilations:m?Array.from((v(),R).subarray(Number(m)>>>0,Number(f)>>>0)):[],group:w,kernel_shape:T?Array.from((v(),R).subarray(Number(T)>>>0,Number(C)>>>0)):[],pads:N?Array.from((v(),R).subarray(Number(N)>>>0,Number(L)>>>0)):[],strides:W?Array.from((v(),R).subarray(Number(W)>>>0,Number(se)>>>0)):[],w_is_const:()=>!!(v(),q)[Number(ye)>>>0],activation:Te(we),activation_params:bt?Array.from((v(),H).subarray(Number(bt)>>>0,Number(vn)>>>0)):[]})},1101356:o=>{t.bc("Gelu",o,void 0)},1101408:(o,d,m,f,w,T,C,N,L)=>{t.bc("GroupQueryAttention",o,{numHeads:d,kvNumHeads:m,scale:f,softcap:w,doRotary:T,rotaryInterleaved:C,smoothSoftmax:N,localWindowSize:L})},1101625:(o,d,m,f)=>{t.bc("LayerNormalization",o,{axis:d,epsilon:m,simplified:!!f})},1101736:(o,d,m,f)=>{t.bc("LayerNormalization",o,{axis:d,epsilon:m,simplified:!!f})},1101847:(o,d,m,f,w,T)=>{t.bc("MatMulNBits",o,{k:d,n:m,accuracyLevel:f,bits:w,blockSize:T})},1101974:(o,d,m,f,w,T)=>{t.bc("MultiHeadAttention",o,{numHeads:d,isUnidirectional:m,maskFilterValue:f,scale:w,doRotary:T})},1102133:(o,d)=>{t.bc("QuickGelu",o,{alpha:d})},1102197:(o,d,m,f,w)=>{t.bc("RotaryEmbedding",o,{interleaved:!!d,numHeads:m,rotaryEmbeddingDim:f,scale:w})},1102336:(o,d,m)=>{t.bc("SkipLayerNormalization",o,{epsilon:d,simplified:!!m})},1102438:(o,d,m)=>{t.bc("SkipLayerNormalization",o,{epsilon:d,simplified:!!m})},1102540:(o,d,m,f)=>{t.bc("GatherBlockQuantized",o,{gatherAxis:d,quantizeAxis:m,blockSize:f})},1102661:o=>{t.Id(o)},1102695:(o,d)=>t.Kd(Number(o),Number(d),t.$c.Nd,t.$c.errors)};function ay(o,d,m){return Eh(async()=>{await t.Gd(Number(o),Number(d),Number(m))})}function ny(){return typeof wasmOffsetConverter<"u"}function sy(o,d,m,f){var w=ue();try{return cf(o,d,m,f)}catch(T){if(oe(w),T!==T+0)throw T;le(1,0)}}function oy(o,d,m){var f=ue();try{return uf(o,d,m)}catch(w){if(oe(f),w!==w+0)throw w;le(1,0)}}function uy(o){var d=ue();try{nf(o)}catch(m){if(oe(d),m!==m+0)throw m;le(1,0)}}function ly(o,d){var m=ue();try{return wn(o,d)}catch(f){if(oe(m),f!==f+0)throw f;le(1,0)}}function dy(o,d,m){var f=ue();try{af(o,d,m)}catch(w){if(oe(f),w!==w+0)throw w;le(1,0)}}function py(o,d){var m=ue();try{hf(o,d)}catch(f){if(oe(m),f!==f+0)throw f;le(1,0)}}function cy(o,d,m,f,w,T,C){var N=ue();try{return df(o,d,m,f,w,T,C)}catch(L){if(oe(N),L!==L+0)throw L;le(1,0)}}function hy(o,d,m,f,w,T){var C=ue();try{sf(o,d,m,f,w,T)}catch(N){if(oe(C),N!==N+0)throw N;le(1,0)}}function fy(o,d,m,f){var w=ue();try{pf(o,d,m,f)}catch(T){if(oe(w),T!==T+0)throw T;le(1,0)}}function my(o,d,m,f,w){var T=ue();try{of(o,d,m,f,w)}catch(C){if(oe(T),C!==C+0)throw C;le(1,0)}}function gy(o,d,m,f,w,T,C){var N=ue();try{mf(o,d,m,f,w,T,C)}catch(L){if(oe(N),L!==L+0)throw L;le(1,0)}}function yy(o,d,m,f,w,T,C){var N=ue();try{gf(o,d,m,f,w,T,C)}catch(L){if(oe(N),L!==L+0)throw L;le(1,0)}}function _y(o,d,m,f,w,T,C,N){var L=ue();try{wf(o,d,m,f,w,T,C,N)}catch(W){if(oe(L),W!==W+0)throw W;le(1,0)}}function by(o,d,m,f,w){var T=ue();try{return ff(o,d,m,f,w)}catch(C){if(oe(T),C!==C+0)throw C;le(1,0)}}function wy(o,d,m){var f=ue();try{return $f(o,d,m)}catch(w){if(oe(f),w!==w+0)throw w;le(1,0)}}function $y(o,d,m,f,w,T,C,N){var L=ue();try{vf(o,d,m,f,w,T,C,N)}catch(W){if(oe(L),W!==W+0)throw W;le(1,0)}}function vy(o,d,m,f,w,T,C,N,L,W,se,ce){var ye=ue();try{yf(o,d,m,f,w,T,C,N,L,W,se,ce)}catch(we){if(oe(ye),we!==we+0)throw we;le(1,0)}}function xy(o,d,m){var f=ue();try{return xf(o,d,m)}catch(w){if(oe(f),w!==w+0)throw w;return le(1,0),0n}}function Sy(o,d,m,f,w,T,C,N,L){var W=ue();try{lf(o,d,m,f,w,T,C,N,L)}catch(se){if(oe(W),se!==se+0)throw se;le(1,0)}}function ky(o){var d=ue();try{return Sf(o)}catch(m){if(oe(d),m!==m+0)throw m;le(1,0)}}function Ty(o,d){var m=ue();try{return qf(o,d)}catch(f){if(oe(m),f!==f+0)throw f;return le(1,0),0n}}function Iy(o,d,m,f){var w=ue();try{return kf(o,d,m,f)}catch(T){if(oe(w),T!==T+0)throw T;le(1,0)}}function Ey(o){var d=ue();try{return Tf(o)}catch(m){if(oe(d),m!==m+0)throw m;return le(1,0),0n}}function zy(o,d,m,f){var w=ue();try{return Of(o,d,m,f)}catch(T){if(oe(w),T!==T+0)throw T;le(1,0)}}function Cy(o,d,m,f,w){var T=ue();try{return Rf(o,d,m,f,w)}catch(C){if(oe(T),C!==C+0)throw C;le(1,0)}}function Ay(o,d,m,f,w,T){var C=ue();try{return Bf(o,d,m,f,w,T)}catch(N){if(oe(C),N!==N+0)throw N;le(1,0)}}function Oy(o,d,m,f,w,T){var C=ue();try{return _f(o,d,m,f,w,T)}catch(N){if(oe(C),N!==N+0)throw N;le(1,0)}}function Ry(o,d,m,f,w,T){var C=ue();try{return Nf(o,d,m,f,w,T)}catch(N){if(oe(C),N!==N+0)throw N;le(1,0)}}function By(o,d,m,f,w,T,C,N){var L=ue();try{return bf(o,d,m,f,w,T,C,N)}catch(W){if(oe(L),W!==W+0)throw W;le(1,0)}}function Ny(o,d,m,f,w){var T=ue();try{return Mf(o,d,m,f,w)}catch(C){if(oe(T),C!==C+0)throw C;return le(1,0),0n}}function My(o,d,m,f){var w=ue();try{return Df(o,d,m,f)}catch(T){if(oe(w),T!==T+0)throw T;le(1,0)}}function Dy(o,d,m,f){var w=ue();try{return Uf(o,d,m,f)}catch(T){if(oe(w),T!==T+0)throw T;le(1,0)}}function Uy(o,d,m,f,w,T,C,N,L,W,se,ce){var ye=ue();try{return Pf(o,d,m,f,w,T,C,N,L,W,se,ce)}catch(we){if(oe(ye),we!==we+0)throw we;le(1,0)}}function Py(o,d,m,f,w,T,C,N,L,W,se){var ce=ue();try{Cf(o,d,m,f,w,T,C,N,L,W,se)}catch(ye){if(oe(ce),ye!==ye+0)throw ye;le(1,0)}}function qy(o,d,m,f,w,T,C,N,L,W,se,ce,ye,we,bt,vn){var Gy=ue();try{Af(o,d,m,f,w,T,C,N,L,W,se,ce,ye,we,bt,vn)}catch(xn){if(oe(Gy),xn!==xn+0)throw xn;le(1,0)}}function Ly(o,d,m){var f=ue();try{return If(o,d,m)}catch(w){if(oe(f),w!==w+0)throw w;le(1,0)}}function Wy(o,d,m){var f=ue();try{return Ef(o,d,m)}catch(w){if(oe(f),w!==w+0)throw w;le(1,0)}}function Vy(o,d,m,f){var w=ue();try{zf(o,d,m,f)}catch(T){if(oe(w),T!==T+0)throw T;le(1,0)}}function ai(){if(0<$e)Ne=ai;else if(a)$?.(t),X();else{for(var o=ge;0<o.length;)o.shift()(t);0<$e?Ne=ai:(t.calledRun=!0,z||(X(),$?.(t)))}}return a||(ut=await Oe(),ai()),t.PTR_SIZE=4,U?t:new Promise((o,d)=>{$=o,S=d})}var Kn,Zn,xm=P(()=>{"use strict";Kn=jn,Zn=globalThis.self?.name?.startsWith("em-pthread"),Zn&&jn()}),yi,_i,Xn,De,Qn,Sr,Yn,Jn,bi,es,wi,ts,$i,rs,vi=P(()=>{"use strict";fi(),yi=typeof location>"u"?void 0:location.origin,_i=self.location.href>"file:"&&self.location.href<"file;",Xn=()=>{if(_i){let e=URL;return new URL(new e("ort.bundle.min.mjs",self.location.href).href,yi).href}return self.location.href},De=Xn(),Qn=()=>{if(De&&!De.startsWith("blob:"))return De.substring(0,De.lastIndexOf("/")+1)},Sr=(e,t)=>{try{let r=t??De;return(r?new URL(e,r):new URL(e)).origin===yi}catch{return!1}},Yn=(e,t)=>{let r=t??De;try{return(r?new URL(e,r):new URL(e)).href}catch{return}},Jn=(e,t)=>`${t??"./"}${e}`,bi=async e=>{let t=await(await fetch(e,{credentials:"same-origin"})).blob();return URL.createObjectURL(t)},es=async e=>(await import(e)).default,wi=(vm(),Jt(Gn)).default,ts=async()=>{if(!De)throw new Error("Failed to load proxy worker: cannot determine the script source URL.");if(Sr(De))return[void 0,wi()];let e=await bi(De);return[e,wi(e)]},$i=(xm(),Jt(Fn)).default,rs=async(e,t,r,i)=>{let a=$i&&!(e||t);if(a)if(De)a=Sr(De)||i&&!r;else if(i&&!r)a=!0;else throw new Error("cannot determine the script source URL.");if(a)return[void 0,$i];{let s="ort-wasm-simd-threaded.jsep.mjs",n=e??Yn(s,t),u=r&&n&&!Sr(n,t),l=u?await bi(n):n??Jn(s,t);return[u?l:void 0,await es(l)]}}}),xi,kr,rr,Si,is,as,ns,ki,_e,Tt=P(()=>{"use strict";vi(),kr=!1,rr=!1,Si=!1,is=()=>{if(typeof SharedArrayBuffer>"u")return!1;try{return typeof MessageChannel<"u"&&new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)),WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,5,4,1,3,1,1,10,11,1,9,0,65,0,254,16,2,0,26,11]))}catch{return!1}},as=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,30,1,28,0,65,0,253,15,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,253,186,1,26,11]))}catch{return!1}},ns=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,19,1,17,0,65,1,253,15,65,2,253,15,65,3,253,15,253,147,2,11]))}catch{return!1}},ki=async e=>{if(kr)return Promise.resolve();if(rr)throw new Error("multiple calls to 'initializeWebAssembly()' detected.");if(Si)throw new Error("previous call to 'initializeWebAssembly()' failed.");rr=!0;let t=e.initTimeout,r=e.numThreads;if(e.simd!==!1){if(e.simd==="relaxed"){if(!ns())throw new Error("Relaxed WebAssembly SIMD is not supported in the current environment.")}else if(!as())throw new Error("WebAssembly SIMD is not supported in the current environment.")}let i=is();r>1&&!i&&(typeof self<"u"&&!self.crossOriginIsolated&&console.warn("env.wasm.numThreads is set to "+r+", but this will not work unless you enable crossOriginIsolated mode. See https://web.dev/cross-origin-isolation-guide/ for more info."),console.warn("WebAssembly multi-threading is not supported in the current environment. Falling back to single-threading."),e.numThreads=r=1);let a=e.wasmPaths,s=typeof a=="string"?a:void 0,n=a?.mjs,u=n?.href??n,l=a?.wasm,p=l?.href??l,h=e.wasmBinary,[c,g]=await rs(u,s,r>1,!!h||!!p),_=!1,y=[];if(t>0&&y.push(new Promise($=>{setTimeout(()=>{_=!0,$()},t)})),y.push(new Promise(($,S)=>{let x={numThreads:r};if(h)x.wasmBinary=h,x.locateFile=b=>b;else if(p||s)x.locateFile=b=>p??s+b;else if(u&&u.indexOf("blob:")!==0)x.locateFile=b=>new URL(b,u).href;else if(c){let b=Qn();b&&(x.locateFile=E=>b+E)}g(x).then(b=>{rr=!1,kr=!0,xi=b,$(),c&&URL.revokeObjectURL(c)},b=>{rr=!1,Si=!0,S(b)})})),await Promise.race(y),_)throw new Error(`WebAssembly backend initializing failed due to timeout: ${t}ms`)},_e=()=>{if(kr&&xi)return xi;throw new Error("WebAssembly is not initialized yet.")}}),Ge,Tr,fe,Ti=P(()=>{"use strict";Tt(),Ge=(e,t)=>{let r=_e(),i=r.lengthBytesUTF8(e)+1,a=r._malloc(i);return r.stringToUTF8(e,a,i),t.push(a),a},Tr=(e,t,r,i)=>{if(typeof e=="object"&&e!==null){if(r.has(e))throw new Error("Circular reference in options");r.add(e)}Object.entries(e).forEach(([a,s])=>{let n=t?t+a:a;if(typeof s=="object")Tr(s,n+".",r,i);else if(typeof s=="string"||typeof s=="number")i(n,s.toString());else if(typeof s=="boolean")i(n,s?"1":"0");else throw new Error(`Can't handle extra config type: ${typeof s}`)})},fe=e=>{let t=_e(),r=t.stackSave();try{let i=t.PTR_SIZE,a=t.stackAlloc(2*i);t._OrtGetLastError(a,a+i);let s=Number(t.getValue(a,i===4?"i32":"i64")),n=t.getValue(a+i,"*"),u=n?t.UTF8ToString(n):"";throw new Error(`${e} ERROR_CODE: ${s}, ERROR_MESSAGE: ${u}`)}finally{t.stackRestore(r)}}}),ss,Sm=P(()=>{"use strict";Tt(),Ti(),ss=e=>{let t=_e(),r=0,i=[],a=e||{};try{if(e?.logSeverityLevel===void 0)a.logSeverityLevel=2;else if(typeof e.logSeverityLevel!="number"||!Number.isInteger(e.logSeverityLevel)||e.logSeverityLevel<0||e.logSeverityLevel>4)throw new Error(`log severity level is not valid: ${e.logSeverityLevel}`);if(e?.logVerbosityLevel===void 0)a.logVerbosityLevel=0;else if(typeof e.logVerbosityLevel!="number"||!Number.isInteger(e.logVerbosityLevel))throw new Error(`log verbosity level is not valid: ${e.logVerbosityLevel}`);e?.terminate===void 0&&(a.terminate=!1);let s=0;return e?.tag!==void 0&&(s=Ge(e.tag,i)),r=t._OrtCreateRunOptions(a.logSeverityLevel,a.logVerbosityLevel,!!a.terminate,s),r===0&&fe("Can't create run options."),e?.extra!==void 0&&Tr(e.extra,"",new WeakSet,(n,u)=>{let l=Ge(n,i),p=Ge(u,i);t._OrtAddRunConfigEntry(r,l,p)!==0&&fe(`Can't set a run config entry: ${n} - ${u}.`)}),[r,i]}catch(s){throw r!==0&&t._OrtReleaseRunOptions(r),i.forEach(n=>t._free(n)),s}}}),os,us,ls,It,ds,ps,km=P(()=>{"use strict";Tt(),Ti(),os=e=>{switch(e){case"disabled":return 0;case"basic":return 1;case"extended":return 2;case"layout":return 3;case"all":return 99;default:throw new Error(`unsupported graph optimization level: ${e}`)}},us=e=>{switch(e){case"sequential":return 0;case"parallel":return 1;default:throw new Error(`unsupported execution mode: ${e}`)}},ls=e=>{e.extra||(e.extra={}),e.extra.session||(e.extra.session={});let t=e.extra.session;t.use_ort_model_bytes_directly||(t.use_ort_model_bytes_directly="1"),e.executionProviders&&e.executionProviders.some(r=>(typeof r=="string"?r:r.name)==="webgpu")&&(e.enableMemPattern=!1)},It=(e,t,r,i)=>{let a=Ge(t,i),s=Ge(r,i);_e()._OrtAddSessionConfigEntry(e,a,s)!==0&&fe(`Can't set a session config entry: ${t} - ${r}.`)},ds=async(e,t,r)=>{let i=t.executionProviders;for(let a of i){let s=typeof a=="string"?a:a.name,n=[];switch(s){case"webnn":if(s="WEBNN",It(e,"session.disable_quant_qdq","1",r),It(e,"session.disable_qdq_constant_folding","1",r),typeof a!="string"){let c=a?.deviceType;c&&It(e,"deviceType",c,r)}break;case"webgpu":if(s="JS",typeof a!="string"){let c=a;if(c?.preferredLayout){if(c.preferredLayout!=="NCHW"&&c.preferredLayout!=="NHWC")throw new Error(`preferredLayout must be either 'NCHW' or 'NHWC': ${c.preferredLayout}`);It(e,"preferredLayout",c.preferredLayout,r)}}break;case"wasm":case"cpu":continue;default:throw new Error(`not supported execution provider: ${s}`)}let u=Ge(s,r),l=n.length,p=0,h=0;if(l>0){p=_e()._malloc(l*_e().PTR_SIZE),r.push(p),h=_e()._malloc(l*_e().PTR_SIZE),r.push(h);for(let c=0;c<l;c++)_e().setValue(p+c*_e().PTR_SIZE,n[c][0],"*"),_e().setValue(h+c*_e().PTR_SIZE,n[c][1],"*")}await _e()._OrtAppendExecutionProvider(e,u,p,h,l)!==0&&fe(`Can't append execution provider: ${s}.`)}},ps=async e=>{let t=_e(),r=0,i=[],a=e||{};ls(a);try{let s=os(a.graphOptimizationLevel??"all"),n=us(a.executionMode??"sequential"),u=typeof a.logId=="string"?Ge(a.logId,i):0,l=a.logSeverityLevel??2;if(!Number.isInteger(l)||l<0||l>4)throw new Error(`log severity level is not valid: ${l}`);let p=a.logVerbosityLevel??0;if(!Number.isInteger(p)||p<0||p>4)throw new Error(`log verbosity level is not valid: ${p}`);let h=typeof a.optimizedModelFilePath=="string"?Ge(a.optimizedModelFilePath,i):0;if(r=t._OrtCreateSessionOptions(s,!!a.enableCpuMemArena,!!a.enableMemPattern,n,!!a.enableProfiling,0,u,l,p,h),r===0&&fe("Can't create session options."),a.executionProviders&&await ds(r,a,i),a.enableGraphCapture!==void 0){if(typeof a.enableGraphCapture!="boolean")throw new Error(`enableGraphCapture must be a boolean value: ${a.enableGraphCapture}`);It(r,"enableGraphCapture",a.enableGraphCapture.toString(),i)}if(a.freeDimensionOverrides)for(let[c,g]of Object.entries(a.freeDimensionOverrides)){if(typeof c!="string")throw new Error(`free dimension override name must be a string: ${c}`);if(typeof g!="number"||!Number.isInteger(g)||g<0)throw new Error(`free dimension override value must be a non-negative integer: ${g}`);let _=Ge(c,i);t._OrtAddFreeDimensionOverride(r,_,g)!==0&&fe(`Can't set a free dimension override: ${c} - ${g}.`)}return a.extra!==void 0&&Tr(a.extra,"",new WeakSet,(c,g)=>{It(r,c,g,i)}),[r,i]}catch(s){throw r!==0&&t._OrtReleaseSessionOptions(r)!==0&&fe("Can't release session options."),i.forEach(n=>t._free(n)),s}}}),Et,it,zt,Ir,Er,Ii,Ei,zi,ee=P(()=>{"use strict";Et=e=>{switch(e){case"int8":return 3;case"uint8":return 2;case"bool":return 9;case"int16":return 5;case"uint16":return 4;case"int32":return 6;case"uint32":return 12;case"float16":return 10;case"float32":return 1;case"float64":return 11;case"string":return 8;case"int64":return 7;case"uint64":return 13;case"int4":return 22;case"uint4":return 21;default:throw new Error(`unsupported data type: ${e}`)}},it=e=>{switch(e){case 3:return"int8";case 2:return"uint8";case 9:return"bool";case 5:return"int16";case 4:return"uint16";case 6:return"int32";case 12:return"uint32";case 10:return"float16";case 1:return"float32";case 11:return"float64";case 8:return"string";case 7:return"int64";case 13:return"uint64";case 22:return"int4";case 21:return"uint4";default:throw new Error(`unsupported data type: ${e}`)}},zt=(e,t)=>{let r=[-1,4,1,1,2,2,4,8,-1,1,2,8,4,8,-1,-1,-1,-1,-1,-1,-1,.5,.5][e],i=typeof t=="number"?t:t.reduce((a,s)=>a*s,1);return r>0?Math.ceil(i*r):void 0},Ir=e=>{switch(e){case"float16":return typeof Float16Array<"u"?Float16Array:Uint16Array;case"float32":return Float32Array;case"uint8":return Uint8Array;case"int8":return Int8Array;case"uint16":return Uint16Array;case"int16":return Int16Array;case"int32":return Int32Array;case"bool":return Uint8Array;case"float64":return Float64Array;case"uint32":return Uint32Array;case"int64":return BigInt64Array;case"uint64":return BigUint64Array;default:throw new Error(`unsupported type: ${e}`)}},Er=e=>{switch(e){case"verbose":return 0;case"info":return 1;case"warning":return 2;case"error":return 3;case"fatal":return 4;default:throw new Error(`unsupported logging level: ${e}`)}},Ii=e=>e==="float32"||e==="float16"||e==="int32"||e==="int64"||e==="uint32"||e==="uint8"||e==="bool"||e==="uint4"||e==="int4",Ei=e=>e==="float32"||e==="float16"||e==="int32"||e==="int64"||e==="uint32"||e==="uint64"||e==="int8"||e==="uint8"||e==="bool"||e==="uint4"||e==="int4",zi=e=>{switch(e){case"none":return 0;case"cpu":return 1;case"cpu-pinned":return 2;case"texture":return 3;case"gpu-buffer":return 4;case"ml-tensor":return 5;default:throw new Error(`unsupported data location: ${e}`)}}}),Ci,cs=P(()=>{"use strict";fi(),Ci=async e=>{if(typeof e=="string"){let t=await fetch(e);if(!t.ok)throw new Error(`failed to load external data file: ${e}`);let r=t.headers.get("Content-Length"),i=r?parseInt(r,10):0;if(i<1073741824)return new Uint8Array(await t.arrayBuffer());{if(!t.body)throw new Error(`failed to load external data file: ${e}, no response body.`);let a=t.body.getReader(),s;try{s=new ArrayBuffer(i)}catch(u){if(u instanceof RangeError){let l=Math.ceil(i/65536);s=new WebAssembly.Memory({initial:l,maximum:l}).buffer}else throw u}let n=0;for(;;){let{done:u,value:l}=await a.read();if(u)break;let p=l.byteLength;new Uint8Array(s,n,p).set(l),n+=p}return new Uint8Array(s,0,i)}}else return e instanceof Blob?new Uint8Array(await e.arrayBuffer()):e instanceof Uint8Array?e:new Uint8Array(e)}}),hs,fs,ms,gs,Ai,ys,de,at=P(()=>{"use strict";ee(),hs=["V","I","W","E","F"],fs=(e,t)=>{console.log(`[${hs[e]},${new Date().toISOString()}]${t}`)},Ai=(e,t)=>{ms=e,gs=t},ys=(e,t)=>{let r=Er(e),i=Er(ms);r>=i&&fs(r,typeof t=="function"?t():t)},de=(...e)=>{gs&&ys(...e)}}),_s,Ht,O,zr,bs,ws,$s,ie=P(()=>{"use strict";_s=class{static calcMatMulShape(e,t){return e[1]!==t[0]?void 0:[e[0],t[1]]}},Ht=class{static calcShape(e,t,r=!1){let i=e.length,a=t.length;if(i===0)return t;if(a===0)return e;let s=Math.max(e.length,t.length),n=new Array(s);if(r){if(i<2||a<2)return;let u=_s.calcMatMulShape([e[i-2],e[i-1]],[t[a-2],t[a-1]]);if(u===void 0)return;[n[s-2],n[s-1]]=u}for(let u=r?3:1;u<=s;u++){let l=i-u<0?1:e[i-u],p=a-u<0?1:t[a-u];if(l!==p&&l>1&&p>1)return;let h=Math.max(l,p);if(l&&p)n[s-u]=Math.max(l,p);else{if(h>1)return;n[s-u]=0}}return n}static isValidBroadcast(e,t){let r=e.length,i=t.length;if(r>i)return!1;for(let a=1;a<=r;a++)if(e[r-a]!==1&&e[r-a]!==t[i-a])return!1;return!0}},O=class ni{static size(t){return ni.getSizeFromDimensionRange(t,0,t.length)}static convertShape(t,r=4){let i=t.length;if(i===0)return[];let a=new Array(i),s=i-1;for(;s>=0;){if(t[s]%r===0){a[s]=t[s]/r;break}if(r%t[s]!==0)throw new Error("cannot convert shape");a[s]=1,r/=t[s],s--}for(s--;s>=0;s--)a[s]=t[s];return a}static sizeFromDimension(t,r){if(r<0||r>t.length)throw new Error(`invalid dimension of ${r} for sizeFromDimension as Tensor has ${t.length} dimensions.`);return ni.getSizeFromDimensionRange(t,r,t.length)}static sizeToDimension(t,r){if(r<0||r>t.length)throw new Error(`invalid dimension of ${r} for sizeToDimension as Tensor has ${t.length} dimensions.`);return ni.getSizeFromDimensionRange(t,0,r)}static getSizeFromDimensionRange(t,r,i){let a=1;for(let s=r;s<i;s++){if(t[s]<0)throw new Error("cannot get valid size from specified dimension range. Most likely the range contains negative values in them.");a*=Number(t[s])}return a}static computeStrides(t){let r=t.length;if(r===0)return[];if(r===1)return[1];let i=new Array(r);i[r-1]=1,i[r-2]=t[r-1];for(let a=r-3;a>=0;--a)i[a]=i[a+1]*t[a+1];return i}static normalizeAxis(t,r){if(t<-r&&t>=r)throw new Error("unsupported axis for this operation.");return t<0?t+r:t}static normalizeAxes(t,r){return t.map(i=>this.normalizeAxis(i,r??t.length))}static sortBasedOnPerm(t,r){return r?r.map(i=>t[i]):t.slice().reverse()}static padShape(t,r){let i=t.length;return t.map((a,s)=>a+r[s]+r[s+i])}static areEqual(t,r){return t.length!==r.length?!1:t.every((i,a)=>i===r[a])}},zr=class wt{static adjustPoolAttributes(t,r,i,a,s,n){if(!t&&i.length!==r.length-2)throw new Error("length of specified kernel shapes should be 2 less than length of input dimensions");if(t)for(let u=0;u<r.length-2;u++)u>=i.length?i.push(r[u+2]):i[u]=r[u+2];for(let u=0;u<i.length;u++)if(u<a.length){if(a[u]<0)throw new Error("strides should be greater than or equal to 1")}else a.push(1);for(let u=0;u<i.length;u++)if(u<s.length){if(s[u]<0)throw new Error("dilations should be greater than or equal to 1")}else s.push(1);for(let u=0;u<i.length*2;u++)if(u<n.length){if(n[u]<0)throw new Error("pad should be greater than or equal to 1")}else n.push(0);for(let u=0;u<i.length;u++){if(i[u]<=0)throw new Error("kernel shapes need to be greater than 0");if(n[u]>=i[u]||n[u+i.length]>=i[u])throw new Error("pads should be smaller than kernel")}}static adjustPadsBasedOnAutoPad(t,r,i,a,s,n,u){if(u){if(s.length!==2*(t.length-2))throw new Error("length of pads should be twice the length of data dimensions");if(r.length!==t.length-2)throw new Error("length of strides should be the length of data dimensions");if(a.length!==t.length-2)throw new Error("length of kernel shapes should be the length of data dimensions");for(let l=0;l<t.length-2;l++)wt.adjustPadAndReturnShape(t[l+(n?1:2)],r[l],i[l],a[l],s,l,l+t.length-2,u)}}static computePoolOutputShape(t,r,i,a,s,n,u,l=0){if(r.length<=0)throw new Error("input shape must be of size greater than 0");let p=[r[0],r[1]];return wt.computeShapeHelper(t,r,p,i,a,s,n,u,l),p}static computeConvOutputShape(t,r,i,a,s,n,u){if(t.length<=0||r.length<=0)throw new Error("invalid input tensor dims or invalid filter tensor dims");let l=[t[0],r[0]];return wt.computeShapeHelper(!1,t,l,i,a,s,n,u),l}static computeShapeHelper(t,r,i,a,s,n,u,l,p=0){if(t)for(let h=0;h<r.length-2;h++)i.push(1);else for(let h=0;h<r.length-2;h++)i.push(wt.adjustPadAndReturnShape(r[h+2],a[h],s[h],n[h],u,h,h+r.length-2,l,p))}static computeOutputSize(t,r,i,a,s){let n=Math.floor(t/r)+1;return s===1&&(n=Math.ceil(t/r)+1,(n-1)*r>=i+a&&(n-=1)),n}static adjustPadAndReturnShape(t,r,i,a,s,n,u,l,p=0){let h=i*(a-1)+1;if(l&&l!=="NOTSET")switch(l){case"VALID":return s[n]=0,s[u]=0,wt.computeOutputSize(t-h,r,t,0,p);case"SAME_LOWER":case"SAME_UPPER":if(i!==1)throw new Error("Dilation not supported for SAME_UPPER or SAME_LOWER");{let c=(Math.floor((t+r-1)/r)-1)*r+a-t;return s[n]=Math.floor(l==="SAME_LOWER"?(c+1)/2:c/2),s[u]=c-s[n],wt.computeOutputSize(t+s[n]+s[u]-h,r,t,s[n],p)}default:throw new Error("Unsupported AutoPad type")}else return wt.computeOutputSize(t+s[n]+s[u]-h,r,t,s[n],p)}},bs=class{static getShapeOfGemmResult(e,t,r,i,a){if(e.length!==2||r.length!==2)throw new Error("shape need to be of size 2");let s,n,u;t?(s=e[1],n=e[0]):(s=e[0],n=e[1]);let l=-1;if(i?(u=r[0],l=1):(u=r[1],l=0),r[l]!==n)throw new Error("dimension mismatch");if(s<=0||u<=0||n<=0)throw new Error("invalid shape specified");if(a&&!Ht.isValidBroadcast(a,[s,u]))throw new Error("gemm: invalid bias shape for broadcast");return[s,u,n]}},ws=-34028234663852886e22,$s=34028234663852886e22}),Oi,vs=P(()=>{"use strict";ee(),Oi=(e,t)=>new(Ir(t))(e)}),Ri,xs,Bi,Ss,Ni,ks,Mi,Di,Ui,Ts,Is,Tm=P(()=>{"use strict";ee(),at(),Ri=new Map([["float32",32],["float16",16],["int32",32],["uint32",32],["int64",64],["uint64",64],["int8",8],["uint8",8],["int4",4],["uint4",4]]),xs=(e,t)=>{if(t==="int32")return e;let r=Ri.get(t);if(!r)throw new Error(`WebNN backend does not support data type: ${t}`);let i=r/8;if(e.byteLength%i!==0)throw new Error(`Invalid Uint8Array length - must be a multiple of ${i}.`);let a=e.byteLength/i,s=new(Ir(t))(e.buffer,e.byteOffset,a);switch(t){case"int64":case"uint64":{let n=new Int32Array(a);for(let u=0;u<a;u++){let l=s[u];if(l>2147483647n||l<-2147483648n)throw new Error("Can not convert int64 data to int32 - value out of range.");n[u]=Number(l)}return new Uint8Array(n.buffer)}case"int8":case"uint8":case"uint32":{if(t==="uint32"&&s.some(u=>u>2147483647))throw new Error("Can not convert uint32 data to int32 - value out of range.");let n=Int32Array.from(s,Number);return new Uint8Array(n.buffer)}default:throw new Error(`Unsupported data conversion from ${t} to 'int32'`)}},Bi=(e,t)=>{if(t==="int32")return e;if(e.byteLength%4!==0)throw new Error("Invalid Uint8Array length - must be a multiple of 4 (int32).");let r=e.byteLength/4,i=new Int32Array(e.buffer,e.byteOffset,r);switch(t){case"int64":{let a=BigInt64Array.from(i,BigInt);return new Uint8Array(a.buffer)}case"uint64":{if(i.some(s=>s<0))throw new Error("Can not convert int32 data to uin64 - negative value found.");let a=BigUint64Array.from(i,BigInt);return new Uint8Array(a.buffer)}case"int8":{if(i.some(s=>s<-128||s>127))throw new Error("Can not convert int32 data to int8 - value out of range.");let a=Int8Array.from(i,Number);return new Uint8Array(a.buffer)}case"uint8":{if(i.some(a=>a<0||a>255))throw new Error("Can not convert int32 data to uint8 - value out of range.");return Uint8Array.from(i,Number)}case"uint32":{if(i.some(s=>s<0))throw new Error("Can not convert int32 data to uint32 - negative value found.");let a=Uint32Array.from(i,Number);return new Uint8Array(a.buffer)}default:throw new Error(`Unsupported data conversion from 'int32' to ${t}`)}},Ss=1,Ni=()=>Ss++,ks=new Map([["int8","int32"],["uint8","int32"],["uint32","int32"],["int64","int32"]]),Mi=(e,t)=>{let r=Ri.get(e);if(!r)throw new Error(`WebNN backend does not support data type: ${e}`);return t.length>0?Math.ceil(t.reduce((i,a)=>i*a)*r/8):0},Di=class{constructor(e){this.isDataConverted=!1;let{sessionId:t,context:r,tensor:i,dataType:a,shape:s,fallbackDataType:n}=e;this.sessionId=t,this.mlContext=r,this.mlTensor=i,this.dataType=a,this.tensorShape=s,this.fallbackDataType=n}get tensor(){return this.mlTensor}get type(){return this.dataType}get fallbackType(){return this.fallbackDataType}get shape(){return this.tensorShape}get byteLength(){return Mi(this.dataType,this.tensorShape)}destroy(){de("verbose",()=>"[WebNN] TensorWrapper.destroy"),this.mlTensor.destroy()}write(e){this.mlContext.writeTensor(this.mlTensor,e)}async read(e){if(this.fallbackDataType){let t=await this.mlContext.readTensor(this.mlTensor),r=Bi(new Uint8Array(t),this.dataType);if(e){(e instanceof ArrayBuffer?new Uint8Array(e):new Uint8Array(e.buffer,e.byteOffset,e.byteLength)).set(r);return}else return new Uint8Array(r).buffer}else return e?this.mlContext.readTensor(this.mlTensor,e):this.mlContext.readTensor(this.mlTensor)}canReuseTensor(e,t,r){return this.mlContext===e&&this.dataType===t&&this.tensorShape.length===r.length&&this.tensorShape.every((i,a)=>i===r[a])}setIsDataConverted(e){this.isDataConverted=e}},Ui=class{constructor(e,t){this.tensorManager=e,this.wrapper=t}get tensorWrapper(){return this.wrapper}releaseTensor(){this.tensorWrapper&&(this.tensorManager.releaseTensor(this.tensorWrapper),this.wrapper=void 0)}async ensureTensor(e,t,r,i){let a=this.tensorManager.getMLContext(e),s=this.tensorManager.getMLOpSupportLimits(e),n;if(!s?.input.dataTypes.includes(t)){if(n=ks.get(t),!n||!s?.input.dataTypes.includes(n))throw new Error(`WebNN backend does not support data type: ${t}`);de("verbose",()=>`[WebNN] TensorIdTracker.ensureTensor: fallback dataType from ${t} to ${n}`)}if(this.wrapper){if(this.wrapper.canReuseTensor(a,t,r))return this.wrapper.tensor;if(i){if(this.wrapper.byteLength!==Mi(t,r))throw new Error("Unable to copy data to tensor with different size.");this.activeUpload=new Uint8Array(await this.wrapper.read())}this.tensorManager.releaseTensor(this.wrapper)}let u=typeof MLTensorUsage>"u"?void 0:MLTensorUsage.READ|MLTensorUsage.WRITE;return this.wrapper=await this.tensorManager.getCachedTensor(e,t,r,u,!0,!0,n),i&&this.activeUpload&&(this.wrapper.write(this.activeUpload),this.activeUpload=void 0),this.wrapper.tensor}upload(e){let t=e;if(this.wrapper){if(this.wrapper.fallbackType)if(this.wrapper.fallbackType==="int32")t=xs(e,this.wrapper.type),this.wrapper.setIsDataConverted(!0);else throw new Error(`Unsupported fallback data type: ${this.wrapper.fallbackType}`);if(e.byteLength===this.wrapper.byteLength){this.wrapper.write(t);return}else de("verbose",()=>"Data size does not match tensor size. Releasing tensor."),this.releaseTensor()}this.activeUpload?this.activeUpload.set(t):this.activeUpload=new Uint8Array(t)}async download(e){if(this.activeUpload){let t=this.wrapper?.isDataConverted?Bi(this.activeUpload,this.wrapper?.type):this.activeUpload;if(e){e instanceof ArrayBuffer?new Uint8Array(e).set(t):new Uint8Array(e.buffer,e.byteOffset,e.byteLength).set(t);return}else return t.buffer}if(!this.wrapper)throw new Error("Tensor has not been created.");return e?this.wrapper.read(e):this.wrapper.read()}},Ts=class{constructor(e){this.backend=e,this.tensorTrackersById=new Map,this.freeTensors=[],this.externalTensors=new Set}getMLContext(e){let t=this.backend.getMLContext(e);if(!t)throw new Error("MLContext not found for session.");return t}getMLOpSupportLimits(e){return this.backend.getMLOpSupportLimits(e)}reserveTensorId(){let e=Ni();return this.tensorTrackersById.set(e,new Ui(this)),e}releaseTensorId(e){let t=this.tensorTrackersById.get(e);t&&(this.tensorTrackersById.delete(e),t.tensorWrapper&&this.releaseTensor(t.tensorWrapper))}async ensureTensor(e,t,r,i,a){de("verbose",()=>`[WebNN] TensorManager.ensureTensor {tensorId: ${t}, dataType: ${r}, shape: ${i}, copyOld: ${a}}`);let s=this.tensorTrackersById.get(t);if(!s)throw new Error("Tensor not found.");return s.ensureTensor(e,r,i,a)}upload(e,t){let r=this.tensorTrackersById.get(e);if(!r)throw new Error("Tensor not found.");r.upload(t)}async download(e,t){de("verbose",()=>`[WebNN] TensorManager.download {tensorId: ${e}, dstBuffer: ${t?.byteLength}}`);let r=this.tensorTrackersById.get(e);if(!r)throw new Error("Tensor not found.");return r.download(t)}releaseTensorsForSession(e){for(let t of this.freeTensors)t.sessionId===e&&t.destroy();this.freeTensors=this.freeTensors.filter(t=>t.sessionId!==e)}registerTensor(e,t,r,i){let a=this.getMLContext(e),s=Ni(),n=new Di({sessionId:e,context:a,tensor:t,dataType:r,shape:i});return this.tensorTrackersById.set(s,new Ui(this,n)),this.externalTensors.add(n),s}async getCachedTensor(e,t,r,i,a,s,n){let u=this.getMLContext(e);for(let[p,h]of this.freeTensors.entries())if(h.canReuseTensor(u,t,r)){de("verbose",()=>`[WebNN] Reusing tensor {dataType: ${t}, ${n?`fallbackDataType: ${n},`:""} shape: ${r}`);let c=this.freeTensors.splice(p,1)[0];return c.sessionId=e,c}de("verbose",()=>`[WebNN] MLContext.createTensor {dataType: ${t}, ${n?`fallbackDataType: ${n},`:""} shape: ${r}}`);let l=await u.createTensor({dataType:n??t,shape:r,dimensions:r,usage:i,writable:a,readable:s});return new Di({sessionId:e,context:u,tensor:l,dataType:t,shape:r,fallbackDataType:n})}releaseTensor(e){this.externalTensors.has(e)&&this.externalTensors.delete(e),this.freeTensors.push(e)}},Is=(...e)=>new Ts(...e)}),ir,Es,zs,Im=P(()=>{"use strict";ee(),Tt(),vs(),Tm(),at(),ir=new Map([[1,"float32"],[10,"float16"],[6,"int32"],[12,"uint32"],[7,"int64"],[13,"uint64"],[22,"int4"],[21,"uint4"],[3,"int8"],[2,"uint8"],[9,"uint8"]]),Es=(e,t)=>{if(e===t)return!0;if(e===void 0||t===void 0)return!1;let r=Object.keys(e).sort(),i=Object.keys(t).sort();return r.length===i.length&&r.every((a,s)=>a===i[s]&&e[a]===t[a])},zs=class{constructor(e){this.tensorManager=Is(this),this.mlContextBySessionId=new Map,this.sessionIdsByMLContext=new Map,this.mlContextCache=[],this.sessionGraphInputs=new Map,this.sessionGraphOutputs=new Map,this.temporaryGraphInputs=[],this.temporaryGraphOutputs=[],this.temporarySessionTensorIds=new Map,this.mlOpSupportLimitsBySessionId=new Map,Ai(e.logLevel,!!e.debug)}get currentSessionId(){if(this.activeSessionId===void 0)throw new Error("No active session");return this.activeSessionId}onRunStart(e){de("verbose",()=>`[WebNN] onRunStart {sessionId: ${e}}`),this.activeSessionId=e}onRunEnd(e){de("verbose",()=>`[WebNN] onRunEnd {sessionId: ${e}}`);let t=this.temporarySessionTensorIds.get(e);if(t){for(let r of t)de("verbose",()=>`[WebNN] releasing temporary tensor {tensorId: ${r}}`),this.tensorManager.releaseTensorId(r);this.temporarySessionTensorIds.delete(e),this.activeSessionId=void 0}}async createMLContext(e){if(e instanceof GPUDevice){let r=this.mlContextCache.findIndex(i=>i.gpuDevice===e);if(r!==-1)return this.mlContextCache[r].mlContext;{let i=await navigator.ml.createContext(e);return this.mlContextCache.push({gpuDevice:e,mlContext:i}),i}}else if(e===void 0){let r=this.mlContextCache.findIndex(i=>i.options===void 0&&i.gpuDevice===void 0);if(r!==-1)return this.mlContextCache[r].mlContext;{let i=await navigator.ml.createContext();return this.mlContextCache.push({mlContext:i}),i}}let t=this.mlContextCache.findIndex(r=>Es(r.options,e));if(t!==-1)return this.mlContextCache[t].mlContext;{let r=await navigator.ml.createContext(e);return this.mlContextCache.push({options:e,mlContext:r}),r}}registerMLContext(e,t){this.mlContextBySessionId.set(e,t);let r=this.sessionIdsByMLContext.get(t);r||(r=new Set,this.sessionIdsByMLContext.set(t,r)),r.add(e),this.mlOpSupportLimitsBySessionId.has(e)||this.mlOpSupportLimitsBySessionId.set(e,t.opSupportLimits()),this.temporaryGraphInputs.length>0&&(this.sessionGraphInputs.set(e,this.temporaryGraphInputs),this.temporaryGraphInputs=[]),this.temporaryGraphOutputs.length>0&&(this.sessionGraphOutputs.set(e,this.temporaryGraphOutputs),this.temporaryGraphOutputs=[])}onReleaseSession(e){this.sessionGraphInputs.delete(e),this.sessionGraphOutputs.delete(e);let t=this.mlContextBySessionId.get(e);if(!t)return;this.tensorManager.releaseTensorsForSession(e),this.mlContextBySessionId.delete(e),this.mlOpSupportLimitsBySessionId.delete(e);let r=this.sessionIdsByMLContext.get(t);if(r.delete(e),r.size===0){this.sessionIdsByMLContext.delete(t);let i=this.mlContextCache.findIndex(a=>a.mlContext===t);i!==-1&&this.mlContextCache.splice(i,1)}}getMLContext(e){return this.mlContextBySessionId.get(e)}getMLOpSupportLimits(e){return this.mlOpSupportLimitsBySessionId.get(e)}reserveTensorId(){return this.tensorManager.reserveTensorId()}releaseTensorId(e){de("verbose",()=>`[WebNN] releaseTensorId {tensorId: ${e}}`),this.tensorManager.releaseTensorId(e)}async ensureTensor(e,t,r,i,a){let s=ir.get(r);if(!s)throw new Error(`Unsupported ONNX data type: ${r}`);return this.tensorManager.ensureTensor(e??this.currentSessionId,t,s,i,a)}async createTemporaryTensor(e,t,r){de("verbose",()=>`[WebNN] createTemporaryTensor {onnxDataType: ${t}, shape: ${r}}`);let i=ir.get(t);if(!i)throw new Error(`Unsupported ONNX data type: ${t}`);let a=this.tensorManager.reserveTensorId();await this.tensorManager.ensureTensor(e,a,i,r,!1);let s=this.temporarySessionTensorIds.get(e);return s?s.push(a):this.temporarySessionTensorIds.set(e,[a]),a}uploadTensor(e,t){if(!_e().shouldTransferToMLTensor)throw new Error("Trying to upload to a MLTensor while shouldTransferToMLTensor is false");de("verbose",()=>`[WebNN] uploadTensor {tensorId: ${e}, data: ${t.byteLength}}`),this.tensorManager.upload(e,t)}async downloadTensor(e,t){return this.tensorManager.download(e,t)}createMLTensorDownloader(e,t){return async()=>{let r=await this.tensorManager.download(e);return Oi(r,t)}}registerMLTensor(e,t,r,i){let a=ir.get(r);if(!a)throw new Error(`Unsupported ONNX data type: ${r}`);let s=this.tensorManager.registerTensor(e,t,a,i);return de("verbose",()=>`[WebNN] registerMLTensor {tensor: ${t}, dataType: ${a}, dimensions: ${i}} -> {tensorId: ${s}}`),s}registerGraphInput(e){this.temporaryGraphInputs.push(e)}registerGraphOutput(e){this.temporaryGraphOutputs.push(e)}isGraphInput(e,t){let r=this.sessionGraphInputs.get(e);return r?r.includes(t):!1}isGraphOutput(e,t){let r=this.sessionGraphOutputs.get(e);return r?r.includes(t):!1}isGraphInputOutputTypeSupported(e,t,r=!0){let i=ir.get(Et(t)),a=this.mlOpSupportLimitsBySessionId.get(e);return typeof i>"u"?!1:r?!!a?.input.dataTypes.includes(i):!!a?.output.dataTypes.includes(i)}flush(){}}}),Pi=P(()=>{"use strict"}),qi,Cr,Ar,Cs,As,Li,Wi,Os,Rs,Em=P(()=>{"use strict";at(),Pi(),qi=new Map([[64,250],[128,200],[256,200],[512,200],[2048,230],[4096,200],[8192,50],[16384,50],[32768,50],[65536,50],[131072,50],[262144,50],[524288,50],[1048576,50],[2097152,30],[4194304,20],[8388608,10],[12582912,10],[16777216,10],[26214400,15],[33554432,22],[44236800,2],[58982400,6],[67108864,6],[134217728,6],[167772160,6]]),Cr=[],Ar=e=>Math.ceil(Number(e)/16)*16,Cs=e=>{for(let t=0;t<Cr.length;t++){let r=Cr[t];if(e<=r)return r}return Math.ceil(e/16)*16},As=1,Li=()=>As++,Wi=async(e,t,r,i)=>{let a=Ar(r),s=e.device.createBuffer({size:a,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});try{let n=e.getCommandEncoder();e.endComputePass(),n.copyBufferToBuffer(t,0,s,0,a),e.flush(),await s.mapAsync(GPUMapMode.READ);let u=s.getMappedRange();if(i){let l=i();return l.set(new Uint8Array(u,0,r)),l}else return new Uint8Array(u.slice(0,r))}finally{s.destroy()}},Os=class{constructor(e){this.backend=e,this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.buffersPending=[],this.capturedPendingBuffers=new Map;for(let[t]of qi)Cr.push(t),this.freeBuffers.set(t,[]),this.freeUniformBuffers.set(t,[]);this.sessionCount=0}upload(e,t){let r=t.buffer,i=t.byteOffset,a=t.byteLength,s=Ar(a),n=this.storageCache.get(e);if(!n)throw new Error("gpu data for uploading does not exist");if(Number(n.originalSize)!==a)throw new Error(`inconsistent data size. gpu data size=${n.originalSize}, data size=${a}`);if(s===a&&i%4===0)this.backend.device.queue.writeBuffer(n.gpuData.buffer,0,r,i,a);else{let u=new Uint8Array(s);u.set(t),this.backend.device.queue.writeBuffer(n.gpuData.buffer,0,u,0,s)}de("verbose",()=>`[WebGPU] GpuDataManager.upload(id=${e})`)}memcpy(e,t){let r=this.storageCache.get(e);if(!r)throw new Error("source gpu data for memcpy does not exist");let i=this.storageCache.get(t);if(!i)throw new Error("destination gpu data for memcpy does not exist");if(r.originalSize!==i.originalSize)throw new Error("inconsistent source and destination gpu data size");let a=Ar(r.originalSize),s=this.backend.getCommandEncoder();this.backend.endComputePass(),s.copyBufferToBuffer(r.gpuData.buffer,0,i.gpuData.buffer,0,a)}registerExternalBuffer(e,t,r){let i;if(r){if(i=r[0],e===r[1])return de("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${t}) => id=${i}, buffer is the same, skip.`),i;if(this.backend.capturedCommandList.has(this.backend.currentSessionId))throw new Error(`Registering a different external buffer under graph capture mode is not supported yet.
             Please use the previous external buffer!`)}else i=Li();return this.storageCache.set(i,{gpuData:{id:i,type:0,buffer:e},originalSize:t}),de("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${t}) => id=${i}, registered.`),i}unregisterExternalBuffer(e){e!==void 0&&(this.storageCache.delete(e),de("verbose",()=>`[WebGPU] GpuDataManager.unregisterExternalBuffer() => id=${e}`))}create(e,t=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST){let r=Cs(e),i,a=(t&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE,s=(t&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM;if(a||s){let u=(a?this.freeBuffers:this.freeUniformBuffers).get(r);u?u.length>0?i=u.pop():i=this.backend.device.createBuffer({size:r,usage:t}):i=this.backend.device.createBuffer({size:r,usage:t})}else i=this.backend.device.createBuffer({size:r,usage:t});let n={id:Li(),type:0,buffer:i};return this.storageCache.set(n.id,{gpuData:n,originalSize:Number(e)}),de("verbose",()=>`[WebGPU] GpuDataManager.create(size=${e}) => id=${n.id}`),n}get(e){return this.storageCache.get(e)?.gpuData}release(e){let t=typeof e=="bigint"?Number(e):e,r=this.storageCache.get(t);if(!r){if(this.storageCache.size===0)return 0;throw new Error("releasing data does not exist")}return de("verbose",()=>`[WebGPU] GpuDataManager.release(id=${t}), gpuDataId=${r.gpuData.id}`),this.storageCache.delete(t),this.buffersPending.push(r.gpuData.buffer),r.originalSize}async download(e,t){let r=this.storageCache.get(Number(e));if(!r)throw new Error("data does not exist");await Wi(this.backend,r.gpuData.buffer,r.originalSize,t)}refreshPendingBuffers(){if(this.buffersPending.length!==0)if(this.backend.sessionStatus==="default"){for(let e of this.buffersPending){let t=qi.get(e.size);if((e.usage&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE){let r=this.freeBuffers.get(e.size)||[];t===void 0||r.length>=t?e.destroy():r.push(e)}else if((e.usage&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM){let r=this.freeUniformBuffers.get(e.size)||[];t===void 0||r.length>=t?e.destroy():r.push(e)}else e.destroy()}this.buffersPending=[]}else{let e=this.capturedPendingBuffers.get(this.backend.currentSessionId);e||(e=[],this.capturedPendingBuffers.set(this.backend.currentSessionId,e));for(let t of this.buffersPending)e.push(t);this.buffersPending=[]}}dispose(){this.freeBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.freeUniformBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.storageCache.forEach(e=>{e.gpuData.buffer.destroy()}),this.capturedPendingBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.capturedPendingBuffers=new Map}onCreateSession(){this.sessionCount+=1}onReleaseSession(e){let t=this.capturedPendingBuffers.get(e);t&&(t.forEach(r=>{r.destroy()}),this.capturedPendingBuffers.delete(e)),this.sessionCount-=1,this.sessionCount===0&&(de("warning",()=>"[WebGPU] Clearing webgpu buffer cache"),this.storageCache.forEach(r=>{r.gpuData.buffer.destroy()}),this.storageCache=new Map)}},Rs=(...e)=>new Os(...e)}),Bs,he,Se=P(()=>{"use strict";Bs=class{constructor(e){Object.assign(this,e)}get cacheKey(){return this.key||(this.key=Object.getOwnPropertyNames(this).sort().map(e=>`${this[e]}`).join(";")),this.key}},he=e=>new Bs(e)}),Ft,Or,Ee,ze,Z,ke,Vi,jt,dt,j,ar,B,G,Ns,Gi,Ms,Ds,ae=P(()=>{"use strict";ee(),ie(),Ft=64,Or=(e,t)=>{if(t===3)throw new Error("vec3 has same alignment as vec4, use vec4 instead");switch(Number(e)){case 10:return t>1?`vec${t}<f16>`:"f16";case 1:return t>1?`vec${t}<f32>`:"f32";case 6:return t>1?`vec${t}<i32>`:"i32";case 12:return t>1?`vec${t}<u32>`:"u32";case 7:if(t>1)throw new Error("currently not supported vecX of uint64 yet");return["vec2<u32>","i32"];case 13:if(t>1)throw new Error("currently not supported vecX of uint64 yet");return["vec2<u32>","u32"];case 9:if(t!==4)throw new Error("bool must be vec4");return["u32","vec4<bool>"];case 22:return"i32";case 21:return"u32";default:throw new Error(`Unknown data type: ${e}`)}},Ee=(e,t=1)=>{let r=Or(e,t);return typeof r=="string"?r:r[0]},ze=(e,t=1)=>{let r=Or(e,t);return typeof r=="string"?r:r[1]},Z=(...e)=>{let t=[];return e.forEach(r=>{r.length!==0&&t.push({type:12,data:r},{type:12,data:O.computeStrides(r)})}),t},ke=e=>e%4===0?4:e%2===0?2:1,Vi=(e="f32",t,r="0")=>!t||t===1?`${e}(${r})`:`vec${t}<${e}>(${r})`,jt=(e,t,r)=>e==="f32"?r:t===1?`f32(${r})`:`vec${t}<f32>(${r})`,dt=(e,t)=>t===4?`(${e}.x + ${e}.y + ${e}.z + ${e}.w)`:t===2?`(${e}.x + ${e}.y)`:t===3?`(${e}.x + ${e}.y + ${e}.z)`:e,j=(e,t,r,i)=>e.startsWith("uniforms.")&&r>4?typeof t=="string"?i==="f16"?`${e}[(${t}) / 8][(${t}) % 8 / 4][(${t}) % 8 % 4]`:`${e}[(${t}) / 4][(${t}) % 4]`:i==="f16"?`${e}[${Math.floor(t/8)}][${Math.floor(t%8/4)}][${t%8%4}]`:`${e}[${Math.floor(t/4)}][${t%4}]`:r>1?`${e}[${t}]`:e,ar=(e,t,r,i,a)=>{let s=typeof r=="number",n=s?r:r.length,u=[...new Array(n).keys()],l=n<2?"u32":n<=4?`vec${n}<u32>`:`array<u32, ${n}>`,p=Or(t,a),h=typeof p=="string"?p:p[1],c=typeof p=="string"?p:p[0],g={indices:l,value:h,storage:c,tensor:t},_=U=>typeof U=="string"?U:`${U}u`,y={offsetToIndices:!1,indicesToOffset:!1,broadcastedIndicesToOffset:!1,set:!1,setByIndices:!1,get:!1,getByIndices:!1},$=s?"uniforms.":"",S=`${$}${e}_shape`,x=`${$}${e}_strides`,b="";for(let U=0;U<n-1;U++)b+=`
    let dim${U} = current / ${j(x,U,n)};
    let rest${U} = current % ${j(x,U,n)};
    indices[${U}] = dim${U};
    current = rest${U};
    `;b+=`indices[${n-1}] = current;`;let E=n<2?"":`
  fn o2i_${e}(offset: u32) -> ${g.indices} {
    var indices: ${g.indices};
    var current = offset;
    ${b}
    return indices;
  }`,k=U=>(y.offsetToIndices=!0,n<2?U:`o2i_${e}(${U})`),I=[];if(n>=2)for(let U=n-1;U>=0;U--)I.push(`${j(x,U,n)} * (indices[${U}])`);let z=n<2?"":`
  fn i2o_${e}(indices: ${g.indices}) -> u32 {
    return ${I.join("+")};
  }`,A=U=>(y.indicesToOffset=!0,n<2?U:`i2o_${e}(${U})`),v=(...U)=>n===0?"0u":`${g.indices}(${U.map(_).join(",")})`,D=(U,Y)=>n<2?`${U}`:`${j(U,Y,n)}`,q=(U,Y,X)=>n<2?`${U}=${X};`:`${j(U,Y,n)}=${X};`,Q={},F=(U,Y)=>{y.broadcastedIndicesToOffset=!0;let X=`${Y.name}broadcastedIndicesTo${e}Offset`;if(X in Q)return`${X}(${U})`;let V=[];for(let Ie=n-1;Ie>=0;Ie--){let Oe=Y.indicesGet("outputIndices",Ie+Y.rank-n);V.push(`${D(x,Ie)} * (${Oe} % ${D(S,Ie)})`)}return Q[X]=`fn ${X}(outputIndices: ${Y.type.indices}) -> u32 {
             return ${V.length>0?V.join("+"):"0u"};
           }`,`${X}(${U})`},K=(U,Y)=>(()=>{if(g.storage===g.value)return`${e}[${U}]=${Y};`;if(g.storage==="vec2<u32>"&&g.value==="i32")return`${e}[${U}]=vec2<u32>(u32(${Y}), select(0u, 0xFFFFFFFFu, ${Y} < 0));`;if(g.storage==="vec2<u32>"&&g.value==="u32")return`${e}[${U}]=vec2<u32>(u32(${Y}), 0u);`;if(g.storage==="u32"&&g.value==="vec4<bool>")return`${e}[${U}]=dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(${Y}));`;throw new Error(`not supported combination of storage type ${g.storage} and value type ${g.value} yet`)})(),R=U=>(()=>{if(g.storage===g.value)return`${e}[${U}]`;if(g.storage==="vec2<u32>"&&g.value==="i32")return`i32(${e}[${U}].x)`;if(g.storage==="vec2<u32>"&&g.value==="u32")return`u32(${e}[${U}].x)`;if(g.storage==="u32"&&g.value==="vec4<bool>")return`vec4<bool>(bool(${e}[${U}] & 0xFFu), bool(${e}[${U}] & 0xFF00u), bool(${e}[${U}] & 0xFF0000u), bool(${e}[${U}] & 0xFF000000u))`;throw new Error(`not supported combination of storage type ${g.storage} and value type ${g.value} yet`)})(),M=n<2?"":`
  fn get_${e}ByIndices(indices: ${g.indices}) -> ${h} {
    return ${R(`i2o_${e}(indices)`)};
  }`,H=n<2?"":(()=>{let U=u.map(X=>`d${X}: u32`).join(", "),Y=u.map(X=>`d${X}`).join(", ");return`
  fn get_${e}(${U}) -> ${h} {
    return get_${e}ByIndices(${v(Y)});
  }`})(),J=(...U)=>{if(U.length!==n)throw new Error(`indices length must be ${n}`);let Y=U.map(_).join(",");return n===0?R("0u"):n===1?R(Y[0]):(y.get=!0,y.getByIndices=!0,y.indicesToOffset=!0,`get_${e}(${Y})`)},te=U=>n<2?R(U):(y.getByIndices=!0,y.indicesToOffset=!0,`get_${e}ByIndices(${U})`),re=n<2?"":`
  fn set_${e}ByIndices(indices: ${g.indices}, value: ${h}) {
    ${K(`i2o_${e}(indices)`,"value")}
  }`,ne=n<2?"":(()=>{let U=u.map(X=>`d${X}: u32`).join(", "),Y=u.map(X=>`d${X}`).join(", ");return`
  fn set_${e}(${U}, value: ${h}) {
    set_${e}ByIndices(${v(Y)}, value);
  }`})();return{impl:()=>{let U=[],Y=!1;return y.offsetToIndices&&(U.push(E),Y=!0),y.indicesToOffset&&(U.push(z),Y=!0),y.broadcastedIndicesToOffset&&(Object.values(Q).forEach(X=>U.push(X)),Y=!0),y.set&&(U.push(ne),Y=!0),y.setByIndices&&(U.push(re),Y=!0),y.get&&(U.push(H),Y=!0),y.getByIndices&&(U.push(M),Y=!0),!s&&Y&&U.unshift(`const ${S} = ${g.indices}(${r.join(",")});`,`const ${x} = ${g.indices}(${O.computeStrides(r).join(",")});`),U.join(`
`)},type:g,offsetToIndices:k,indicesToOffset:A,broadcastedIndicesToOffset:F,indices:v,indicesGet:D,indicesSet:q,set:(...U)=>{if(U.length!==n+1)throw new Error(`indices length must be ${n}`);let Y=U[n];if(typeof Y!="string")throw new Error("value must be string");let X=U.slice(0,n).map(_).join(",");return n===0?K("0u",Y):n===1?K(X[0],Y):(y.set=!0,y.setByIndices=!0,y.indicesToOffset=!0,`set_${e}(${X}, ${Y})`)},setByOffset:K,setByIndices:(U,Y)=>n<2?K(U,Y):(y.setByIndices=!0,y.indicesToOffset=!0,`set_${e}ByIndices(${U}, ${Y});`),get:J,getByOffset:R,getByIndices:te,usage:i,name:e,strides:x,shape:S,rank:n}},B=(e,t,r,i=1)=>ar(e,t,r,"input",i),G=(e,t,r,i=1)=>ar(e,t,r,"output",i),Ns=(e,t,r)=>ar(e,t,r,"atomicOutput",1),Gi=(e,t,r,i=1)=>ar(e,t,r,"internal",i),Ms=class{constructor(e,t){this.normalizedDispatchGroup=e,this.limits=t,this.internalVariables=[],this.variables=[],this.uniforms=[],this.variableIndex=0}guardAgainstOutOfBoundsWorkgroupSizes(e){return`if (global_idx >= ${typeof e=="number"?`${e}u`:e}) { return; }`}mainStart(e=Ft){let t=typeof e=="number"?e:e[0],r=typeof e=="number"?1:e[1],i=typeof e=="number"?1:e[2];if(t>this.limits.maxComputeWorkgroupSizeX||r>this.limits.maxComputeWorkgroupSizeY||i>this.limits.maxComputeWorkgroupSizeZ)throw new Error(`workgroup size [${t}, ${r}, ${i}] exceeds the maximum workgroup size [${this.limits.maxComputeWorkgroupSizeX}, ${this.limits.maxComputeWorkgroupSizeY}, ${this.limits.maxComputeWorkgroupSizeZ}].`);if(t*r*i>this.limits.maxComputeInvocationsPerWorkgroup)throw new Error(`workgroup size [${t}, ${r}, ${i}] exceeds the maximum workgroup invocations ${this.limits.maxComputeInvocationsPerWorkgroup}.`);let a=this.normalizedDispatchGroup[1]===1&&this.normalizedDispatchGroup[2]===1,s=a?`@builtin(global_invocation_id) global_id : vec3<u32>,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(local_invocation_id) local_id : vec3<u32>`:`@builtin(global_invocation_id) global_id : vec3<u32>,
                                             @builtin(local_invocation_id) local_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(num_workgroups) num_workgroups : vec3<u32>`,n=a?`let global_idx = global_id.x;
         let workgroup_index = workgroup_id.x;`:`let workgroup_index = workgroup_id.z * num_workgroups[0] * num_workgroups[1] +
             workgroup_id.y * num_workgroups[0] + workgroup_id.x;
         let global_idx = workgroup_index * ${t*r*i}u + local_idx;`;return`@compute @workgroup_size(${t}, ${r}, ${i})
  fn main(${s}) {
    ${n}
  `}appendVariableUniforms(e){e.rank!==0&&(e.shape.startsWith("uniforms.")&&this.uniforms.push({name:e.shape.replace("uniforms.",""),type:"u32",length:e.rank}),e.strides.startsWith("uniforms.")&&this.uniforms.push({name:e.strides.replace("uniforms.",""),type:"u32",length:e.rank}))}declareVariable(e,t){if(e.usage==="internal")throw new Error("cannot use internal variable with declareVariable(). use registerInternalVariables() instead.");this.variables.push(e),this.appendVariableUniforms(e);let r=e.usage==="input"?"read":"read_write",i=e.usage==="atomicOutput"?"atomic<i32>":e.type.storage;return`@group(0) @binding(${t}) var<storage, ${r}> ${e.name}: array<${i}>;`}declareVariables(...e){return e.map(t=>this.declareVariable(t,this.variableIndex++)).join(`
`)}registerInternalVariable(e){if(e.usage!=="internal")throw new Error("cannot use input or output variable with registerInternalVariable(). use declareVariables() instead.");this.internalVariables.push(e),this.appendVariableUniforms(e)}registerInternalVariables(...e){return e.forEach(t=>this.registerInternalVariable(t)),this}registerUniform(e,t,r=1){return this.uniforms.push({name:e,type:t,length:r}),this}registerUniforms(e){return this.uniforms=this.uniforms.concat(e),this}uniformDeclaration(){if(this.uniforms.length===0)return"";let e=[];for(let{name:t,type:r,length:i}of this.uniforms)if(i&&i>4)r==="f16"?e.push(`@align(16) ${t}:array<mat2x4<${r}>, ${Math.ceil(i/8)}>`):e.push(`${t}:array<vec4<${r}>, ${Math.ceil(i/4)}>`);else{let a=i==null||i===1?r:`vec${i}<${r}>`;e.push(`${t}:${a}`)}return`
      struct Uniforms { ${e.join(", ")} };
      @group(0) @binding(${this.variableIndex}) var<uniform> uniforms: Uniforms;`}get additionalImplementations(){return this.uniformDeclaration()+this.variables.map(e=>e.impl()).join(`
`)+this.internalVariables.map(e=>e.impl()).join(`
`)}get variablesInfo(){if(this.uniforms.length===0)return;let e=t=>[12,10,1,6][["u32","f16","f32","i32"].indexOf(t)];return this.uniforms.map(t=>[e(t.type),t.length??1])}},Ds=(e,t)=>new Ms(e,t)}),Us,Hi,Ps,qs,Ls,Ws,Ue,Vs,Gs,pt=P(()=>{"use strict";ee(),ie(),Se(),ae(),Us=(e,t)=>{if(!e||e.length!==1)throw new Error("Transpose requires 1 input.");if(t.length!==0&&t.length!==e[0].dims.length)throw new Error(`perm size ${t.length} does not match input rank ${e[0].dims.length}`)},Hi=(e,t)=>t.length!==0?t:[...new Array(e).keys()].reverse(),Ps=(e,t)=>O.sortBasedOnPerm(e,Hi(e.length,t)),qs=(e,t,r,i)=>{let a=`fn perm(i: ${i.type.indices}) -> ${r.type.indices} {
    var a: ${r.type.indices};`;for(let s=0;s<t;++s)a+=`a[${e[s]}]=i[${s}];`;return a+="return a;}"},Ls=(e,t)=>{let r=[],i=[];for(let a=0;a<e.length;++a)e[a]!==1&&r.push(e[a]),e[t[a]]!==1&&i.push(t[a]);return{newShape:r,newPerm:i}},Ws=(e,t)=>{let r=0;for(let i=0;i<e.length;++i)if(t[e[i]]!==1){if(e[i]<r)return!1;r=e[i]}return!0},Ue=(e,t)=>{let r=e.dataType,i=e.dims.length,a=Hi(i,t),s=Ps(e.dims,a),n=e.dims,u=s,l=i<2||Ws(a,e.dims),p;if(l)return p=y=>{let $=B("input",r,n,4),S=G("output",r,u,4);return`
  ${y.registerUniform("output_size","u32").declareVariables($,S)}
  ${y.mainStart()}
    ${y.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    output[global_idx] = input[global_idx];
  }`},{name:"TransposeCopy",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let y=O.size(s);return{outputs:[{dims:s,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(y/64/4)},programUniforms:[{type:12,data:Math.ceil(y/4)}]}},getShaderSource:p};let{newShape:h,newPerm:c}=Ls(e.dims,a),g=O.areEqual(c,[2,3,1]),_=O.areEqual(c,[3,1,2]);if(h.length===2||g||_){n=g?[h[0],h[1]*h[2]]:_?[h[0]*h[1],h[2]]:h,u=[n[1],n[0]];let y=16;return p=$=>{let S=B("a",r,n.length),x=G("output",r,u.length);return`
  ${$.registerUniform("output_size","u32").declareVariables(S,x)}
  var<workgroup> tile : array<array<${x.type.value}, ${y+1}>, ${y}>;
  ${$.mainStart([y,y,1])}
    let stride = (uniforms.output_shape[1] - 1) / ${y} + 1;
    let workgroup_id_x = workgroup_index % stride;
    let workgroup_id_y = workgroup_index / stride;
    let input_col = workgroup_id_y * ${y}u + local_id.x;
    let input_row = workgroup_id_x * ${y}u + local_id.y;
    if (input_row < uniforms.a_shape[0] && input_col < uniforms.a_shape[1]) {
      tile[local_id.y][local_id.x] = ${S.getByIndices(`${S.type.indices}(input_row, input_col)`)};
    }
    workgroupBarrier();

    let output_col = workgroup_id_x * ${y}u + local_id.x;
    let output_row = workgroup_id_y * ${y}u + local_id.y;
    if (output_row < uniforms.output_shape[0] && output_col < uniforms.output_shape[1]) {
      ${x.setByIndices(`${x.type.indices}(output_row, output_col)`,"tile[local_id.x][local_id.y]")}
    }
  }`},{name:"TransposeShared",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let $=O.size(s);return{outputs:[{dims:s,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(u[1]/y),y:Math.ceil(u[0]/y)},programUniforms:[{type:12,data:$},...Z(n,u)]}},getShaderSource:p}}return p=y=>{let $=B("a",r,n.length),S=G("output",r,u.length);return`
  ${y.registerUniform("output_size","u32").declareVariables($,S)}

  ${qs(a,i,$,S)}

  ${y.mainStart()}
    ${y.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${S.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${S.setByOffset("global_idx",$.getByIndices("aIndices"))}
  }`},{name:"Transpose",shaderCache:{hint:`${t}`,inputDependencies:["rank"]},getRunData:()=>{let y=O.size(s);return{outputs:[{dims:s,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(y/64)},programUniforms:[{type:12,data:y},...Z(n,u)]}},getShaderSource:p}},Vs=(e,t)=>{Us(e.inputs,t.perm),e.compute(Ue(e.inputs[0],t.perm))},Gs=e=>he({perm:e.perm})}),Hs,Fs,js,Ks,Zs,Xs,Qs,Ys,Js,eo,He,to,ro,io,ao,no,so,oo,uo,lo,po,zm=P(()=>{"use strict";ee(),ie(),ae(),ji(),pt(),Hs={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate * candidate",logSumExp:"bestValue + exp(candidate)",l1:"bestValue + abs(candidate)",l2:"bestValue + candidate * candidate",logSum:"bestValue + candidate"},Fs={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate",logSumExp:"bestValue + candidate",l1:"bestValue + candidate",l2:"bestValue + candidate",logSum:"bestValue + candidate"},js={max:"_A[offset]",min:"_A[offset]",mean:"0",sum:"0",prod:"1",sumSquare:"0",logSumExp:"0",l1:"0",l2:"0",logSum:"0"},Ks={max:"bestValue",min:"bestValue",sum:"bestValue",prod:"bestValue",sumSquare:"bestValue",logSumExp:"log(bestValue)",l1:"bestValue",l2:"sqrt(bestValue)",logSum:"log(bestValue)"},Zs=(e,t)=>{let r=[];for(let i=t-e;i<t;++i)r.push(i);return r},Xs=(e,t)=>{let r=[],i=e.length;for(let s=0;s<i;s++)t.indexOf(s)===-1&&r.push(e[s]);let a=t.map(s=>e[s]);return[r,a]},Qs=(e,t)=>{let r=e.length+t.length,i=[],a=0;for(let s=0;s<r;s++)t.indexOf(s)===-1?i.push(e[a++]):i.push(1);return i},Ys=(e,t)=>{for(let r=0;r<e.length;++r)if(e[e.length-r-1]!==t-1-r)return!1;return!0},Js=(e,t)=>{let r=[];if(!Ys(e,t)){for(let i=0;i<t;++i)e.indexOf(i)===-1&&r.push(i);e.forEach(i=>r.push(i))}return r},eo=(e,t,r,i,a,s,n)=>{let u=r[0].dims,l=O.size(s),p=O.size(n),h=B("_A",r[0].dataType,u),c=G("output",a,s),g=64;l===1&&(g=256);let _=`
          var<workgroup> aBestValues : array<f32, ${g}>;
       `,y=$=>`
        ${$.registerUniform("reduceSize","u32").declareVariables(h,c)}
        ${_}
        fn DIV_CEIL(a : u32, b : u32) -> u32 {
          return ((a - 1u) / b + 1u);
         }
         ${$.mainStart(g)}

          let outputIndex = global_idx / ${g};
          let offset = outputIndex * uniforms.reduceSize;

          var bestValue = f32(${js[i]});
          let Length = uniforms.reduceSize;
          for (var k = local_idx; k < Length; k = k + ${g}) {
           let candidate = f32(${h.getByOffset("offset + k")});
           bestValue = ${Hs[i]};
          }
          aBestValues[local_idx] = bestValue;
          workgroupBarrier();

         var reduceSize = min(Length, ${g}u);
         for (var currentSize = reduceSize / 2u; reduceSize > 1u;
             currentSize = reduceSize / 2u) {
           let interval = DIV_CEIL(reduceSize, 2u);
           if (local_idx < currentSize) {
            let candidate = aBestValues[local_idx + interval];
            bestValue = ${Fs[i]};
            aBestValues[local_idx] = bestValue;
           }
           reduceSize = interval;
           workgroupBarrier();
         }

         if (local_idx == 0u) {
          ${c.setByOffset("outputIndex",`${i==="mean"?`${c.type.storage}(bestValue / f32(uniforms.reduceSize))`:`${c.type.storage}(${Ks[i]})`}`)};
         }
        }`;return{name:e,shaderCache:{hint:`${t};${g}`,inputDependencies:["type"]},getShaderSource:y,getRunData:()=>({outputs:[{dims:s,dataType:a}],dispatchGroup:{x:l},programUniforms:[{type:12,data:p}]})}},He=(e,t,r,i)=>{let a=e.inputs.length===1?r:Fi(e.inputs,r),s=a.axes;s.length===0&&!a.noopWithEmptyAxes&&(s=e.inputs[0].dims.map((_,y)=>y));let n=O.normalizeAxes(s,e.inputs[0].dims.length),u=n,l=e.inputs[0],p=Js(u,e.inputs[0].dims.length);p.length>0&&(l=e.compute(Ue(e.inputs[0],p),{inputs:[0],outputs:[-1]})[0],u=Zs(u.length,l.dims.length));let[h,c]=Xs(l.dims,u),g=h;a.keepDims&&(g=Qs(h,n)),e.compute(eo(t,a.cacheKey,[l],i,e.inputs[0].dataType,g,c),{inputs:[l]})},to=(e,t)=>{He(e,"ReduceMeanShared",t,"mean")},ro=(e,t)=>{He(e,"ReduceL1Shared",t,"l1")},io=(e,t)=>{He(e,"ReduceL2Shared",t,"l2")},ao=(e,t)=>{He(e,"ReduceLogSumExpShared",t,"logSumExp")},no=(e,t)=>{He(e,"ReduceMaxShared",t,"max")},so=(e,t)=>{He(e,"ReduceMinShared",t,"min")},oo=(e,t)=>{He(e,"ReduceProdShared",t,"prod")},uo=(e,t)=>{He(e,"ReduceSumShared",t,"sum")},lo=(e,t)=>{He(e,"ReduceSumSquareShared",t,"sumSquare")},po=(e,t)=>{He(e,"ReduceLogSumShared",t,"logSum")}}),Fe,co,Rr,Fi,je,ho,fo,mo,go,yo,_o,bo,wo,$o,vo,Ke,xo,So,ko,To,Io,Eo,zo,Co,Ao,Oo,ji=P(()=>{"use strict";ee(),ie(),Se(),ae(),zm(),Fe=e=>{if(!e||e.length===0||e.length>2)throw new Error("Reduce op requires 1 or 2 inputs.");if(e.length===2&&e[1].dims.length!==1)throw new Error("Invalid axes input dims.")},co=e=>["","",`var value = ${e.getByIndices("input_indices")};`,""],Rr=(e,t,r,i,a,s,n=!1,u=!1)=>{let l=[],p=r[0].dims,h=p.length,c=O.normalizeAxes(a,h),g=!u&&c.length===0;p.forEach(($,S)=>{g||c.indexOf(S)>=0?n&&l.push(1):l.push($)});let _=l.length,y=O.size(l);return{name:e,shaderCache:t,getShaderSource:$=>{let S=[],x=B("_A",r[0].dataType,h),b=G("output",s,_),E=i(x,b,c),k=E[2];for(let I=0,z=0;I<h;I++)g||c.indexOf(I)>=0?(n&&z++,k=`for(var j${I}: u32 = 0; j${I} < ${p[I]}; j${I}++) {
                  ${E[2].includes("last_index")?`let last_index = j${I};`:""}
                  ${x.indicesSet("input_indices",I,`j${I}`)}
                  ${k}
                }`):(S.push(`${x.indicesSet("input_indices",I,b.indicesGet("output_indices",z))};`),z++);return`

        ${$.registerUniform("output_size","u32").declareVariables(x,b)}

        ${$.mainStart()}
          ${$.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          var input_indices: ${x.type.indices};
          let output_indices = ${b.offsetToIndices("global_idx")};

          ${S.join(`
`)}
          ${E[0]}       // init ops for reduce max/min
          ${E[1]}
          ${k}
          ${E[3]}
          ${E.length===4?b.setByOffset("global_idx","value"):E.slice(4).join(`
`)}
        }`},getRunData:()=>({outputs:[{dims:l,dataType:s}],dispatchGroup:{x:Math.ceil(y/64)},programUniforms:[{type:12,data:y},...Z(p,l)]})}},Fi=(e,t)=>{let r=[];return e[1].dims[0]>0&&e[1].getBigInt64Array().forEach(i=>r.push(Number(i))),he({axes:r,keepDims:t.keepDims,noopWithEmptyAxes:t.noopWithEmptyAxes})},je=(e,t,r,i)=>{let a=e.inputs,s=a.length===1?r:Fi(a,r);e.compute(Rr(t,{hint:s.cacheKey,inputDependencies:["rank"]},[a[0]],s.noopWithEmptyAxes&&s.axes.length===0?co:i,s.axes,a[0].dataType,s.keepDims,s.noopWithEmptyAxes),{inputs:[0]})},ho=(e,t)=>{Fe(e.inputs),je(e,"ReduceLogSum",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += ${r.getByIndices("input_indices")};`,"value = log(value);"])},fo=(e,t)=>{Fe(e.inputs),je(e,"ReduceL1",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += abs(${r.getByIndices("input_indices")});`,""])},mo=(e,t)=>{Fe(e.inputs),je(e,"ReduceL2",t,(r,i)=>[`var t = ${i.type.value}(0); var value = ${i.type.value}(0);`,"",`t = ${r.getByIndices("input_indices")}; value += (t * t);`,"value = sqrt(value);"])},go=(e,t)=>{Fe(e.inputs),je(e,"ReduceLogSumExp",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += exp(${r.getByIndices("input_indices")});`,"value = log(value);"])},yo=(e,t)=>{Fe(e.inputs),je(e,"ReduceMax",t,(r,i,a)=>{let s=[];for(let n=0;n<r.rank;n++)(a.indexOf(n)>=0||a.length===0)&&s.push(r.indicesSet("input_indices",n,0));return[`${s.join(`
`)}`,`var value = ${r.getByIndices("input_indices")};`,`value = max(value, ${r.getByIndices("input_indices")});`,""]})},_o=(e,t)=>{Fe(e.inputs),je(e,"ReduceMean",t,(r,i,a)=>{let s=1;for(let n=0;n<r.rank;n++)(a.indexOf(n)>=0||a.length===0)&&(s*=e.inputs[0].dims[n]);return["var sum = f32(0);","",`sum += f32(${r.getByIndices("input_indices")});`,`let value = ${i.type.value}(sum / ${s});`]})},bo=(e,t)=>{Fe(e.inputs),je(e,"ReduceMin",t,(r,i,a)=>{let s=[];for(let n=0;n<r.rank;n++)(a.indexOf(n)>=0||a.length===0)&&s.push(`input_indices[${n}] = 0;`);return[`${s.join(`
`)}`,`var value = ${r.getByIndices("input_indices")};`,`value = min(value, ${r.getByIndices("input_indices")});`,""]})},wo=(e,t)=>{Fe(e.inputs),je(e,"ReduceProd",t,(r,i)=>[`var value = ${i.type.storage}(1);`,"",`value *= ${r.getByIndices("input_indices")};`,""])},$o=(e,t)=>{Fe(e.inputs),je(e,"ReduceSum",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += ${r.getByIndices("input_indices")};`,""])},vo=(e,t)=>{Fe(e.inputs),je(e,"ReduceSumSquare",t,(r,i)=>[`var t = ${i.type.value}(0); var value = ${i.type.value}(0);`,"",`t = ${r.getByIndices("input_indices")}; value += t * t;`,""])},Ke=(e,t,r)=>{if(t.length===0)return r;let i=1,a=1;for(let s=0;s<t.length;s++)t.indexOf(s)===-1?i*=e[s]:a*=e[s];return a<32&&i>1024},xo=(e,t)=>{Ke(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?_o(e,t):to(e,t)},So=(e,t)=>{Ke(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?fo(e,t):ro(e,t)},ko=(e,t)=>{Ke(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?mo(e,t):io(e,t)},To=(e,t)=>{Ke(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?go(e,t):ao(e,t)},Io=(e,t)=>{Ke(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?yo(e,t):no(e,t)},Eo=(e,t)=>{Ke(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?bo(e,t):so(e,t)},zo=(e,t)=>{Ke(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?wo(e,t):oo(e,t)},Co=(e,t)=>{Ke(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?$o(e,t):uo(e,t)},Ao=(e,t)=>{Ke(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?vo(e,t):lo(e,t)},Oo=(e,t)=>{Ke(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?ho(e,t):po(e,t)}}),Ki,Ro,Bo,Zi,Cm=P(()=>{"use strict";ee(),Se(),ji(),Ki=e=>{if(!e||e.length===0||e.length>2)throw new Error("ArgMinMaxOp op requires 1 or 2 inputs.");if(e[0].dataType!==1)throw new Error("Invalid input type.")},Ro=(e,t)=>{Ki(e.inputs);let r=(i,a,s)=>{let n=[];for(let u=0;u<i.rank;u++)(s.indexOf(u)>=0||s.length===0)&&n.push(`input_indices[${u}] = 0;`);return[`${n.join(`
`)}`,`var value = ${i.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${i.getByIndices("input_indices")} ${t.selectLastIndex>0?"<=":"<"} value) {
         value = ${i.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",a.setByOffset("global_idx","best_index")]};e.compute(Rr("ArgMin",{hint:t.cacheKey,inputDependencies:["rank"]},[e.inputs[0]],r,[t.axis],7,t.keepDims),{inputs:[0]})},Bo=(e,t)=>{Ki(e.inputs);let r=(i,a,s)=>{let n=[];for(let u=0;u<i.rank;u++)(s.indexOf(u)>=0||s.length===0)&&n.push(`input_indices[${u}] = 0;`);return[`${n.join(`
`)}`,`var value = ${i.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${i.getByIndices("input_indices")} ${t.selectLastIndex>0?">=":">"} value) {
         value = ${i.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",a.setByOffset("global_idx","best_index")]};e.compute(Rr("argMax",{hint:t.cacheKey,inputDependencies:["rank"]},[e.inputs[0]],r,[t.axis],7,t.keepDims),{inputs:[0]})},Zi=e=>he(e)}),No,Br,Mo,Do,Uo,nr,Po,qo,Xi=P(()=>{"use strict";ee(),ie(),Pi(),ae(),No=(e,t)=>{let r=e[0],i=e[1],a=e[2],s=e[3],n=e[4],u=e[5];if(n&&u)throw new Error("Attention cannot have both past and attention_bias");if(r.dims.length!==3)throw new Error('Input "input" must have 3 dimensions');let l=r.dims[0],p=r.dims[1],h=r.dims[2];if(a.dims.length!==1)throw new Error('Input "bias" is expected to have 1 dimensions');if(i.dims.length!==2)throw new Error('Input "weights" is expected to have 2 dimensions');if(i.dims[0]!==h)throw new Error("Input 1 dimension 0 should have same length as dimension 2 of input 0");if(a.dims[0]!==i.dims[1])throw new Error('Input "bias" dimension 0 should have same length as dimension 1 of input "weights"');let c=a.dims[0]/3,g=c,_=g;if(t.qkvHiddenSizes.length>0){if(t.qkvHiddenSizes.length!==3)throw new Error("qkv_hidden_sizes attribute should have 3 elements");for(let E of t.qkvHiddenSizes)if(E%t.numHeads!==0)throw new Error("qkv_hidden_sizes should be divisible by num_heads");c=t.qkvHiddenSizes[0],g=t.qkvHiddenSizes[1],_=t.qkvHiddenSizes[2]}let y=p;if(c!==g)throw new Error("qkv_hidden_sizes first element should be same as the second");if(a.dims[0]!==c+g+_)throw new Error('Input "bias" dimension 0 should have same length as sum of Q/K/V hidden sizes');let $=0;if(n){if(g!==_)throw new Error('Input "past" expect k_hidden_size == v_hidden_size');if(n.dims.length!==5)throw new Error('Input "past" must have 5 dimensions');if(n.dims[0]!==2)throw new Error('Input "past" first dimension must be 2');if(n.dims[1]!==l)throw new Error('Input "past" second dimension must be batch_size');if(n.dims[2]!==t.numHeads)throw new Error('Input "past" third dimension must be num_heads');if(n.dims[4]!==g/t.numHeads)throw new Error('Input "past" fifth dimension must be k_hidden_size / num_heads');t.pastPresentShareBuffer||($=n.dims[3])}let S=y+$,x=-1,b=0;if(s)throw new Error("Mask not supported");if(n)throw new Error("past is not supported");if(u){if(u.dims.length!==4)throw new Error('Input "attention_bias" must have 4 dimensions');if(u.dims[0]!==l||u.dims[1]!==t.numHeads||u.dims[2]!==p||u.dims[3]!==S)throw new Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:l,sequenceLength:p,pastSequenceLength:$,kvSequenceLength:y,totalSequenceLength:S,maxSequenceLength:x,inputHiddenSize:h,hiddenSize:c,vHiddenSize:_,headSize:Math.floor(c/t.numHeads),vHeadSize:Math.floor(_/t.numHeads),numHeads:t.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:t.maskFilterValue,maskType:b,scale:t.scale,broadcastResPosBias:!1,passPastInKv:!1,qkvFormat:1}},Br=(e,t,r)=>t&&e?`
      let total_sequence_length_input = u32(${t.getByOffset("0")});
      let present_sequence_length = max(total_sequence_length_input, uniforms.past_sequence_length);
      let is_subsequent_prompt: bool = sequence_length > 1 && sequence_length != total_sequence_length_input;
      let is_first_prompt: bool = is_subsequent_prompt == false && sequence_length == total_sequence_length_input;
      total_sequence_length = u32(${e?.getByOffset("batchIdx")}) + 1;
      var past_sequence_length: u32 = 0;
      if (is_first_prompt == false) {
        past_sequence_length = total_sequence_length - sequence_length;
      }
       `:`
    ${r?"let past_sequence_length = uniforms.past_sequence_length":""};
    let present_sequence_length = total_sequence_length;
    `,Mo=(e,t,r,i,a,s,n,u)=>{let l=ke(n?1:s),p=64,h=s/l;h<p&&(p=32);let c=Math.ceil(s/l/p),g=[{type:12,data:t},{type:12,data:r},{type:12,data:i},{type:12,data:a},{type:12,data:h},{type:12,data:c}],_=Ee(e.dataType,l),y=ze(1,l),$=["type"];n&&$.push("type"),u&&$.push("type");let S=x=>{let b=G("x",e.dataType,e.dims,l),E=[b],k=n?B("seq_lens",n.dataType,n.dims):void 0;k&&E.push(k);let I=u?B("total_sequence_length_input",u.dataType,u.dims):void 0;I&&E.push(I);let z=ze(e.dataType),A=[{name:"batch_size",type:"u32"},{name:"num_heads",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"sequence_length",type:"u32"},{name:"total_sequence_length",type:"u32"},{name:"elements_per_thread",type:"u32"}];return`
  var<workgroup> thread_max: array<f32, ${p}>;
  var<workgroup> thread_sum: array<f32, ${p}>;
  ${x.registerUniforms(A).declareVariables(...E)}
  ${x.mainStart([p,1,1])}
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let sequence_length = uniforms.sequence_length;
    var total_sequence_length = uniforms.total_sequence_length;
    ${Br(k,I,!1)}
    let local_offset = local_idx * uniforms.elements_per_thread;
    let offset = (global_idx / ${p}) * uniforms.total_sequence_length + local_offset;
    let seq_causal_length = ${n?"u32(past_sequence_length + workgroup_id.y + 1)":"total_sequence_length"};
    var thread_max_vector = ${y}(-3.4028234663852886e+38f);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      thread_max_vector = max(${y}(x[offset + i]), thread_max_vector);
    }
    thread_max[local_idx] = ${(()=>{switch(l){case 1:return"thread_max_vector";case 2:return"max(thread_max_vector.x, thread_max_vector.y)";case 4:return"max(max(thread_max_vector.x, thread_max_vector.y), max(thread_max_vector.z, thread_max_vector.w))";default:throw new Error(`Unsupported components: ${l}`)}})()};
    workgroupBarrier();

    var max_value =  f32(-3.4028234663852886e+38f);
    for (var i = 0u; i < ${p}; i++) {
      max_value = max(thread_max[i], max_value);
    }

    var sum_vector = ${y}(0);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      sum_vector += exp(${y}(x[offset + i]) - max_value);
    }
    thread_sum[local_idx] = ${(()=>{switch(l){case 1:return"sum_vector";case 2:return"sum_vector.x + sum_vector.y";case 4:return"sum_vector.x + sum_vector.y + sum_vector.z + sum_vector.w";default:throw new Error(`Unsupported components: ${l}`)}})()};
    workgroupBarrier();

    var sum: f32 = 0;
    for (var i = 0u; i < ${p}; i++) {
      sum += thread_sum[i];
    }

    if (sum == 0) {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        x[offset + i] = ${b.type.value}(${z}(1.0) / ${z}(seq_causal_length));
      }
    } else {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        var f32input = ${y}(x[offset + i]);
        x[offset + i] = ${b.type.value}(exp(f32input - max_value) / sum);
      }
    }
      ${n?`
        for (var total_seq_id: u32 = seq_causal_length; total_seq_id + local_offset < uniforms.total_sequence_length; total_seq_id++) {
          x[offset + total_seq_id] = ${b.type.value}(${z}(0));
        }`:""};
  }`};return{name:"AttentionProbsSoftmax",shaderCache:{hint:`${p};${_};${l}`,inputDependencies:$},getShaderSource:S,getRunData:()=>({outputs:[],dispatchGroup:{x:1,y:a,z:t*r},programUniforms:g})}},Do=(e,t,r,i,a,s,n,u,l)=>{let p=n+s.kvSequenceLength,h=[s.batchSize,s.numHeads,s.sequenceLength,p],c=e>1&&i,g=s.kvNumHeads?s.kvNumHeads:s.numHeads,_=c?[s.batchSize,g,p,s.headSize]:void 0,y=s.nReps?s.nReps:1,$=s.scale===0?1/Math.sqrt(s.headSize):s.scale,S=ke(s.headSize),x=s.headSize/S,b=12,E={x:Math.ceil(p/b),y:Math.ceil(s.sequenceLength/b),z:s.batchSize*s.numHeads},k=[{type:12,data:s.sequenceLength},{type:12,data:x},{type:12,data:p},{type:12,data:s.numHeads},{type:12,data:s.headSize},{type:1,data:$},{type:12,data:n},{type:12,data:s.kvSequenceLength},{type:12,data:y}],I=c&&i&&O.size(i.dims)>0,z=["type","type"];I&&z.push("type"),a&&z.push("type"),u&&z.push("type"),l&&z.push("type");let A=[{dims:h,dataType:t.dataType,gpuDataType:0}];c&&A.push({dims:_,dataType:t.dataType,gpuDataType:0});let v=D=>{let q=B("q",t.dataType,t.dims,S),Q=B("key",r.dataType,r.dims,S),F=[q,Q];if(I){let re=B("past_key",i.dataType,i.dims,S);F.push(re)}a&&F.push(B("attention_bias",a.dataType,a.dims));let K=u?B("seq_lens",u.dataType,u.dims):void 0;K&&F.push(K);let R=l?B("total_sequence_length_input",l.dataType,l.dims):void 0;R&&F.push(R);let M=G("output",t.dataType,h),H=[M];c&&H.push(G("present_key",t.dataType,_,S));let J=ze(1,S),te=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"alpha",type:"f32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${b}u;

  var<workgroup> tileQ: array<${q.type.storage}, ${b*b}>;
  var<workgroup> tileK: array<${q.type.storage}, ${b*b}>;
  ${D.registerUniforms(te).declareVariables(...F,...H)}
  ${D.mainStart([b,b,1])}
    // x holds the N and y holds the M
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let kvHeadIdx = ${y===1?"headIdx":"headIdx / uniforms.n_reps"};
    let kv_num_heads = ${y===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let m = workgroup_id.y * TILE_SIZE;
    let n = workgroup_id.x * TILE_SIZE;
    let sequence_length = uniforms.M;
    var total_sequence_length = uniforms.N;
    ${Br(K,R,!0)}
    let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx;
    let qOffset = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
    ${I&&c?"let pastKeyOffset = absKvHeadIdx * uniforms.past_sequence_length * uniforms.K;":""};
    let kOffset = absKvHeadIdx * uniforms.kv_sequence_length * uniforms.K;
    ${c?"let presentKeyOffset = absKvHeadIdx * uniforms.N * uniforms.K;":""}
    var value = ${J}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (global_id.y < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = q[qOffset + local_id.y * uniforms.K + w + local_id.x];
      }
      if (n + local_id.y < uniforms.N && w + local_id.x < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
      ${I&&c?`
              if (n + local_id.y < past_sequence_length) {
                tileK[idx] = past_key[pastKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
              } else if (n + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
                tileK[idx] = key[kOffset + (n + local_id.y - past_sequence_length) * uniforms.K + w + local_id.x];
              }`:`
          if (n + local_id.y < uniforms.kv_sequence_length) {
            tileK[idx] = key[kOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
          }`}
      ${c?`if (n + local_id.y < present_sequence_length) {
        present_key[presentKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x] = tileK[idx];
      }`:""}
      }
      workgroupBarrier();

      for (var k: u32 = 0u; k < TILE_SIZE && w+k < uniforms.K; k++) {
          value += ${J}(tileQ[TILE_SIZE * local_id.y + k] * tileK[TILE_SIZE * local_id.x + k]);
      }

      workgroupBarrier();
    }

    if (global_id.y < uniforms.M && global_id.x < total_sequence_length) {
      let headOffset = workgroup_id.z * uniforms.M * uniforms.N;
      let outputIdx = headOffset + global_id.y * uniforms.N + global_id.x;
      var sum: f32 = ${(()=>{switch(S){case 1:return"value";case 2:return"value.x + value.y";case 4:return"value.x + value.y + value.z + value.w";default:throw new Error(`Unsupported components: ${S}`)}})()};
        output[outputIdx] = ${M.type.value} (sum * uniforms.alpha) + ${a?"attention_bias[outputIdx]":"0.0"};
    }
  }`};return{name:"AttentionProbs",shaderCache:{hint:`${S};${a!==void 0};${i!==void 0};${e}`,inputDependencies:z},getRunData:()=>({outputs:A,dispatchGroup:E,programUniforms:k}),getShaderSource:v}},Uo=(e,t,r,i,a,s,n=void 0,u=void 0)=>{let l=s+a.kvSequenceLength,p=a.nReps?a.nReps:1,h=a.vHiddenSize*p,c=e>1&&i,g=a.kvNumHeads?a.kvNumHeads:a.numHeads,_=c?[a.batchSize,g,l,a.headSize]:void 0,y=[a.batchSize,a.sequenceLength,h],$=12,S={x:Math.ceil(a.vHeadSize/$),y:Math.ceil(a.sequenceLength/$),z:a.batchSize*a.numHeads},x=[{type:12,data:a.sequenceLength},{type:12,data:l},{type:12,data:a.vHeadSize},{type:12,data:a.numHeads},{type:12,data:a.headSize},{type:12,data:h},{type:12,data:s},{type:12,data:a.kvSequenceLength},{type:12,data:p}],b=c&&i&&O.size(i.dims)>0,E=["type","type"];b&&E.push("type"),n&&E.push("type"),u&&E.push("type");let k=[{dims:y,dataType:t.dataType,gpuDataType:0}];c&&k.push({dims:_,dataType:t.dataType,gpuDataType:0});let I=z=>{let A=B("probs",t.dataType,t.dims),v=B("v",r.dataType,r.dims),D=[A,v];b&&D.push(B("past_value",i.dataType,i.dims));let q=n?B("seq_lens",n.dataType,n.dims):void 0;n&&D.push(q);let Q=u?B("total_sequence_length_input",u.dataType,u.dims):void 0;u&&D.push(Q);let F=[G("output",t.dataType,y)];c&&F.push(G("present_value",t.dataType,_));let K=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"v_hidden_size",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${$}u;
  var<workgroup> tileQ: array<${A.type.value}, ${$*$}>;
  var<workgroup> tileV: array<${A.type.value}, ${$*$}>;
  ${z.registerUniforms(K).declareVariables(...D,...F)}
  ${z.mainStart([$,$,1])}
   let headIdx = workgroup_id.z % uniforms.num_heads;
   let batchIdx = workgroup_id.z / uniforms.num_heads;
   let kvHeadIdx = ${p===1?"headIdx":"headIdx / uniforms.n_reps"};
   let kv_num_heads = ${p===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
   let m = global_id.y;
   let n = global_id.x;
   let sequence_length = uniforms.M;
   var total_sequence_length = uniforms.K;
   ${Br(q,Q,!0)}
   let offsetA = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
   let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx; // kvHeadIdx is relative to the batch
   ${b&&c?"let pastValueOffset = absKvHeadIdx * uniforms.N * uniforms.past_sequence_length + n;":""};
   let vOffset = absKvHeadIdx * uniforms.N * uniforms.kv_sequence_length + n;
   ${c?"let presentValueOffset = absKvHeadIdx * uniforms.N * uniforms.K + n;":""}
   var value = ${A.type.storage}(0);
   for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = probs[offsetA + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
        ${b&&c?`
        if (w + local_id.y < past_sequence_length) {
          tileV[idx] = past_value[pastValueOffset + (w + local_id.y) * uniforms.N];
        } else if (w + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
          tileV[idx] = v[vOffset + (w + local_id.y - past_sequence_length) * uniforms.N];
        }
      `:`
            if (w + local_id.y < uniforms.kv_sequence_length) {
              tileV[idx] = v[vOffset + (w + local_id.y) * uniforms.N];
            }`}
        ${c?`
            if (w + local_id.y < present_sequence_length) {
          present_value[presentValueOffset + (w + local_id.y) * uniforms.N] = tileV[idx];
        }`:""}
      }
     workgroupBarrier();
     for (var k: u32 = 0u; k < TILE_SIZE && w+k < total_sequence_length; k++) {
       value += tileQ[TILE_SIZE * local_id.y + k] * tileV[TILE_SIZE * k + local_id.x];
     }
     workgroupBarrier();
   }

   // we need to transpose output from BNSH_v to BSND_v
   if (m < uniforms.M && n < uniforms.N) {
     let outputIdx = batchIdx * uniforms.M * uniforms.v_hidden_size + m * uniforms.v_hidden_size
       + headIdx * uniforms.N + n;
     output[outputIdx] = value;
   }
  }`};return{name:"AttentionScore",shaderCache:{hint:`${i!==void 0};${e}`,inputDependencies:E},getRunData:()=>({outputs:k,dispatchGroup:S,programUniforms:x}),getShaderSource:I}},nr=(e,t,r,i,a,s,n,u,l,p,h=void 0,c=void 0)=>{let g=Math.min(e.outputCount,1+(n?1:0)+(u?1:0)),_=g>1?n:void 0,y=g>1?u:void 0,$=g>1?p.pastSequenceLength:0,S=$+p.kvSequenceLength,x=l&&O.size(l.dims)>0?l:void 0,b=[t,r];_&&O.size(_.dims)>0&&b.push(_),x&&b.push(x),h&&b.push(h),c&&b.push(c);let E=e.compute(Do(g,t,r,_,x,p,$,h,c),{inputs:b,outputs:g>1?[-1,1]:[-1]})[0];e.compute(Mo(E,p.batchSize,p.numHeads,$,p.sequenceLength,S,h,c),{inputs:h&&c?[E,h,c]:[E],outputs:[]});let k=[E,i];y&&O.size(y.dims)>0&&k.push(y),h&&k.push(h),c&&k.push(c),e.compute(Uo(g,E,i,y,p,$,h,c),{inputs:k,outputs:g>1?[0,2]:[0]})},Po=(e,t)=>{let r=[t.batchSize,t.numHeads,t.sequenceLength,t.headSize],i=t.sequenceLength,a=t.inputHiddenSize,s=t.headSize,n=12,u={x:Math.ceil(t.headSize/n),y:Math.ceil(t.sequenceLength/n),z:t.batchSize*t.numHeads},l=[e.inputs[0],e.inputs[1],e.inputs[2]],p=[{type:12,data:i},{type:12,data:a},{type:12,data:s},{type:12,data:t.numHeads},{type:12,data:t.headSize},{type:12,data:t.hiddenSize},{type:12,data:t.hiddenSize+t.hiddenSize+t.vHiddenSize}],h=c=>{let g=G("output_q",l[0].dataType,r),_=G("output_k",l[0].dataType,r),y=G("output_v",l[0].dataType,r),$=B("input",l[0].dataType,l[0].dims),S=B("weight",l[1].dataType,l[1].dims),x=B("bias",l[2].dataType,l[2].dims),b=$.type.storage,E=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"hidden_size",type:"u32"},{name:"ldb",type:"u32"}];return`
  const TILE_SIZE = ${n}u;
  var<workgroup> tileInput: array<${b}, ${n*n}>;
  var<workgroup> tileWeightQ: array<${b}, ${n*n}>;
  var<workgroup> tileWeightK: array<${b}, ${n*n}>;
  var<workgroup> tileWeightV: array<${b}, ${n*n}>;
  ${c.registerUniforms(E).declareVariables($,S,x,g,_,y)}
  ${c.mainStart([n,n,1])}
    let batchIndex = workgroup_id.z / uniforms.num_heads;
    let headNumber = workgroup_id.z % uniforms.num_heads;
    let m = global_id.y;
    let n = global_id.x;

    let inputOffset = batchIndex * (uniforms.M * uniforms.K) + m * uniforms.K;
    let biasOffsetQ = headNumber * uniforms.head_size;
    let biasOffsetK = uniforms.hidden_size + biasOffsetQ;
    let biasOffsetV = uniforms.hidden_size + biasOffsetK;

    var valueQ = ${b}(0);
    var valueK = ${b}(0);
    var valueV = ${b}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileInput[TILE_SIZE * local_id.y + local_id.x] = input[inputOffset + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        let offset = n + (w + local_id.y) * uniforms.ldb;
        tileWeightQ[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetQ + offset];
        tileWeightK[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetK + offset];
        tileWeightV[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetV + offset];
      }
      workgroupBarrier();
      for (var k: u32 = 0u; k<TILE_SIZE && w+k < uniforms.K; k++) {
        let inputTileOffset = TILE_SIZE * local_id.y + k;
        let weightTileOffset = TILE_SIZE * k + local_id.x;
        valueQ += tileInput[inputTileOffset] * tileWeightQ[weightTileOffset];
        valueK += tileInput[inputTileOffset] * tileWeightK[weightTileOffset];
        valueV += tileInput[inputTileOffset] * tileWeightV[weightTileOffset];
      }

      workgroupBarrier();
    }

    let headOffset = (m * uniforms.N + n) % uniforms.head_size;
    valueQ += bias[headOffset + biasOffsetQ];
    valueK += bias[headOffset + biasOffsetK];
    valueV += bias[headOffset + biasOffsetV];

    let offset = workgroup_id.z * uniforms.M * uniforms.N;
    if (m < uniforms.M && n < uniforms.N) {
      let outputIdx = offset + m * uniforms.N + n;
      output_q[outputIdx] = valueQ;
      output_k[outputIdx] = valueK;
      output_v[outputIdx] = valueV;
    }
  }`};return e.compute({name:"AttentionPrepare",shaderCache:{inputDependencies:["type","type","type"]},getRunData:()=>({outputs:[{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0},{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0},{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0}],dispatchGroup:u,programUniforms:p}),getShaderSource:h},{inputs:l,outputs:[-1,-1,-1]})},qo=(e,t)=>{let r=No(e.inputs,t),[i,a,s]=Po(e,r);return nr(e,i,a,s,e.inputs[4],void 0,void 0,void 0,e.inputs[5],r)}}),Lo,Wo,Vo,Go,Am=P(()=>{"use strict";qe(),ee(),ie(),Se(),ae(),Lo=(e,t)=>{if(!e||e.length!==5)throw new Error("BatchNormalization requires 5 inputs");let r=(i,a,s)=>{let n=a.length;if(n!==i.length)throw new Error(`${s}: num dimensions != ${n}`);a.forEach((u,l)=>{if(u!==i[l])throw new Error(`${s}: dim[${l}] do not match`)})};if(e[0].dims.length>1){let i=t.format==="NHWC"?t.spatial?e[0].dims.slice(-1):e[0].dims.slice(-1).concat(e[0].dims.slice(1,e[0].dims.length-1)):e[0].dims.slice(1,t.spatial?2:void 0);r(e[1].dims,i,"Invalid input scale"),r(e[2].dims,i,"Invalid input B"),r(e[3].dims,i,"Invalid input mean"),r(e[4].dims,i,"Invalid input var")}else r(e[1].dims,[1],"Invalid input scale"),r(e[2].dims,[1],"Invalid input B"),r(e[3].dims,[1],"Invalid input mean"),r(e[4].dims,[1],"Invalid input var")},Wo=(e,t)=>{let{epsilon:r,spatial:i,format:a}=t,s=e[0].dims,n=i?ke(s[s.length-1]):1,u=a==="NHWC"&&s.length>1?n:1,l=O.size(s)/n,p=i,h=p?s.length:s,c=B("x",e[0].dataType,e[0].dims,n),g=B("scale",e[1].dataType,e[1].dims,u),_=B("bias",e[2].dataType,e[2].dims,u),y=B("inputMean",e[3].dataType,e[3].dims,u),$=B("inputVar",e[4].dataType,e[4].dims,u),S=G("y",e[0].dataType,h,n),x=()=>{let E="";if(i)E=`let cOffset = ${s.length===1?"0u":a==="NHWC"?`outputIndices[${s.length-1}] / ${n}`:"outputIndices[1]"};`;else if(a==="NCHW")E=`
            ${S.indicesSet("outputIndices","0","0")}
            let cOffset = ${S.indicesToOffset("outputIndices")};`;else{E=`var cIndices = ${g.type.indices}(0);
                       cIndices[0] = outputIndices[${s.length-1}];`;for(let k=1;k<g.rank;k++)E+=`cIndices[${k}] = outputIndices[${k}];`;E+=`let cOffset = ${g.indicesToOffset("cIndices")};`}return E},b=E=>`
  const epsilon = ${r};
  ${E.registerUniform("outputSize","u32").declareVariables(c,g,_,y,$,S)}
  ${E.mainStart()}
  ${E.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
    var outputIndices = ${S.offsetToIndices(`global_idx * ${n}`)};
    ${x()}
    let scale = ${g.getByOffset("cOffset")};
    let bias = ${_.getByOffset("cOffset")};
    let inputMean = ${y.getByOffset("cOffset")};
    let inputVar = ${$.getByOffset("cOffset")};
    let x = ${c.getByOffset("global_idx")};
    let value = (x - inputMean) * inverseSqrt(inputVar + epsilon) * scale + bias;
    ${S.setByOffset("global_idx","value")}
  }`;return{name:"BatchNormalization",shaderCache:{hint:`${t.epsilon}_${t.format}_${i}_${n}`,inputDependencies:p?["rank","type","type","type","type"]:void 0},getShaderSource:b,getRunData:()=>({outputs:[{dims:e[0].dims,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(l/64)},programUniforms:p?[{type:12,data:l},...Z(s)]:[{type:12,data:l}]})}},Vo=e=>he(e),Go=(e,t)=>{let{inputs:r,outputCount:i}=e,a=Vo({...t,outputCount:i});if(be.webgpu.validateInputContent&&Lo(r,a),t.trainingMode)throw new Error("BatchNormalization trainingMode is not supported yet.");e.compute(Wo(r,a))}}),Ho,Fo,jo,Om=P(()=>{"use strict";ie(),ae(),Ho=e=>{if(e[0].dims.length!==3)throw new Error("input should have 3 dimensions");if(![320,640,1280].includes(e[0].dims[2]))throw new Error("number of channels should be 320, 640 or 1280");if(e[1].dims.length!==1)throw new Error("bias is expected to have 1 dimensions");if(e[0].dims[2]!==e[1].dims[0])throw new Error("last dimension of input and bias are not the same")},Fo=e=>{let t=e[0].dims,r=e[0].dims[2],i=O.size(t)/4,a=e[0].dataType,s=B("input",a,t,4),n=B("bias",a,[r],4),u=B("residual",a,t,4),l=G("output",a,t,4);return{name:"BiasAdd",getRunData:()=>({outputs:[{dims:t,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(i/64)}}),getShaderSource:p=>`
  const channels = ${r}u / 4;
  ${p.declareVariables(s,n,u,l)}

  ${p.mainStart()}
    ${p.guardAgainstOutOfBoundsWorkgroupSizes(i)}
    let value = ${s.getByOffset("global_idx")}
      + ${n.getByOffset("global_idx % channels")} + ${u.getByOffset("global_idx")};
    ${l.setByOffset("global_idx","value")}
  }`}},jo=e=>{Ho(e.inputs),e.compute(Fo(e.inputs))}}),Ko,pe,Zo,Xo,Qo,Yo,Jo,eu,tu,ru,iu,au,nu,su,ou,uu,sr,lu,Nr,du,pu,cu,hu,fu,mu,gu,yu,_u,bu,wu,$u,vu,xu,Su,ku,Tu,Qi,Iu,Yi,Ji,Eu,zu,Cu,Au,Ou,Ru,ea=P(()=>{"use strict";ee(),ie(),Se(),ae(),Ko=(e,t,r,i,a,s,n)=>{let u=Math.ceil(t/4),l="";typeof a=="string"?l=`${a}(a)`:l=a("a");let p=B("inputData",r,[u],4),h=G("outputData",i,[u],4),c=[{name:"vec_size",type:"u32"}];return n&&c.push(...n),`
      ${e.registerUniforms(c).declareVariables(p,h)}

  ${s??""}

  ${e.mainStart()}
    ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}

    let a = ${p.getByOffset("global_idx")};
    ${h.setByOffset("global_idx",l)}
  }`},pe=(e,t,r,i,a,s=e.dataType,n,u)=>{let l=[{type:12,data:Math.ceil(O.size(e.dims)/4)}];return n&&l.push(...n),{name:t,shaderCache:{hint:a,inputDependencies:["type"]},getShaderSource:p=>Ko(p,O.size(e.dims),e.dataType,s,r,i,u),getRunData:p=>({outputs:[{dims:e.dims,dataType:s}],dispatchGroup:{x:Math.ceil(O.size(p[0].dims)/64/4)},programUniforms:l})}},Zo=e=>{e.compute(pe(e.inputs[0],"Abs","abs"))},Xo=e=>{e.compute(pe(e.inputs[0],"Acos","acos"))},Qo=e=>{e.compute(pe(e.inputs[0],"Acosh","acosh"))},Yo=e=>{e.compute(pe(e.inputs[0],"Asin","asin"))},Jo=e=>{e.compute(pe(e.inputs[0],"Asinh","asinh"))},eu=e=>{e.compute(pe(e.inputs[0],"Atan","atan"))},tu=e=>{e.compute(pe(e.inputs[0],"Atanh","atanh"))},ru=e=>he(e),iu=(e,t)=>{let r;switch(t.to){case 10:r="vec4<f16>";break;case 1:r="vec4<f32>";break;case 12:r="vec4<u32>";break;case 6:r="vec4<i32>";break;case 9:r="vec4<bool>";break;default:throw new RangeError(`not supported type (specified in attribute 'to' from 'Cast' operator): ${t.to}`)}e.compute(pe(e.inputs[0],"Cast",r,void 0,t.cacheKey,t.to))},au=e=>{let t,r,i=e.length>=2&&e[1].data!==0,a=e.length>=3&&e[2].data!==0;switch(e[0].dataType){case 1:t=i?e[1].getFloat32Array()[0]:-34028234663852886e22,r=a?e[2].getFloat32Array()[0]:34028234663852886e22;break;case 10:t=i?e[1].getUint16Array()[0]:64511,r=a?e[2].getUint16Array()[0]:31743;break;default:throw new Error("Unsupport data type")}return he({min:t,max:r})},nu=(e,t)=>{let r=t||au(e.inputs),i=ze(e.inputs[0].dataType);e.compute(pe(e.inputs[0],"Clip",a=>`clamp(${a}, vec4<${i}>(uniforms.min), vec4<${i}>(uniforms.max))`,void 0,r.cacheKey,void 0,[{type:e.inputs[0].dataType,data:r.min},{type:e.inputs[0].dataType,data:r.max}],[{name:"min",type:i},{name:"max",type:i}]),{inputs:[0]})},su=e=>{e.compute(pe(e.inputs[0],"Ceil","ceil"))},ou=e=>{e.compute(pe(e.inputs[0],"Cos","cos"))},uu=e=>{e.compute(pe(e.inputs[0],"Cosh","cosh"))},sr=e=>he(e),lu=(e,t)=>{let r=ze(e.inputs[0].dataType);e.compute(pe(e.inputs[0],"Elu",i=>`elu_vf32(${i})`,`
  const elu_alpha_ = ${r}(${t.alpha});

  fn elu_f32(a: ${r}) -> ${r} {
  return select((exp(a) - 1.0) * elu_alpha_, a, a >= 0.0);
  }

  fn elu_vf32(v: vec4<${r}>) -> vec4<${r}> {
  return vec4(elu_f32(v.x), elu_f32(v.y), elu_f32(v.z), elu_f32(v.w));
  }`,t.cacheKey))},Nr=(e="f32")=>`
const r0: ${e} = 0.3275911;
const r1: ${e} = 0.254829592;
const r2: ${e} = -0.284496736;
const r3: ${e} = 1.421413741;
const r4: ${e} = -1.453152027;
const r5: ${e} = 1.061405429;

fn erf_vf32(v: vec4<${e}>) -> vec4<${e}> {
  let absv = abs(v);
  let x = 1.0 / (1.0 + r0 * absv);
  return sign(v) * (1.0 - ((((r5 * x + r4) * x + r3) * x + r2) * x + r1) * x * exp(-absv * absv));
}`,du=e=>{let t=ze(e.inputs[0].dataType);e.compute(pe(e.inputs[0],"Erf",r=>`erf_vf32(${r})`,Nr(t)))},pu=e=>{e.compute(pe(e.inputs[0],"Exp","exp"))},cu=e=>{e.compute(pe(e.inputs[0],"Floor","floor"))},hu=e=>{let t=ze(e.inputs[0].dataType);e.compute(pe(e.inputs[0],"Gelu",r=>`0.5 * ${r} * (1.0 + erf_vf32(${r} * 0.7071067811865475))`,Nr(t)))},fu=(e,t)=>{let r=ze(e.inputs[0].dataType);e.compute(pe(e.inputs[0],"LeakyRelu",i=>`select(leaky_relu_alpha_ * ${i}, ${i}, ${i} >= vec4<${r}>(0.0))`,`const leaky_relu_alpha_ = ${r}(${t.alpha});`,t.cacheKey))},mu=e=>{e.compute(pe(e.inputs[0],"Not",t=>`!${t}`))},gu=e=>{e.compute(pe(e.inputs[0],"Neg",t=>`-${t}`))},yu=e=>{e.compute(pe(e.inputs[0],"Reciprocal",t=>`1.0/${t}`))},_u=e=>{let t=ze(e.inputs[0].dataType);e.compute(pe(e.inputs[0],"Relu",r=>`select(vec4<${t}>(0.0), ${r}, ${r} > vec4<${t}>(0.0))`))},bu=e=>{e.compute(pe(e.inputs[0],"Sigmoid",t=>`(1.0 / (1.0 + exp(-${t})))`))},wu=e=>he(e),$u=(e,t)=>{let r=ze(e.inputs[0].dataType);e.compute(pe(e.inputs[0],"HardSigmoid",i=>`max(vec4<${r}>(0.0), min(vec4<${r}>(1.0), ${t.alpha} * ${i} + vec4<${r}>(${t.beta})))`,void 0,t.cacheKey))},vu=e=>{let t=ze(e.inputs[0].dataType);e.compute(pe(e.inputs[0],"HardSwish",r=>`${r} * max(vec4<${t}>(0.0), min(vec4<${t}>(1.0), vec4<${t}>(${t}(1.0 / 6.0)) * ${r} + vec4<${t}>(0.5)))`))},xu=e=>{e.compute(pe(e.inputs[0],"Sin","sin"))},Su=e=>{e.compute(pe(e.inputs[0],"Sinh","sinh"))},ku=e=>{e.compute(pe(e.inputs[0],"Sqrt","sqrt"))},Tu=e=>{e.compute(pe(e.inputs[0],"Tan","tan"))},Qi=e=>`sign(${e}) * (1 - exp(-2 * abs(${e}))) / (1 + exp(-2 * abs(${e})))`,Iu=e=>{e.compute(pe(e.inputs[0],"Tanh",Qi))},Yi=(e="f32")=>`
const fast_gelu_a: ${e} = 0.5;
const fast_gelu_b: ${e} = 0.7978845608028654;
const fast_gelu_c: ${e} = 0.035677408136300125;

fn tanh_v(v: vec4<${e}>) -> vec4<${e}> {
  return ${Qi("v")};
}
`,Ji=e=>`(fast_gelu_a + fast_gelu_a * tanh_v(${e} * (fast_gelu_c * ${e} * ${e} + fast_gelu_b))) * ${e}`,Eu=e=>{let t=ze(e.inputs[0].dataType);e.compute(pe(e.inputs[0],"FastGelu",Ji,Yi(t),void 0,e.inputs[0].dataType))},zu=(e,t)=>{let r=ze(e.inputs[0].dataType);return e.compute(pe(e.inputs[0],"ThresholdedRelu",i=>`select(vec4<${r}>(0.0), ${i}, ${i} > thresholded_relu_alpha_)`,`const thresholded_relu_alpha_ = vec4<${r}>(${t.alpha});`,t.cacheKey)),0},Cu=e=>{e.compute(pe(e.inputs[0],"Log","log"))},Au=(e,t)=>`
const alpha = vec4<${e}>(${t});
const one = ${e}(1.0);
const zero = ${e}(0.0);

fn quick_gelu_impl(x: vec4<${e}>) -> vec4<${e}> {
  let v = x *alpha;
  var x1 : vec4<${e}>;
  for (var i = 0; i < 4; i = i + 1) {
    if (v[i] >= zero) {
      x1[i] = one / (one + exp(-v[i]));
    } else {
      x1[i] = one - one / (one + exp(v[i]));
    }
  }
  return x * x1;
}
`,Ou=e=>`quick_gelu_impl(${e})`,Ru=(e,t)=>{let r=ze(e.inputs[0].dataType);e.compute(pe(e.inputs[0],"QuickGelu",Ou,Au(r,t.alpha),t.cacheKey,e.inputs[0].dataType))}}),Bu,Nu,Mu,Rm=P(()=>{"use strict";ie(),ae(),ea(),Bu=e=>{if(e[0].dims.length!==3)throw new Error("input should have 3 dimensions");if(![2560,5120,10240].includes(e[0].dims[2]))throw new Error("hidden state should be 2560, 5120 or 10240");if(e[1].dims.length!==1)throw new Error("bias is expected to have 1 dimensions");if(e[0].dims[2]!==e[1].dims[0])throw new Error("last dimension of input and bias are not the same")},Nu=e=>{let t=e[0].dims.slice();t[2]=t[2]/2;let r=B("input",e[0].dataType,e[0].dims,4),i=B("bias",e[0].dataType,[e[0].dims[2]],4),a=G("output",e[0].dataType,t,4),s=O.size(t)/4,n=Ee(e[0].dataType);return{name:"BiasSplitGelu",getRunData:()=>({outputs:[{dims:t,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(s/64)}}),getShaderSource:u=>`
  const M_SQRT2 = sqrt(2.0);
  const halfChannels = ${e[0].dims[2]/4/2}u;

  ${u.declareVariables(r,i,a)}

  ${Nr(n)}

  ${u.mainStart()}
    ${u.guardAgainstOutOfBoundsWorkgroupSizes(s)}
    let biasIdx = global_idx % halfChannels;
    let batchIndex = global_idx / halfChannels;
    let inputOffset = biasIdx + batchIndex * halfChannels * 2;
    let valueLeft = input[inputOffset] + bias[biasIdx];
    let valueRight = input[inputOffset + halfChannels] + bias[biasIdx + halfChannels];
    let geluRight = valueRight * 0.5 * (erf_vf32(valueRight / M_SQRT2) + 1);

    ${a.setByOffset("global_idx","valueLeft * geluRight")}
  }`}},Mu=e=>{Bu(e.inputs),e.compute(Nu(e.inputs))}}),Du,Uu,Ze,Pu,qu,Lu,Wu,Vu,Gu,Hu,Fu,ju,Ku,Bm=P(()=>{"use strict";ee(),ie(),ae(),Du=(e,t,r,i,a,s,n,u,l,p,h,c)=>{let g,_;typeof u=="string"?g=_=(b,E)=>`${u}((${b}),(${E}))`:typeof u=="function"?g=_=u:(g=u.scalar,_=u.vector);let y=G("outputData",h,i.length,4),$=B("aData",l,t.length,4),S=B("bData",p,r.length,4),x;if(a)if(s){let b=O.size(t)===1,E=O.size(r)===1,k=t.length>0&&t[t.length-1]%4===0,I=r.length>0&&r[r.length-1]%4===0;b||E?x=y.setByOffset("global_idx",_(b?`${$.type.value}(${$.getByOffset("0")}.x)`:$.getByOffset("global_idx"),E?`${S.type.value}(${S.getByOffset("0")}.x)`:S.getByOffset("global_idx"))):x=`
            let outputIndices = ${y.offsetToIndices("global_idx * 4u")};
            let offsetA = ${$.broadcastedIndicesToOffset("outputIndices",y)};
            let offsetB = ${S.broadcastedIndicesToOffset("outputIndices",y)};
            ${y.setByOffset("global_idx",_(n||k?$.getByOffset("offsetA / 4u"):`${$.type.value}(${$.getByOffset("offsetA / 4u")}[offsetA % 4u])`,n||I?S.getByOffset("offsetB / 4u"):`${S.type.value}(${S.getByOffset("offsetB / 4u")}[offsetB % 4u])`))}
          `}else x=y.setByOffset("global_idx",_($.getByOffset("global_idx"),S.getByOffset("global_idx")));else{if(!s)throw new Error("no necessary to use scalar implementation for element-wise binary op implementation.");let b=(E,k,I="")=>{let z=`aData[indexA${k}][componentA${k}]`,A=`bData[indexB${k}][componentB${k}]`;return`
            let outputIndices${k} = ${y.offsetToIndices(`global_idx * 4u + ${k}u`)};
            let offsetA${k} = ${$.broadcastedIndicesToOffset(`outputIndices${k}`,y)};
            let offsetB${k} = ${S.broadcastedIndicesToOffset(`outputIndices${k}`,y)};
            let indexA${k} = offsetA${k} / 4u;
            let indexB${k} = offsetB${k} / 4u;
            let componentA${k} = offsetA${k} % 4u;
            let componentB${k} = offsetB${k} % 4u;
            ${E}[${k}] = ${I}(${g(z,A)});
          `};h===9?x=`
            var data = vec4<u32>(0);
            ${b("data",0,"u32")}
            ${b("data",1,"u32")}
            ${b("data",2,"u32")}
            ${b("data",3,"u32")}
            outputData[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:x=`
            ${b("outputData[global_idx]",0)}
            ${b("outputData[global_idx]",1)}
            ${b("outputData[global_idx]",2)}
            ${b("outputData[global_idx]",3)}
          `}return`
        ${e.registerUniform("vec_size","u32").declareVariables($,S,y)}

        ${c??""}

        ${e.mainStart()}
        ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${x}
      }`},Uu=(e,t,r,i,a,s,n=r.dataType)=>{let u=r.dims.map(Number),l=i.dims.map(Number),p=!O.areEqual(u,l),h=u,c=O.size(u),g=!1,_=!1,y=[p];if(p){let $=Ht.calcShape(u,l,!1);if(!$)throw new Error("Can't perform binary op on the given tensors");h=$.slice(),c=O.size(h);let S=O.size(u)===1,x=O.size(l)===1,b=u.length>0&&u[u.length-1]%4===0,E=l.length>0&&l[l.length-1]%4===0;y.push(S),y.push(x),y.push(b),y.push(E);let k=1;for(let I=1;I<h.length;I++){let z=u[u.length-I],A=l[l.length-I];if(z===A)k*=z;else break}k%4===0?(_=!0,g=!0):(S||x||b||E)&&(g=!0)}else g=!0;return y.push(g),{name:e,shaderCache:{hint:t+y.map($=>$.toString()).join("_"),inputDependencies:["rank","rank"]},getShaderSource:$=>Du($,u,l,h,g,p,_,a,r.dataType,i.dataType,n,s),getRunData:()=>({outputs:[{dims:h,dataType:n}],dispatchGroup:{x:Math.ceil(c/64/4)},programUniforms:[{type:12,data:Math.ceil(O.size(h)/4)},...Z(u,l,h)]})}},Ze=(e,t,r,i,a,s)=>{e.compute(Uu(t,a??"",e.inputs[0],e.inputs[1],r,i,s))},Pu=e=>{Ze(e,"Add",(t,r)=>`${t}+${r}`)},qu=e=>{Ze(e,"Div",(t,r)=>`${t}/${r}`)},Lu=e=>{Ze(e,"Equal",{scalar:(t,r)=>`u32(${t}==${r})`,vector:(t,r)=>`vec4<u32>(${t}==${r})`},void 0,void 0,9)},Wu=e=>{Ze(e,"Mul",(t,r)=>`${t}*${r}`)},Vu=e=>{let t=B("input",e.inputs[0].dataType,e.inputs[0].dims).type.value;Ze(e,"Pow",{scalar:(r,i)=>`pow_custom(${r},${i})`,vector:(r,i)=>`pow_vector_custom(${r},${i})`},`
    fn pow_custom(a : ${t}, b : ${t}) -> ${t} {
      if (b == ${t}(0.0)) {
        return ${t}(1.0);
      } else if (a < ${t}(0.0) && f32(b) != floor(f32(b))) {
        return ${t}(pow(f32(a), f32(b))); // NaN
      }
      return select(sign(a), ${t}(1.0), round(f32(abs(b) % ${t}(2.0))) != 1.0) * ${t}(${t==="i32"?"round":""}(pow(f32(abs(a)), f32(b))));
    }
    fn pow_vector_custom(a : vec4<${t}>, b : vec4<${t}>) -> vec4<${t}> {
      // TODO: implement vectorized pow
      return vec4<${t}>(pow_custom(a.x, b.x), pow_custom(a.y, b.y), pow_custom(a.z, b.z), pow_custom(a.w, b.w));
    }
      `)},Gu=e=>{Ze(e,"Sub",(t,r)=>`${t}-${r}`)},Hu=e=>{Ze(e,"Greater",{scalar:(t,r)=>`u32(${t}>${r})`,vector:(t,r)=>`vec4<u32>(${t}>${r})`},void 0,void 0,9)},Fu=e=>{Ze(e,"Less",{scalar:(t,r)=>`u32(${t}<${r})`,vector:(t,r)=>`vec4<u32>(${t}<${r})`},void 0,void 0,9)},ju=e=>{Ze(e,"GreaterOrEqual",{scalar:(t,r)=>`u32(${t}>=${r})`,vector:(t,r)=>`vec4<u32>(${t}>=${r})`},void 0,void 0,9)},Ku=e=>{Ze(e,"LessOrEqual",{scalar:(t,r)=>`u32(${t}<=${r})`,vector:(t,r)=>`vec4<u32>(${t}<=${r})`},void 0,void 0,9)}}),Zu,Xu,Qu,Yu,Ju,el,Nm=P(()=>{"use strict";ee(),ie(),Se(),ae(),Zu=(e,t)=>{if(!e||e.length<1)throw new Error("too few inputs");let r=0,i=e[r],a=i.dataType,s=i.dims.length;e.forEach((n,u)=>{if(u!==r){if(n.dataType!==a)throw new Error("input tensors should be one type");if(n.dims.length!==s)throw new Error("input tensors should have the same shape");n.dims.forEach((l,p)=>{if(p!==t&&l!==i.dims[p])throw new Error("non concat dimensions must match")})}})},Xu=(e,t)=>`
  fn calculateInputIndex(index: u32) -> u32 {
    let sizeInConcatAxis = array<u32, ${e}u>(${t});
    for (var i: u32 = 0u; i < ${e}; i += 1u ) {
      if (index < sizeInConcatAxis[i]) {
        return i;
      }
    }
    return ${e}u;
  }`,Qu=(e,t)=>{let r=e.length,i=[];for(let a=0;a<r;++a){let s=t.setByOffset("global_idx",e[a].getByIndices("indices"));r===1?i.push(s):a===0?i.push(`if (inputIndex == ${a}u) { ${s} }`):a===r-1?i.push(`else { ${s} }`):i.push(`else if (inputIndex == ${a}) { ${s} }`)}return i.join(`
`)},Yu=(e,t,r,i)=>{let a=O.size(r),s=new Array(e.length),n=new Array(e.length),u=0,l=[],p=[],h=[{type:12,data:a}];for(let $=0;$<e.length;++$)u+=e[$].dims[t],s[$]=u,p.push(e[$].dims.length),n[$]=B(`input${$}`,i,p[$]),l.push("rank"),h.push({type:12,data:s[$]});for(let $=0;$<e.length;++$)h.push(...Z(e[$].dims));h.push(...Z(r));let c=G("output",i,r.length),g=c.indicesGet("indices",t),_=Array.from(Array(s.length).keys()).map($=>`uniforms.sizeInConcatAxis${$}`).join(","),y=$=>`

  ${(()=>{$.registerUniform("outputSize","u32");for(let S=0;S<e.length;S++)$.registerUniform(`sizeInConcatAxis${S}`,"u32");return $.declareVariables(...n,c)})()}

  ${Xu(s.length,_)}

  ${$.mainStart()}
    ${$.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

    var indices = ${c.offsetToIndices("global_idx")};

    let inputIndex = calculateInputIndex(${g});
    if (inputIndex != 0u) {
      let sizeInConcatAxis = array<u32, ${s.length}u>(${_});
      ${g} -= sizeInConcatAxis[inputIndex - 1u];
    }

    ${Qu(n,c)}
  }`;return{name:"Concat",shaderCache:{hint:`${t}`,inputDependencies:l},getRunData:()=>({outputs:[{dims:r,dataType:i}],dispatchGroup:{x:Math.ceil(a/64)},programUniforms:h}),getShaderSource:y}},Ju=(e,t)=>{let r=e.inputs,i=r[0].dims,a=O.normalizeAxis(t.axis,i.length);Zu(r,a);let s=i.slice();s[a]=r.reduce((u,l)=>u+(l.dims.length>a?l.dims[a]:0),0);let n=r.filter(u=>O.size(u.dims)>0);e.compute(Yu(n,a,s,r[0].dataType),{inputs:n})},el=e=>he({axis:e.axis})}),Ct,At,Ot,ta,Rt=P(()=>{"use strict";ee(),ie(),Ct=(e,t,r="f32")=>{switch(e.activation){case"Relu":return`value = max(value, ${t}(0.0));`;case"Sigmoid":return`value = (${t}(1.0) / (${t}(1.0) + exp(-value)));`;case"Clip":return`value = clamp(value, ${t}(${r}(uniforms.clip_min)), ${t}(${r}(uniforms.clip_max)));`;case"HardSigmoid":return`value = max(${t}(0.0), min(${t}(1.0), ${r}(uniforms.alpha) * value + ${r}(uniforms.beta)));`;case"LeakyRelu":return`value = select(${r}(uniforms.alpha) * value, value, value >= ${t}(0.0));`;case"Tanh":return`let e2x = exp(-2.0 * abs(value));
              value = sign(value) * (1.0 - e2x) / (1.0 + e2x);
        `;case"":return"";default:throw new Error(`Unsupported activation ${e.activation}`)}},At=(e,t)=>{e.activation==="Clip"?t.push({type:1,data:e.clipMax},{type:1,data:e.clipMin}):e.activation==="HardSigmoid"?t.push({type:1,data:e.alpha},{type:1,data:e.beta}):e.activation==="LeakyRelu"&&t.push({type:1,data:e.alpha})},Ot=(e,t)=>{e.activation==="Clip"?t.push({name:"clip_max",type:"f32"},{name:"clip_min",type:"f32"}):e.activation==="HardSigmoid"?t.push({name:"alpha",type:"f32"},{name:"beta",type:"f32"}):e.activation==="LeakyRelu"&&t.push({name:"alpha",type:"f32"})},ta=e=>{let t=e?.activation||"";if(t==="HardSigmoid"){let[r,i]=e?.activation_params||[.2,.5];return{activation:t,alpha:r,beta:i}}else if(t==="Clip"){let[r,i]=e?.activation_params||[ws,$s];return{activation:t,clipMax:i,clipMin:r}}else if(t==="LeakyRelu"){let[r]=e?.activation_params||[.01];return{activation:t,alpha:r}}return{activation:t}}}),Ae,tl,ra=P(()=>{"use strict";Ae=(e,t)=>{switch(e){case 1:return t;case 2:return`vec2<${t}>`;case 3:return`vec3<${t}>`;case 4:return`vec4<${t}>`;default:throw new Error(`${e}-component is not supported.`)}},tl=e=>`
      ${e?"value = value + getBiasByOutputCoords(coords);":""}
      `}),rl,Mm=P(()=>{"use strict";rl=e=>`
fn getIndexFromCoords4D(coords : vec4<i32>, shape : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
      shape.y * shape.z * shape.w, shape.z * shape.w, shape.w, 1));
}
fn getOutputIndexFromCoords(coords : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
    i32(${e}.x), i32(${e}.y), i32(${e}.z), 1));
}
`}),or,ia,aa=P(()=>{"use strict";ee(),ie(),ae(),Rt(),or=(e,t,r,i,a)=>{let s=i-r;return`
      ${Array.from({length:r}).map((n,u)=>`
      if (${j(t.shape,u,t.rank)} != 1) {
        ${t.indicesSet(e,u,j(a,u+s,i))}
      } else {
        ${t.indicesSet(e,u,0)}
      }`).join("")}
`},ia=(e,t,r,i,a=!1,s)=>{let n=e[0].dims,u=e[1].dims,l=n[n.length-2],p=u[u.length-1],h=n[n.length-1],c=ke(p),g=ke(h),_=ke(l),y=O.size(r)/c/_,$=e.length>2,S=i?i.slice(0,-2):r.slice(0,-2),x=[O.size(S),l,p],b=[{type:12,data:y},{type:12,data:l},{type:12,data:p},{type:12,data:h}];At(t,b),b.push(...Z(S,n,u)),$&&b.push(...Z(e[2].dims)),b.push(...Z(x));let E=k=>{let I=Gi("batch_dims",e[0].dataType,S.length),z=B("a",e[0].dataType,n.length,g),A=B("b",e[1].dataType,u.length,c),v=G("output",e[0].dataType,x.length,c),D=Ee(v.type.tensor),q=Ct(t,v.type.value,D),Q=[z,A],F="";if($){let M=a?c:1;Q.push(B("bias",e[2].dataType,e[2].dims.length,M)),F=`${a?`value += bias[col / ${M}];`:`value += ${v.type.value}(bias[row + i]);`}`}let K=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"}];Ot(t,K);let R=()=>{let M=`var a_data: ${z.type.value};`;for(let H=0;H<g;H++)M+=`
              let b_data${H} = b[(b_offset + (k + ${H}) * uniforms.N + col) / ${c}];`;for(let H=0;H<_;H++){M+=`a_data = a[(a_offset + (row + ${H}) * uniforms.K + k) / ${g}];`;for(let J=0;J<g;J++)M+=`
            values[${H}] = fma(${A.type.value}(a_data${g===1?"":`[${J}]`}), b_data${J}, values[${H}]);
`}return M};return`
  ${k.registerUniforms(K).registerInternalVariables(I).declareVariables(...Q,v)}
  ${k.mainStart()}
    ${k.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let col = (global_idx % (uniforms.N / ${c})) * ${c};
    var index1 = global_idx / (uniforms.N / ${c});
    let stride1 = uniforms.M / ${_};
    let row = (index1 % stride1) * ${_};
    let batch = index1 / stride1;

    ${r.length===2?"":`let batch_indices = ${I.offsetToIndices("batch")};`}

    var a_indices: ${z.type.indices};
    ${or("a_indices",z,z.rank-2,I.rank,"batch_indices")}
    ${z.indicesSet("a_indices",z.rank-2,0)}
    ${z.indicesSet("a_indices",z.rank-1,0)}
    let a_offset = ${z.indicesToOffset("a_indices")};

    var b_indices: ${A.type.indices};
    ${or("b_indices",A,A.rank-2,I.rank,"batch_indices")}
    ${A.indicesSet("b_indices",A.rank-2,0)}
    ${A.indicesSet("b_indices",A.rank-1,0)}
    let b_offset = ${A.indicesToOffset("b_indices")};
    var values: array<${v.type.value}, ${_}>;
    for (var k: u32 = 0u; k < uniforms.K; k = k + ${g}) {
      ${R()}
    }
    for (var i = 0u; i < ${_}u; i++) {
      var value = values[i];
      ${F}
      ${q}
      let cur_indices = ${v.type.indices}(batch, row + i, col);
      let offset = ${v.indicesToOffset("cur_indices")};
      ${v.setByOffset(`offset / ${c}`,"value")};
    }
  }
  `};return{name:"MatMulNaive",shaderCache:{hint:`${t.activation};${c};${g};${_};${a}`,inputDependencies:$?["rank","rank","rank"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:s?s(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(y/64)},programUniforms:b}),getShaderSource:E}}}),il,al,na,sa,nl,oa,sl,Mr,ua=P(()=>{"use strict";ee(),ie(),ae(),Rt(),aa(),ra(),il=(e,t)=>e?`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          kStart + inputRow,
          globalRowStart / innerElementSize + inputCol${t?", batchIndices":""});
        `:`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          globalRow + innerRow,
          kStart / innerElementSize + inputCol${t?", batchIndices":""});
        `,al=(e,t)=>e?`
        let ACached0 = mm_Asub[k * innerElementSize][localRow];
        let ACached1 = mm_Asub[k * innerElementSize + 1][localRow];
        let ACached2 = mm_Asub[k * innerElementSize + 2][localRow];
        ${t===3?"":"let ACached3 = mm_Asub[k * innerElementSize + 3][localRow];"}
        for (var i = 0; i < rowPerThread; i = i + 1) {
          acc[i] = BCached0 * ACached0[i] + acc[i];
          acc[i] = BCached1 * ACached1[i] + acc[i];
          acc[i] = BCached2 * ACached2[i] + acc[i];
          ${t===3?"":"acc[i] = BCached3 * ACached3[i] + acc[i];"}
        }`:`
        for (var i = 0; i < rowPerThread; i = i + 1) {
          let ACached = mm_Asub[tileRow + i][k];
          acc[i] = BCached0 * ACached.x + acc[i];
          acc[i] = BCached1 * ACached.y + acc[i];
          acc[i] = BCached2 * ACached.z + acc[i];
          ${t===3?"":"acc[i] = BCached3 * ACached.w + acc[i];"}
        }`,na=(e,t,r="f32",i,a=!1,s=32,n=!1,u=32)=>{let l=t[1]*e[1],p=t[0]*e[0],h=a?l:s,c=a?s:l,g=h/t[0],_=s/t[1];if(!((a&&g===4&&e[1]===4||!a&&(g===3||g===4))&&h%t[0]===0&&s%t[1]===0&&e[0]===4))throw new Error(`If transposeA ${a} is true, innerElementSize ${g} and workPerThread[1] ${e[1]} must be 4.
      Otherwise, innerElementSize ${g} must be 3 or 4.
  tileAWidth ${h} must be divisible by workgroupSize[0]${t[0]}. tileInner ${s} must be divisible by workgroupSize[1] ${t[1]}. colPerThread ${e[0]} must be 4.`);return`
var<workgroup> mm_Asub: array<array<vec${g}<${r}>, ${h/g}>, ${c}>;
var<workgroup> mm_Bsub: array<array<vec4<${r}>, ${p/e[0]}>, ${s}>;

const rowPerThread = ${e[1]};
const colPerThread = ${e[0]};
const innerElementSize = ${g};
const tileInner = ${s};

@compute @workgroup_size(${t[0]}, ${t[1]}, ${t[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
  let localRow = i32(localId.y);
  let tileRow = localRow * rowPerThread;
  let tileCol = i32(localId.x);

  let globalRow =i32(globalId.y) * rowPerThread;
  let globalCol = i32(globalId.x);
  let batch = ${n?"0":"i32(globalId.z)"};
  ${i?`let batchIndices = ${i.offsetToIndices("u32(batch)")};`:""}
  let globalRowStart = i32(workgroupId.y) * ${l};

  let num_tiles = ${n?`${Math.ceil(u/s)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
  var kStart = ${n?`i32(globalId.z) * ${u}`:"0"};

  var acc: array<vec4<${r}>, rowPerThread>;

  // Loop over shared dimension.
  let tileRowB = localRow * ${_};
  for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let inputRow = tileRow + innerRow;
          let inputCol = tileCol;
          ${il(a,i)}
      }

      // Load one tile of B into local memory.
      for (var innerRow = 0; innerRow < ${_}; innerRow = innerRow + 1) {
          let inputRow = tileRowB + innerRow;
          let inputCol = tileCol;
          mm_Bsub[inputRow][inputCol] = mm_readB(batch, kStart + inputRow, globalCol${i?", batchIndices":""});
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      for (var k = 0; k < tileInner / innerElementSize; k = k + 1) {
          let BCached0 = mm_Bsub[k * innerElementSize][tileCol];
          let BCached1 = mm_Bsub[k * innerElementSize + 1][tileCol];
          let BCached2 = mm_Bsub[k * innerElementSize + 2][tileCol];
          ${g===3?"":"let BCached3 = mm_Bsub[k * innerElementSize + 3][tileCol];"}

          ${al(a,g)}
      }

      workgroupBarrier();
  }

  for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      mm_write(batch, globalRow + innerRow, globalCol, acc[innerRow]);
  }
}`},sa=(e,t)=>e?`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              kStart + inputRow,
              globalRowStart + inputCol${t?", batchIndices":""});
            `:`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              globalRowStart + inputRow,
              kStart + inputCol${t?", batchIndices":""});
            `,nl=e=>e?"let ACached = mm_Asub[k][tileRow + innerRow];":"let ACached = mm_Asub[tileRow + innerRow][k];",oa=(e,t,r="f32",i,a=!1,s=32,n=!1,u=32,l=!1)=>{let p=e[1]*t[1],h=e[0]*t[0],c=a?p:s,g=a?s:p;if(!(g%t[1]===0&&c%t[0]===0&&s%t[1]===0))throw new Error(`tileAHight ${g} must be divisible by workgroupSize[1]${t[1]}, tileAWidth ${c} must be divisible by workgroupSize[0]${t[0]}, tileInner ${s} must be divisible by workgroupSize[1]${t[1]}`);let _=g/t[1],y=c/t[0],$=s/t[1],S=l?`
    let localRow = i32(localId.y);
    let localCol = i32(localId.x);
    let globalRowStart = i32(workgroupId.y) * ${p};
    let globalColStart = i32(workgroupId.x) * ${h};

    // Loop over shared dimension.
    for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var inputRow = localRow; inputRow < ${g}; inputRow = inputRow + ${t[1]}) {
        for (var inputCol = localCol; inputCol < ${c}; inputCol = inputCol + ${t[0]}) {
          ${sa(a,i)}
        }
      }
      // Load one tile of B into local memory.
      for (var inputRow = localRow; inputRow < ${s}; inputRow = inputRow + ${t[1]}) {
            for (var inputCol = localCol; inputCol < ${h}; inputCol = inputCol + ${t[0]}) {
          mm_Bsub[inputRow][inputCol] = mm_readB(batch,
            kStart + inputRow,
            globalColStart + inputCol${i?", batchIndices":""});
        }
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      var BCached : array<${r}, colPerThread>;
      for (var k = 0; k < tileInner; k = k + 1) {
        for (var inner = 0; inner < colPerThread; inner = inner + 1) {
          BCached[inner] = mm_Bsub[k][localCol + inner * ${t[0]}];
        }
        for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let ACached = ${a?`mm_Asub[k][localRow + innerRow * ${t[1]}];`:`mm_Asub[localRow + innerRow * ${t[1]}][k];`}
          for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
            acc[innerRow][innerCol] = acc[innerRow][innerCol] +
                ACached * BCached[innerCol];
          }
        }
      }
      workgroupBarrier();
    }
    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      let gRow = globalRowStart + localRow + innerRow * ${t[1]};
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        let gCol = globalColStart + localCol + innerCol * ${t[0]};
        mm_write(batch, gRow, gCol, acc[innerRow][innerCol]);
      }
    }
    `:`
let tileRow = i32(localId.y) * rowPerThread;
let tileCol = i32(localId.x) * colPerThread;

let globalRow = i32(globalId.y) * rowPerThread;
let globalCol = i32(globalId.x) * colPerThread;
let globalRowStart = i32(workgroupId.y) * ${p};

let tileRowA = i32(localId.y) * ${_};
let tileColA = i32(localId.x) * ${y};
let tileRowB = i32(localId.y) * ${$};
// Loop over shared dimension.
for (var t = 0; t < num_tiles; t = t + 1) {
  // Load one tile of A into local memory.
  for (var innerRow = 0; innerRow < ${_}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < ${y}; innerCol = innerCol + 1) {
      let inputRow = tileRowA + innerRow;
      let inputCol = tileColA + innerCol;
      ${sa(a,i)}
    }
  }

  // Load one tile of B into local memory.
  for (var innerRow = 0; innerRow < ${$}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
      let inputRow = tileRowB + innerRow;
      let inputCol = tileCol + innerCol;
      mm_Bsub[inputRow][inputCol] = mm_readB(batch,
        kStart + inputRow,
        globalCol + innerCol${i?", batchIndices":""});
    }
  }
  kStart = kStart + tileInner;
  workgroupBarrier();

  // Compute acc values for a single thread.
  var BCached : array<${r}, colPerThread>;
  for (var k = 0; k < tileInner; k = k + 1) {
    for (var inner = 0; inner < colPerThread; inner = inner + 1) {
      BCached[inner] = mm_Bsub[k][tileCol + inner];
    }

    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      ${nl(a)}
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        acc[innerRow][innerCol] = acc[innerRow][innerCol] + ACached * BCached[innerCol];
      }
    }
  }

  workgroupBarrier();
}

for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
  for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
    mm_write(batch, globalRow + innerRow, globalCol + innerCol,
        acc[innerRow][innerCol]);
  }
}
`;return`
  var<workgroup> mm_Asub : array<array<${r}, ${c}>, ${g}>;
  var<workgroup> mm_Bsub : array<array<${r}, ${h}>, ${s}>;
  const rowPerThread = ${e[1]};
  const colPerThread = ${e[0]};
  const tileInner = ${s};

@compute @workgroup_size(${t[0]}, ${t[1]}, ${t[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
    let batch = ${n?"0":"i32(globalId.z)"};
    ${i?`let batchIndices = ${i.offsetToIndices("u32(batch)")};`:""}
    let num_tiles = ${n?`${Math.ceil(u/s)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
    var kStart = ${n?`i32(globalId.z) * ${u}`:"0"};

    var acc : array<array<${r}, colPerThread>, rowPerThread>;
    ${S}
  }
`},sl=(e,t,r,i,a=!1)=>{let[s,n,u,l]=i,p=Ee(i[0].type.tensor);return`
    fn mm_readA(batch: i32, row: i32, colIn: i32, batchIndices: ${s.type.indices}) -> ${Ae(e,p)} {
      var value = ${Ae(e,p)}(0.0);
      let col = colIn * ${e};
      if(row < uniforms.dim_a_outer && col < uniforms.dim_inner)
      {
        var aIndices: ${n.type.indices};
        ${or("aIndices",n,n.rank-2,s.rank,"batchIndices")}
        ${n.indicesSet("aIndices",n.rank-2,"u32(row)")}
        ${n.indicesSet("aIndices",n.rank-1,"u32(colIn)")}
        value = ${n.getByIndices("aIndices")};
      }
      return value;
    }

    fn mm_readB(batch: i32, row: i32, colIn: i32, batchIndices: ${s.type.indices}) -> ${Ae(e,p)} {
      var value = ${Ae(e,p)}(0.0);
      let col = colIn * ${e};
      if(row < uniforms.dim_inner && col < uniforms.dim_b_outer)
      {
        var bIndices: ${u.type.indices};
        ${or("bIndices",u,u.rank-2,s.rank,"batchIndices")}
        ${u.indicesSet("bIndices",u.rank-2,"u32(row)")}
        ${u.indicesSet("bIndices",u.rank-1,"u32(colIn)")}
        value = ${u.getByIndices("bIndices")};
      }
      return value;
    }

    fn mm_write(batch: i32, row: i32, colIn: i32, valueIn: ${Ae(e,p)}) {
      let col = colIn * ${e};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer) {
        var value = valueIn;
        let coords = vec3<i32>(batch, row, colIn);
        ${t?`value = value + ${a?"bias[colIn]":`${Ae(e,p)}(bias[row])`};`:""}
        ${r}
        ${l.setByIndices("vec3<u32>(coords)","value")}
      }
    }
    `},Mr=(e,t,r,i,a=!1,s)=>{let n=e[0].dims,u=e[1].dims,l=n.slice(0,-2),p=u.slice(0,-2),h=i?i.slice(0,-2):r.slice(0,-2),c=O.size(h),g=n[n.length-2],_=n[n.length-1],y=u[u.length-1],$=_%4===0&&y%4===0,S=g<=8?[4,1,1]:[4,4,1],x=[8,8,1],b=[Math.ceil(y/x[0]/S[0]),Math.ceil(g/x[1]/S[1]),Math.ceil(c/x[2]/S[2])],E=$?4:1,k=[...l,g,_/E],I=k.length,z=[...p,_,y/E],A=z.length,v=[c,g,y/E],D=[{type:6,data:g},{type:6,data:y},{type:6,data:_}];At(t,D),D.push(...Z(h,k,z));let q=["rank","rank"],Q=e.length>2;Q&&(D.push(...Z(e[2].dims)),q.push("rank")),D.push(...Z(v));let F=K=>{let R=h.length,M=Gi("batchDims",e[0].dataType,R,1),H=Ee(e[0].dataType),J=B("a",e[0].dataType,I,E),te=B("b",e[1].dataType,A,E),re=G("result",e[0].dataType,v.length,E),ne=[J,te];if(Q){let Ie=a?E:1;ne.push(B("bias",e[2].dataType,e[2].dims.length,Ie))}let U=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"}];Ot(t,U);let Y=Ee(re.type.tensor),X=Ct(t,re.type.value,Y),V=sl(E,Q,X,[M,J,te,re],a);return`
  ${K.registerUniforms(U).registerInternalVariables(M).declareVariables(...ne,re)}
  ${V}
  ${$?na(S,x,H,M):oa(S,x,H,M)}
                   `};return{name:"MatMul",shaderCache:{hint:`${S};${t.activation};${$};${a}`,inputDependencies:q},getRunData:()=>({outputs:[{dims:s?s(r):r,dataType:e[0].dataType}],dispatchGroup:{x:b[0],y:b[1],z:b[2]},programUniforms:D}),getShaderSource:F}}}),ol,ul,Dm=P(()=>{"use strict";ee(),at(),ae(),Rt(),ra(),Mm(),ua(),ol=(e,t,r,i,a=!1,s,n=4,u=4,l=4,p="f32")=>{let h=D=>{switch(D){case 1:return"resData = x[xIndex];";case 3:return`resData = vec3<${p}>(x[xIndex], x[xIndex + 1], x[xIndex + 2]);`;case 4:return"resData = x[xIndex / 4];";default:throw new Error(`innerElementSize ${D} is not supported.`)}},c=D=>{switch(D){case 1:return"return w[row * i32(uniforms.w_shape[3]) + colIn];";case 4:return"return w[row * i32(uniforms.w_shape[3]) / 4 + colIn];";default:throw new Error(`innerElementSize ${D} is not supported.`)}},g=e?`
    let coord = vec4<i32>(batch, xRow, xCol, xCh);
    `:`
    let coord = vec4<i32>(batch, xCh, xRow, xCol);
    `,_=e?`
    let coords = vec4<i32>(
      batch,
      row / outWidth,
      row % outWidth,
      col);
    `:`
    let coords = vec4<i32>(
      batch,
      row,
      col / outWidth,
      col % outWidth);
    `,y=e?"i32(uniforms.x_shape[1])":"i32(uniforms.x_shape[2])",$=e?"i32(uniforms.x_shape[2])":"i32(uniforms.x_shape[3])",S=e?"row":"col",x=e?"col":"row",b=`
    let inChannels = i32(uniforms.w_shape[2]);
    let outWidth = ${e?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
    let outRow = ${S} / outWidth;
    let outCol = ${S} % outWidth;

    let WRow = ${x} / (i32(uniforms.w_shape[1]) * inChannels);
    let WCol = ${x} / inChannels % i32(uniforms.w_shape[1]);
    let xRow = outRow * uniforms.stride[0] + uniforms.dilation[0] * WRow - uniforms.pad[0];
    let xCol = outCol * uniforms.stride[1] + uniforms.dilation[1] * WCol - uniforms.pad[1];
    let xCh = ${x} % inChannels;
    var resData = ${Ae(n,p)}(0.0);
    // The bounds checking is always needed since we use it to pad zero for
    // the 'same' padding type.
    if (xRow >= 0 && xRow < ${y} && xCol >= 0 && xCol < ${$}) {
      ${g}
      let xIndex = getIndexFromCoords4D(coord, vec4<i32>(uniforms.x_shape));
      ${h(n)}
    }
    return resData;`,E=e?t&&i?`
    let col = colIn * ${n};
    ${b}`:`
    let col = colIn * ${n};
    if (row < uniforms.dim_a_outer && col < uniforms.dim_inner) {
      ${b}
    }
    return ${Ae(n,p)}(0.0);`:i&&r?`
    let col = colIn * ${n};
    ${b}`:`
    let col = colIn * ${n};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${b}
    }
    return ${Ae(n,p)}(0.0);`,k=e?i&&r?c(u):`
    let col = colIn * ${u};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${c(u)}
    }
    return ${Ae(u,p)}(0.0);`:`
    let col = colIn * ${u};
    if (row < uniforms.dim_inner && col < uniforms.dim_a_outer) {
      ${c(u)}
    }
    return ${Ae(u,p)}(0.0);`,I=Ae(l,p),z=Ae(e?n:u,p),A=Ae(e?u:n,p),v=Ct(s,I,p);return`
    fn mm_readA(batch: i32, row : i32, colIn : i32) -> ${z} {
      ${e?E:k}
    }

    fn mm_readB(batch: i32, row : i32, colIn : i32) -> ${A} {
      ${e?k:E}
    }

    fn mm_write(batch: i32, row : i32, colIn : i32, valueIn : ${I}) {
      let col = colIn * ${l};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer)
      {
      var value = valueIn;
      let outWidth = ${e?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
      ${_}
      ${tl(a)}
      ${v}
      setOutputAtCoords(coords[0], coords[1], coords[2], coords[3], value);
      }
    }`},ul=(e,t,r,i,a,s,n,u,l)=>{let p=t.format==="NHWC",h=p?e[0].dims[3]:e[0].dims[1],c=r[0],g=p?r[2]:r[3],_=p?r[1]:r[2],y=p?r[3]:r[1],$=p&&(h%4===0||h%3===0)&&y%4===0,S=p?y:g*_,x=p?g*_:y,b=[8,8,1],E=i<=8?[4,1,1]:[4,4,1],k=[Math.ceil(S/b[0]/E[0]),Math.ceil(x/b[1]/E[1]),Math.ceil(c/b[2]/E[2])];de("verbose",()=>`[conv2d_mm_webgpu] dispatch = ${k}`);let I=$?p&&h%4!==0?3:4:1,z=b[1]*E[1],A=b[0]*E[0],v=Math.max(b[0]*I,b[1]),D=i%z===0,q=a%A===0,Q=s%v===0,F=$?[I,4,4]:[1,1,1],K=[{type:6,data:i},{type:6,data:a},{type:6,data:s},{type:6,data:[t.pads[0],t.pads[1]]},{type:6,data:t.strides},{type:6,data:t.dilations}];At(t,K),K.push(...Z(e[0].dims,e[1].dims));let R=["rank","rank"];n&&(K.push(...Z(e[2].dims)),R.push("rank")),K.push(...Z(r));let M=H=>{let J=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"},{name:"pad",type:"i32",length:2},{name:"stride",type:"i32",length:2},{name:"dilation",type:"i32",length:2}];Ot(t,J);let te=$?4:1,re=Ee(e[0].dataType),ne=`
      fn setOutputAtIndex(flatIndex : i32, value : ${$?`vec4<${re}>`:re}) {
        result[flatIndex] = ${$?`vec4<${re}>`:re}(value);
      }
      fn setOutputAtCoords(d0 : i32, d1 : i32, d2 : i32, d3 : i32, value : ${$?`vec4<${re}>`:re}) {
        let flatIndex = getOutputIndexFromCoords(vec4<i32>(d0, d1, d2, d3));
        setOutputAtIndex(flatIndex ${$?"/ 4":""}, value);
      }`,U=B("x",e[0].dataType,e[0].dims.length,I===3?1:I),Y=B("w",e[1].dataType,e[1].dims.length,te),X=[U,Y],V=G("result",e[0].dataType,r.length,te);if(n){let Ie=B("bias",e[2].dataType,e[2].dims.length,te);X.push(Ie),ne+=`
        fn getBiasByOutputCoords(coords : vec4<i32>) -> ${$?`vec4<${re}>`:re} {
          return bias[coords.${p?"w":"y"}${$?"/ 4":""}];
        }`}return`
        ${rl("uniforms.result_strides")}
        //struct Uniforms { xShape : vec4<i32>, wShape : vec4<i32>, outShape : vec4<i32>,
        //  outShapeStrides: vec3<i32>, filterDims : vec2<i32>, pad : vec2<i32>, stride : vec2<i32>,
        //  dilation : vec2<i32>, dimAOuter : i32, dimBOuter : i32, dimInner : i32 };
        ${H.registerUniforms(J).declareVariables(...X,V)}
        ${ne}
        ${ol(p,D,q,Q,n,t,F[0],F[1],F[2],re)}
        ${$?na(E,b,re,void 0,!p,v):oa(E,b,re,void 0,!p,v,!1,void 0,u)}`};return{name:"Conv2DMatMul",shaderCache:{hint:`${t.cacheKey};${I};${$};${D};${q};${Q};${z};${A};${v}`,inputDependencies:R},getRunData:()=>({outputs:[{dims:l?l(r):r,dataType:e[0].dataType}],dispatchGroup:{x:k[0],y:k[1],z:k[2]},programUniforms:K}),getShaderSource:M}}}),ll,la,ur,dl,da,pl,cl,hl,Um=P(()=>{"use strict";ee(),at(),ie(),ae(),Rt(),ra(),ll=e=>{let t=1;for(let r=0;r<e.length;r++)t*=e[r];return t},la=e=>typeof e=="number"?[e,e,e]:e,ur=(e,t)=>t<=1?e:e+(e-1)*(t-1),dl=(e,t,r,i=1)=>{let a=ur(t,i);return Math.floor((e[0]*(r-1)-r+a)/2)},da=(e,t,r,i,a)=>{a==null&&(a=dl(e,t[0],i[0]));let s=[0,0,0,r];for(let n=0;n<3;n++)e[n]+2*a>=t[n]&&(s[n]=Math.trunc((e[n]-t[n]+2*a)/i[n]+1));return s},pl=(e,t,r,i,a,s,n,u,l,p)=>{let h,c,g,_;if(e==="VALID"&&(e=0),typeof e=="number"){h={top:e,bottom:e,left:e,right:e,front:e,back:e};let y=da([t,r,i,1],[u,l,p],1,[a,s,n],e);c=y[0],g=y[1],_=y[2]}else if(Array.isArray(e)){if(!e.every(($,S,x)=>$===x[0]))throw Error(`Unsupported padding parameter: ${e}`);h={top:e[0],bottom:e[1],left:e[2],right:e[3],front:e[4],back:e[5]};let y=da([t,r,i,1],[u,l,p],1,[a,s,n],e[0]);c=y[0],g=y[1],_=y[2]}else if(e==="SAME_UPPER"){c=Math.ceil(t/a),g=Math.ceil(r/s),_=Math.ceil(i/n);let y=(c-1)*a+u-t,$=(g-1)*s+l-r,S=(_-1)*n+p-i,x=Math.floor(y/2),b=y-x,E=Math.floor($/2),k=$-E,I=Math.floor(S/2),z=S-I;h={top:E,bottom:k,left:I,right:z,front:x,back:b}}else throw Error(`Unknown padding parameter: ${e}`);return{padInfo:h,outDepth:c,outHeight:g,outWidth:_}},cl=(e,t,r,i,a,s=!1,n="channelsLast")=>{let u,l,p,h,c;if(n==="channelsLast")[u,l,p,h,c]=e;else if(n==="channelsFirst")[u,c,l,p,h]=e;else throw new Error(`Unknown dataFormat ${n}`);let[g,,_,y,$]=t,[S,x,b]=la(r),[E,k,I]=la(i),z=ur(_,E),A=ur(y,k),v=ur($,I),{padInfo:D,outDepth:q,outHeight:Q,outWidth:F}=pl(a,l,p,h,S,x,b,z,A,v),K=s?g*c:g,R=[0,0,0,0,0];return n==="channelsFirst"?R=[u,K,q,Q,F]:n==="channelsLast"&&(R=[u,q,Q,F,K]),{batchSize:u,dataFormat:n,inDepth:l,inHeight:p,inWidth:h,inChannels:c,outDepth:q,outHeight:Q,outWidth:F,outChannels:K,padInfo:D,strideDepth:S,strideHeight:x,strideWidth:b,filterDepth:_,filterHeight:y,filterWidth:$,effectiveFilterDepth:z,effectiveFilterHeight:A,effectiveFilterWidth:v,dilationDepth:E,dilationHeight:k,dilationWidth:I,inShape:e,outShape:R,filterShape:t}},hl=(e,t,r,i,a,s)=>{let n=s==="channelsLast",u=n?e[0].dims[3]:e[0].dims[1],l=!1,p=[64,1,1],h={x:r.map((b,E)=>E)},c=[Math.ceil(ll(h.x.map(b=>r[b]))/p[0]),1,1];de("verbose",()=>`[conv3d_naive_webgpu] dispatch = ${c}`);let g=l?n&&u%4!==0?3:4:1,_=O.size(r),y=[{type:12,data:_},{type:12,data:i},{type:12,data:a},{type:12,data:t.strides},{type:12,data:t.dilations}];At(t,y),y.push(...Z(e[0].dims,e[1].dims));let $=["rank","rank"],S=e.length===3;S&&(y.push(...Z(e[2].dims)),$.push("rank")),y.push(...Z(r));let x=b=>{let E=[{name:"output_size",type:"u32"},{name:"filter_dims",type:"u32",length:i.length},{name:"pads",type:"u32",length:a.length},{name:"strides",type:"u32",length:t.strides.length},{name:"dilations",type:"u32",length:t.dilations.length}];Ot(t,E);let k=l?4:1,I=Ee(e[0].dataType),z=B("x",e[0].dataType,e[0].dims.length,g===3?1:g),A=B("W",e[1].dataType,e[1].dims.length,k),v=[z,A],D=G("result",e[0].dataType,r.length,k),q="";if(S){let K=B("bias",e[2].dataType,e[2].dims.length,k);v.push(K),q+=`
        fn getBiasByOutputCoords(coords : array<u32, 5>) -> ${l?`vec4<${I}>`:I} {
          return bias[${n?j("coords",4,5):j("coords",1,5)}${l?"/ 4":""}];
        }`}let Q=Ae(g,I),F=Ct(t,Q,I);return`
            ${q}
            fn getX(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> ${I} {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${z.getByIndices("aIndices")};
            }
            fn getW(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> ${I} {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${A.getByIndices("aIndices")};
            }
          ${b.registerUniforms(E).declareVariables(...v,D)}
          ${b.mainStart()}
          ${b.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
              let coords = ${D.offsetToIndices("global_idx")};
              let batch = ${j("coords",0,z.rank)};
              let d2 = ${n?j("coords",z.rank-1,z.rank):j("coords",1,z.rank)};
              let xFRCCorner = vec3<u32>(${n?j("coords",1,z.rank):j("coords",2,z.rank)},
              ${n?j("coords",2,z.rank):j("coords",3,z.rank)},
              ${n?j("coords",3,z.rank):j("coords",4,z.rank)}) * uniforms.strides - uniforms.pads;
              let xFCorner = xFRCCorner.x;
              let xRCorner = xFRCCorner.y;
              let xCCorner = xFRCCorner.z;
              let xShapeY = ${n?j("uniforms.x_shape",1,z.rank):j("uniforms.x_shape",2,z.rank)};
              let xShapeZ = ${n?j("uniforms.x_shape",2,z.rank):j("uniforms.x_shape",3,z.rank)};
              let xShapeW = ${n?j("uniforms.x_shape",3,z.rank):j("uniforms.x_shape",4,z.rank)};
              let xShapeU = ${n?j("uniforms.x_shape",4,z.rank):j("uniforms.x_shape",1,z.rank)};
              let inputDepthNearestVec4 = (xShapeU / 4) * 4;
              let inputDepthVec4Remainder = xShapeU % 4;

              var value = ${I}(0);
              for (var wF = 0u; wF < uniforms.filter_dims[0]; wF++) {
                let xF = xFCorner + wF * uniforms.dilations[0];
                if (xF < 0 || xF >= xShapeY) {
                  continue;
                }

                for (var wR = 0u; wR < uniforms.filter_dims[1]; wR++) {
                  let xR = xRCorner + wR * uniforms.dilations[1];
                  if (xR < 0 || xR >= xShapeZ) {
                    continue;
                  }

                  for (var wC = 0u; wC < uniforms.filter_dims[2]; wC++) {
                    let xC = xCCorner + wC * uniforms.dilations[2];
                    if (xC < 0 || xC >= xShapeW) {
                      continue;
                    }

                    for (var d1 = 0u; d1 < inputDepthNearestVec4; d1 += 4) {
                      ${n?`let xValues = vec4<${I}>(
                               getX(batch, xF, xR, xC, d1),
                               getX(batch, xF, xR, xC, d1 + 1),
                               getX(batch, xF, xR, xC, d1 + 2),
                               getX(batch, xF, xR, xC, d1 + 3));
                            `:`let xValues = vec4<${I}>(
                               getX(batch, d1, xF, xR, xC),
                               getX(batch, d1 + 1, xF, xR, xC),
                               getX(batch, d1 + 2, xF, xR, xC),
                               getX(batch, d1 + 3, xF, xR, xC));
                            `}
                            let wValues = vec4<${I}>(
                              getW(d2, d1, wF, wR, wC),
                              getW(d2, d1 + 1, wF, wR, wC),
                              getW(d2, d1 + 2, wF, wR, wC),
                              getW(d2, d1 + 3, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                    if (inputDepthVec4Remainder == 1) {
                        ${n?`value += getX(batch, xF, xR, xC, inputDepthNearestVec4)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`:`value += getX(batch, inputDepthNearestVec4, xF, xR, xC)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`}
                    } else if (inputDepthVec4Remainder == 2) {
                      ${n?`let xValues = vec2<${I}>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1));
                      `:`let xValues = vec2<${I}>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC));
                    `}
                    let wValues = vec2<${I}>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC));
                      value += dot(xValues, wValues);
                    } else if (inputDepthVec4Remainder == 3) {
                      ${n?`let xValues = vec3<${I}>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 2));
                      `:`let xValues = vec3<${I}>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 2, xF, xR, xC));
                    `}
                    let wValues = vec3<${I}>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 2, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                  }
                }
              }
              ${S?"value = value + getBiasByOutputCoords(coords)":""};
              ${F}
              result[global_idx] = ${I}(value);
          }`};return{name:"Conv3DNaive",shaderCache:{hint:`${t.cacheKey};${n};${g};${S}`,inputDependencies:$},getRunData:()=>({outputs:[{dims:r,dataType:e[0].dataType}],dispatchGroup:{x:c[0],y:c[1],z:c[2]},programUniforms:y}),getShaderSource:x}}}),fl,ml,Pm=P(()=>{"use strict";ee(),ie(),ae(),Rt(),fl=(e,t,r,i)=>{let a=e.length>2,s=a?"value += b[output_channel];":"",n=e[0].dims,u=e[1].dims,l=t.format==="NHWC",p=l?r[3]:r[1],h=p/t.group,c=l&&h>=4?ke(p):1,g=O.size(r)/c,_=[{type:12,data:g},{type:12,data:t.dilations},{type:12,data:[t.strides[0],t.strides[1]]},{type:12,data:[t.pads[0],t.pads[1]]},{type:12,data:h}];At(t,_),_.push(...Z(n,[u[0],u[1],u[2],u[3]/c]));let y=a?["rank","rank","rank"]:["rank","rank"];_.push(...Z([r[0],r[1],r[2],r[3]/c]));let $=S=>{let x=G("output",e[0].dataType,r.length,c),b=Ee(x.type.tensor),E=Ct(t,x.type.value,b),k=B("x",e[0].dataType,n.length),I=B("w",e[1].dataType,u.length,c),z=[k,I];a&&z.push(B("b",e[2].dataType,e[2].dims,c));let A=[{name:"output_size",type:"u32"},{name:"dilations",type:"u32",length:t.dilations.length},{name:"strides",type:"u32",length:2},{name:"pads",type:"u32",length:2},{name:"output_channels_per_group",type:"u32"}];Ot(t,A);let v=l?`
      for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[0]; wHeight++) {
        let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

        if (xHeight < 0u || xHeight >= uniforms.x_shape[1]) {
          continue;
        }

        for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[1]; wWidth++) {
          let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
          if (xWidth < 0u || xWidth >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[2]; wInChannel++) {
            let input_channel = in_channel_offset + wInChannel;
            let xVal = ${k.get("batch","xHeight","xWidth","input_channel")};
            let wVal = ${I.get("wHeight","wWidth","wInChannel","output_channel")};
            value += xVal * wVal;
          }
        }
      }
      `:`
      for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[1]; wInChannel++) {
        let input_channel = in_channel_offset + wInChannel;
        for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[2]; wHeight++) {
          let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

          if (xHeight < 0u || xHeight >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[3]; wWidth++) {
            let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
            if (xWidth < 0u || xWidth >= uniforms.x_shape[3]) {
              continue;
            }

            let xVal = ${k.get("batch","input_channel","xHeight","xWidth")};
            let wVal = ${I.get("output_channel","wInChannel","wHeight","wWidth")};
            value += xVal * wVal;
          }
        }
      }
      `;return`
  ${S.registerUniforms(A).declareVariables(...z,x)}

  ${S.mainStart()}
    ${S.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let outputIndices = ${x.offsetToIndices("global_idx")};
    let batch: u32 = outputIndices[0];
    let output_channel: u32 = outputIndices[${l?3:1}];
    let xRCCorner: vec2<u32> = vec2<u32>(outputIndices[${l?1:2}], outputIndices[${l?2:3}]) * uniforms.strides - uniforms.pads;
    let group_id: u32 = output_channel * ${c} / uniforms.output_channels_per_group;
    var in_channel_offset = group_id * uniforms.w_shape[${l?2:1}];

    var value: ${x.type.value} = ${x.type.value}(0);
    ${v}
    ${s}
    ${E}
    ${x.setByOffset("global_idx","value")}
  }`};return{name:"GroupedConv",shaderCache:{hint:`${t.cacheKey}_${c}`,inputDependencies:y},getRunData:()=>({outputs:[{dims:i?i(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(g/64)},programUniforms:_}),getShaderSource:$}},ml=(e,t,r,i)=>{let a=e.length>2,s=ke(r[3]),n=ke(r[2]),u=O.size(r)/s/n,l=[e[0].dims[0],e[0].dims[1],e[0].dims[2],e[0].dims[3]/s],p=[e[1].dims[0],e[1].dims[1],e[1].dims[2],e[1].dims[3]/s],h=[r[0],r[1],r[2],r[3]/s],c=[{type:12,data:u},{type:6,data:[t.strides[0],t.strides[1]]},{type:6,data:[t.pads[0],t.pads[1]]}];At(t,c),c.push(...Z(l,p,h));let g=(n-1)*t.strides[1]+p[1],_=y=>{let $=G("output",e[0].dataType,h.length,s),S=Ee($.type.tensor),x=Ct(t,$.type.value,S),b=B("x",e[0].dataType,l.length,s),E=B("w",e[1].dataType,p.length,s),k=[b,E];a&&k.push(B("b",e[2].dataType,e[2].dims,s));let I=a?"value += b[output_channel];":"",z=[{name:"output_size",type:"u32"},{name:"strides",type:"i32",length:2},{name:"pads",type:"i32",length:2}];return Ot(t,z),`
  ${y.registerUniforms(z).declareVariables(...k,$)}
  ${y.mainStart()}
    ${y.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let width0 = uniforms.output_shape[3];
    let output_channel = global_idx % width0;
    var index1 = global_idx / width0;
    let width1 = uniforms.output_shape[2] / ${n}u;
    let col = (index1 % width1) * ${n}u;
    index1 = index1 / width1;
    let row = index1 % uniforms.output_shape[1];
    let batch = index1 / uniforms.output_shape[1];

    let x_corner = vec2<i32>(i32(row), i32(col)) * uniforms.strides - uniforms.pads;

    var x_vals: array<${b.type.value}, ${g}>;
    var values: array<${$.type.value}, ${n}>;
    let input_channel = output_channel;
    // Use constant instead of uniform can give better performance for w's height/width.
    for (var w_height: u32 = 0u; w_height < ${p[0]}; w_height++) {
      let x_height = x_corner.x + i32(w_height);
      if (x_height >= 0 && u32(x_height) < uniforms.x_shape[1]) {
        for (var i = 0; i < ${g}; i++) {
          let x_width = x_corner.y + i;
          if (x_width >= 0 && u32(x_width) < uniforms.x_shape[2]) {
            x_vals[i] = ${b.get("batch","u32(x_height)","u32(x_width)","input_channel")};
          } else {
            x_vals[i] = ${b.type.value}(0);
          }
        }
        for (var w_width: u32 = 0u; w_width < ${p[1]}; w_width++) {
          let w_val = ${E.get("w_height","w_width","0","output_channel")};
          for (var i = 0u; i < ${n}u; i++) {
            values[i] = fma(x_vals[i * u32(uniforms.strides[1]) + w_width], w_val, values[i]);
          }
        }
      }
    }

    for (var i = 0u; i < ${n}u; i++) {
      var value = values[i];
      ${I}
      ${x}
      ${$.set("batch","row","col + i","output_channel","value")};
    }
  }`};return{name:"GroupedConv-Vectorize",shaderCache:{hint:`${t.cacheKey};${s};${n};${g};${p[0]};${p[1]}`,inputDependencies:a?["rank","rank","type"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:i?i(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:c}),getShaderSource:_}}}),gl,Dr,yl,Ur,pa,ca,_l,bl,ha,qm=P(()=>{"use strict";ie(),Dm(),Um(),ua(),Pm(),Rt(),aa(),pt(),gl=(e,t,r,i,a,s)=>{let n=e[0],u=e.slice(s?1:2,s?3:4),l=u.length,p=t[0],h=t.slice(2).map((g,_)=>g+(g-1)*(r[_]-1)),c=u.map((g,_)=>g+i[_]+i[_+l]).map((g,_)=>Math.floor((g-h[_]+a[_])/a[_]));return c.splice(0,0,n),c.splice(s?3:1,0,p),c},Dr=[2,3,1,0],yl=(e,t)=>{if(!e||e.length!==2&&e.length!==3)throw new Error("Conv requires 2 or 3 inputs");if(e[0].dims.length>5)throw new Error("greater than 5D is not supported");if(e[0].dims.length!==e[1].dims.length)throw new Error("filter does not have same dimension as input");let r=e[0].dims[t.format==="NHWC"?e[0].dims.length-1:1],i=e[1].dims[1]*t.group;if(r!==i)throw new Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");if(e.length===3&&(e[2].dims.length!==1||e[1].dims[0]!==e[2].dims[0]))throw new Error("invalid bias");let a=e[0].dims.length-2;if(t.dilations.length!==a)throw new Error(`dilations should be ${a}D`);if(t.strides.length!==a)throw new Error(`strides should be ${a}D`);if(t.pads.length!==a*2)throw new Error(`pads should be ${a*2}D`);if(t.kernelShape.length!==0&&t.kernelShape.length!==e[1].dims.length-2)throw new Error("invalid kernel shape")},Ur=(e,t)=>{let r=e.kernelShape.slice();r.length<t[1].dims.length-2&&r.push(...Array(t[1].dims.length-2-r.length).fill(0));for(let s=2;s<t[1].dims.length;++s)r[s-2]===0&&(r[s-2]=t[1].dims[s]);let i=e.pads.slice();zr.adjustPadsBasedOnAutoPad(t[0].dims,e.strides,e.dilations,r,i,e.format==="NHWC",e.autoPad);let a=Object.assign({},e);return Object.assign(a,{kernelShape:r,pads:i}),a},pa=e=>{let t=ta(e),r=e.format,i=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][e.auto_pad],a=e.dilations,s=e.group,n=e.kernel_shape,u=e.pads,l=e.strides,p=e.w_is_const();return{autoPad:i,format:r,dilations:a,group:s,kernelShape:n,pads:u,strides:l,wIsConst:p,...t,cacheKey:`${e.format};${t.activation};`}},ca=(e,t,r,i)=>{let a=r.format==="NHWC",s=gl(t[0].dims,t[1].dims,r.dilations,r.pads,r.strides,a);if(r.group!==1){let z=[t[0]];if(a){let A=e.kernelCustomData.wT??e.compute(Ue(t[1],Dr),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=A),z.push(A)}else z.push(t[1]);t.length===3&&z.push(t[2]),!e.adapterInfo.isArchitecture("ampere")&&a&&t[1].dims[0]===r.group&&t[1].dims[1]===1&&r.dilations[0]===1&&r.dilations[1]===1?e.compute(ml(z,r,s,i),{inputs:z}):e.compute(fl(z,r,s,i),{inputs:z});return}let n=t.length===3,u=t[0].dims[a?1:2],l=t[0].dims[a?2:3],p=t[0].dims[a?3:1],h=t[1].dims[2],c=t[1].dims[3],g=s[a?1:2],_=s[a?2:3],y=s[a?3:1],$=a&&h===u&&c===l&&r.pads[0]===0&&r.pads[1]===0;if($||h===1&&c===1&&r.dilations[0]===1&&r.dilations[1]===1&&r.strides[0]===1&&r.strides[1]===1&&r.pads[0]===0&&r.pads[1]===0){let z=s[0],A,v,D,q=[];if(a){let K=e.kernelCustomData.wT??e.compute(Ue(t[1],Dr),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];if(r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=K),$){let R=u*l*p;A=t[0].reshape([1,z,R]),v=K.reshape([1,R,y]),D=[1,z,y]}else A=t[0].reshape([z,u*l,p]),v=K.reshape([1,p,y]),D=[z,g*_,y];q.push(A),q.push(v)}else A=t[0].reshape([z,p,u*l]),v=t[1].reshape([1,y,p]),D=[z,y,g*_],q.push(v),q.push(A);n&&q.push(t[2]);let Q=D[2],F=q[0].dims[q[0].dims.length-1];Q<8&&F<8?e.compute(ia(q,r,s,D,a,i),{inputs:q}):e.compute(Mr(q,r,s,D,a,i),{inputs:q});return}let S=!0,x=e.kernelCustomData.wT??e.compute(Ue(t[1],Dr),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=x);let b=[t[0],x];n&&b.push(t[2]);let E=a?g*_:y,k=a?y:g*_,I=h*c*p;e.compute(ul(b,r,s,E,k,I,n,S,i),{inputs:b})},_l=(e,t)=>{let r=t.format==="NHWC",i=[e.inputs[0].reshape(r?[e.inputs[0].dims[0],1,e.inputs[0].dims[1],e.inputs[0].dims[2]]:[e.inputs[0].dims[0],e.inputs[0].dims[1],1,e.inputs[0].dims[2]]),e.inputs[1].reshape([e.inputs[1].dims[0],e.inputs[1].dims[1],1,e.inputs[1].dims[2]])];e.inputs.length===3&&i.push(e.inputs[2]);let a=[0,t.pads[0],0,t.pads[1]],s=[1].concat(t.strides),n=[1].concat(t.dilations),u=[1].concat(t.kernelShape),l=Ur({...t,pads:a,strides:s,dilations:n,kernelShape:u},i);ca(e,i,l,p=>r?[p[0],p[2],p[3]]:[p[0],p[1],p[3]])},bl=(e,t,r)=>{let i=r.format==="NHWC"?"channelsLast":"channelsFirst",a=Ur(r,t),s=r.autoPad==="NOTSET"?r.pads:r.autoPad,n=cl(t[0].dims,t[1].dims,r.strides,r.dilations,s,!1,i);e.compute(hl(t,a,n.outShape,[n.filterDepth,n.filterHeight,n.filterWidth],[n.padInfo.front,n.padInfo.top,n.padInfo.left],i))},ha=(e,t)=>{if(yl(e.inputs,t),e.inputs[0].dims.length===3)_l(e,t);else if(e.inputs[0].dims.length===5)bl(e,e.inputs,t);else{let r=Ur(t,e.inputs);ca(e,e.inputs,r)}}}),wl,Lm=P(()=>{"use strict";ee(),at(),ie(),ae(),wl=(e,t,r)=>{let i=e.length>2,a=t.outputShape,s=t.format==="NHWC",n=t.group,u=e[1].dims,l=u[2]/n,p=u[3],h=s?ke(l):1,c=s&&p===1&&l>=4,g=c?Math.floor(l/4)*4:Math.floor(l/h)*h,_=l-g,y=s?ke(p):1,$=s?p===1?h:y:1,S=O.size(a)/y,x=[Math.ceil(S/64),1,1];de("verbose",()=>`[conv2d_backprop_webgpu] dispatch = ${x}`);let b=["rank","rank"],E=[t.strides[0],t.strides[1]],k=[t.kernelShape[s?1:2],t.kernelShape[s?2:3]],I=[t.dilations[0],t.dilations[1]],z=[k[0]+(t.dilations[0]<=1?0:(t.kernelShape[s?1:2]-1)*(t.dilations[0]-1)),k[1]+(t.dilations[1]<=1?0:(t.kernelShape[s?2:3]-1)*(t.dilations[1]-1))],A=[z[0]-1-Math.floor((t.pads[0]+t.pads[2])/2),z[1]-1-Math.floor((t.pads[1]+t.pads[3])/2)],v=[{type:12,data:S},{type:12,data:E},{type:12,data:k},{type:12,data:I},{type:12,data:z},{type:6,data:A},{type:12,data:g},{type:12,data:l},{type:12,data:p},...Z(e[0].dims,e[1].dims)];i&&(v.push(...Z(e[2].dims)),b.push("rank")),v.push(...Z(a));let D=q=>{let Q=[{name:"output_size",type:"u32"},{name:"strides",type:"u32",length:E.length},{name:"filter_dims",type:"u32",length:k.length},{name:"dilations",type:"u32",length:k.length},{name:"effective_filter_dims",type:"u32",length:z.length},{name:"pads",type:"i32",length:A.length},{name:"input_channels_per_group_int",type:"u32"},{name:"input_channels_per_group",type:"u32"},{name:"output_channels_per_group",type:"u32"}],F=Ee(e[0].dataType),K=s?1:2,R=s?2:3,M=s?3:1,H=B("W",e[1].dataType,e[1].dims.length,$),J=B("Dy",e[0].dataType,e[0].dims.length,h),te=[J,H];i&&te.push(B("bias",e[2].dataType,[a[M]].length,y));let re=G("result",e[0].dataType,a.length,y),ne=()=>{let X="";if(c)h===4?X+=`
        let xValue = ${J.getByOffset("x_offset")};
        let wValue = ${H.getByOffset("w_offset")};
        dotProd = dotProd + dot(xValue, wValue);
        x_offset += 1u;
        w_offset += 1u;`:h===2?X+=`
          dotProd = dotProd + dot(vec4<${F}>(${J.getByOffset("x_offset")}, ${J.getByOffset("x_offset + 1u")}), vec4<${F}>(${H.getByOffset("w_offset")}, ${H.getByOffset("w_offset + 1u")}));
          x_offset += 2u;
          w_offset += 2u;`:h===1&&(X+=`
          dotProd = dotProd + dot(vec4<${F}>(${J.getByOffset("x_offset")}, ${J.getByOffset("x_offset + 1u")}, ${J.getByOffset("x_offset + 2u")}, ${J.getByOffset("x_offset + 3u")}), vec4<${F}>(${H.getByOffset("w_offset")}, ${H.getByOffset("w_offset + 1u")}, ${H.getByOffset("w_offset + 2u")}, ${H.getByOffset("w_offset + 3u")}));
          x_offset += 4u;
          w_offset += 4u;`);else if(X+=`
                  let xValue = ${s?J.getByOffset(`${J.indicesToOffset(`${J.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${h}`):J.get("batch","inputChannel","idyR","idyC")};
        `,h===1)X+=`
          let w_offset = ${H.indicesToOffset(`${H.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel, wOutChannel)`)};
          let wValue = ${H.getByOffset(`w_offset / ${$}`)};
          dotProd = dotProd + xValue * wValue;`;else for(let V=0;V<h;V++)X+=`
            let wValue${V} = ${H.getByOffset(`${H.indicesToOffset(`${H.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel + ${V}, wOutChannel)`)} / ${$}`)};
            dotProd = dotProd + xValue[${V}] * wValue${V};`;return X},U=()=>{if(_===0)return"";if(!c)throw new Error(`packInputAs4 ${c} is not true.`);let X="";if(h===1){X+="dotProd = dotProd";for(let V=0;V<_;V++)X+=`
            + ${J.getByOffset(`x_offset + ${V}`)} * ${H.getByOffset(`w_offset + ${V}`)}`;X+=";"}else if(h===2){if(_!==2)throw new Error(`Invalid inputChannelsRemainder ${_}.`);X+=`
          let xValue = ${J.getByOffset("x_offset")};
          let wValue = ${H.getByOffset("w_offset")};
          dotProd = dotProd + dot(xValue, wValue);`}return X},Y=`
            let outputIndices = ${re.offsetToIndices(`global_idx * ${y}`)};
            let batch = ${re.indicesGet("outputIndices",0)};
            let d1 = ${re.indicesGet("outputIndices",M)};
            let r = ${re.indicesGet("outputIndices",K)};
            let c = ${re.indicesGet("outputIndices",R)};
            let dyCorner = vec2<i32>(i32(r), i32(c)) - uniforms.pads;
            let dyRCorner = dyCorner.x;
            let dyCCorner = dyCorner.y;
            let groupId = d1 / uniforms.output_channels_per_group;
            let wOutChannel = d1 - groupId * uniforms.output_channels_per_group;
            // Convolve dy(?, ?, d2) with w(:, :, d1, d2) to compute dx(xR, xC, d1).
            // ? = to be determined. : = across all values in that axis.
            var dotProd = ${re.type.value}(0.0);
            var wR: u32 = 0;
            if (uniforms.dilations.x == 1) {
              // Minimum wR >= 0 that satisfies (dyRCorner + wR) % (uniforms.strides.x) == 0
              wR = u32(((dyRCorner + i32(uniforms.strides.x) - 1) / i32(uniforms.strides.x)) * i32(uniforms.strides.x) - dyRCorner);
            }
            for (; wR < uniforms.effective_filter_dims.x; wR = wR + 1) {
              if (wR % uniforms.dilations.x != 0) {
                continue;
              }
              let dyR = (${F}(dyRCorner) + ${F}(wR)) / ${F}(uniforms.strides[0]);
              let wRPerm = uniforms.filter_dims.x - 1 - wR / uniforms.dilations.x;
              if (dyR < 0.0 || dyR >= ${F}(uniforms.Dy_shape[${K}]) || fract(dyR) > 0.0 ||
                  wRPerm < 0) {
                continue;
              }
              let idyR: u32 = u32(dyR);
              var wC: u32 = 0;
              if (uniforms.dilations.y == 1) {
                // Minimum wC >= 0 that satisfies (dyCCorner + wC) % (uniforms.strides.y) == 0
                wC = u32(((dyCCorner + i32(uniforms.strides.y) - 1) / i32(uniforms.strides.y)) * i32(uniforms.strides.y) - dyCCorner);
              }
              for (; wC < uniforms.effective_filter_dims.y; wC = wC + 1) {
                if (wC % uniforms.dilations.y != 0) {
                  continue;
                }
                let dyC = (${F}(dyCCorner) + ${F}(wC)) / ${F}(uniforms.strides.y);
                let wCPerm = uniforms.filter_dims.y - 1 - wC / uniforms.dilations.y;
                if (dyC < 0.0 || dyC >= ${F}(uniforms.Dy_shape[${R}]) ||
                    fract(dyC) > 0.0 || wCPerm < 0) {
                  continue;
                }
                let idyC: u32 = u32(dyC);
                var inputChannel = groupId * uniforms.input_channels_per_group;
                ${c?`
                var x_offset = ${J.indicesToOffset(`${J.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${h};
                var w_offset = ${H.indicesToOffset(`${H.type.indices}(wRPerm, wCPerm, inputChannel, wOutChannel)`)} / ${$};
                  `:""}
                for (var d2: u32 = 0; d2 < uniforms.input_channels_per_group_int; d2 = d2 + ${c?4:h}) {
                  ${ne()}
                  inputChannel = inputChannel + ${c?4:h};
                }
                ${U()}
                wC = wC + uniforms.strides.y - 1;
              }
              wR = wR + uniforms.strides[0] - 1;
            }
            let value = dotProd${i?` + bias[d1 / ${y}]`:""};
            ${re.setByOffset("global_idx","value")};
          `;return`
    ${q.registerUniforms(Q).declareVariables(...te,re)}
      ${q.mainStart()}
      ${q.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")};
    ${Y}}`};return{name:"ConvTranspose2D",shaderCache:{hint:`${t.cacheKey};${h}${$}${y}${c}${_}`,inputDependencies:b},getRunData:()=>({dispatchGroup:{x:x[0],y:x[1],z:x[2]},outputs:[{dims:r?r(a):a,dataType:e[0].dataType}],programUniforms:v}),getShaderSource:D}}}),$l,vl,xl,fa,Sl,kl,ma,Tl,Il,Wm=P(()=>{"use strict";Lm(),Rt(),pt(),$l=(e,t,r,i,a,s)=>(e-1)*t+r+(i-1)*a+1-s,vl=(e,t,r,i,a)=>{let s=Math.floor(e/2);t==="SAME_UPPER"?(r[i]=s,r[a]=e-s):t==="SAME_LOWER"&&(r[i]=e-s,r[a]=s)},xl=(e,t,r,i,a,s,n,u,l,p)=>{let h=e.length-2,c=p.length===0;l.length<h&&l.push(...Array(h-l.length).fill(0));let g=e[0],_=t[u?3:1]*a;for(let y=0,$=e.length-h-(u?1:0);y<h;++y,++$){let S=e[$],x=c?S*n[y]:p[y],b=$l(S,n[y],s[y],t[$],r[y],x);vl(b,i,s,y,y+h),c&&p.push(n[y]*(S-1)+l[y]+(t[$]-1)*r[y]+1-s[y]-s[y+h])}p.splice(0,0,g),p.splice(u?3:1,0,_)},fa=(e,t)=>{let r=e.kernelShape.slice();if(e.kernelShape.length===0||e.kernelShape.reduce((c,g)=>c*g,1)===0){r.length=0;for(let c=2;c<t[1].dims.length;++c)r.push(t[1].dims[c])}let i=e.format==="NHWC";r.splice(0,0,t[1].dims[0]),r.splice(i?3:1,0,t[1].dims[1]);let a=e.pads.slice(),s=e.outputShape.slice(),n=e.outputPadding.slice(),u=t[0].dims,l=e.dilations.slice();if(l.reduce((c,g)=>c+g,0)===0){let c=t[0].dims.length-2;l=new Array(c).fill(1)}let p=e.strides.slice();if(p.reduce((c,g)=>c+g,0)===0){let c=t[0].dims.length-2;p=new Array(c).fill(1)}xl(u,r,l,e.autoPad,e.group,a,p,i,n,s);let h=Object.assign({},e);return Object.assign(h,{kernelShape:r,pads:a,outputPadding:n,outputShape:s,dilations:l,strides:p}),h},Sl=e=>{let t=ta(e),r=e.format,i=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][typeof e.autoPad>"u"?0:e.autoPad],a=e.dilations,s=e.group??1,n=e.kernelShape,u=e.pads,l=e.strides,p=e.wIsConst(),h=e.outputPadding,c=e.outputShape;return{autoPad:i,format:r,dilations:a,group:s,kernelShape:n,outputPadding:h,outputShape:c,pads:u,strides:l,wIsConst:p,...t,cacheKey:`${e.format};${t.activation};`}},kl=(e,t)=>{if(!e||e.length!==2&&e.length!==3)throw new Error("Conv requires 2 or 3 inputs");if(e[0].dims.length!==4&&e[0].dims.length!==3)throw new Error("currently only support 2-dimensional conv");if(e[0].dims.length!==e[1].dims.length)throw new Error("filter does not have same dimension as input");let r=e[0].dims[t.format==="NHWC"?e[0].dims.length-1:1],i=e[1].dims[0];if(r!==i)throw new Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");let a=e[1].dims[1]*t.group;if(e.length===3&&(e[2].dims.length!==1||e[2].dims[0]!==a))throw new Error("invalid bias");let s=e[0].dims.length-2;if(t.dilations.reduce((n,u)=>n+u,0)>0&&t.dilations.length!==s)throw new Error(`dilations should be ${s}D`);if(t.strides.reduce((n,u)=>n+u,0)>0&&t.strides.length!==s)throw new Error(`strides should be ${s}D`);if(t.pads.reduce((n,u)=>n+u,0)>0&&t.pads.length!==s*2)throw new Error(`pads should be ${s*2}D`);if(t.outputPadding.length!==s&&t.outputPadding.length!==0)throw new Error(`output_padding should be ${s}D`);if(t.kernelShape.reduce((n,u)=>n+u,0)>0&&t.kernelShape.length!==0&&t.kernelShape.length!==e[1].dims.length-2)throw new Error("invalid kernel shape");if(t.outputShape.length!==0&&t.outputShape.length!==e[0].dims.length-2)throw new Error("invalid output shape")},ma=(e,t,r,i)=>{let a=e.kernelCustomData.wT??e.compute(Ue(t[1],[2,3,0,1]),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=a);let s=[t[0],a];t.length===3&&s.push(t[2]),e.compute(wl(s,r,i),{inputs:s})},Tl=(e,t)=>{let r=t.format==="NHWC",i=[e.inputs[0].reshape(r?[e.inputs[0].dims[0],1,e.inputs[0].dims[1],e.inputs[0].dims[2]]:[e.inputs[0].dims[0],e.inputs[0].dims[1],1,e.inputs[0].dims[2]]),e.inputs[1].reshape([e.inputs[1].dims[0],e.inputs[1].dims[1],1,e.inputs[1].dims[2]])];e.inputs.length===3&&i.push(e.inputs[2]);let a=t.kernelShape;(a.length===0||a[0]===0)&&(a=[e.inputs[1].dims[2]]);let s=t.dilations;(s.length===0||s[0]===0)&&(s=[1]);let n=t.strides;(n.length===0||n[0]===0)&&(n=[1]);let u=t.pads;u.length===0&&(u=[0,0]),u=[0,u[0],0,u[1]],n=[1].concat(n),s=[1].concat(s),a=[1].concat(a);let l=t.outputPadding;l=[0].concat(l);let p=fa({...t,pads:u,strides:n,dilations:s,kernelShape:a,outputPadding:l},i);ma(e,i,p,h=>r?[h[0],h[2],h[3]]:[h[0],h[1],h[3]])},Il=(e,t)=>{if(kl(e.inputs,t),e.inputs[0].dims.length===3)Tl(e,t);else{let r=fa(t,e.inputs);ma(e,e.inputs,r)}}}),El,zl,Cl,Vm=P(()=>{"use strict";ee(),ie(),Se(),ae(),El=(e,t,r,i)=>{let a=O.size(t),s=t.length,n=B("input",e,s),u=G("output",e,s),l=r.dataType===6?r.getInt32Array()[0]:Number(r.getBigInt64Array()[0]),p=O.normalizeAxis(l,s),h=c=>{let g=` i32(${n.indicesGet("inputIndices","uniforms.axis")}) `,_=j("uniforms.input_shape","uniforms.axis",s),y=i.reverse?g+(i.exclusive?" + 1":""):"0",$=i.reverse?_:g+(i.exclusive?"":" + 1");return`
                ${c.registerUniform("outputSize","u32").registerUniform("axis","u32").declareVariables(n,u)}
                ${c.mainStart()}
                  ${c.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
                  var inputIndices = ${u.offsetToIndices("global_idx")};
                  var sum = ${u.type.value}(0);
                  let first : i32 = ${y};
                  let last : i32 = ${$};
                  for (var i : i32 = first; i < last; i++) {
                    ${n.indicesSet("inputIndices","uniforms.axis","u32(i)")};
                    sum = sum + ${n.getByIndices("inputIndices")};
                  }
                  ${u.setByOffset("global_idx","sum")};
                }`};return{name:"CumSum",shaderCache:{hint:i.cacheKey,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:t,dataType:e}],dispatchGroup:{x:Math.ceil(a/64)},programUniforms:[{type:12,data:a},{type:12,data:p},...Z(t,t)]}),getShaderSource:h}},zl=(e,t)=>{let r=e.inputs[0].dims,i=e.inputs[0].dataType,a=e.inputs[1];e.compute(El(i,r,a,t),{inputs:[0]})},Cl=e=>{let t=e.exclusive===1,r=e.reverse===1;return he({exclusive:t,reverse:r})}}),Al,Ol,Rl,Bl,Nl,Gm=P(()=>{"use strict";ee(),ie(),Se(),ae(),Al=e=>{if(!e||e.length!==1)throw new Error("DepthToSpace requires 1 input.");if(e[0].dims.length!==4)throw new Error("DepthToSpace requires 4D input.")},Ol=(e,t,r,i)=>{let a=[];a.push(`fn perm(i: ${i.type.indices}) -> ${r.type.indices} {
    var a: ${r.type.indices};`);for(let s=0;s<t;++s)a.push(r.indicesSet("a",e[s],`i[${s}]`));return a.push("return a;}"),a.join(`
`)},Rl=(e,t)=>{let r,i,a,s,n,u,l=t.format==="NHWC",p=t.blocksize,h=t.mode==="DCR";l?([r,i,a,s]=e.dims,n=h?[r,i,a,p,p,s/p**2]:[r,i,a,s/p**2,p,p],u=h?[0,1,3,2,4,5]:[0,1,4,2,5,3]):([r,i,a,s]=[e.dims[0],e.dims[2],e.dims[3],e.dims[1]],n=h?[r,p,p,s/p**2,i,a]:[r,s/p**2,p,p,i,a],u=h?[0,3,4,1,5,2]:[0,1,4,2,5,3]);let c=e.reshape(n),g=c.dims.length,_=e.dataType,y=B("a",_,g),$=G("output",_,g),S=x=>`
  ${x.registerUniform("output_size","u32").declareVariables(y,$)}

  ${Ol(u,g,y,$)}

  ${x.mainStart()}
    ${x.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${$.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${$.setByOffset("global_idx",y.getByIndices("aIndices"))}
  }`;return{name:"DepthToSpace",shaderCache:{hint:`${e.dims};${t.blocksize};${t.mode}`,inputDependencies:["rank"]},getRunData:x=>{let b=l?[r,i*p,a*p,s/p**2]:[r,s/p**2,i*p,a*p],E=O.size(b),k=c.dims,I=O.sortBasedOnPerm(k,u);return{outputs:[{dims:b,dataType:x[0].dataType}],dispatchGroup:{x:Math.ceil(E/64)},programUniforms:[{type:12,data:E},...Z(k,I)]}},getShaderSource:S}},Bl=(e,t)=>{Al(e.inputs),e.compute(Rl(e.inputs[0],t))},Nl=e=>he({blocksize:e.blocksize,mode:e.mode,format:e.format})}),nt,lr,Pr,ga,ct,Ml,Dl,Ul,ya,_a,ba,Pl,ql,wa,Ll,Wl,Vl,Hm=P(()=>{"use strict";ee(),ie(),Se(),ae(),nt=256,lr=512,Pr=2*Math.PI,ga=e=>{let t=[],r=e;for(let i of[4,2,3,5])for(;r%i===0;)t.push(i),r/=i;return r===1?t:void 0},ct=e=>{let t=e.toPrecision(9);return/[.eE]/.test(t)?t:`${t}.0`},Ml=(e,t,r,i,a)=>{let s=r/e,n=lr-i,u=p=>`smem[${n}u + base + ${p*t}u]`,l=`  for (var t = local_idx; t < ${s}u; t += ${nt}u) {
`;l+=`    let twiddleIndex = t % ${t}u;
    let angleUnit = f32(twiddleIndex);
`,l+=`    var leg: array<vec2<f32>, 5>;
`;for(let p=0;p<e;p++){let h=`${i}u + t + ${p*s}u`;if(p===0)l+=`    leg[0] = smem[${h}];
`;else{let c=a*Pr*p/(e*t);l+=`    { let a = ${ct(c)} * angleUnit; leg[${p}] = cmul(smem[${h}], vec2<f32>(cos(a), sin(a))); }
`}}if(l+=`    let base = (t / ${t}u) * ${t*e}u + twiddleIndex;
`,e===2)l+=`    ${u(0)} = leg[0] + leg[1];
    ${u(1)} = leg[0] - leg[1];
`;else if(e===4){let p=a<0?"vec2<f32>(oddDiff.y, -oddDiff.x)":"vec2<f32>(-oddDiff.y, oddDiff.x)";l+=`    let evenSum = leg[0] + leg[2]; let evenDiff = leg[0] - leg[2];
`,l+=`    let oddSum = leg[1] + leg[3]; let oddDiff = leg[1] - leg[3];
`,l+=`    let oddRot = ${p};
`,l+=`    ${u(0)} = evenSum + oddSum;
    ${u(1)} = evenDiff + oddRot;
`,l+=`    ${u(2)} = evenSum - oddSum;
    ${u(3)} = evenDiff - oddRot;
`}else for(let p=0;p<e;p++){let h=["leg[0]"];for(let c=1;c<e;c++){let g=a*Pr*(c*p)/e,_=ct(Math.cos(g)),y=ct(Math.sin(g));h.push(`vec2<f32>(leg[${c}].x*${_} - leg[${c}].y*${y}, leg[${c}].x*${y} + leg[${c}].y*${_})`)}l+=`    ${u(p)} = ${h.join(" + ")};
`}return`${l}  }
  workgroupBarrier();
`},Dl=(e,t,r)=>{let i="",a=1,s=0;for(let n of e)i+=Ml(n,a,t,s,r),a*=n,s=lr-s;return{code:i,resultOffset:s}},Ul=(e,t,r,i,a)=>{let s=e.dims,n=s.length,u=s[n-1],l=s[t],p=r&&i?(l-1)*2:l;a!==void 0&&(p=a);let h=r&&i?1:2,c=i&&!r?Math.floor(p/2)+1:p,g=s.slice();g[t]=c,g[n-1]=h;let _=1;for(let $=t+1;$<n-1;$++)_*=s[$];let y=O.size(s)/u/l;return{dataType:e.dataType,outputDims:g,length:p,signalLength:l,inner:_,batch:y,inputComponents:u,outputComponents:h,outputLength:c,inverse:r,onesided:i}},ya=(e,t)=>[t,e.length,e.inputComponents,e.outputComponents,e.inverse,e.onesided].join(";"),_a=e=>[{type:12,data:e.batch},{type:12,data:e.signalLength},{type:12,data:e.inner},{type:12,data:e.outputLength}],ba=(e,t,r)=>e.registerUniform("batch","u32").registerUniform("signalLength","u32").registerUniform("inner","u32").registerUniform("outputLength","u32").declareVariables(t,r),Pl=e=>{let{dataType:t,length:r,inputComponents:i,outputComponents:a,inverse:s,onesided:n}=e,u=ze(t),l=s?1:-1,p=s?1/r:1,h=ga(r),c=g=>{let _=B("x",t,[1]),y=G("y",t,[1]),$=I=>{let z=`inBase + (${I}) * uniforms.inner * ${i}u`,A=`f32(${_.getByOffset(z)})`,v=i===2?`f32(${_.getByOffset(`${z} + 1u`)})`:"0.0";return`vec2<f32>(${A}, ${v})`},S;if(s&&n){let I=Math.floor(r/2)+1,z=r%2===0?`select(provided, provided - 1u, provided == ${I}u)`:"provided";S=`
    let provided = min(uniforms.signalLength, ${I}u);
    for (var i = local_idx; i < ${r}u; i += ${nt}u) {
      if (i < provided) { smem[i] = ${$("i")}; } else { smem[i] = vec2<f32>(0.0); }
    }
    workgroupBarrier();
    for (var k = local_idx + 1u; k < ${z}; k += ${nt}u) {
      let h = smem[k];
      smem[${r}u - k] = vec2<f32>(h.x, -h.y);
    }
    workgroupBarrier();`}else S=`
    let loadCount = min(uniforms.signalLength, ${r}u);
    for (var i = local_idx; i < ${r}u; i += ${nt}u) {
      if (i < loadCount) { smem[i] = ${$("i")}; } else { smem[i] = vec2<f32>(0.0); }
    }
    workgroupBarrier();`;let{code:x,resultOffset:b}=Dl(h,r,l),E=p===1?`smem[${b}u + i]`:`smem[${b}u + i] * ${ct(p)}`,k=a===2?y.setByOffset("off + 1u",`${u}(v.y)`):"";return`
  ${ba(g,_,y)}
  var<workgroup> smem: array<vec2<f32>, ${2*lr}>;
  fn cmul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
    return vec2<f32>(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
  }
  ${g.mainStart(nt)}
    let row = workgroup_index;
    if (row >= uniforms.batch) { return; }
    let outer = row / uniforms.inner;
    let within = row % uniforms.inner;
    let inBase = (outer * uniforms.signalLength * uniforms.inner + within) * ${i}u;
    let outBase = (outer * uniforms.outputLength * uniforms.inner + within) * ${a}u;
    ${S}
${x}    for (var i = local_idx; i < uniforms.outputLength; i += ${nt}u) {
      let v = ${E};
      let off = outBase + i * uniforms.inner * ${a}u;
      ${y.setByOffset("off",`${u}(v.x)`)}
      ${k}
    }
  }`};return{name:"DFT",shaderCache:{hint:ya(e,"fft"),inputDependencies:["type"]},getShaderSource:c,getRunData:()=>({outputs:[{dims:e.outputDims,dataType:t}],programUniforms:_a(e),dispatchGroup:{x:e.batch}})}},ql=e=>{let{dataType:t,length:r,inputComponents:i,outputComponents:a,inverse:s,onesided:n}=e,u=ze(t),l=s?1:-1,p=s?1/r:1,h=c=>{let g=B("x",t,[1]),_=G("y",t,[1]),y=E=>{let k=`inBase + (${E}) * uniforms.inner * ${i}u`,I=`f32(${g.getByOffset(k)})`,z=i===2?`f32(${g.getByOffset(`${k} + 1u`)})`:"0.0";return`vec2<f32>(${I}, ${z})`},$=s&&n?`fn spectrum(inBase: u32, k: u32) -> vec2<f32> {
    let provided = min(uniforms.signalLength, ${Math.floor(r/2)+1}u);
    if (k < provided) { return ${y("k")}; }
    let m = ${r}u - k;
    if (m < provided) {
      let h = ${y("m")};
      return vec2<f32>(h.x, -h.y);
    }
    return vec2<f32>(0.0, 0.0);
  }`:`fn spectrum(inBase: u32, n: u32) -> vec2<f32> {
    if (n < uniforms.signalLength) { return ${y("n")}; }
    return vec2<f32>(0.0, 0.0);
  }`,S=`
      let angle = ${ct(l*Pr)} * f32(knMod) / ${ct(r)};
      acc += cmul(spectrum(inBase, n), vec2<f32>(cos(angle), sin(angle)));
      knMod += k;
      if (knMod >= ${r}u) { knMod -= ${r}u; }`,x=a===2?_.setByOffset("off + 1u",`${u}(v.y)`):"",b=p===1?"acc":`acc * ${ct(p)}`;return`
  ${ba(c,g,_)}
  fn cmul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
    return vec2<f32>(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
  }
  ${$}
  ${c.mainStart(nt)}
    let row = workgroup_index;
    if (row >= uniforms.batch) { return; }
    let outer = row / uniforms.inner;
    let within = row % uniforms.inner;
    let inBase = (outer * uniforms.signalLength * uniforms.inner + within) * ${i}u;
    let outBase = (outer * uniforms.outputLength * uniforms.inner + within) * ${a}u;
    for (var k = local_idx; k < uniforms.outputLength; k += ${nt}u) {
      var acc = vec2<f32>(0.0, 0.0);
      var knMod = 0u;
      for (var n = 0u; n < ${r}u; n++) {${S}
      }
      let v = ${b};
      let off = outBase + k * uniforms.inner * ${a}u;
      ${_.setByOffset("off",`${u}(v.x)`)}
      ${x}
    }
  }`};return{name:"DFT",shaderCache:{hint:ya(e,"direct"),inputDependencies:["type"]},getShaderSource:h,getRunData:()=>({outputs:[{dims:e.outputDims,dataType:t}],programUniforms:_a(e),dispatchGroup:{x:e.batch}})}},wa=e=>{if(!e||e.dataType===0)return;if(O.size(e.dims)!==1)throw new Error("DFT optional scalar inputs must have exactly 1 element.");if(e.dataType===6)return e.getInt32Array()[0];let t=Number(e.getBigInt64Array()[0]);if(!Number.isSafeInteger(t))throw new Error("DFT optional scalar inputs are out of JavaScript safe integer range.");return t},Ll=e=>{if(!e||e.length<1)throw new Error("DFT requires at least 1 input.");let t=e[0].dims;if(t.length<2)throw new Error("DFT input must have at least 2 dimensions.");let r=t[t.length-1];if(r!==1&&r!==2)throw new Error("DFT input's innermost dimension must be 1 (real) or 2 (complex).")},Wl=(e,t)=>{Ll(e.inputs);let r=e.inputs[0],i=r.dims.length,a=t.inverse!==0,s=t.onesided!==0,n=wa(e.inputs[1]);if(n!==void 0&&n<=0)throw new Error("dft_length must be greater than zero.");let u=O.normalizeAxis(wa(e.inputs[2])??t.axis,i);if(u===i-1)throw new Error("DFT axis must refer to a signal dimension, not the innermost (real/imaginary) dimension.");if(a&&s&&r.dims[i-1]!==2)throw new Error("Inverse one-sided DFT (IRFFT) requires complex-valued input (innermost dimension 2).");let l=Ul(r,u,a,s,n);if(l.length<=0)throw new Error(`Invalid DFT length: ${l.length}`);let p=l.length<=lr&&ga(l.length)!==void 0?Pl(l):ql(l);e.compute(p,{inputs:[0]})},Vl=e=>he({axis:e.axis??1,inverse:e.inverse??0,onesided:e.onesided??0})}),qr,dr,$a,Gl,Hl,Fl,jl,va,Kl,Zl,Xl,Fm=P(()=>{"use strict";ee(),ie(),Se(),ae(),qr="[a-zA-Z]|\\.\\.\\.",dr="("+qr+")+",$a="^"+dr+"$",Gl="("+dr+",)*"+dr,Hl="^"+Gl+"$",Fl=class{constructor(e=-1){this.symbolToIndices=new Map,this.inputIndex=e}addSymbol(e,t){let r=this.symbolToIndices.get(e);r===void 0?r=[t]:r.push(t),this.symbolToIndices.set(e,r)}},jl=class{constructor(e,t){this.equation=t,this.hasEllipsis=!1,this.symbolToInfo=new Map,this.lhs=new Array,this.outputDims=[];let[r,i]=t.includes("->")?t.split("->",2):[t,""];if(!r.match(RegExp(Hl)))throw new Error("Invalid LHS term");if(r.split(",").forEach((a,s)=>{let n=e[s].dims.slice();if(!a.match(RegExp($a)))throw new Error("Invalid LHS term");let u=this.processTerm(a,!0,n,s);this.lhs.push(u)}),i==="")i+=[...this.symbolToInfo.entries()].filter(([a,s])=>s.count===1||a==="...").map(([a])=>a).join("");else if(!i.match(RegExp(dr)))throw new Error("Invalid RHS");i.match(RegExp(qr,"g"))?.forEach(a=>{if(a==="...")this.outputDims=this.outputDims.concat(this.ellipsisDims);else{let s=this.symbolToInfo.get(a);if(s===void 0)throw new Error("Invalid RHS symbol");this.outputDims.push(s.dimValue)}}),this.rhs=this.processTerm(i,!1,this.outputDims)}addSymbol(e,t,r){let i=this.symbolToInfo.get(e);if(i!==void 0){if(i.dimValue!==t&&i.count!==1)throw new Error("Dimension mismatch");i.count++,i.inputIndices.push(r)}else i={count:1,dimValue:t,inputIndices:[r]};this.symbolToInfo.set(e,i)}processTerm(e,t,r,i=-1){let a=r.length,s=!1,n=[],u=0;if(!e.match(RegExp($a))&&!t&&e!=="")throw new Error("Invalid LHS term");let l=e.match(RegExp(qr,"g")),p=new Fl(i);return l?.forEach((h,c)=>{if(h==="..."){if(s)throw new Error("Only one ellipsis is allowed per input term");s=!0;let g=a-l.length+1;if(g<0)throw new Error("Ellipsis out of bounds");if(n=r.slice(u,u+g),this.hasEllipsis){if(this.ellipsisDims.length!==n.length||this.ellipsisDims.toString()!==n.toString())throw new Error("Ellipsis dimensions mismatch")}else if(t)this.hasEllipsis=!0,this.ellipsisDims=n;else throw new Error("Ellipsis must be specified in the LHS");for(let _=0;_<n.length;_++){let y=String.fromCharCode(48+_);p.addSymbol(y,c+_),this.addSymbol(y,r[u++],i)}}else p.addSymbol(h,c+(this.hasEllipsis?this.ellipsisDims.length-1:0)),this.addSymbol(h,r[u++],i)}),p}},va=e=>e+"_max",Kl=(e,t,r,i)=>{let a=e.map(p=>p.length).map((p,h)=>B(`input${h}`,t,p)),s=O.size(i),n=G("output",t,i.length),u=[...r.symbolToInfo.keys()].filter(p=>!r.rhs.symbolToIndices.has(p)),l=p=>{let h=[],c="var prod = 1.0;",g="var sum = 0.0;",_="sum += prod;",y=[],$=[],S=[],x=[],b=r.symbolToInfo.size===r.rhs.symbolToIndices.size;r.symbolToInfo.forEach((k,I)=>{if(r.rhs.symbolToIndices.has(I)){let z=r.rhs.symbolToIndices.get(I)?.[0];z!==void 0&&r.lhs.forEach((A,v)=>{if(k.inputIndices.includes(v)){let D=A.symbolToIndices.get(I);if(D===void 0)throw new Error("Invalid symbol error");D.forEach(q=>{h.push(`${a[v].indicesSet(`input${v}Indices`,q,n.indicesGet("outputIndices",z))}`)})}})}else r.lhs.forEach((z,A)=>{if(k.inputIndices.includes(A)){let v=z.symbolToIndices.get(I);if(v===void 0)throw new Error("Invalid symbol error");v.forEach(D=>{y.push(`${a[A].indicesSet(`input${A}Indices`,D,`${I}`)}`)}),x.push(`prod *= ${a[A].getByIndices(`input${A}Indices`)};`)}}),$.push(`for(var ${I}: u32 = 0; ${I} < uniforms.${va(I)}; ${I}++) {`),S.push("}")});let E=b?[...h,`let sum = ${a.map((k,I)=>k.getByIndices(`input${I}Indices`)).join(" * ")};`]:[...h,g,...$,...y,c,...x,_,...S];return`
            ${p.registerUniforms(u.map(k=>({name:`${va(k)}`,type:"u32"}))).registerUniform("outputSize","u32").declareVariables(...a,n)}

            ${p.mainStart()}
            ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
            var outputIndices = ${n.offsetToIndices("global_idx")};
            ${a.map((k,I)=>`var input${I}Indices: ${a[I].type.indices};`).join(`
`)}
            ${E.join(`
`)};
            ${n.setByOffset("global_idx","sum")};
          }`};return{name:"Einsum",shaderCache:{hint:r.equation,inputDependencies:e.map(()=>"rank")},getRunData:()=>{let p=u.filter(c=>r.symbolToInfo.has(c)).map(c=>({type:12,data:r.symbolToInfo.get(c)?.dimValue||0}));p.push({type:12,data:s});let h=e.map((c,g)=>[...Z(c)]).reduce((c,g)=>c.concat(g),p);return h.push(...Z(i)),{outputs:[{dims:i,dataType:t}],dispatchGroup:{x:Math.ceil(s/64)},programUniforms:h}},getShaderSource:l}},Zl=(e,t)=>{let r=new jl(e.inputs,t.equation),i=r.outputDims,a=e.inputs.map((s,n)=>s.dims);e.compute(Kl(a,e.inputs[0].dataType,r,i))},Xl=e=>{let t=e.equation.replace(/\s+/g,"");return he({equation:t})}}),Ql,xa,Yl,Jl,ed,jm=P(()=>{"use strict";ee(),ie(),ae(),Ql=e=>{if(!e||e.length!==2)throw new Error("Expand requires 2 input.");let t=e[0].dims,r=Array.from(e[1].getBigInt64Array(),Number),i=r.length<t.length?0:r.length-t.length,a=t.length<r.length?0:t.length-r.length;for(;i<r.length&&a<t.length;++i,++a)if(r[i]!==t[a]&&r[i]!==1&&t[a]!==1)throw new Error("Expand requires shape to be broadcastable to input")},xa=(e,t)=>{let r=e.length-t.length,i=[];for(let a=0;a<r;++a)i.push(e[a]);for(let a=0;a<t.length;++a)i.push(t[a]===1?e[a+r]:t[a]);return i},Yl=(e,t)=>e.length>t.length?xa(e,t):xa(t,e),Jl=e=>{let t=e[0].dims,r=Array.from(e[1].getBigInt64Array(),Number),i=Yl(t,r),a=e[0].dataType,s=a===9||O.size(t)===1,n=a===9||t.length>0&&t[t.length-1]%4===0?4:1,u=s||i.length>0&&i[i.length-1]%4===0?4:1,l=Math.ceil(O.size(i)/u),p=c=>{let g=B("input",a,t.length,n),_=G("output",a,i.length,u),y;if(a===9){let $=(S,x,b="")=>`
          let outputIndices${x} = ${_.offsetToIndices(`outputOffset + ${x}u`)};
          let offset${x} = ${g.broadcastedIndicesToOffset(`outputIndices${x}`,_)};
          let index${x} = offset${x} / 4u;
          let component${x} = offset${x} % 4u;
          ${S}[${x}] = ${b}(${g.getByOffset(`index${x}`)}[component${x}]);
        `;y=`
        let outputOffset = global_idx * ${u};
        var data = vec4<u32>(0);
        ${$("data",0,"u32")}
        ${$("data",1,"u32")}
        ${$("data",2,"u32")}
        ${$("data",3,"u32")}
        ${_.setByOffset("global_idx","data")}
      }`}else y=`
        let outputIndices = ${_.offsetToIndices(`global_idx * ${u}`)};
        let inputOffset = ${g.broadcastedIndicesToOffset("outputIndices",_)};
        let data = ${_.type.value}(${g.getByOffset(`inputOffset / ${n}`)});
        ${_.setByOffset("global_idx","data")}
      }`;return`
    ${c.registerUniform("vec_size","u32").declareVariables(g,_)}
    ${c.mainStart()}
    ${c.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
    ${y}`},h=[{type:12,data:l},...Z(t,i)];return{name:"Expand",shaderCache:{hint:`${i.length};${n}${u}`,inputDependencies:["rank"]},getShaderSource:p,getRunData:()=>({outputs:[{dims:i,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(l/64)},programUniforms:h})}},ed=e=>{Ql(e.inputs),e.compute(Jl(e.inputs),{inputs:[0]})}}),td,rd,Km=P(()=>{"use strict";ee(),ie(),ae(),ea(),td=e=>{let t=e[0].dataType,r=O.size(e[0].dims),i=O.size(e[1].dims),a=i%4===0,s=n=>{let u=B("x",t,[1],4),l=B("bias",t,[1],4),p=G("y",t,[1],4),h=[{name:"output_vec_size",type:"u32"},{name:"bias_size",type:"u32"}],c=_=>`
      let bias${_}_offset: u32 = (global_idx * 4 + ${_}) % uniforms.bias_size;
      let bias${_} = ${l.getByOffset(`bias${_}_offset / 4`)}[bias${_}_offset % 4];`,g=a?`
      let bias = ${l.getByOffset("global_idx % (uniforms.bias_size / 4)")};`:`${c(0)}${c(1)}${c(2)}${c(3)}
      let bias = ${u.type.value}(bias0, bias1, bias2, bias3);`;return`${n.registerUniforms(h).declareVariables(u,l,p)}

    ${Yi(ze(t))}

    ${n.mainStart(Ft)}
      ${n.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_vec_size")}

      let x = ${u.getByOffset("global_idx")};
      ${g}
      let x_in = x + bias;
      ${p.setByOffset("global_idx",Ji("x_in"))}
    }`};return{name:"FastGeluWithBias",shaderCache:{hint:`${a}`,inputDependencies:["type","type"]},getShaderSource:s,getRunData:n=>({outputs:[{dims:n[0].dims,dataType:n[0].dataType}],programUniforms:[{type:12,data:Math.ceil(r/4)},{type:12,data:i}],dispatchGroup:{x:Math.ceil(r/Ft/4)}})}},rd=e=>{e.inputs.length<2||O.size(e.inputs[1].dims)===0?Eu(e):e.compute(td(e.inputs))}}),id,ad,nd,sd,Zm=P(()=>{"use strict";ee(),ie(),Se(),ae(),id=e=>{if(!e||e.length!==2)throw new Error("Gather requires 2 inputs.")},ad=(e,t)=>{let r=e[0].dims,i=e[1].dims,a=r.length,s=O.normalizeAxis(t.axis,a),n=r.slice(0);n.splice(s,1,...i);let u=r[s],l=e[0].dataType===9?4:1,p=Math.ceil(O.size(n)/l),h=[{type:12,data:p},{type:6,data:u},{type:12,data:s},...Z(e[0].dims,e[1].dims,n)],c=g=>{let _=B("data",e[0].dataType,e[0].dims.length,l),y=B("inputIndices",e[1].dataType,e[1].dims.length),$=G("output",e[0].dataType,n.length,l),S=b=>{let E=i.length,k=`var indicesIndices${b}  = ${y.type.indices}(0);`;for(let I=0;I<E;I++)k+=`${E>1?`indicesIndices${b}[${I}]`:`indicesIndices${b}`} = ${n.length>1?`outputIndices${b}[uniforms.axis + ${I}]`:`outputIndices${b}`};`;k+=`
          var idx${b} = ${y.getByIndices(`indicesIndices${b}`)};
          if (idx${b} < 0) {
            idx${b} = idx${b} + uniforms.axisDimLimit;
          }
          var dataIndices${b} : ${_.type.indices};
        `;for(let I=0,z=0;I<a;I++)I===s?(k+=`${a>1?`dataIndices${b}[${I}]`:`dataIndices${b}`} = u32(idx${b});`,z+=E):(k+=`${a>1?`dataIndices${b}[${I}]`:`dataIndices${b}`} = ${n.length>1?`outputIndices${b}[${z}]`:`outputIndices${b}`};`,z++);return k},x;if(e[0].dataType===9){let b=(E,k,I="")=>`
          let outputIndices${k} = ${$.offsetToIndices(`outputOffset + ${k}u`)};
          ${S(k)};
          let offset${k} = ${_.indicesToOffset(`dataIndices${k}`)};
          let index${k} = offset${k} / 4u;
          let component${k} = offset${k} % 4u;
          ${E}[${k}] = ${I}(${_.getByOffset(`index${k}`)}[component${k}]);
        `;x=`
        let outputOffset = global_idx * ${l};
        var value = vec4<u32>(0);
        ${b("value",0,"u32")}
        ${b("value",1,"u32")}
        ${b("value",2,"u32")}
        ${b("value",3,"u32")}
        ${$.setByOffset("global_idx","value")}
      `}else x=`
      let outputIndices = ${$.offsetToIndices("global_idx")};
      ${S("")};
      let value = ${_.getByIndices("dataIndices")};
      ${$.setByOffset("global_idx","value")};
      `;return`
      ${g.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(_,y,$)}
      ${g.mainStart()}
        ${g.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        ${x}
      }`};return{name:"Gather",shaderCache:{hint:t.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:n,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(p/64)},programUniforms:h}),getShaderSource:c}},nd=e=>he({axis:e.axis}),sd=(e,t)=>{let r=e.inputs;id(r),e.compute(ad(e.inputs,t))}}),od,ud,ld,Xm=P(()=>{"use strict";ee(),ie(),ae(),od=(e,t,r,i,a,s,n,u,l)=>{let p=[{type:12,data:s},{type:12,data:i},{type:12,data:a},{type:12,data:r},{type:12,data:n},{type:12,data:u},{type:12,data:l}],h=[s];p.push(...Z(t.dims,h));let c=g=>{let _=B("indices_data",t.dataType,t.dims.length),y=G("input_slice_offsets_data",12,1,1),$=[_,y],S=[{name:"output_size",type:"u32"},{name:"batch_dims",type:"u32"},{name:"input_dims",type:"u32",length:a.length},{name:"sizes_from_slice_dims_data",type:"u32",length:r.length},{name:"num_slices_per_batch",type:"u32"},{name:"input_batch_stride",type:"u32"},{name:"num_slice_dims",type:"u32"}];return`
  ${g.registerUniforms(S).declareVariables(...$)}
  ${g.mainStart()}
    ${g.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let batch_idx = global_idx / uniforms.num_slices_per_batch;
    let base_offset = batch_idx * uniforms.input_batch_stride;

    let slice_indices_base_offset = global_idx * uniforms.num_slice_dims;
    var relative_slice_offset = 0;
    for (var dim_idx = 0u; dim_idx < uniforms.num_slice_dims; dim_idx ++) {
      var index = i32(indices_data[dim_idx + slice_indices_base_offset].x);
      let input_dim_idx = uniforms.batch_dims + dim_idx;
      if (index < 0) {
        ${a.length===1?"index += i32(uniforms.input_dims);":"index += i32(uniforms.input_dims[input_dim_idx]);"}
      }
      ${r.length===1?"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data);":"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data[dim_idx]);"}
    }

    input_slice_offsets_data[global_idx] =  base_offset + u32(relative_slice_offset);
  }`};return e.compute({name:"computeSliceOffsets",shaderCache:{hint:`${a.length}_${r.length}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:h,dataType:e.inputs[1].dataType}],dispatchGroup:{x:Math.ceil(s/64)},programUniforms:p}),getShaderSource:c},{inputs:[t],outputs:[-1]})[0]},ud=(e,t)=>{let r=e.inputs,i=r[0].dims,a=r[0].dataType,s=r[1].dims,n=s[s.length-1],u=O.sizeToDimension(s,s.length-1),l=O.sizeFromDimension(i,t.batchDims+n),p=O.sizeToDimension(i,t.batchDims),h=O.sizeFromDimension(i,t.batchDims),c=u/p,g=new Array(n),_=l;for(let k=0;k<n;++k)g[n-1-k]=_,_*=i[t.batchDims+n-1-k];let y=od(e,r[1],g,t.batchDims,i,u,c,h,n),$=t.batchDims+n;if($>i.length)throw new Error("last dimension of indices must not be larger than rank of input tensor");let S=s.slice(0,-1).concat(i.slice($)),x=O.size(S),b=[{type:12,data:x},{type:12,data:l},...Z(r[0].dims,y.dims,S)],E=k=>{let I=B("data",r[0].dataType,r[0].dims.length),z=B("slice_offsets",12,y.dims.length),A=G("output",r[0].dataType,S.length);return`
          ${k.registerUniform("output_size","u32").registerUniform("slice_size","u32").declareVariables(I,z,A)}
            ${k.mainStart()}
            ${k.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let slice_offset = slice_offsets[global_idx / uniforms.slice_size];
          output[global_idx] = data[u32(slice_offset) + global_idx % uniforms.slice_size];
        }`};e.compute({name:"GatherND",shaderCache:{hint:t.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:S,dataType:a}],dispatchGroup:{x:Math.ceil(x/64)},programUniforms:b}),getShaderSource:E},{inputs:[r[0],y]})},ld=e=>({batchDims:e.batch_dims,cacheKey:""})}),dd,pd,cd,hd,Qm=P(()=>{"use strict";ee(),ie(),Se(),ae(),dd=(e,t)=>{if(e.length<3||e.length>4)throw new Error("GatherBlockQuantized requires 3 or 4 inputs.");let r=O.normalizeAxis(t.quantizeAxis,e[0].dims.length),i=t.blockSize,a=e[0],s=e[2],n=e.length===4?e[3]:void 0;if(s.dims.length!==a.dims.length||!a.dims.map((u,l)=>l===r?Math.ceil(u/i)===s.dims[l]:u===s.dims[l]).reduce((u,l)=>u&&l,!0))throw new Error("Scales must have the same rank as the input tensor and the dims should match except on gatherAxis.");if(n){if(n.dataType!==a.dataType)throw new Error("Zero point must have the same data type as the input tensor.");if(n.dims.length!==s.dims.length||!n.dims.map((u,l)=>u===s.dims[l]).reduce((u,l)=>u&&l,!0))throw new Error("Zero point must have the same rank as the input tensor and the dims should match except on quantizeAxis.")}},pd=(e,t)=>{let r=e[0].dims,i=e[1].dims,a=r.length,s=O.normalizeAxis(t.gatherAxis,a),n=O.normalizeAxis(t.quantizeAxis,a),u=r.slice(0);u.splice(s,1,...i);let l=O.size(u),p=e[2].dataType,h=e[0].dataType===22,c=[{type:12,data:l},{type:12,data:n},{type:12,data:s},{type:12,data:t.blockSize},...Z(...e.map((_,y)=>_.dims),u)],g=_=>{let y=B("data",e[0].dataType,e[0].dims.length),$=B("inputIndices",e[1].dataType,e[1].dims.length),S=B("scales",e[2].dataType,e[2].dims.length),x=e.length>3?B("zeroPoint",e[3].dataType,e[3].dims.length):void 0,b=G("output",p,u.length),E=[y,$,S];x&&E.push(x);let k=[{name:"output_size",type:"u32"},{name:"quantize_axis",type:"u32"},{name:"gather_axis",type:"u32"},{name:"block_size",type:"u32"}];return`
        ${_.registerUniforms(k).declareVariables(...E,b)}
        ${_.mainStart()}
        let output_indices = ${b.offsetToIndices("global_idx")};
        var indices_indices = ${$.type.indices}(0);
        ${i.length>1?`
          for (var i: u32 = 0; i < ${i.length}; i++) {
            let index = ${b.indicesGet("output_indices","uniforms.gather_axis + i")};
            ${$.indicesSet("indices_indices","i","index")};
          }`:`indices_indices = ${b.indicesGet("output_indices","uniforms.gather_axis")};`};
        var data_indices = ${y.type.indices}(0);
        for (var i: u32 = 0; i < uniforms.gather_axis; i++) {
          let index = ${b.indicesGet("output_indices","i")};
          ${y.indicesSet("data_indices","i","index")};
        }
        var index_from_indices = ${$.getByIndices("indices_indices")};
        if (index_from_indices < 0) {
          index_from_indices += ${r[s]};
        }
        ${y.indicesSet("data_indices","uniforms.gather_axis","u32(index_from_indices)")};
        for (var i = uniforms.gather_axis + 1; i < ${u.length}; i++) {
          let index = ${b.indicesGet("output_indices",`i + ${i.length} - 1`)};
          ${y.indicesSet("data_indices","i","index")};
        }
        let data_offset = ${y.indicesToOffset("data_indices")};
        let data_index = data_offset % 8;
        // Convert 4-bit packed data to 8-bit packed data.
        let packed_4bit_quantized_data = ${y.getByOffset("data_offset / 8")};
        let packed_8bit_quantized_data = (packed_4bit_quantized_data >> (4 * (data_index % 2))) & 0x0f0f0f0f;
        let quantized_data_vec = ${h?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_quantized_data));
        let quantized_data = quantized_data_vec[data_index / 2];
        var scale_indices = data_indices;
        let quantize_axis_index = ${S.indicesGet("data_indices","uniforms.quantize_axis")} / uniforms.block_size;
        ${S.indicesSet("scale_indices","uniforms.quantize_axis","quantize_axis_index")};
        var scale = ${S.getByIndices("scale_indices")};
        ${x?`
              let zero_point_indices = scale_indices;
              let zero_point_offset = ${x.indicesToOffset("zero_point_indices")};
              let zero_point_index = zero_point_offset % 8;
              let packed_4bit_zero_points = ${x.getByOffset("zero_point_offset / 8")};
              let packed_8bit_zero_points = (packed_4bit_zero_points >> (4 * (zero_point_index % 2))) & 0x0f0f0f0f;
              let zero_point_vec = ${h?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_zero_points));
              let zero_point = zero_point_vec[zero_point_index / 2];`:"var zero_point = 0"};
        let dequantized_data = ${ze(p)}(quantized_data - zero_point) * scale;
        ${b.setByOffset("global_idx","dequantized_data")};
    }`};return{name:"GatherBlockQuantized",shaderCache:{hint:`${t.cacheKey};${e.filter((_,y)=>y!==1).map(_=>_.dims.join("_")).join(";")}`,inputDependencies:Array.from({length:e.length},(_,y)=>"rank")},getRunData:()=>({outputs:[{dims:u,dataType:p}],dispatchGroup:{x:Math.ceil(l/64)},programUniforms:c}),getShaderSource:g}},cd=(e,t)=>{let r=e.inputs;dd(r,t),e.compute(pd(e.inputs,t))},hd=e=>he({blockSize:e.blockSize,gatherAxis:e.gatherAxis,quantizeAxis:e.quantizeAxis})}),fd,md,gd,yd,Ym=P(()=>{"use strict";ee(),ie(),Se(),ae(),fd=e=>{if(!e||e.length!==2)throw new Error("GatherElements requires 2 inputs.");if(e[0].dims.length<1)throw new Error("GatherElements requires that the data input be rank >= 1.");if(e[0].dims.length!==e[1].dims.length)throw new Error(`GatherElements requires that the data input and
                     indices input tensors be of same rank.`)},md=(e,t)=>{let r=e[0].dims,i=e[0].dataType,a=r.length,s=e[1].dims,n=e[1].dataType,u=O.normalizeAxis(t.axis,a),l=r[u],p=s.slice(0),h=O.size(p),c=B("input",i,a),g=B("indicesInput",n,s.length),_=G("output",i,p.length),y=[{type:12,data:h},{type:6,data:l},{type:12,data:u}];return y.push(...Z(r,s,p)),{name:"GatherElements",shaderCache:{inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:p,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(h/64)},programUniforms:y}),getShaderSource:$=>`
      ${$.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(c,g,_)}
      ${$.mainStart()}
      ${$.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

      let outputIndices = ${_.offsetToIndices("global_idx")};

      var idx = ${g.getByOffset("global_idx")};
      if (idx < 0) {
        idx = idx + uniforms.axisDimLimit;
      }
      var inputIndices = ${c.type.indices}(outputIndices);
      ${c.indicesSet("inputIndices","uniforms.axis","u32(idx)")};
      let value = ${c.getByIndices("inputIndices")};

      ${_.setByOffset("global_idx","value")};
  }`}},gd=e=>he({axis:e.axis}),yd=(e,t)=>{let r=e.inputs;fd(r),e.compute(md(e.inputs,t))}}),_d,bd,wd,$d,Jm=P(()=>{"use strict";ee(),ie(),ae(),_d=e=>{if(!e)throw new Error("Input is missing");if(e.length<2||e.length>3)throw new Error("Invaid input number.");if(e.length===3&&e[2].dims.length>2)throw new Error("Invalid input shape of C");if(e[0].dataType!==e[1].dataType||e.length===3&&e[0].dataType!==e[2].dataType)throw new Error("Input types are mismatched")},bd=(e,t)=>{let r=e[0].dims.slice(),i=e[1].dims.slice(),[a,s,n]=bs.getShapeOfGemmResult(r,t.transA,i,t.transB,e.length===3?e[2].dims:void 0),u=[a,s];if(!u)throw new Error("Can't use gemm on the given tensors");let l=16,p=Math.ceil(s/l),h=Math.ceil(a/l),c=!0,g=O.size(u),_=[{type:12,data:c?p:g},{type:12,data:a},{type:12,data:s},{type:12,data:n},{type:1,data:t.alpha},{type:1,data:t.beta}],y=["type","type"];e.length===3&&(_.push(...Z(e[2].dims)),y.push("rank")),_.push(...Z(u));let $=x=>{let b="";t.transA&&t.transB?b="value += a[k * uniforms.M + m] * b[n * uniforms.K + k];":t.transA&&!t.transB?b="value += a[k * uniforms.M + m] * b[k * uniforms.N + n];":!t.transA&&t.transB?b="value += a[m * uniforms.K + k] * b[n * uniforms.K + k];":!t.transA&&!t.transB&&(b="value += a[m * uniforms.K + k] * b[k * uniforms.N + n];");let E=t.alpha===1?"":"value *= uniforms.alpha;",k=B("a",e[0].dataType,e[0].dims),I=B("b",e[1].dataType,e[1].dims),z=k.type.value,A=null,v=[k,I];e.length===3&&(A=B("c",e[2].dataType,e[2].dims.length),v.push(A));let D=G("output",e[0].dataType,u.length);v.push(D);let q=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}];return`
  ${x.registerUniforms(q).declareVariables(...v)}

  ${x.mainStart()}
    ${x.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let m = global_idx / uniforms.N;
    let n = global_idx % uniforms.N;

    var value = ${z}(0);
    for (var k: u32 = 0u; k < uniforms.K; k++) {
      ${b}
    }

    ${E}
    ${A!=null?`let cOffset = ${A.broadcastedIndicesToOffset("vec2(m, n)",D)}; value += ${z}(uniforms.beta) * ${A.getByOffset("cOffset")};`:""}
    output[global_idx] = value;
  }`},S=x=>{let b=B("a",e[0].dataType,e[0].dims),E=B("b",e[1].dataType,e[1].dims),k=null,I=[b,E];e.length===3&&(k=B("c",e[2].dataType,e[2].dims.length),I.push(k));let z=G("output",e[0].dataType,u.length);I.push(z);let A=[{name:"num_tile_n",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}],v="",D="";t.transA&&t.transB?(D=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${b.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${E.type.value}(0);
      }
      `,v="value += tile_a[k][local_id.y] * tile_b[local_id.x][k];"):t.transA&&!t.transB?(D=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${b.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${E.type.value}(0);
      }
      `,v="value += tile_a[k][local_id.y] * tile_b[k][local_id.x];"):!t.transA&&t.transB?(D=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${b.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${E.type.value}(0);
      }
      `,v="value += tile_a[local_id.y][k] * tile_b[local_id.x][k];"):!t.transA&&!t.transB&&(D=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${b.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${E.type.value}(0);
      }
      `,v="value += tile_a[local_id.y][k] * tile_b[k][local_id.x];");let q=t.alpha===1?"":"value *= uniforms.alpha;";return`
  ${x.registerUniforms(A).declareVariables(...I)}
  var<workgroup> tile_a: array<array<${b.type.storage}, ${l}>, ${l}>;
  var<workgroup> tile_b: array<array<${E.type.storage}, ${l}>, ${l}>;
  ${x.mainStart([l,l,1])}
    let tile_col_start = (workgroup_index % uniforms.num_tile_n) * ${l};
    let tile_row_start = (workgroup_index / uniforms.num_tile_n) * ${l};
    let num_tiles = (uniforms.K - 1) / ${l} + 1;
    var k_start = 0u;
    var value = ${z.type.value}(0);
    for (var t: u32 = 0u; t < num_tiles; t++) {
      ${D}
      k_start = k_start + ${l};
      workgroupBarrier();

      for (var k: u32 = 0u; k < ${l}; k++) {
        ${v}
      }
      workgroupBarrier();
    }

    ${q}
    let m = tile_row_start + local_id.y;
    let n = tile_col_start + local_id.x;
    ${k!=null?`let cOffset = ${k.broadcastedIndicesToOffset("vec2(m, n)",z)}; value += ${z.type.value}(uniforms.beta) * ${k.getByOffset("cOffset")};`:""}
    if (m < uniforms.M && n < uniforms.N) {
      output[m * uniforms.N + n] = value;
    }
  }`};return c?{name:"GemmShared",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:y},getRunData:()=>({outputs:[{dims:u,dataType:e[0].dataType}],dispatchGroup:{x:p*h},programUniforms:_}),getShaderSource:S}:{name:"Gemm",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:y},getRunData:()=>({outputs:[{dims:u,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(g/64)},programUniforms:_}),getShaderSource:$}},wd=e=>{let t=e.transA,r=e.transB,i=e.alpha,a=e.beta;return{transA:t,transB:r,alpha:i,beta:a,cacheKey:`${e.transA};${e.transB};${e.alpha===1}`}},$d=(e,t)=>{_d(e.inputs),e.compute(bd(e.inputs,t))}}),Ye,st,Bt,Nt,vd,xd,Sd,kd,Td,Id,Ed,zd,Cd,Ad,eg=P(()=>{"use strict";ee(),ie(),Se(),ae(),[Ye,st,Bt,Nt]=[0,1,2,3],vd=e=>{if(e[0].dims.length!==4)throw new Error("only 4-D tensor is supported.");if(e[0].dims.length!==e[1].dims.length)throw new Error("input dimensions must be equal to grid dimensions");if(e[0].dims.length-2!==e[1].dims[e[1].dims.length-1])throw new Error(`last dimension of grid must be equal to ${e[0].dims.length-2}`);if(e[0].dims[0]!==e[1].dims[0])throw new Error("grid batch size must match input batch size")},xd=`
  fn gs_get_cubic_coeffs(x: f32) -> vec4<f32> {
    let cubic_alpha = -0.75f;
    let x_abs = abs(x);
    var coeffs: vec4<f32>;
    coeffs[0] = (((cubic_alpha * (x_abs + 1) - 5 * cubic_alpha) * (x_abs + 1) + 8 * cubic_alpha) * (x_abs + 1) - 4 * cubic_alpha);
    coeffs[1] = (((cubic_alpha + 2) * x_abs - (cubic_alpha + 3)) * x_abs * x_abs + 1);
    coeffs[2] = (((cubic_alpha + 2) * (1 - x_abs) - (cubic_alpha + 3)) * (1 - x_abs) * (1 - x_abs) + 1);
    coeffs[3] = (((cubic_alpha * (2 - x_abs) - 5 * cubic_alpha) * (2 - x_abs) + 8 * cubic_alpha) * (2 - x_abs) - 4 * cubic_alpha);
    return coeffs;
  }
`,Sd=e=>`
  fn gs_bicubic_interpolate(p: mat4x4<${e}>, x: f32, y: f32) -> ${e} {
    var v: vec4<f32>;
    var coeffs = gs_get_cubic_coeffs(x);
    for (var i = 0; i < 4; i++) {
      v[i] = coeffs[0] * p[i][0] + coeffs[1] * p[i][1] + coeffs[2] * p[i][2] + coeffs[3] * p[i][3];
    }
    coeffs = gs_get_cubic_coeffs(y);
    let pixel = ${e}(coeffs[0] * v[0] + coeffs[1] * v[1] + coeffs[2] * v[2] + coeffs[3] * v[3]);
    return pixel;
  }
`,kd=e=>`
  fn gs_denormalize(n: f32, length: i32) -> f32 {
    ${e.alignCorners===0?`
    // alignCorners: false => [-1, 1] to [-0.5, length - 0.5]
    return ((n + 1.0) * f32(length) - 1.0) / 2.0;
    `:`
    // alignCorners: true => [-1, 1] to [0, length - 1]
    return (n + 1.0) / 2.0 * (f32(length - 1));
    `}
  }
`,Td=e=>`
  ${e.paddingMode==="reflection"?`
      fn gs_reflect(x: i32, x_min: f32, x_max: f32) -> u32 {
        var dx = 0.0;
        var fx = f32(x);
        let range = x_max - x_min;
        if (fx < x_min) {
          dx = x_min - fx;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_min + r;
          } else {
            fx = x_max - r;
          }
        } else if (fx > x_max) {
          dx = fx - x_max;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_max - r;
          } else {
            fx = x_min + r;
          }
        }
        return u32(fx);
      }`:""}
`,Id=(e,t,r)=>`
  fn pixel_at_grid(r: i32, c: i32, H: i32, W: i32, batch: u32, channel: u32, border: vec4<f32>) -> ${t} {
     var pixel = ${t}(0);
     var indices = vec4<u32>(0);
     indices[${Ye}] = batch;
     indices[${st}] = channel;`+(()=>{switch(r.paddingMode){case"zeros":return`
          if (r >= 0 && r < H && c >=0 && c < W) {
            indices[${Bt}] = u32(r);
            indices[${Nt}] = u32(c);
          } else {
            return ${t}(0);
          }
        `;case"border":return`
          indices[${Bt}] = u32(clamp(r, 0, H - 1));
          indices[${Nt}] = u32(clamp(c, 0, W - 1));
        `;case"reflection":return`
          indices[${Bt}] = gs_reflect(r, border[1], border[3]);
          indices[${Nt}] = gs_reflect(c, border[0], border[2]);
        `;default:throw new Error(`padding mode ${r.paddingMode} is not supported`)}})()+`
    return ${e.getByIndices("indices")};
  }
`,Ed=(e,t,r)=>(()=>{switch(r.mode){case"nearest":return`
          let result = pixel_at_grid(i32(round(y)), i32(round(x)), H_in, W_in, indices[${Ye}], indices[${st}], border);
        `;case"bilinear":return`
          let x1 = i32(floor(x));
          let y1 = i32(floor(y));
          let x2 = x1 + 1;
          let y2 = y1 + 1;

          let p11 = pixel_at_grid(y1, x1, H_in, W_in, indices[${Ye}], indices[${st}], border);
          let p12 = pixel_at_grid(y1, x2, H_in, W_in, indices[${Ye}], indices[${st}], border);
          let p21 = pixel_at_grid(y2, x1, H_in, W_in, indices[${Ye}], indices[${st}], border);
          let p22 = pixel_at_grid(y2, x2, H_in, W_in, indices[${Ye}], indices[${st}], border);

          let dx2 = ${t}(f32(x2) - x);
          let dx1 = ${t}(x - f32(x1));
          let dy2 = ${t}(f32(y2) - y);
          let dy1 = ${t}(y - f32(y1));
          let result = dy2 * (dx2 * p11 + dx1 * p12) + dy1 * (dx2 * p21 + dx1 * p22);
        `;case"bicubic":return`
          let x0 = i32(floor(x)) - 1;
          let y0 = i32(floor(y)) - 1;
          var p: mat4x4<${t}>;
          for (var h = 0; h < 4; h++) {
            for (var w = 0; w < 4; w++) {
              p[h][w] = pixel_at_grid(h + y0, w + x0, H_in, W_in, indices[${Ye}], indices[${st}], border);
            }
          }

          let dx = x - f32(x0 + 1);
          let dy = y - f32(y0 + 1);
          let result = gs_bicubic_interpolate(p, dx, dy);
        `;default:throw new Error(`mode ${r.mode} is not supported`)}})()+`${e.setByOffset("global_idx","result")}`,zd=(e,t)=>{let r=B("x",e[0].dataType,e[0].dims.length),i=[e[1].dims[0],e[1].dims[1],e[1].dims[2]],a=B("grid",e[1].dataType,i.length,2),s=[e[0].dims[0],e[0].dims[1],e[1].dims[1],e[1].dims[2]];t.format==="NHWC"&&(s=[e[0].dims[0],e[1].dims[1],e[1].dims[2],e[0].dims[3]],[Ye,st,Bt,Nt]=[0,3,1,2]);let n=G("output",e[0].dataType,s.length),u=r.type.value,l=O.size(s),p=[{type:12,data:l},...Z(e[0].dims,i,s)],h=c=>`
  ${c.registerUniform("output_size","u32").declareVariables(r,a,n)}
  ${xd}
  ${Sd(u)}
  ${kd(t)}
  ${Td(t)}
  ${Id(r,u,t)}

  ${c.mainStart()}
    ${c.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let H_in = i32(uniforms.x_shape[${Bt}]);
      let W_in = i32(uniforms.x_shape[${Nt}]);

      ${t.alignCorners===0?`
      let x_min = -0.5;
      let x_max = f32(W_in) - 0.5;
      let y_min = -0.5;
      let y_max = f32(H_in) - 0.5;
      `:`
      let x_min = 0.0;
      let x_max = f32(W_in) - 1.0;
      let y_min = 0.0;
      let y_max = f32(H_in) - 1.0;
      `};
      let border = vec4<f32>(x_min, y_min, x_max, y_max);

      let indices = ${n.offsetToIndices("global_idx")};
      var grid_indices = vec3<u32>(indices[${Ye}], indices[${Bt}], indices[${Nt}]);
      let nxy = ${a.getByIndices("grid_indices")};
      var x = gs_denormalize(f32(nxy[0]), W_in);
      var y = gs_denormalize(f32(nxy[1]), H_in);

      ${Ed(n,u,t)}
  }`;return{name:"GridSample",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:["type","type"]},getRunData:c=>{let g=O.size(s);return{outputs:[{dims:s,dataType:c[0].dataType}],dispatchGroup:{x:Math.ceil(g/64)},programUniforms:p}},getShaderSource:h}},Cd=(e,t)=>{vd(e.inputs),e.compute(zd(e.inputs,t))},Ad=e=>he({alignCorners:e.align_corners,mode:e.mode,paddingMode:e.padding_mode,format:e.format})}),Be,Od,Rd,Sa,Bd,pr,Nd,Md=P(()=>{"use strict";ee(),ie(),Se(),Pi(),Xi(),ae(),pt(),Be=(e,t)=>e.length>t&&e[t].dims.length>0?e[t]:void 0,Od=(e,t)=>{let r=e[0],i=Be(e,1),a=Be(e,2),s=Be(e,3),n=Be(e,4),u=Be(e,5),l=Be(e,6),p=Be(e,7);if(r.dims.length!==3&&r.dims.length!==5)throw new Error("Input query is expected to have 3 or 5 dimensions");let h=r.dims[0],c=r.dims[1],g=r.dims.length===3?r.dims[2]:t.numHeads*r.dims[4],_=c,y=0,$=0,S=Math.floor(g/t.numHeads);if(l&&p&&O.size(l.dims)&&O.size(p.dims)){if(l.dims.length!==4)throw new Error('Input "past_key" is expected to have 4 dimensions');if(l.dims[0]!==h||l.dims[1]!==t.numHeads||l.dims[3]!==S)throw new Error('Input "past_key" shape (batch_size, num_heads, past_sequence_length, head_size)');if(p.dims[0]!==h||p.dims[1]!==t.numHeads||p.dims[3]!==S)throw new Error('Input "past_value" shape (batch_size, num_heads, past_sequence_length, head_size)');if(l.dims[2]!==p.dims[2])throw new Error('Input "past_key" and "past_value" shall have same dim 2 (past_sequence_length)');if(p.dims.length!==4)throw new Error('Input "past_value" is expected to have 4 dimensions');y=l.dims[2],$=l.dims[2]}else if(l&&O.size(l.dims)||p&&O.size(p.dims))throw new Error('Input "past_key" and "past_value" shall be both present or both absent');let x;if(i&&O.size(i.dims)>0){if(r.dims.length!==3)throw new Error('Input "query" is expected to have 3 dimensions when key is given');if(i.dims.length<3||i.dims.length>5)throw new Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(r.dims[0]!==i.dims[0])throw new Error('Input "query" and "key" shall have same dim 0 (batch size)');if(i.dims.length===3){if(i.dims[2]!==r.dims[2])throw new Error('Input "query" and "key" shall have same dim 2 (hidden_size)');x=2,_=i.dims[1]}else if(i.dims.length===5){if(i.dims[2]!==t.numHeads||i.dims[3]!==2||i.dims[4]!==S)throw new Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(a)throw new Error('Expect "value" be none when "key" has packed kv format.');x=5,_=i.dims[1]}else{if(i.dims[1]!==t.numHeads||i.dims[3]!==S)throw new Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');x=0,_=i.dims[2]}}else{if(r.dims.length!==5)throw new Error('Input "query" is expected to have 5 dimensions when key is empty');if(r.dims[2]!==t.numHeads||r.dims[3]!==3)throw new Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');x=3}if(s&&O.size(s.dims)>0){if(s.dims.length!==1)throw new Error('Input "bias" is expected to have 1 dimension');if(i&&i.dims.length===5&&i.dims[3]===2)throw new Error("bias is not allowed for packed kv.")}let b=y+_,E=0;if(n&&O.size(n.dims)>0){E=8;let A=n.dims;throw A.length===1?A[0]===h?E=1:A[0]===3*h+2&&(E=3):A.length===2&&A[0]===h&&A[1]===b&&(E=5),E===8?new Error('Input "key_padding_mask" shape shall be (batch_size) or (batch_size, total_sequence_length)'):new Error("Mask not supported")}let k=!1,I=g;if(a&&O.size(a.dims)>0){if(a.dims.length!==3&&a.dims.length!==4)throw new Error('Input "value" is expected to have 3 or 4 dimensions');if(r.dims[0]!==a.dims[0])throw new Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(a.dims.length===3){if(_!==a.dims[1])throw new Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');I=a.dims[2]}else{if(_!==a.dims[2])throw new Error('Input "key" and "value" shall have the same dim 2 (kv_sequence_length)');I=a.dims[1]*a.dims[3],k=!0}}let z=!1;if(n&&O.size(n.dims)>0)throw new Error("Key padding mask is not supported");if(u&&O.size(u.dims)>0){if(u.dims.length!==4)throw new Error('Input "attention_bias" is expected to have 4 dimensions');if(u.dims[0]!==h||u.dims[1]!==t.numHeads||u.dims[2]!==c||u.dims[3]!==b)throw new Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:h,sequenceLength:c,pastSequenceLength:y,kvSequenceLength:_,totalSequenceLength:b,maxSequenceLength:$,inputHiddenSize:0,hiddenSize:g,vHiddenSize:I,headSize:S,vHeadSize:Math.floor(I/t.numHeads),numHeads:t.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:t.maskFilterValue,maskType:E,scale:t.scale,broadcastResPosBias:z,passPastInKv:k,qkvFormat:x}},Rd=e=>he({...e}),Sa=he({perm:[0,2,1,3]}),Bd=(e,t,r,i,a,s,n)=>{let u=[i,a,s],l=O.size(u),p=[{type:12,data:l},{type:12,data:n},{type:12,data:s}],h=c=>{let g=G("qkv_with_bias",t.dataType,u),_=B("qkv",t.dataType,u),y=B("bias",r.dataType,u),$=[{name:"output_size",type:"u32"},{name:"bias_offset",type:"u32"},{name:"hidden_size",type:"u32"}];return`
  ${c.registerUniforms($).declareVariables(_,y,g)}
  ${c.mainStart()}
    ${c.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let bias_offset_idx = (global_idx % uniforms.hidden_size) + uniforms.bias_offset;

    qkv_with_bias[global_idx] = qkv[global_idx] + bias[bias_offset_idx];
  }`};return e.compute({name:"MultiHeadAttentionAddBias",shaderCache:{inputDependencies:["type","type"]},getRunData:()=>({outputs:[{dims:u,dataType:t.dataType,gpuDataType:0}],dispatchGroup:{x:Math.ceil(l/64)},programUniforms:p}),getShaderSource:h},{inputs:[t,r],outputs:[-1]})[0]},pr=(e,t,r,i,a,s,n,u)=>{let l=s;if(n&&O.size(n.dims)>0){if(i===1)throw new Error("AddBiasReshape is not implemented. Please export your model with packed QKV or KV");return l=Bd(e,s,n,t,i,r*a,u),l=l.reshape([t,i,r,a]),r===1||i===1?l:e.compute(Ue(l,Sa.perm),{inputs:[l],outputs:[-1]})[0]}else return s.dims.length===3&&(l=s.reshape([t,i,r,a])),r===1||i===1?l:e.compute(Ue(l,Sa.perm),{inputs:[l],outputs:[-1]})[0]},Nd=(e,t)=>{let r=Od(e.inputs,t),i=e.inputs[0],a=Be(e.inputs,1),s=Be(e.inputs,2),n=Be(e.inputs,3),u=Be(e.inputs,4),l=Be(e.inputs,5),p=Be(e.inputs,6),h=Be(e.inputs,7);if(i.dims.length===5)throw new Error("Packed QKV is not implemented");if(a?.dims.length===5)throw new Error("Packed KV is not implemented");let c=a&&s&&a.dims.length===4&&s.dims.length===4,g=pr(e,r.batchSize,r.numHeads,r.sequenceLength,r.headSize,i,n,0);if(c)return nr(e,g,a,s,u,void 0,p,h,l,r);if(!a||!s)throw new Error("key and value must be provided");let _=pr(e,r.batchSize,r.numHeads,r.kvSequenceLength,r.headSize,a,n,r.hiddenSize),y=pr(e,r.batchSize,r.numHeads,r.kvSequenceLength,r.vHeadSize,s,n,2*r.hiddenSize);nr(e,g,_,y,u,void 0,p,h,l,r)}}),Dd,Ud,Pd,qd,ka,Ld,Wd,Vd=P(()=>{"use strict";ee(),ie(),Se(),ae(),Dd=e=>{if(!e||e.length<1)throw new Error("too few inputs")},Ud=(e,t)=>{let r=[],i=t.numOutputs;return e[1].dims[0]>0&&(e[1].getBigInt64Array().forEach(a=>r.push(Number(a))),i=r.length),he({numOutputs:i,axis:t.axis,splitSizes:r})},Pd=e=>`
fn calculateOutputIndex(index: u32) -> u32 {
    for (var i: u32 = 0u; i < ${e}u; i += 1u ) {
    if (index < ${j("uniforms.size_in_split_axis","i",e)}) {
        return i;
    }
    }
    return ${e}u;
}`,qd=e=>{let t=e.length,r=[];for(let i=0;i<t;++i){let a=e[i].setByIndices("indices","input[global_idx]");t===1?r.push(a):i===0?r.push(`if (output_number == ${i}u) { ${a} }`):i===t-1?r.push(`else { ${a} }`):r.push(`else if (output_number == ${i}) { ${a} }`)}return`
      fn writeBufferData(output_number: u32, indices: ${e[0].type.indices}, global_idx: u32) {
        ${r.join(`
`)}
      }`},ka=(e,t)=>{let r=e[0].dims,i=O.size(r),a=e[0].dataType,s=O.normalizeAxis(t.axis,r.length),n=new Array(t.numOutputs),u=B("input",a,r.length),l=new Array(t.numOutputs),p=[],h=[],c=0,g=[{type:12,data:i}];for(let y=0;y<t.numOutputs;y++){c+=t.splitSizes[y],l[y]=c;let $=r.slice();$[s]=t.splitSizes[y],h.push($),n[y]=G(`output${y}`,a,$.length),p.push({dims:h[y],dataType:e[0].dataType})}g.push({type:12,data:l},...Z(r,...h));let _=y=>`
  ${y.registerUniform("input_size","u32").registerUniform("size_in_split_axis","u32",l.length).declareVariables(u,...n)}
  ${Pd(l.length)}
  ${qd(n)}

  ${y.mainStart()}
    ${y.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.input_size")}

    var indices = ${u.offsetToIndices("global_idx")};
    var index = ${u.indicesGet("indices",s)};
    let output_number = calculateOutputIndex(index);
    if (output_number != 0) {
      index -= ${j("uniforms.size_in_split_axis","output_number - 1u",l.length)};
      ${u.indicesSet("indices",s,"index")};
    }
    writeBufferData(output_number, indices, global_idx);
  }`;return{name:"Split",shaderCache:{hint:t.cacheKey,inputDependencies:["rank"]},getShaderSource:_,getRunData:()=>({outputs:p,dispatchGroup:{x:Math.ceil(i/64)},programUniforms:g})}},Ld=(e,t)=>{Dd(e.inputs);let r=e.inputs.length===1?t:Ud(e.inputs,t);e.compute(ka(e.inputs,r),{inputs:[0]})},Wd=e=>{let t=e.axis,r=e.splitSizes,i=e.numOutputs<0?r.length:e.numOutputs;if(i!==r.length)throw new Error("numOutputs and splitSizes length must be equal");return he({axis:t,numOutputs:i,splitSizes:r})}}),Gd,Lr,Hd,Fd=P(()=>{"use strict";ee(),ie(),Se(),ae(),Gd=(e,t)=>{let[r,i,a,s]=e,{numHeads:n,rotaryEmbeddingDim:u}=t;if(r.dims.length!==3&&r.dims.length!==4)throw new Error(`Input 'x' is expected to have 3 or 4 dimensions, got ${r.dims.length}`);if(!O.areEqual(i.dims,[])&&!O.areEqual(i.dims,[1])&&i.dims.length!==2)throw new Error(`Input 'position_ids' is expected to have 0, 1, or 2 dimensions, got ${i.dims.length}`);if(a.dims.length!==2)throw new Error(`Input 'cos_cache' is expected to have 2 dimensions, got ${a.dims.length}`);if(s.dims.length!==2)throw new Error(`Input 'sin_cache' is expected to have 2 dimensions, got ${s.dims.length}`);if(!O.areEqual(a.dims,s.dims))throw new Error("Inputs 'cos_cache' and 'sin_cache' are expected to have the same shape");if(u>0&&n===0)throw new Error("num_heads must be provided if rotary_embedding_dim is specified");let l=r.dims[0],p=r.dims[r.dims.length-2],h=a.dims[0],c=O.sizeFromDimension(r.dims,1)/p,g=u===0?a.dims[1]*2:c/n;if(u>g)throw new Error("rotary_embedding_dim must be less than or equal to head_size");if(i.dims.length===2){if(l!==i.dims[0])throw new Error(`Input 'position_ids' dimension 0 should be of size batch_size, got ${i.dims[0]}`);if(p!==i.dims[1])throw new Error(`Input 'position_ids' dimension 1 should be of size sequence_length, got ${i.dims[1]}`)}if(p>h)throw new Error("Updating cos_cache and sin_cache in RotaryEmbedding is not currently supported");if(g/2!==a.dims[1]&&u/2!==a.dims[1])throw new Error(`Input 'cos_cache' dimension 1 should be same as head_size / 2 or rotary_embedding_dim / 2, got ${a.dims[1]}`)},Lr=(e,t)=>{let{interleaved:r,numHeads:i,rotaryEmbeddingDim:a,scale:s}=t,n=e[0].dims[0],u=O.sizeFromDimension(e[0].dims,1),l=e[0].dims[e[0].dims.length-2],p=u/l,h=e[2].dims[1],c=a===0?h*2:p/i,g=new Array(n,l,p/c,c-h),_=O.computeStrides(g),y=[{type:1,data:s},{type:12,data:g},{type:12,data:_},...e[0].dims.length===3?new Array({type:12,data:[u,p,c,1]}):[],...e[0].dims.length===4?new Array({type:12,data:[u,c,l*c,1]}):[],...Z(e[0].dims,e[1].dims,e[2].dims,e[3].dims,e[0].dims)],$=S=>{let x=B("input",e[0].dataType,e[0].dims.length),b=B("position_ids",e[1].dataType,e[1].dims.length),E=B("cos_cache",e[2].dataType,e[2].dims.length),k=B("sin_cache",e[3].dataType,e[3].dims.length),I=G("output",e[0].dataType,e[0].dims.length);return S.registerUniforms([{name:"scale",type:"f32"},{name:"global_shape",type:"u32",length:g.length},{name:"global_strides",type:"u32",length:_.length},{name:"input_output_strides",type:"u32",length:_.length}]),`
        ${S.declareVariables(x,b,E,k,I)}

        ${S.mainStart(Ft)}
          let half_rotary_emb_dim = uniforms.${E.name}_shape[1];
          let bsnh = global_idx / uniforms.global_strides % uniforms.global_shape;
          let size = uniforms.global_shape[0] * uniforms.global_strides[0];
          ${S.guardAgainstOutOfBoundsWorkgroupSizes("size")}

          if (bsnh[3] < half_rotary_emb_dim) {
            let position_ids_idx =
                ${b.broadcastedIndicesToOffset("bsnh.xy",G("",b.type.tensor,2))};
            let position_id =
                u32(${b.getByOffset("position_ids_idx")}) + select(0, bsnh[1], position_ids_idx == 0);
            let i = dot(bsnh, uniforms.input_output_strides) + select(0, bsnh[3], ${r});
            let j = i + select(half_rotary_emb_dim, 1, ${r});
            let re = ${x.getByOffset("i")} * ${E.get("position_id","bsnh[3]")} -
                ${x.getByOffset("j")} * ${k.get("position_id","bsnh[3]")};
            ${I.setByOffset("i","re")}
            let im = ${x.getByOffset("i")} * ${k.get("position_id","bsnh[3]")} +
                ${x.getByOffset("j")} * ${E.get("position_id","bsnh[3]")};
            ${I.setByOffset("j","im")}
          } else {
            let k = dot(bsnh, uniforms.input_output_strides) + half_rotary_emb_dim;
            ${I.setByOffset("k",x.getByOffset("k"))}
          }
        }`};return{name:"RotaryEmbedding",shaderCache:{hint:he({interleaved:r}).cacheKey,inputDependencies:["rank","rank","rank","rank"]},getShaderSource:$,getRunData:()=>({outputs:[{dims:e[0].dims,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(O.size(g)/Ft)},programUniforms:y})}},Hd=(e,t)=>{Gd(e.inputs,t),e.compute(Lr(e.inputs,t))}}),jd,Kd,Ta,Zd,Xd,tg=P(()=>{"use strict";Se(),ee(),Xi(),Md(),Vd(),pt(),Fd(),ae(),jd=(e,t)=>{if(t.doRotary&&e.length<=7)throw new Error("cos_cache and sin_cache inputs are required if do_rotary is specified");let r=e[0],i=e[1],a=e[2],s=e[3],n=e[4];if(t.doRotary!==0&&e.length<=7)throw new Error("cos_cast and sin_cache are expected if do_rotary attribute is non-zero");if(t.localWindowSize!==-1)throw new Error("Local attention is not supported");if(t.softcap!==0)throw new Error("Softcap is not supported");if(t.rotaryInterleaved!==0)throw new Error("Rotary interleaved is not supported");if(t.smoothSoftmax)throw new Error("Smooth softmax is not supported");if(r.dims.length!==3&&r.dims.length!==5)throw new Error("Input query is expected to have 3 or 5 dimensions");let u=!1,l=r.dims[0],p=r.dims[1],h=r.dims.length===3?u?r.dims[2]/3:r.dims[2]:t.numHeads*r.dims[4],c=p,g=0,_=!i||i.dims.length===0,y=Math.floor(_?h/(t.numHeads+2*t.kvNumHeads):h/t.numHeads);_&&(h=y*t.numHeads);let $=s&&s.dims.length!==0,S=n&&n.dims.length!==0;if($&&s.dims.length===4&&s.dims[0]===l&&s.dims[1]!==t.kvNumHeads&&s.dims[2]===t.kvNumHeads&&s.dims[3]===y)throw new Error("BSNH pastKey/pastValue is not supported");if($&&S){if(s.dims.length!==4)throw new Error('Input "past_key" is expected to have 4 dimensions');if(n.dims.length!==4)throw new Error('Input "past_value" is expected to have 4 dimensions');g=s.dims[2]}else if($||S)throw new Error('Input "past_key" and "past_value" shall be both present or both absent');let x=1;if(i&&i.dims.length>0){if(r.dims.length!==3)throw new Error('Input "query" is expected to have 3 dimensions when key is given');if(i.dims.length<3||i.dims.length>5)throw new Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(r.dims[0]!==i.dims[0])throw new Error('Input "query" and "key" shall have same dim 0 (batch size)');if(i.dims.length===3){if(r.dims[2]%i.dims[2]!==0)throw new Error('Dimension 2 of "query" should be a multiple of "key"');c=i.dims[1]}else if(i.dims.length===5){if(i.dims[2]!==t.numHeads||i.dims[3]!==2||i.dims[4]!==y)throw new Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(a)throw new Error('Expect "value" be none when "key" has packed kv format.');c=i.dims[1]}else{if(i.dims[1]!==t.numHeads||i.dims[3]!==y)throw new Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');c=i.dims[2]}}else{if(r.dims.length!==3&&r.dims.length!==5)throw new Error('Input "query" is expected to have 3 or 5 dimensions when key is empty');if(r.dims.length===5&&(r.dims[2]!==t.numHeads||r.dims[3]!==3))throw new Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');x=3}let b=0,E=!1,k=t.kvNumHeads?y*t.kvNumHeads:h;if(a&&a.dims.length>0){if(a.dims.length!==3&&a.dims.length!==4)throw new Error('Input "value" is expected to have 3 or 4 dimensions');if(r.dims[0]!==a.dims[0])throw new Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(a.dims.length===3){if(c!==a.dims[1])throw new Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');k=a.dims[2]}else{if(c!==a.dims[2])throw new Error('Input "past_key" and "past_value" shall have the same dim 2 (kv_sequence_length)');k=a.dims[1]*a.dims[3],E=!0}}let I=e.length>4?e[5]:void 0;if(I){if(I.dims.length===0)throw new Error("seqlens_k must be at least 1D, got scalar.");let z=I.dims.reduce((A,v)=>A*v,1);if(z!==l)throw new Error(`seqlens_k must have batch_size (${l}) elements, got ${z}.`);for(let A=0;A<I.dims.length;A++)if(I.dims[A]!==1&&I.dims[A]!==l)throw new Error(`seqlens_k has unexpected shape. Each dimension must be 1 or batch_size (${l}), got dims[${A}] = ${I.dims[A]}.`)}return{batchSize:l,sequenceLength:p,pastSequenceLength:g,kvSequenceLength:c,totalSequenceLength:-1,maxSequenceLength:-1,inputHiddenSize:0,hiddenSize:h,vHiddenSize:k,headSize:y,vHeadSize:Math.floor(k/t.kvNumHeads),numHeads:t.numHeads,kvNumHeads:t.kvNumHeads,nReps:t.numHeads/t.kvNumHeads,pastPresentShareBuffer:!1,maskType:b,scale:t.scale,broadcastResPosBias:!1,passPastInKv:E,qkvFormat:x}},Kd=he({perm:[0,2,1,3]}),Ta=(e,t,r)=>{let i=t,a=r.kvNumHeads;return t.dims.length===3&&r.kvSequenceLength!==0&&(i=t.reshape([r.batchSize,r.kvSequenceLength,a,r.headSize]),i=e.compute(Ue(i,Kd.perm),{inputs:[i],outputs:[-1]})[0]),i},Zd=(e,t,r,i)=>{let a=7,s=["type","type"],n=[e*t],u=e*t,l=[{type:12,data:u},{type:12,data:t},{type:12,data:e}],p=h=>{let c=B("seq_lens",r.dataType,r.dims),g=B("total_seq_lens",i.dataType,i.dims),_=G("pos_ids",a,n),y=[{name:"output_size",type:"u32"},{name:"sequence_length",type:"u32"},{name:"batch_size",type:"u32"}];return`
  ${h.registerUniforms(y).declareVariables(c,g,_)}
  ${h.mainStart()}
    ${h.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let total_sequence_length = u32(${g.getByOffset("0")});
    let is_subsequent_prompt = uniforms.sequence_length > 1 && uniforms.sequence_length != total_sequence_length;
    let is_first_prompt = !is_subsequent_prompt && uniforms.sequence_length == total_sequence_length;
    let batch_idx = global_idx / uniforms.sequence_length;
    let sequence_idx = i32(global_idx % uniforms.sequence_length);
    var pos_id: i32 = 0;
    let seqlen = ${c.getByOffset("batch_idx")};
    let total_seqlen = seqlen + 1;
    if (is_first_prompt) {
      if (sequence_idx < total_seqlen) {
        pos_id = sequence_idx;
      } else {
        pos_id = 1;
      }
      ${_.setByOffset("global_idx","pos_id")}
    } else if (is_subsequent_prompt) {
      let past_seqlen = total_seqlen - i32(uniforms.sequence_length);
      if (past_seqlen + sequence_idx < total_seqlen) {
        pos_id = past_seqlen + sequence_idx;
      } else {
        pos_id = 1;
      }
      ${_.setByOffset("global_idx","pos_id")}
    } else if (global_idx < uniforms.batch_size) {
      ${_.setByOffset("global_idx","seqlen")}
    };
  }
  `};return{name:"GeneratePositionIds",shaderCache:{hint:`${e};${t}`,inputDependencies:s},getRunData:()=>({outputs:[{dims:n,dataType:a}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:l}),getShaderSource:p}},Xd=(e,t)=>{if(e.inputs.length>14&&e.inputs[14]||e.inputs.length>15&&e.inputs[15])throw new Error("GroupQueryAttention (JSEP): q_norm_weight / k_norm_weight inputs are not supported. The per-head Q/K RMS normalization prologue is implemented only on the CUDA and native WebGPU EPs.");let r=jd(e.inputs,t);if(e.inputs[0].dims.length===5)throw new Error("Packed QKV is not implemented");if(e.inputs[1]?.dims.length===5)throw new Error("Packed KV is not implemented");let i=e.inputs[0],a=e.inputs[1]&&e.inputs[1].dims.length>0?e.inputs[1]:void 0,s=e.inputs[2]&&e.inputs[2].dims.length>0?e.inputs[2]:void 0,n=e.inputs[3]&&e.inputs[3].dims.length!==0?e.inputs[3]:void 0,u=e.inputs[4]&&e.inputs[4].dims.length!==0?e.inputs[4]:void 0,l=e.inputs.length>4?e.inputs[5]:void 0,p=e.inputs.length>5?e.inputs[6]:void 0,h=r.kvNumHeads?r.kvNumHeads:r.numHeads,c=he({axis:2,numOutputs:3,splitSizes:[r.numHeads*r.headSize,h*r.headSize,h*r.headSize]}),[g,_,y]=!a&&!s?e.compute(ka([i],c),{inputs:[i],outputs:[-1,-1,-1]}):[i,a,s],$,S;if(t.doRotary){let k=e.compute(Zd(r.batchSize,r.sequenceLength,l,p),{inputs:[l,p],outputs:[-1]})[0],I=e.inputs[7],z=e.inputs[8],A=he({interleaved:t.rotaryInterleaved!==0,numHeads:r.numHeads,rotaryEmbeddingDim:0,scale:t.scale}),v=[g,k,I,z],D=[-1];$=e.compute(Lr(v,A),{inputs:v,outputs:D})[0],v.splice(0,1,_);let q=he({interleaved:t.rotaryInterleaved!==0,numHeads:r.kvNumHeads,rotaryEmbeddingDim:0,scale:t.scale});S=e.compute(Lr(v,q),{inputs:v,outputs:D})[0]}let x=pr(e,r.batchSize,r.numHeads,r.sequenceLength,r.headSize,t.doRotary?$:g,void 0,0),b=Ta(e,t.doRotary?S:_,r),E=Ta(e,y,r);nr(e,x,b,E,void 0,void 0,n,u,void 0,r,l,p)}}),Ia,Qd,Yd,Jd,rg=P(()=>{"use strict";ee(),ie(),pt(),ae(),Ia=(e,t,r,i,a,s,n,u)=>{let l=ke(s),p=l===1?"f32":`vec${l}f`,h=l===1?"vec2f":`mat2x${l}f`,c=a*n,g=64;c===1&&(g=256);let _=[a,n,s/l],y=[a,n,2],$=["rank","type","type"],S=[];S.push(...Z(_,y));let x=b=>{let E=B("x",t.dataType,3,l),k=B("scale",r.dataType,r.dims),I=B("bias",i.dataType,i.dims),z=G("output",1,3,2),A=[E,k,I,z];return`
  var<workgroup> workgroup_shared : array<${h}, ${g}>;
  const workgroup_size = ${g}u;
  ${b.declareVariables(...A)}
  ${b.mainStart(g)}
    let batch = workgroup_index / uniforms.x_shape[1];
    let channel = workgroup_index % uniforms.x_shape[1];
    let hight = uniforms.x_shape[2];
    // initialize workgroup memory
    var sum = ${p}(0);
    var squared_sum = ${p}(0);
    for (var h = local_idx; h < hight; h += workgroup_size) {
      let value = ${p}(${E.get("batch","channel","h")});
      sum += value;
      squared_sum += value * value;
    }
    workgroup_shared[local_idx] = ${h}(sum, squared_sum);
    workgroupBarrier();

    for (var currSize = workgroup_size >> 1;  currSize > 0; currSize = currSize >> 1) {
      if (local_idx < currSize) {
        workgroup_shared[local_idx] = workgroup_shared[local_idx] + workgroup_shared[local_idx + currSize];
      }
      workgroupBarrier();
    }
    if (local_idx == 0) {
      let sum_final = ${dt("workgroup_shared[0][0]",l)} / f32(hight * ${l});
      let squared_sum_final = ${dt("workgroup_shared[0][1]",l)} / f32(hight * ${l});

      let inv_std_dev = inverseSqrt(squared_sum_final - sum_final * sum_final + f32(${u}));
      let channel_scale = inv_std_dev * f32(scale[channel]);
      let channel_shift = f32(bias[channel]) - sum_final * channel_scale;
      output[workgroup_index] = vec2f(channel_scale, channel_shift);
    }
  }`};return e.compute({name:"InstanceNormComputeChannelScaleShift",shaderCache:{hint:`${l};${u};${g}`,inputDependencies:$},getRunData:()=>({outputs:[{dims:y,dataType:1}],dispatchGroup:{x:c},programUniforms:S}),getShaderSource:x},{inputs:[t,r,i],outputs:[-1]})[0]},Qd=(e,t,r)=>{let i=t[0].dims,a=i,s=2,n=i[0],u=i[1],l=O.sizeFromDimension(i,s),p=ke(l),h=O.size(a)/p,c=Ia(e,t[0],t[1],t[2],n,l,u,r.epsilon),g=[n,u,l/p],_=[n,u],y=["type","none"],$=S=>{let x=B("x",t[0].dataType,g.length,p),b=B("scale_shift",1,_.length,2),E=G("output",t[0].dataType,g.length,p),k=[x,b,E];return`
  ${S.registerUniform("output_size","u32").declareVariables(...k)}
  ${S.mainStart()}
  ${S.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let outputIndices = ${E.offsetToIndices("global_idx")};
      let batch = outputIndices[0];
      let channel = outputIndices[1];
      let scale_shift = ${b.getByIndices("vec2<u32>(batch, channel)")};
      let value = ${x.getByOffset("global_idx")} * ${E.type.value}(scale_shift.x) + ${E.type.value}(scale_shift.y);
      ${E.setByOffset("global_idx","value")};
  }`};e.compute({name:"InstanceNormalization",shaderCache:{hint:`${p}`,inputDependencies:y},getRunData:()=>({outputs:[{dims:a,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(h/64)},programUniforms:[{type:12,data:h},...Z(g,_,g)]}),getShaderSource:$},{inputs:[t[0],c]})},Yd=(e,t,r)=>{let i=t[0].dims,a=i,s=i[0],n=i[i.length-1],u=O.sizeFromDimension(i,1)/n,l=ke(n),p=O.size(a)/l,h=[{type:12,data:u},{type:12,data:Math.floor(n/l)}],c=["type","type"],g=!1,_=[0,i.length-1];for(let x=0;x<i.length-2;x++)g=g||i[x+1]!==1,_.push(x+1);g=g&&i[i.length-1]!==1;let y=g?e.compute(Ue(e.inputs[0],_),{inputs:[e.inputs[0]],outputs:[-1]})[0]:e.inputs[0].reshape(Array.from({length:i.length},(x,b)=>i[_[b]])),$=Ia(e,y,t[1],t[2],s,u,n,r.epsilon),S=x=>{let b=Ee(t[0].dataType),E=l===1?"vec2f":`mat${l}x2f`,k=A=>{let v=A===0?"x":"y",D=l===1?"f32":`vec${l}f`;switch(l){case 1:return`${b}(${D}(scale.${v}))`;case 2:return`vec2<${b}>(${D}(scale[0].${v}, scale[1].${v}))`;case 4:return`vec4<${b}>(${D}(scale[0].${v}, scale[1].${v}, scale[2].${v}, scale[3].${v}))`;default:throw new Error(`Not supported compoents ${l}`)}},I=B("input",t[0].dataType,t[0].dims,l),z=G("output",t[0].dataType,a,l);return`
  @group(0) @binding(0) var<storage, read> input : array<${I.type.storage}>;
  @group(0) @binding(1) var<storage, read> scale_input : array<${E}>;
  @group(0) @binding(2) var<storage, read_write> output : array<${z.type.storage}>;
  struct Uniforms {H: u32, C : u32};
  @group(0) @binding(3) var<uniform> uniforms: Uniforms;

  ${x.mainStart()}
    let current_image_number = global_idx / (uniforms.C * uniforms.H);
    let current_channel_number = global_idx % uniforms.C;

    let scale_offset = current_image_number * uniforms.C + current_channel_number;
    let scale = scale_input[scale_offset];
    output[global_idx] = fma(input[global_idx], ${k(0)}, ${k(1)});
  }`};e.compute({name:"InstanceNormalizationNHWC",shaderCache:{hint:`${l}`,inputDependencies:c},getRunData:()=>({outputs:[{dims:a,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(p/64)},programUniforms:h}),getShaderSource:S},{inputs:[t[0],$]})},Jd=(e,t)=>{t.format==="NHWC"?Yd(e,e.inputs,t):Qd(e,e.inputs,t)}}),ep,tp,rp,ig=P(()=>{"use strict";ee(),ie(),ae(),ep=e=>{if(!e||e.length<2)throw new Error("layerNorm requires at least 2 inputs.")},tp=(e,t,r)=>{let i=t.simplified,a=e[0].dims,s=e[1],n=!i&&e[2],u=a,l=O.normalizeAxis(t.axis,a.length),p=O.sizeToDimension(a,l),h=O.sizeFromDimension(a,l),c=O.size(s.dims),g=n?O.size(n.dims):0;if(c!==h||n&&g!==h)throw new Error(`Size of X.shape()[axis:] == ${h}.
       Size of scale and bias (if provided) must match this.
       Got scale size of ${c} and bias size of ${g}`);let _=[];for(let I=0;I<a.length;++I)I<l?_.push(a[I]):_.push(1);let y=ke(h),$=["type","type"],S=[{type:12,data:p},{type:1,data:h},{type:12,data:Math.floor(h/y)},{type:1,data:t.epsilon}];n&&$.push("type");let x=r>1,b=r>2,E=I=>{let z=Ee(e[0].dataType),A=[B("x",e[0].dataType,e[0].dims,y),B("scale",s.dataType,s.dims,y)];n&&A.push(B("bias",n.dataType,n.dims,y)),A.push(G("output",e[0].dataType,u,y)),x&&A.push(G("mean_data_output",1,_)),b&&A.push(G("inv_std_output",1,_));let v=[{name:"norm_count",type:"u32"},{name:"norm_size",type:"f32"},{name:"norm_size_vectorized",type:"u32"},{name:"epsilon",type:"f32"}];return`
  ${I.registerUniforms(v).declareVariables(...A)}
  ${I.mainStart()}
    ${I.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.norm_count")}
    let offset = global_idx * uniforms.norm_size_vectorized;
    var mean_vector = ${Vi("f32",y)};
    var mean_square_vector = ${Vi("f32",y)};

    for (var h: u32 = 0u; h < uniforms.norm_size_vectorized; h++) {
      let value = ${jt(z,y,"x[h + offset]")};
      mean_vector += value;
      mean_square_vector += value * value;
    }
    let mean = ${dt("mean_vector",y)} / uniforms.norm_size;
    let inv_std_dev = inverseSqrt(${dt("mean_square_vector",y)} / uniforms.norm_size ${i?"":"- mean * mean"} + uniforms.epsilon);

    for (var j: u32 = 0; j < uniforms.norm_size_vectorized; j++) {
      let f32input = ${jt(z,y,"x[j + offset]")};
      let f32scale = ${jt(z,y,"scale[j]")};
      output[j + offset] = ${A[0].type.value}((f32input ${i?"":"- mean"}) * inv_std_dev * f32scale
        ${n?`+ ${jt(z,y,"bias[j]")}`:""}
      );
    }

    ${x?"mean_data_output[global_idx] = mean":""};
    ${b?"inv_std_output[global_idx] = inv_std_dev":""};
  }`},k=[{dims:u,dataType:e[0].dataType}];return x&&k.push({dims:_,dataType:1}),b&&k.push({dims:_,dataType:1}),{name:"LayerNormalization",shaderCache:{hint:`${y};${r};${i}`,inputDependencies:$},getRunData:()=>({outputs:k,dispatchGroup:{x:Math.ceil(p/64)},programUniforms:S}),getShaderSource:E}},rp=(e,t)=>{ep(e.inputs),e.compute(tp(e.inputs,t,e.outputCount))}}),ip,ap,ag=P(()=>{"use strict";ie(),aa(),ua(),ip=e=>{if(!e||e.length!==2)throw new Error("MatMul requires 2 inputs.");if(e[0].dims[e[0].dims.length-1]!==e[1].dims[e[1].dims.length-2])throw new Error("shared dimension does not match.")},ap=e=>{ip(e.inputs);let t=Ht.calcShape(e.inputs[0].dims,e.inputs[1].dims,!0);if(!t)throw new Error("Can't use matmul on the given tensors");let r=t[t.length-1],i=e.inputs[0].dims[e.inputs[0].dims.length-1];if(r<8&&i<8)e.compute(ia(e.inputs,{activation:""},t));else{let a=t[t.length-2],s=O.size(e.inputs[0].dims.slice(0,-2)),n=O.size(e.inputs[1].dims.slice(0,-2));if(s!==1&&a===1&&n===1){let u=e.inputs[0].reshape([1,s,i]),l=e.inputs[1].reshape([1,i,r]),p=[1,s,r],h=[u,l];e.compute(Mr(h,{activation:""},t,p),{inputs:h})}else e.compute(Mr(e.inputs,{activation:""},t))}}}),np,sp,op,up,lp,ng=P(()=>{"use strict";ee(),ie(),Se(),ae(),np=(e,t)=>{if(e.length<3||e.length>4)throw new Error("MatMulNBits requires 3 or 4 inputs");let r=e[0],i=r.dims.length;if(r.dims[i-1]!==t.k)throw new Error("The last dim of input shape does not match the k value");let a=Math.floor((t.k+t.blockSize-1)/t.blockSize),s=t.blockSize/8*t.bits,n=e[1];if(!O.areEqual(n.dims,[t.n,a,s]))throw new Error("The second inputs must be 3D tensor with shape N X nBlocksPerCol X blobSize");let u=e[2].dims;if(O.size(u)!==t.n*a)throw new Error("scales input size error.");if(e.length===4){let l=e[3].dims,p=t.n*(t.bits===8?a:Math.floor((a*t.bits+7)/8));if(O.size(l)!==p)throw new Error("zeroPoints input size error.")}},sp=(e,t)=>{let r=e[0].dims,i=r.length,a=r[i-2],s=t.k,n=t.n,u=r.slice(0,i-2),l=O.size(u),p=e[1].dims[2]/4,h=e[0].dataType,c=ke(t.k),g=ke(p),_=ke(n),y=u.concat([a,n]),$=a>1&&n/_%2===0?2:1,S=O.size(y)/_/$,x=64,b=[],E=[l,a,s/c],k=O.convertShape(e[1].dims).slice();k.splice(-1,1,p/g),b.push(...Z(E)),b.push(...Z(k)),b.push(...Z(e[2].dims)),e.length===4&&b.push(...Z(O.convertShape(e[3].dims)));let I=[l,a,n/_];b.push(...Z(I));let z=A=>{let v=E.length,D=B("a",e[0].dataType,v,c),q=B("b",12,k.length,g),Q=B("scales",e[2].dataType,e[2].dims.length),F=[D,q,Q],K=e.length===4?B("zero_points",12,e[3].dims.length):void 0;K&&F.push(K);let R=I.length,M=G("output",e[0].dataType,R,_),H=Ee(e[0].dataType),J=(()=>{switch(c){case 1:return`array<${H}, 8>`;case 2:return`mat4x2<${H}>`;case 4:return`mat2x4<${H}>`;default:throw new Error(`${c}-component is not supported.`)}})(),te=Math.floor(32/t.bits),re=Math.floor(te/8),ne=()=>{let X="";for(let V=0;V<re;V++){let Ie=V*t.bits*4,Oe=Ie+t.bits;X+=`
          // reuse a data (pass ${V})
            var input_offset${V>0?V:""} = ${V===0?D.indicesToOffset(`${D.type.indices}(batch, row, word_offset)`):"input_offset"};
            var a_data${V>0?V:""}: ${J};
            for (var j${V>0?V:""}: u32 = 0; j${V>0?V:""} < ${8/c}; j${V>0?V:""}++) {
              a_data${V>0?V:""}[j${V>0?V:""}] = ${D.getByOffset(`input_offset${V>0?V:""}`)};
              input_offset${V>0?V:""}++;
            }
          `;for(let xe=0;xe<_*$;xe++)X+=`
            b_value = ${g===1?`b${xe}_data`:`b${xe}_data[i]`};
            ${t.bits===2?`{
              let half_word = b_value >> ${V*16}u;
              let byte_lo = half_word & 0xFFu;
              let byte_hi = (half_word >> 8u) & 0xFFu;
              let spread_word = (byte_lo & 0xFu) | ((byte_lo >> 4u) << 8u) | ((byte_hi & 0xFu) << 16u) | ((byte_hi >> 4u) << 24u);
              b_value_lower = unpack4xU8(spread_word & b_mask);
              b_value_upper = unpack4xU8((spread_word >> 2u) & b_mask);
            }`:`b_value_lower = unpack4xU8((b_value >> ${Ie}u) & b_mask);
            b_value_upper = unpack4xU8((b_value >> ${Oe}u) & b_mask);`}
            b_quantized_values = ${J}(${Array.from({length:4},(Re,ge)=>`${H}(b_value_lower[${ge}]), ${H}(b_value_upper[${ge}])`).join(", ")});
            b_dequantized_values = ${c===1?`${J}(${Array.from({length:8},(Re,ge)=>`(b_quantized_values[${ge}] - ${K?`zero_point${xe}`:"zero_point"}) * scale${xe}`).join(", ")});`:`(b_quantized_values - ${J}(${Array(8).fill(`${K?`zero_point${xe}`:"zero_point"}`).join(",")})) * scale${xe};`};
            workgroup_shared[local_id.x * ${$} + ${Math.floor(xe/_)}]${_>1?`[${xe%_}]`:""} += ${Array.from({length:8/c},(Re,ge)=>`${c===1?`a_data${V>0?V:""}[${ge}] * b_dequantized_values[${ge}]`:`dot(a_data${V>0?V:""}[${ge}], b_dequantized_values[${ge}])`}`).join(" + ")};
          `}return X},U=()=>{let X=`
            var col_index = col * ${_};
            ${K?`
            let zero_point_values_per_byte: u32 = ${Math.floor(8/t.bits)}u;
            let zero_point_bytes_per_col = (nBlocksPerCol + zero_point_values_per_byte - 1u) / zero_point_values_per_byte;
            var zero_point_byte_count: u32;
            var zero_point_word_index: u32;
            var zero_point_byte_offset: u32;
            let zero_point_sub_offset: u32 = block % zero_point_values_per_byte;
            var zero_point_bits_offset: u32;
            var zero_point_word: u32;`:`
            // The default zero point is ${Math.pow(2,t.bits-1)} for unsigned ${t.bits}-bit quantization.
            let zero_point = ${H}(${Math.pow(2,t.bits-1).toFixed(1)});`}
            `;for(let V=0;V<_*$;V++)X+=`
            let scale${V} = ${Q.getByOffset("col_index * nBlocksPerCol + block")};
            ${K?`
            zero_point_byte_count = col_index * zero_point_bytes_per_col + (block / zero_point_values_per_byte);
            zero_point_word_index = zero_point_byte_count >> 0x2u;
            zero_point_byte_offset = zero_point_byte_count & 0x3u;
            zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_sub_offset * ${t.bits}u);
            zero_point_word = ${K.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point${V} = ${H}((zero_point_word) & ${t.bits===2?"0x3u":"0xFu"});`:""}
            col_index += 1;`;return X},Y=()=>{let X=`col_index = col * ${_};`;for(let V=0;V<_*$;V++)X+=`
            let b${V}_data = ${q.getByIndices(`${q.type.indices}(col_index, block, word)`)};
            col_index += 1;`;return X+=`
            var b_value: u32;
            let b_mask: u32 = ${t.bits===2?"0x03030303u":"0x0F0F0F0Fu"};
            var b_value_lower: vec4<u32>;
            var b_value_upper: vec4<u32>;
            var b_quantized_values: ${J};
            var b_dequantized_values: ${J};`,X};return`
        var<workgroup> workgroup_shared: array<${M.type.value}, ${$*x}>;
        ${A.declareVariables(...F,M)}
        ${A.mainStart([x,1,1])}
          let output_indices = ${M.offsetToIndices(`(global_idx / ${x}) * ${$}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let nBlocksPerCol = uniforms.b_shape[1];

          for (var block = local_id.x; block < nBlocksPerCol; block += ${x}) {
            //process one block
            var word_offset: u32 = block * ${t.blockSize/c};
            ${U()}
            for (var word: u32 = 0; word < ${p}; word += ${g}) {
              ${Y()}
              for (var i: u32 = 0; i < ${g}; i++) {
                ${ne()}
                word_offset += ${te/c};
              }
            }
          }
          workgroupBarrier();

          if (local_id.x < ${$}) {
            var output_value: ${M.type.value} = ${M.type.value}(0);
            var workgroup_shared_offset: u32 = local_id.x;
            for (var b: u32 = 0u; b < ${x}u; b++) {
              output_value += workgroup_shared[workgroup_shared_offset];
              workgroup_shared_offset += ${$};
            }
            ${M.setByIndices(`${M.type.indices}(batch, row, col + local_id.x)`,"output_value")};
          }
        }`};return{name:"MatMulNBits",shaderCache:{hint:`${t.blockSize};${t.bits};${c};${g};${_};${$};${x}`,inputDependencies:Array(e.length).fill("rank")},getRunData:()=>({outputs:[{dims:y,dataType:h}],dispatchGroup:{x:S},programUniforms:b}),getShaderSource:z}},op=(e,t)=>{let r=e[0].dims,i=r.length,a=r[i-2],s=t.k,n=t.n,u=r.slice(0,i-2),l=O.size(u),p=e[1].dims[2]/4,h=e[0].dataType,c=ke(t.k),g=ke(p),_=u.concat([a,n]),y=128,$=n%8===0?8:n%4===0?4:1,S=y/$,x=Math.floor(32/t.bits),b=S*g*x,E=b/c,k=b/t.blockSize,I=O.size(_)/$,z=[],A=[l,a,s/c],v=O.convertShape(e[1].dims).slice();v.splice(-1,1,p/g),z.push(...Z(A)),z.push(...Z(v)),z.push(...Z(e[2].dims)),e.length===4&&z.push(...Z(O.convertShape(e[3].dims)));let D=[l,a,n];z.push(...Z(D));let q=Q=>{let F=A.length,K=B("a",e[0].dataType,F,c),R=B("b",12,v.length,g),M=B("scales",e[2].dataType,e[2].dims.length),H=[K,R,M],J=e.length===4?B("zero_points",12,e[3].dims.length):void 0;J&&H.push(J);let te=D.length,re=G("output",e[0].dataType,te),ne=Ee(e[0].dataType),U=()=>{switch(c){case 1:return`
          let a_data0 = vec4<${ne}>(sub_a[word_offset], sub_a[word_offset + 1], sub_a[word_offset + 2], sub_a[word_offset + 3]);
          let a_data1 = vec4<${ne}>(sub_a[word_offset + 4], sub_a[word_offset + 5], sub_a[word_offset + 6], sub_a[word_offset + 7]);`;case 2:return`
          let a_data0 = vec4<${ne}>(sub_a[word_offset], sub_a[word_offset + 1]);
          let a_data1 = vec4<${ne}>(sub_a[word_offset + 2], sub_a[word_offset + 3]);`;case 4:return`
          let a_data0 = sub_a[word_offset];
          let a_data1 = sub_a[word_offset + 1];`;default:throw new Error(`${c}-component is not supported.`)}};return`
        var<workgroup> sub_a: array<${K.type.value}, ${E}>;
        var<workgroup> inter_results: array<array<${re.type.value}, ${S}>, ${$}>;
        ${Q.declareVariables(...H,re)}
        ${Q.mainStart([S,$,1])}
          let output_indices = ${re.offsetToIndices(`workgroup_index * ${$}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let n_blocks_per_col = uniforms.b_shape[1];
          let num_tiles =  (n_blocks_per_col - 1) / ${k} + 1;

          // Loop over shared dimension.
          for (var tile: u32 = 0; tile < num_tiles; tile += 1) {
            let a_col_start = tile * ${E};
            // load one tile A data into shared memory.
            for (var a_offset = local_idx; a_offset < ${E}; a_offset += ${y})
            {
              let a_col = a_col_start + a_offset;
              if (a_col < uniforms.a_shape[2])
              {
                sub_a[a_offset] = ${K.getByIndices(`${K.type.indices}(batch, row, a_col)`)};
              } else {
                sub_a[a_offset] = ${K.type.value}(0);
              }
            }
            workgroupBarrier();

            // each thread process one block
            let b_row = col + local_id.y;
            let block = tile * ${k} + local_id.x;
            ${J?`
            let zero_point_values_per_byte: u32 = ${Math.floor(8/t.bits)}u;
            let zero_point_bytes_per_col = (n_blocks_per_col + zero_point_values_per_byte - 1u) / zero_point_values_per_byte;
            let zero_point_byte_count = b_row * zero_point_bytes_per_col + (block / zero_point_values_per_byte);
            let zero_point_word_index = zero_point_byte_count >> 0x2u;
            let zero_point_byte_offset = zero_point_byte_count & 0x3u;
            let zero_point_sub_offset: u32 = block % zero_point_values_per_byte;
            let zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_sub_offset * ${t.bits}u);
            let zero_point_word = ${J.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point = ${ne}((zero_point_word) & ${t.bits===2?"0x3u":"0xFu"});`:`
            // The default zero point is ${Math.pow(2,t.bits-1)} for unsigned ${t.bits}-bit quantization.
            let zero_point = ${ne}(${Math.pow(2,t.bits-1).toFixed(1)});`}
            let scale = ${M.getByOffset("b_row * n_blocks_per_col + block")};
            let b_data = ${R.getByIndices(`${R.type.indices}(b_row, block, 0)`)};
            var word_offset = local_id.x * ${t.blockSize/c};
            for (var i: u32 = 0; i < ${g}; i++) {
              let b_value = ${g===1?"b_data":"b_data[i]"};
              ${(()=>{let Y=Math.floor(x/8),X="";for(let V=0;V<Y;V++){let Ie=V*t.bits*4,Oe=Ie+t.bits;X+=`
              ${U()}
              {${t.bits===2?`
                let half_word = b_value >> ${V*16}u;
                let byte_lo = half_word & 0xFFu;
                let byte_hi = (half_word >> 8u) & 0xFFu;
                let spread_word = (byte_lo & 0xFu) | ((byte_lo >> 4u) << 8u) | ((byte_hi & 0xFu) << 16u) | ((byte_hi >> 4u) << 24u);
                let b_value_lower = unpack4xU8(spread_word & 0x03030303u);
                let b_value_upper = unpack4xU8((spread_word >> 2u) & 0x03030303u);`:`
                let b_value_lower = unpack4xU8((b_value >> ${Ie}u) & 0x0F0F0F0Fu);
                let b_value_upper = unpack4xU8((b_value >> ${Oe}u) & 0x0F0F0F0Fu);`}
                let b_quantized_values = mat2x4<${ne}>(${Array.from({length:4},(xe,Re)=>`${ne}(b_value_lower[${Re}]), ${ne}(b_value_upper[${Re}])`).join(", ")});
                let b_dequantized_values = (b_quantized_values - mat2x4<${ne}>(${Array(8).fill("zero_point").join(",")})) * scale;
                inter_results[local_id.y][local_id.x] += ${Array.from({length:2},(xe,Re)=>`${`dot(a_data${Re}, b_dequantized_values[${Re}])`}`).join(" + ")};
              }
              word_offset += ${8/c};`}return X})()}
            }
            workgroupBarrier();
          }

          if (local_idx < ${$}) {
            var output_value: ${re.type.value} = ${re.type.value}(0);
            for (var b = 0u; b < ${S}; b++) {
              output_value += inter_results[local_idx][b];
            }
            if (col + local_idx < uniforms.output_shape[2])
            {
              ${re.setByIndices(`${re.type.indices}(batch, row, col + local_idx)`,"output_value")}
            }
          }
        }`};return{name:"BlockwiseMatMulNBits32",shaderCache:{hint:`${t.blockSize};${c};${g};${S};${$}`,inputDependencies:Array(e.length).fill("rank")},getRunData:()=>({outputs:[{dims:_,dataType:h}],dispatchGroup:{x:I},programUniforms:z}),getShaderSource:q}},up=(e,t)=>{np(e.inputs,t),t.blockSize===32&&e.adapterInfo.isVendor("intel")&&e.adapterInfo.isArchitecture("gen-12lp")?e.compute(op(e.inputs,t)):e.compute(sp(e.inputs,t))},lp=e=>he(e)}),dp,pp,cp,hp,fp,mp,gp,yp,_p,sg=P(()=>{"use strict";ee(),ie(),ae(),dp=e=>{if(!e||e.length<1)throw new Error("Too few inputs");if(e[0].dataType!==1&&e[0].dataType!==10)throw new Error("Input type must be float or float16.");if(e.length>=2){let t=e[0].dims.length*2===e[1].dims[0];if(e.length===4&&(t=e[3].dims[0]*2===e[1].dims[0]),!t)throw new Error("The pads should be a 1D tensor of shape [2 * input_rank] or [2 * num_axes].")}},pp=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
            k = i32(${e.indicesGet("indices",a)}) - ${j("uniforms.pads",a,r)};
            if (k < 0) {
              break;
            }
            if (k >= i32(${j("uniforms.x_shape",a,t)})) {
              break;
            }
            offset += k * i32(${j("uniforms.x_strides",a,t)});
        `;return`
          value = ${e.type.value}(uniforms.constant_value);
          for (var i = 0; i < 1; i++) {
            var offset = 0;
            var k = 0;
            ${i}
            value = x[offset];
          }
      `},cp=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
                k = i32(${e.indicesGet("indices",a)}) - ${j("uniforms.pads",a,r)};
                if (k < 0) {
                  k = -k;
                }
                {
                  let _2n_1 = 2 * (i32(${j("uniforms.x_shape",a,t)}) - 1);
                  k = k % _2n_1;
                  if(k >= i32(${j("uniforms.x_shape",a,t)})) {
                    k = _2n_1 - k;
                  }
                }
                offset += k * i32(${j("uniforms.x_strides",a,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${i}
              value = x[offset];
          `},hp=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
                k = i32(${e.indicesGet("indices",a)}) - ${j("uniforms.pads",a,r)};
                if (k < 0) {
                  k = 0;
                }
                if (k >= i32(${j("uniforms.x_shape",a,t)})) {
                  k = i32(${j("uniforms.x_shape",a,t)}) - 1;
                }
                offset += k * i32(${j("uniforms.x_strides",a,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${i}
              value = x[offset];
          `},fp=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
                k = i32(${e.indicesGet("indices",a)}) - ${j("uniforms.pads",a,r)};
                if (k < 0)  {
                  k += i32(${j("uniforms.x_shape",a,t)}]);
                }
                if (k >= i32(${j("uniforms.x_shape",a,t)})) {
                  k -= i32(${j("uniforms.x_shape",a,t)});
                }
                offset += k * i32(${j("uniforms.x_strides",a,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${i}
              value = x[offset];
          `},mp=(e,t,r)=>{switch(r.mode){case 0:return pp(e,t,r.pads.length);case 1:return cp(e,t,r.pads.length);case 2:return hp(e,t,r.pads.length);case 3:return fp(e,t,r.pads.length);default:throw new Error("Invalid mode")}},gp=(e,t)=>{let r=O.padShape(e[0].dims.slice(),t.pads),i=e[0].dims,a=O.size(r),s=[{type:12,data:a},{type:6,data:t.pads}],n=e.length>=3&&e[2].data;t.mode===0&&s.push({type:n?e[2].dataType:1,data:t.value}),s.push(...Z(e[0].dims,r));let u=["rank"],l=p=>{let h=G("output",e[0].dataType,r.length),c=B("x",e[0].dataType,i.length),g=c.type.value,_=mp(h,i.length,t),y=[{name:"output_size",type:"u32"},{name:"pads",type:"i32",length:t.pads.length}];return t.mode===0&&y.push({name:"constant_value",type:n?g:"f32"}),`
            ${p.registerUniforms(y).declareVariables(c,h)}
            ${p.mainStart()}
            ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

            let indices = ${h.offsetToIndices("global_idx")};

            var value = ${g}(0);
            ${_}
            output[global_idx] = value;
        }`};return{name:"Pad",shaderCache:{hint:`${t.mode}${n}`,inputDependencies:u},getRunData:()=>({outputs:[{dims:r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(O.size(r)/64)},programUniforms:s}),getShaderSource:l}},yp=(e,t)=>{if(e.length>1){let r=e[1].getBigInt64Array(),i=e.length>=3&&e[2].data?e[2].dataType===10?e[2].getUint16Array()[0]:e[2].getFloat32Array()[0]:0,a=e[0].dims.length,s=new Int32Array(2*a).fill(0);if(e.length>=4){let u=e[3].getBigInt64Array();for(let l=0;l<u.length;l++)s[Number(u[l])]=Number(r[l]),s[Number(u[l])+a]=Number(r[l+u.length])}else r.forEach((u,l)=>s[Number(l)]=Number(u));let n=[];return s.forEach(u=>n.push(u)),{mode:t.mode,value:i,pads:n}}else return t},_p=(e,t)=>{dp(e.inputs);let r=yp(e.inputs,t);e.compute(gp(e.inputs,r),{inputs:[0]})}}),cr,Ea,za,Ca,Aa,bp,wp,Oa,Ra,$p,vp,Ba,xp,Sp,Na,kp,Tp,Ip,Ep,og=P(()=>{"use strict";qe(),ee(),ie(),ae(),cr=e=>{if(be.webgpu.validateInputContent&&(!e||e.length!==1))throw new Error("Pool ops requires 1 input.")},Ea=(e,t,r)=>{let i=t.format==="NHWC",a=e.dims.slice();i&&a.splice(1,0,a.pop());let s=Object.hasOwnProperty.call(t,"dilations"),n=t.kernelShape.slice(),u=t.strides.slice(),l=s?t.dilations.slice():[],p=t.pads.slice();zr.adjustPoolAttributes(r,a,n,u,l,p);let h=zr.computePoolOutputShape(r,a,u,l,n,p,t.autoPad,t.ceilMode),c=Object.assign({},t);s?Object.assign(c,{kernelShape:n,strides:u,pads:p,dilations:l,cacheKey:t.cacheKey}):Object.assign(c,{kernelShape:n,strides:u,pads:p,cacheKey:t.cacheKey});let g=h.slice();return g.push(g.splice(1,1)[0]),[c,i?g:h]},za=(e,t)=>{let r=t.format==="NHWC",i=O.size(e),a=O.size(t.kernelShape),s=[{type:12,data:i},{type:12,data:a}],n=[{name:"outputSize",type:"u32"},{name:"kernelSize",type:"u32"}];if(t.kernelShape.length<=2){let u=t.kernelShape[t.kernelShape.length-1],l=t.strides[t.strides.length-1],p=t.pads[t.pads.length/2-1],h=t.pads[t.pads.length-1],c=!!(p+h);s.push({type:12,data:u},{type:12,data:l},{type:12,data:p},{type:12,data:h}),n.push({name:"kw",type:"u32"},{name:"sw",type:"u32"},{name:"pwStart",type:"u32"},{name:"pwEnd",type:"u32"});let g=!1;if(t.kernelShape.length===2){let _=t.kernelShape[t.kernelShape.length-2],y=t.strides[t.strides.length-2],$=t.pads[t.pads.length/2-2],S=t.pads[t.pads.length-2];g=!!($+S),s.push({type:12,data:_},{type:12,data:y},{type:12,data:$},{type:12,data:S}),n.push({name:"kh",type:"u32"},{name:"sh",type:"u32"},{name:"phStart",type:"u32"},{name:"phEnd",type:"u32"})}return[s,n,!0,c,g]}else{if(r)throw new Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let u=O.computeStrides(t.kernelShape);s.push({type:12,data:u},{type:12,data:t.pads},{type:12,data:t.strides}),n.push({name:"kernelStrides",type:"u32",length:u.length},{name:"pads",type:"u32",length:t.pads.length},{name:"strides",type:"u32",length:t.strides.length});let l=t.pads.reduce((p,h)=>p+h);return[s,n,!!l,!1,!1]}},Ca=(e,t,r,i,a,s,n,u,l,p,h,c)=>{let g=a.format==="NHWC",_=t.type.value,y=G("output",t.type.tensor,i);if(a.kernelShape.length<=2){let $="",S="",x="",b=r-(g?2:1);if(h?$=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${b}] = indices[${b}] * uniforms.sw - uniforms.pwStart + i;
                  if (xIndices[${b}] < 0 || xIndices[${b}]
                      >= uniforms.x_shape[${b}]) {
                    pad++;
                    continue;
                  }
                  let x_val = x[${t.indicesToOffset("xIndices")}];
                  ${s}
                }`:$=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${b}] = indices[${b}] * uniforms.sw - uniforms.pwStart + i;
                  let x_val = x[${t.indicesToOffset("xIndices")}];
                  ${s}
                }`,a.kernelShape.length===2){let E=r-(g?3:2);c?S=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${E}] = indices[${E}] * uniforms.sh - uniforms.phStart + j;
                  if (xIndices[${E}] < 0 || xIndices[${E}] >= uniforms.x_shape[${E}]) {
                    pad += i32(uniforms.kw);
                    continue;
                  }
              `:S=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${E}] = indices[${E}] * uniforms.sh - uniforms.phStart + j;
                `,x=`
              }
            `}return`
            ${e.registerUniforms(l).declareVariables(t,y)}

            ${e.mainStart()}
              ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

              let indices = ${y.offsetToIndices("global_idx")};
              var xIndices = ${y.offsetToIndices("global_idx")};

              var value = ${_}(${u});
              var pad = 0;
              ${S}
              ${$}
              ${x}
              ${n}

              output[global_idx] = value;
            }`}else{if(g)throw new Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let $=a.kernelShape.length,S=a.pads.length,x="";return p?x=`
                if (xIndices[j] >= uniforms.x_shape[j]) {
                  pad++;
                  isPad = true;
                  break;
                }
              }
              if (!isPad) {
                let x_val = x[${t.indicesToOffset("xIndices")}];
                ${s}
              }`:x=`
              }
              let x_val = x[${t.indicesToOffset("xIndices")}];
              ${s}
            `,`
            ${e.registerUniforms(l).declareVariables(t,y)}

            ${e.mainStart()}
              ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
              let indices = ${y.offsetToIndices("global_idx")};
              var xIndices = ${y.offsetToIndices("global_idx")};

              var offsets: array<u32, ${$}>;

              var value = ${_}(${u});
              var pad = 0;
              var isPad = false;

              for (var i: u32 = 0u; i < uniforms.kernelSize; i++) {
                var offset = i;
                for (var j = 0u; j < ${$-1}u; j++) {
                  offsets[j] = offset / ${j("uniforms.kernelStrides","j",$)};
                  offset -= offsets[j] * ${j("uniforms.kernelStrides","j",$)};
                }
                offsets[${$-1}] = offset;

                isPad = false;
                for (var j = ${r-$}u; j < ${r}u; j++) {
                  xIndices[j] = indices[j] * ${j("uniforms.strides",`j - ${r-$}u`,$)}
                    + offsets[j - ${r-$}u] - ${j("uniforms.pads","j - 2u",S)};
                  ${x}
              }
              ${n}

              output[global_idx] = value;
            }`}},Aa=e=>`${e.format};${e.ceilMode};${e.autoPad};${e.kernelShape.length}`,bp=e=>`${Aa(e)};${e.countIncludePad}`,wp=e=>`${Aa(e)};${e.storageOrder};${e.dilations}`,Oa=e=>({format:e.format,autoPad:["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][e.auto_pad],ceilMode:e.ceil_mode,kernelShape:e.kernel_shape,strides:e.strides,pads:e.pads}),Ra=(e,t,r,i)=>{let[a,s]=Ea(t,i,r),n=B("x",t.dataType,t.dims.length),u=n.type.value,l="value += x_val;",p="";a.countIncludePad?p+=`value /= ${u}(uniforms.kernelSize);`:p+=`value /= ${u}(i32(uniforms.kernelSize) - pad);`;let[h,c,g,_,y]=za(s,a);h.push(...Z(t.dims,s));let $=["rank"];return{name:e,shaderCache:{hint:`${i.cacheKey};${g};${_};${y}`,inputDependencies:$},getRunData:()=>({outputs:[{dims:s,dataType:t.dataType}],dispatchGroup:{x:Math.ceil(O.size(s)/64)},programUniforms:h}),getShaderSource:S=>Ca(S,n,t.dims.length,s.length,a,l,p,0,c,g,_,y)}},$p=e=>{let t=e.count_include_pad!==0,r=Oa(e);if(r.ceilMode!==0)throw new Error("ceil_mode output-shape is computed, but ceil_mode kernel execution (padding/divisor) is not yet implemented in the WebGPU AveragePool kernel");let i={countIncludePad:t,...r,cacheKey:""};return{...i,cacheKey:bp(i)}},vp=(e,t)=>{cr(e.inputs),e.compute(Ra("AveragePool",e.inputs[0],!1,t))},Ba={autoPad:"",ceilMode:0,countIncludePad:!1,kernelShape:[],strides:[],pads:[],storageOrder:0,dilations:[]},xp=e=>{let t=e.format;return{format:t,...Ba,cacheKey:t}},Sp=(e,t)=>{cr(e.inputs),e.compute(Ra("GlobalAveragePool",e.inputs[0],!0,t))},Na=(e,t,r,i)=>{let[a,s]=Ea(t,i,r),n=`
      value = max(x_val, value);
    `,u="",l=B("x",t.dataType,t.dims.length),p=["rank"],[h,c,g,_,y]=za(s,a);return h.push(...Z(t.dims,s)),{name:e,shaderCache:{hint:`${i.cacheKey};${g};${_};${y}`,inputDependencies:p},getRunData:()=>({outputs:[{dims:s,dataType:t.dataType}],dispatchGroup:{x:Math.ceil(O.size(s)/64)},programUniforms:h}),getShaderSource:$=>Ca($,l,t.dims.length,s.length,a,n,u,t.dataType===10?-65504:-1e5,c,g,_,y)}},kp=(e,t)=>{cr(e.inputs),e.compute(Na("MaxPool",e.inputs[0],!1,t))},Tp=e=>{let t=e.storage_order,r=e.dilations,i=Oa(e);if(t!==0)throw new Error("column major storage order is not yet supported for MaxPool");if(i.ceilMode!==0)throw new Error("ceil_mode output-shape is computed, but ceil_mode kernel execution (padding) is not yet implemented in the WebGPU MaxPool kernel");let a={storageOrder:t,dilations:r,...i,cacheKey:""};return{...a,cacheKey:wp(a)}},Ip=e=>{let t=e.format;return{format:t,...Ba,cacheKey:t}},Ep=(e,t)=>{cr(e.inputs),e.compute(Na("GlobalMaxPool",e.inputs[0],!0,t))}}),zp,Cp,Ap,Op,ug=P(()=>{"use strict";ee(),ie(),Se(),ae(),zp=(e,t)=>{if(e.length<2||e.length>3)throw new Error("DequantizeLinear requires 2 or 3 inputs.");if(e.length===3&&e[1].dims===e[2].dims)throw new Error("x-scale and x-zero-point must have the same shape.");if(e.length===3&&e[0].dataType!==e[2].dataType)throw new Error("x and x-zero-point must have the same data type.");if(e[1].dims.length!==0&&e[1].dims.length!==1&&e[1].dims.length!==e[0].dims.length)throw new Error("scale input must be a scalar, a 1D tensor, or have the same rank as the input tensor.");if(e.length>2){if(e[0].dataType!==e[2].dataType)throw new Error("x and x-zero-point must have the same data type.");if(e[1].dims.length!==e[2].dims.length)throw new Error("scale and zero-point inputs must have the same rank.");if(!e[1].dims.map((r,i)=>r===e[2].dims[i]).reduce((r,i)=>r&&i,!0))throw new Error("scale and zero-point inputs must have the same shape.")}if(t.blockSize>0){if(e[1].dims.length===0||e[1].dims.length===1&&e[1].dims[0]===1)throw new Error("blockSize must be set only for block quantization.");if(!e[1].dims.map((a,s)=>s===t.axis||a===e[0].dims[s]).reduce((a,s)=>a&&s,!0))throw new Error("For block qunatization, scale input shape to match the input shape except for the axis");if(e[1].dims.length!==e[0].dims.length)throw new Error("For block qunatization the scale input rank must be the same as the x rank.");let r=e[0].dims[t.axis],i=e[1].dims[t.axis];if(t.blockSize<Math.ceil(r/i)||t.blockSize>Math.ceil(r/(i-1)-1))throw new Error("blockSize must be with in the range [ceil(dI / Si), ceil(dI / (Si - 1) - 1)].")}},Cp=(e,t)=>{let r=O.normalizeAxis(t.axis,e[0].dims.length),i=e[0].dataType,a=i===3,s=e[0].dims,n=e[1].dataType,u=O.size(s),l=i===3||i===2,p=l?[Math.ceil(O.size(e[0].dims)/4)]:e[0].dims,h=e[1].dims,c=e.length>2?e[2]:void 0,g=c?l?[Math.ceil(O.size(c.dims)/4)]:c.dims:void 0,_=h.length===0||h.length===1&&h[0]===1,y=_===!1&&h.length===1,$=ke(u),S=_&&(!l||$===4),x=S?$:1,b=S&&!l?$:1,E=B("input",l?12:i,p.length,b),k=B("scale",n,h.length),I=c?B("zero_point",l?12:i,g.length):void 0,z=G("output",n,s.length,x),A=[E,k];I&&A.push(I);let v=[p,h];c&&v.push(g);let D=[{type:12,data:u/x},{type:12,data:r},{type:12,data:t.blockSize},...Z(...v,s)],q=Q=>{let F=[{name:"output_size",type:"u32"},{name:"axis",type:"u32"},{name:"block_size",type:"u32"}];return`
      ${Q.registerUniforms(F).declareVariables(...A,z)}
      ${Q.mainStart()}
          ${Q.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let output_indices = ${z.offsetToIndices("global_idx")};

          // Set input x
          ${l?`
            let input = ${E.getByOffset("global_idx / 4")};
            let x_vec = ${a?"unpack4xI8(input)":"unpack4xU8(input)"};
            let x_value = ${x===1?"x_vec[global_idx % 4]":"x_vec"};`:`let x_value = ${E.getByOffset("global_idx")};`};

          // Set scale input
          ${_?`let scale_value= ${k.getByOffset("0")}`:y?`
            let scale_index = ${z.indicesGet("output_indices","uniforms.axis")};
            let scale_value= ${k.getByOffset("scale_index")};`:`
            var scale_indices: ${k.type.indices} = output_indices;
            let index = ${k.indicesGet("scale_indices","uniforms.axis")} / uniforms.block_size;
            ${k.indicesSet("scale_indices","uniforms.axis","index")};
            let scale_value= ${k.getByIndices("scale_indices")};`};

          // Set zero-point input
          ${I?_?l?`
                let zero_point_input = ${I.getByOffset("0")};
                let zero_point_vec =  ${a?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value= zero_point_vec[0]`:`let zero_point_value = ${I.getByOffset("0")}`:y?l?`
                let zero_point_index = ${z.indicesGet("output_indices","uniforms.axis")};
                let zero_point_input = ${I.getByOffset("zero_point_index / 4")};
                let zero_point_vec =  ${a?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_index % 4]`:`
                let zero_point_index = ${z.indicesGet("output_indices","uniforms.axis")};
                let zero_point_value = ${I.getByOffset("zero_point_index")};`:l?`
                let zero_point_offset = ${k.indicesToOffset("scale_indices")};
                let zero_point_input = ${I.getByOffset("zero_point_offset / 4")};
                let zero_point_vec = ${a?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_offset % 4];`:`let zero_point_value = ${I.getByIndices("scale_indices")};`:`let zero_point_value = ${l?a?"i32":"u32":E.type.value}(0);`};
      // Compute and write output
      ${z.setByOffset("global_idx",`${z.type.value}(x_value - zero_point_value) * scale_value`)};
      }`};return{name:"DequantizeLinear",shaderCache:{hint:t.cacheKey,inputDependencies:I?["rank","rank","rank"]:["rank","rank"]},getShaderSource:q,getRunData:()=>({outputs:[{dims:s,dataType:n}],dispatchGroup:{x:Math.ceil(u/x/64),y:1,z:1},programUniforms:D})}},Ap=(e,t)=>{zp(e.inputs,t),e.compute(Cp(e.inputs,t))},Op=e=>he({axis:e.axis,blockSize:e.blockSize})}),Rp,Bp,Np,lg=P(()=>{"use strict";qe(),ee(),ae(),Rp=(e,t,r)=>{let i=e===t,a=e<t&&r<0,s=e>t&&r>0;if(i||a||s)throw new Error("Range these inputs' contents are invalid.")},Bp=(e,t,r,i)=>{let a=Math.abs(Math.ceil((t-e)/r)),s=[a],n=a,u=[{type:12,data:n},{type:i,data:e},{type:i,data:r},...Z(s)],l=p=>{let h=G("output",i,s.length),c=h.type.value,g=[{name:"outputSize",type:"u32"},{name:"start",type:c},{name:"delta",type:c}];return`
        ${p.registerUniforms(g).declareVariables(h)}
        ${p.mainStart()}
        ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        output[global_idx] = uniforms.start + ${c}(global_idx) * uniforms.delta;
      }`};return{name:"Range",shaderCache:{hint:`${i}`},getShaderSource:l,getRunData:()=>({outputs:[{dims:s,dataType:i}],dispatchGroup:{x:Math.ceil(n/64)},programUniforms:u})}},Np=e=>{let t=0,r=0,i=0;e.inputs[0].dataType===6?(t=e.inputs[0].getInt32Array()[0],r=e.inputs[1].getInt32Array()[0],i=e.inputs[2].getInt32Array()[0]):e.inputs[0].dataType===1&&(t=e.inputs[0].getFloat32Array()[0],r=e.inputs[1].getFloat32Array()[0],i=e.inputs[2].getFloat32Array()[0]),be.webgpu.validateInputContent&&Rp(t,r,i),e.compute(Bp(t,r,i,e.inputs[0].dataType),{inputs:[]})}}),Mp,Dp,Up,Pp,dg=P(()=>{"use strict";ee(),ie(),Se(),ae(),Mp=(e,t,r,i)=>{if(e!=="none"&&i!=="i32"&&i!=="u32"&&i!=="f32")throw new Error(`Input ${i} is not supported with reduction ${e}.`);let a=`{
                var oldValue = 0;
                loop {
                  let newValueF32 =`,s=`;
                  let newValue = bitcast<i32>(newValueF32);
                  let res = atomicCompareExchangeWeak(&${t}, oldValue, newValue);
                  if res.exchanged {
                    break;
                  }
                  oldValue = res.old_value;
                }
              }`;switch(e){case"none":return`${t}=${r};`;case"add":return i==="i32"||i==="u32"?`atomicAdd(&${t}, bitcast<${i}>(${r}));`:`
              ${a}bitcast<${i}>(oldValue) + (${r})${s}`;case"max":return i==="i32"||i==="u32"?`atomicMax(&${t}, bitcast<${i}>(${r}));`:`
                ${a}max(bitcast<f32>(oldValue), (${r}))${s}`;case"min":return i==="i32"||i==="u32"?`atomicMin(&${t}, bitcast<${i}>(${r}));`:`${a}min(bitcast<${i}>(oldValue), (${r}))${s}`;case"mul":return`${a}(bitcast<${i}>(oldValue) * (${r}))${s}`;default:throw new Error(`Reduction ${e} is not supported.`)}},Dp=(e,t)=>{let r=e[0].dims,i=e[1].dims,a=r,s=1,n=Math.ceil(O.sizeToDimension(i,i.length-1)/s),u=i[i.length-1],l=O.sizeFromDimension(r,u),p=[{type:12,data:n},{type:12,data:u},{type:12,data:l},...Z(e[1].dims,e[2].dims,a)],h=c=>{let g=B("indices",e[1].dataType,e[1].dims.length),_=B("updates",e[2].dataType,e[2].dims.length,s),y=t.reduction!=="none"&&t.reduction!==""?Ns("output",e[0].dataType,a.length):G("output",e[0].dataType,a.length,s);return`
      ${c.registerUniform("output_size","u32").registerUniform("last_index_dimension","u32").registerUniform("num_updates_elements","u32").declareVariables(g,_,y)}
      ${c.mainStart()}
        ${c.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
  var data_offset = 0u;
  let indices_start = uniforms.last_index_dimension * global_idx;
  let indices_end = indices_start + uniforms.last_index_dimension;
  for (var i = indices_start; i < indices_end; i++) {
    var index = i32(indices[i].x);
    ${e[0].dims.length===1?`
    let element_count_dim = uniforms.output_strides;
    let dim_value = uniforms.output_shape;`:`
    let element_count_dim = uniforms.output_strides[i - indices_start];
    let dim_value = uniforms.output_shape[i - indices_start];`}
    if (index >= 0) {
      if (index >= i32(dim_value)) {
        index = i32(dim_value - 1);
      }
    } else {
      if (index < -i32(dim_value)) {
        index = 0;
      } else {
        index += i32(dim_value);
      }
    }
    data_offset += u32((u32(index) * element_count_dim));
  }

  for (var i = 0u; i < uniforms.num_updates_elements; i++) {
    let value = updates[uniforms.num_updates_elements * global_idx + i];
    ${Mp(t.reduction,"output[data_offset + i]","value",y.type.value)}
  }

      }`};return{name:"ScatterND",shaderCache:{hint:`${t.cacheKey}_${t.reduction}`,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:a,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(n/64)},programUniforms:p}),getShaderSource:h}},Up=e=>he({reduction:e.reduction}),Pp=(e,t)=>{e.compute(Dp(e.inputs,t),{inputs:[e.inputs[1],e.inputs[2]],outputs:[]})}}),qp,Lp,Wp,Ma,Vp,Gp,Hp,Fp,jp,Kp,Zp,Xp,Da,Qp,Yp,Jp,ec,tc,rc,ic,pg=P(()=>{"use strict";ee(),ie(),Se(),ae(),qp=(e,t)=>{if(e.every(r=>r>0||(()=>{throw new Error("Resize requires scales input values to be positive")})),e.length>0){if(t.mode==="linear"){if(!(e.length===2||e.length===3||e.length===4&&e[0]===1&&e[1]===1||e.length===4&&e[0]===1&&e[3]===1||e.length===5&&e[0]===1&&e[1]===1))throw new Error(`For linear mode, Resize requires scales to be 2D, 3D, 4D with either two outermost or one innermost and
            one outermost scale values equal to 1, or 5D with two outermost scale values equal to 1`)}else if(t.mode==="cubic"&&!(e.length===2||e.length===4&&e[0]===1&&e[1]===1||e.length===4&&e[0]===1&&e[3]===1))throw new Error("Resize requires scales input size to be 2 or 4 for cubic mode")}},Lp=(e,t,r)=>{t.every(a=>a>=0&&a<r||(()=>{throw new Error("Resize requires axes input values to be positive and less than rank")}));let i=new Array(r).fill(1);return t.forEach((a,s)=>i[a]=e[s]),i},Wp=(e,t,r,i,a,s)=>{let[n,u,l]=r>10?[1,2,3]:[-1,e.length>1?1:-1,-1],p=e[0].dims.length;if(n>0&&e.length>n&&e[n].dims.length>0)e[n].getFloat32Array().forEach(h=>s.push(h));else if(t.coordinateTransformMode==="tf_crop_and_resize")throw new Error("Resize requires RoI input to be specified when coordinateTransformMode is tfCropAndResize");if(u>0&&e.length>u&&e[u].dims.length===1&&e[u].dims[0]>0){if(e[u].getFloat32Array().forEach(h=>i.push(h)),i.length!==0&&i.length!==p&&r>=18&&i.length!==t.axes.length)throw new Error("Resize requires scales input size to be same as input rank or axes size for opset 18 and up");qp(i,t),t.axes.length>0&&Lp(i,t.axes,p).forEach((h,c)=>i[c]=h)}if(l>0&&e.length>l&&e[l].dims.length===1&&e[l].dims[0]>0&&(e[l].getBigInt64Array().forEach(h=>a.push(Number(h))),a.length!==0&&a.length!==p&&r>=18&&a.length!==t.axes.length))throw new Error("Resize requires sizes input size to be same as input rank or axes size for opset 18 and up");if(t.axes.length>0){if(i.length!==0&&i.length!==t.axes.length)throw new Error('Resize requires "scales" input size to be of axes rank when axes attributes is specified');if(a.length!==0&&a.length!==t.axes.length)throw new Error('Resize requires "sizes" input size to be of rank axes rank when axes attributes is specified')}if(typeof i<"u"&&typeof a<"u"&&i.length>0&&a.length>p)throw new Error("Resize requires only of scales or sizes to be specified")},Ma=(e,t,r,i)=>`
  // The whole part and the fractional part are calculated separately due to inaccuracy of floating
  // point division. As an example, f32(21) / f32(7) may evaluate to 2.99... instead of 3, causing an
  // offset-by-one error later in floor().
  let big = (${e}) * (${t});
  let whole = ${i}(big / (${r}));
  let fract = ${i}(big % (${r})) / ${i}(${r});
  return whole + fract;
`,Vp=(e,t)=>`fn getOriginalCoordinateFromResizedCoordinate(xResized: u32, xScale: f32, lengthResized: u32,
     lengthOriginal: u32, roiStart: f32, roiEnd: f32) -> ${t} { `+(()=>{switch(e){case"asymmetric":return`
          if (xScale < 1.0 || floor(xScale) != xScale) {
            return ${t}(xResized) / ${t}(xScale);
          } else {
            ${Ma("xResized","lengthOriginal","lengthResized",t)}
          }
        `;case"pytorch_half_pixel":return`if (lengthResized > 1) {
                    return (${t}(xResized) + 0.5) / ${t}(xScale) - 0.5;
                  } else {
                    return 0.0;
                  }`;case"tf_half_pixel_for_nn":return`return (${t}(xResized) + 0.5) / ${t}(xScale);`;case"align_corners":return`if (lengthResized == 1) {
                    return 0.0;
                  } else {
                    ${Ma("xResized","lengthOriginal - 1","lengthResized - 1",t)}
                  }`;case"tf_crop_and_resize":return`if (lengthResized > 1) {
                    return ${t}(roiStart) * ${t}(lengthOriginal - 1) +
                        (${t}(xResized) * ${t}(roiEnd - roiStart) * ${t}(lengthOriginal - 1)) /
                        ${t}(lengthResized - 1);
                  } else {
                    return 0.5 * ${t}(roiStart + roiEnd) * ${t}(lengthOriginal - 1);
                  }`;case"half_pixel_symmetric":return`const outputWidth = ${t}xScale * ${t}(lengthResized);
                  const adjustment = ${t}(lengthResized) / outputWidth;
                  const center = ${t}(lengthOriginal) / 2;
                  const offset = center * (1 - adjustment);
                  return offset + ((${t}(xResized) + 0.5) / ${t}(xScale)) - 0.5;`;case"half_pixel":return`return ((${t}(xResized) + 0.5) / ${t}(xScale)) - 0.5;`;default:throw new Error(`Coordinate transform mode ${e} is not supported`)}})()+"}",Gp=(e,t,r)=>`fn getNearestPixelFromOriginal(xOriginal: ${r}, isDownSample: bool) -> ${r} {`+(()=>{switch(e){case"round_prefer_ceil":return"if (fract(xOriginal) == 0.5) {             return ceil(xOriginal);           } else {             return round(xOriginal);           }";case"floor":return"return floor(xOriginal);";case"ceil":return"return ceil(xOriginal);";case"round_prefer_floor":return"if (fract(xOriginal) == 0.5) {                     return floor(xOriginal);                   } else {                     return round(xOriginal);                   }";default:if(t<11)return"if (isDownSample)                     {                       return ceil(xOriginal);                     } else {                       return xOriginal;                     }";throw new Error(`Nearest mode ${e} is not supported`)}})()+"}",Hp=(e,t,r)=>{let i=new Array(r).fill(0).concat(new Array(r).fill(1)),a=e.length===0?i:e.slice();return t.length>0?(t.forEach((s,n)=>{i[s]=a[n],i[n+r]=a[t.length+n]}),i):a},Fp=(e,t,r,i)=>{let a=[];if(r.length>0)if(i.length>0){if(e.forEach(s=>a.push(s)),Math.max(...i)>e.length)throw new Error("axes is out of bound");i.forEach((s,n)=>a[s]=r[n])}else r.forEach(s=>a.push(s));else{if(t.length===0)throw new Error("Resize requires either scales or sizes.");a=e.map((s,n)=>Math.round(s*t[n]))}return a},jp=(e,t,r)=>{let i=(()=>{switch(r.keepAspectRatioPolicy){case"not_larger":return r.axes.length>0?Math.min(...r.axes.map(s=>t[s]),Number.MAX_VALUE):Math.min(...t,Number.MAX_VALUE);case"not_smaller":return r.axes.length>0?Math.max(...r.axes.map(s=>t[s]),Number.MIN_VALUE):Math.max(...t,Number.MIN_VALUE);default:throw new Error(`Keep aspect ratio policy ${r.keepAspectRatioPolicy} is not supported`)}})();t.fill(1,0,t.length);let a=e.slice();return r.axes.length>0?(r.axes.forEach(s=>t[s]=i),r.axes.forEach(s=>a[s]=Math.round(e[s]*t[s]))):(t.fill(i,0,t.length),a.forEach((s,n)=>a[n]=Math.round(s*t[n]))),a},Kp=(e,t,r,i,a)=>`
    fn calculateOriginalIndicesFromOutputIndices(output_indices: ${e.type.indices}) -> array<${e.type.value}, ${r.length}> {
      var original_indices: array<${e.type.value}, ${r.length}>;
      for (var i:u32 = 0; i < ${r.length}; i++) {
        var output_index = ${e.indicesGet("output_indices","i")};
        var scale = ${j("uniforms.scales","i",i)};
        var roi_low = ${j("uniforms.roi","i",a)};
        var roi_hi = ${j("uniforms.roi",`i + ${t.length}`,a)};
        if (scale == 1.0) {
          original_indices[i] = ${e.type.value}(output_index);
        } else {
          var input_shape_i = ${j("uniforms.input_shape","i",t.length)};
          var output_shape_i = ${j("uniforms.output_shape","i",r.length)};
          original_indices[i] = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                           input_shape_i, roi_low, roi_hi);
        }
      }
      return original_indices;
    }`,Zp=(e,t,r,i,a,s,n)=>`
    fn calculateInputIndicesFromOutputIndices(output_indices: ${t.type.indices}) -> ${e.type.indices} {
      var input_indices: ${e.type.indices};
      for (var i:u32 = 0; i < ${i.length}; i++) {
        var output_index = ${t.indicesGet("output_indices","i")};
        var input_index: u32;
        var scale = ${j("uniforms.scales","i",a)};
        if (scale == 1.0) {
          input_index = output_index;
        } else {
          var roi_low = ${j("uniforms.roi","i",s)};
          var roi_hi = ${j("uniforms.roi",`i + ${r.length}`,s)};
          var input_shape_i = ${j("uniforms.input_shape","i",r.length)};
          var output_shape_i = ${j("uniforms.output_shape","i",i.length)};
          var original_idx = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                        input_shape_i, roi_low, roi_hi);
          if (!${n} || (original_idx >= 0 && original_idx < ${t.type.value}(input_shape_i))) {
            if (original_idx < 0) {
              input_index = 0;
            } else if (original_idx > ${t.type.value}(input_shape_i - 1)) {
              input_index = input_shape_i - 1;
            } else {
              input_index = u32(getNearestPixelFromOriginal(original_idx, scale < 1));
            }
          } else {
            input_index = u32(original_idx);
          }
        }
        ${e.indicesSet("input_indices","i","input_index")}
      }
      return input_indices;
    }`,Xp=(e,t)=>`
    fn checkInputIndices(input_indices: ${e.type.indices}) -> bool {
      for (var i:u32 = 0; i < ${t.length}; i++) {
        var input_index = ${e.indicesGet("input_indices","i")};
        if (input_index < 0 || input_index >= ${j("uniforms.input_shape","i",t.length)}) {
          return false;
        }
      }
      return true;
    }`,Da=(e,t,r,i)=>e.rank>i?`
    ${e.indicesSet("input_indices",t,"channel")};
    ${e.indicesSet("input_indices",r,"batch")};
`:"",Qp=(e,t,r,i,a)=>{let[s,n,u,l]=r.length===2?[-1,0,1,-1]:[0,2,3,1],p=e.type.value;return`
    fn getInputValue(batch: u32, channel: u32, row: u32, col: u32) -> ${p} {
      var input_indices: ${e.type.indices};
      ${e.indicesSet("input_indices",n,`max(0, min(row, ${r[n]} - 1))`)};
      ${e.indicesSet("input_indices",u,`max(0, min(col, ${r[u]} - 1))`)};
      ${Da(e,l,s,2)}
      return ${e.getByIndices("input_indices")};
    }

    fn bilinearInterpolation(output_indices: ${t.type.indices}) -> ${p} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var row:${p} = originalIndices[${n}];
      var col:${p} = originalIndices[${u}];
      ${i?`if (row < 0 || row > (${r[n]} - 1) || col < 0 || col > (${r[u]} - 1)) {
        return ${a};
      }`:""};
      row = max(0, min(row, ${r[n]} - 1));
      col = max(0, min(col, ${r[u]} - 1));
      var row1: u32 = u32(row);
      var col1: u32 = u32(col);
      var row2: u32 = u32(row + 1);
      var col2: u32 = u32(col + 1);
      var channel: u32 = ${r.length>2?`u32(originalIndices[${l}])`:"0"};
      var batch: u32 =  ${r.length>2?`u32(originalIndices[${s}])`:"0"};
      var x11: ${p} = getInputValue(batch, channel, row1, col1);
      var x12: ${p} = getInputValue(batch, channel, row1, col2);
      var x21: ${p} = getInputValue(batch, channel, row2, col1);
      var x22: ${p} = getInputValue(batch, channel, row2, col2);
      var dx1: ${p} = abs(row - ${p}(row1));
      var dx2: ${p} = abs(${p}(row2) - row);
      var dy1: ${p} = abs(col - ${p}(col1));
      var dy2: ${p} = abs(${p}(col2) - col);
      if (row1 == row2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (col1 == col2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      return (x11 * dx2 * dy2 + x12 * dx2 * dy1 + x21 * dx1 * dy2 + x22 * dx1 * dy1);
    }`},Yp=(e,t,r,i,a,s,n,u,l,p)=>{let h=r.length===2,c=!0,[g,_]=h?[0,1]:c?[2,3]:[1,2],y=e.type.value,$=S=>{let x=S===g?"row":"col";return`
      fn ${x}CubicInterpolation(input_indices: ${e.type.indices}, output_indices: ${t.type.indices}) -> ${y} {
        var output_index = ${t.indicesGet("output_indices",S)};
        var originalIdx: ${y} = getOriginalCoordinateFromResizedCoordinate(output_index, ${a[S]},
        ${i[S]}, ${r[S]}, ${s[S]}, ${s[S]} + ${r.length});
        var fractOriginalIdx: ${y} = originalIdx - floor(originalIdx);
        var coefs = getCubicInterpolationCoefs(fractOriginalIdx);

        if (${u} && (originalIdx < 0 || originalIdx > (${r[S]} - 1))) {
          return ${l};
        }
        var data: array<${y}, 4> = array<${y}, 4>(0.0, 0.0, 0.0, 0.0);
        for (var i: i32 = -1; i < 3; i++) {
          var ${x}: ${y} = originalIdx + ${y}(i);
          if (${x} < 0 || ${x} >= ${r[S]}) {
            ${p?`coefs[i + 1] = 0.0;
                        continue;`:u?`return ${l};`:`${x} = max(0, min(${x}, ${r[S]} - 1));`};
          }
        var input_indices_copy: ${e.type.indices} = input_indices;
          ${e.indicesSet("input_indices_copy",S,`u32(${x})`)};
          data[i + 1] = ${S===g?e.getByIndices("input_indices_copy"):"rowCubicInterpolation(input_indices_copy, output_indices)"};
        }
        return cubicInterpolation1D(data, coefs);
      }`};return`
    ${$(g)};
    ${$(_)};
  fn getCubicInterpolationCoefs(s: ${y}) -> array<${y}, 4> {
    var absS = abs(s);
    var coeffs: array<${y}, 4> = array<${y}, 4>(0.0, 0.0, 0.0, 0.0);
    var oneMinusAbsS: ${y} = 1.0 - absS;
    var twoMinusAbsS: ${y} = 2.0 - absS;
    var onePlusAbsS: ${y} = 1.0 + absS;
    coeffs[0] = ((${n} * onePlusAbsS - 5 * ${n}) * onePlusAbsS + 8 * ${n}) * onePlusAbsS - 4 * ${n};
    coeffs[1] = ((${n} + 2) * absS - (${n} + 3)) * absS * absS + 1;
    coeffs[2] = ((${n} + 2) * oneMinusAbsS - (${n} + 3)) * oneMinusAbsS * oneMinusAbsS + 1;
    coeffs[3] = ((${n} * twoMinusAbsS - 5 * ${n}) * twoMinusAbsS + 8 * ${n}) * twoMinusAbsS - 4 * ${n};
    return coeffs;
  }

  fn cubicInterpolation1D(x: array<${y}, 4>, coefs: array<${y}, 4>) -> ${y} {
    var coefsSum: ${y} = coefs[0] + coefs[1] + coefs[2] + coefs[3];
    return (x[0] * coefs[0] + x[1] * coefs[1]+ x[2] * coefs[2]+ x[3] * coefs[3]) / coefsSum;
  }

  fn bicubicInterpolation(output_indices: ${t.type.indices}) -> ${y} {
    var input_indices: ${e.type.indices} = output_indices;
    return colCubicInterpolation(input_indices, output_indices);
  }
    `},Jp=(e,t,r,i,a)=>{let[s,n,u,l,p]=r.length===3?[-1,0,1,2,-1]:[0,2,3,4,1],h=e.type.value;return`
    fn getInputValue(batch: u32, channel: u32, depth:u32, height: u32, width: u32) -> ${h} {
      var input_indices: ${e.type.indices};
      ${e.indicesSet("input_indices",n,`max(0, min(depth, ${r[n]} - 1))`)};
      ${e.indicesSet("input_indices",u,`max(0, min(height, ${r[u]} - 1))`)};
      ${e.indicesSet("input_indices",l,`max(0, min(width, ${r[l]} - 1))`)};
      ${Da(e,p,s,3)}
      return ${e.getByIndices("input_indices")};
    }

    fn trilinearInterpolation(output_indices: ${t.type.indices}) -> ${h} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var depth:${h} = originalIndices[${n}];
      var height:${h} = originalIndices[${u}];
      var width:${h} = originalIndices[${l}];
      ${i?`if (depth < 0 || depth > (${r[n]} - 1) || height < 0 || height > (${r[u]} - 1) || width < 0 || (width > ${r[l]} - 1)) {
      return ${a};
        }`:""};

    depth = max(0, min(depth, ${r[n]} - 1));
      height = max(0, min(height, ${r[u]} - 1));
      width = max(0, min(width, ${r[l]} - 1));
      var depth1: u32 = u32(depth);
      var height1: u32 = u32(height);
      var width1: u32 = u32(width);
      var depth2: u32 = u32(depth + 1);
      var height2: u32 = u32(height + 1);
      var width2: u32 = u32(width + 1);
      var channel: u32 = ${r.length>3?`u32(originalIndices[${p}])`:"0"};
      var batch: u32 =  ${r.length>3?`u32(originalIndices[${s}])`:"0"};

      var x111: ${h} = getInputValue(batch, channel, depth1, height1, width1);
      var x112: ${h} = getInputValue(batch, channel, depth1, height1, width2);
      var x121: ${h} = getInputValue(batch, channel, depth1, height2, width1);
      var x122: ${h} = getInputValue(batch, channel, depth1, height2, width2);
      var x211: ${h} = getInputValue(batch, channel, depth2, height1, width1);
      var x212: ${h} = getInputValue(batch, channel, depth2, height1, width2);
      var x221: ${h} = getInputValue(batch, channel, depth2, height2, width1);
      var x222: ${h} = getInputValue(batch, channel, depth2, height2, width2);
      var dx1: ${h} = abs(depth - ${h}(depth1));
      var dx2: ${h} = abs(${h}(depth2) - depth);
      var dy1: ${h} = abs(height - ${h}(height1));
      var dy2: ${h} = abs(${h}(height2) - height);
      var dz1: ${h} = abs(width - ${h}(width1));
      var dz2: ${h} = abs(${h}(width2) - width);
      if (depth1 == depth2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (height1 == height2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      if (width1 == width2) {
        dz1 = 0.5;
        dz2 = 0.5;
      }
      return (x111 * dx2 * dy2 * dz2 + x112 * dx2 * dy2 * dz1 + x121 * dx2 * dy1 *dz2 + x122 * dx2 * dy1 * dz1 +
              x211 * dx1 * dy2 * dz2 + x212 * dx1 * dy2 * dz1 + x221 * dx1 * dy1 *dz2 + x222 * dx1 * dy1 * dz1);
    }`},ec=(e,t,r,i,a,s)=>{let n=e.dims,u=Hp(s,t.axes,n.length),l=Fp(n,i,a,t.axes),p=i.slice();i.length===0&&(p=n.map((b,E)=>b===0?1:l[E]/b),t.keepAspectRatioPolicy!=="stretch"&&(l=jp(n,p,t)));let h=G("output",e.dataType,l.length),c=B("input",e.dataType,n.length),g=O.size(l),_=n.length===l.length&&n.every((b,E)=>b===l[E]),y=t.coordinateTransformMode==="tf_crop_and_resize",$=t.extrapolationValue,S=c.type.value,x=b=>`
      ${_?"":`
      ${Vp(t.coordinateTransformMode,S)};
      ${(()=>{switch(t.mode){case"nearest":return`
              ${Xp(c,n)};
              ${Gp(t.nearestMode,r,S)};
              ${Zp(c,h,n,l,p.length,u.length,y)};
              `;case"linear":return`
              ${Kp(h,n,l,p.length,u.length)};
              ${(()=>{if(n.length===2||n.length===4)return`${Qp(c,h,n,y,$)}`;if(n.length===3||n.length===5)return`${Jp(c,h,n,y,$)}`;throw Error("Linear mode only supports input dims 2, 3, 4 and 5 are supported in linear mode.")})()};
            `;case"cubic":return`
            ${(()=>{if(n.length===2||n.length===4)return`${Yp(c,h,n,l,p,u,t.cubicCoeffA,y,t.extrapolationValue,t.excludeOutside)}`;throw Error("Cubic mode only supports input dims 2 and 4 are supported in linear mode.")})()};
            `;default:throw Error("Invalid resize mode")}})()};
      `}
      ${b.registerUniform("output_size","u32").registerUniform("scales","f32",p.length).registerUniform("roi","f32",u.length).declareVariables(c,h)}
      ${b.mainStart()}
        ${b.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
        ${_?"output[global_idx] = input[global_idx];":`
        let output_indices = ${h.offsetToIndices("global_idx")};
        var input_indices: ${c.type.indices};
        ${(()=>{switch(t.mode){case"nearest":return`input_indices = calculateInputIndicesFromOutputIndices(output_indices);
                if (checkInputIndices(input_indices)) {
                  output[global_idx] = ${c.getByIndices("input_indices")};
                } else {
                  output[global_idx] = ${t.extrapolationValue};
                }`;case"linear":return`output[global_idx] = ${n.length===2||n.length===4?"bilinearInterpolation":"trilinearInterpolation"}(output_indices);`;case"cubic":return"output[global_idx] = bicubicInterpolation(output_indices);";default:throw Error(`Unsupported resize mode: ${t.mode}`)}})()};
`}
      }`;return{name:"Resize",shaderCache:{hint:`${t.cacheKey}|${r}|${p.length>0?t.mode==="cubic"?p:p.length:""}|${a.length>0?a:""}|${u.length>0?u:""}|${_}|${t.mode==="nearest"?n.length:n}`,inputDependencies:["rank"]},getShaderSource:x,getRunData:()=>({outputs:[{dims:l,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(g/64)},programUniforms:[{type:12,data:g},{type:1,data:p},{type:1,data:u},...Z(n,l)]})}},tc=e=>{let t=e.customDataBuffer;return new Uint32Array(t.buffer,t.byteOffset,1)[0]},rc=(e,t)=>{let r=[],i=[],a=[],s=tc(e);if(t.antialias!==0)throw Error("Only default value (0) for Antialias attribute is supported");Wp(e.inputs,t,s,r,i,a),e.compute(ec(e.inputs[0],t,s,r,i,a),{inputs:[0]})},ic=e=>{let t=e.antialias,r=e.axes,i=e.coordinateTransformMode,a=e.cubicCoeffA,s=e.excludeOutside!==0,n=e.extrapolationValue,u=e.keepAspectRatioPolicy,l=e.mode,p=e.nearestMode===""?"simple":e.nearestMode;return he({antialias:t,axes:r,coordinateTransformMode:i,cubicCoeffA:a,excludeOutside:s,extrapolationValue:n,keepAspectRatioPolicy:u,mode:l,nearestMode:p})}}),ac,nc,sc,cg=P(()=>{"use strict";ee(),ie(),ae(),ac=e=>{if(!e||e.length<3)throw new Error("layerNorm requires at least 3 inputs.");let t=e[0],r=e[1],i=e[2];if(t.dataType!==r.dataType||t.dataType!==i.dataType)throw new Error("All inputs must have the same data type");if(t.dims.length!==3&&t.dims.length!==2)throw new Error("Input must be 2D or 3D");if(r.dims.length!==3&&r.dims.length!==2)throw new Error("Skip must be 2D or 3D");let a=t.dims[t.dims.length-1],s=t.dims[t.dims.length-2];if(r.dims[r.dims.length-1]!==a)throw new Error("Skip must have the same hidden size as input");if(r.dims[r.dims.length-2]!==s)throw new Error("Skip must have the same sequence length as input");if(i.dims.length!==1)throw new Error("Gamma must be 1D");if(i.dims[i.dims.length-1]!==a)throw new Error("Gamma must have the same hidden size as input");if(e.length>3){let n=e[3];if(n.dims.length!==1)throw new Error("Beta must be 1D");if(n.dims[n.dims.length-1]!==a)throw new Error("Beta must have the same hidden size as input")}if(e.length>4){let n=e[4];if(n.dims.length!==1)throw new Error("Bias must be 1D");if(n.dims[n.dims.length-1]!==a)throw new Error("Bias must have the same hidden size as input")}},nc=(e,t,r,i)=>{let a=t.simplified,s=e[0].dims,n=O.size(s),u=s,l=n,p=s.slice(-1)[0],h=i?s.slice(0,-1).concat(1):[],c=!a&&e.length>3,g=e.length>4,_=i&&r>1,y=i&&r>2,$=r>3,S=64,x=ke(p),b=[{type:12,data:l},{type:12,data:x},{type:12,data:p},{type:1,data:t.epsilon}],E=I=>{let z=[{name:"output_size",type:"u32"},{name:"components",type:"u32"},{name:"hidden_size",type:"u32"},{name:"epsilon",type:"f32"}],A=[B("x",e[0].dataType,e[0].dims,x),B("skip",e[1].dataType,e[1].dims,x),B("gamma",e[2].dataType,e[2].dims,x)];c&&A.push(B("beta",e[3].dataType,e[3].dims,x)),g&&A.push(B("bias",e[4].dataType,e[4].dims,x)),A.push(G("output",e[0].dataType,u,x)),_&&A.push(G("mean_output",1,h)),y&&A.push(G("inv_std_output",1,h)),$&&A.push(G("input_skip_bias_sum",e[0].dataType,u,x));let v=Ee(e[0].dataType),D=Ee(1,x);return`

      ${I.registerUniforms(z).declareVariables(...A)}
      var<workgroup> sum_shared : array<${D}, ${S}>;
      var<workgroup> sum_squared_shared : array<${D}, ${S}>;

      ${I.mainStart([S,1,1])}
        let ix = local_id.x;
        let iy = global_id.x / ${S};

        let hidden_size_vectorized: u32 = uniforms.hidden_size / uniforms.components;
        var stride = hidden_size_vectorized / ${S};
        let offset = ix * stride + iy * hidden_size_vectorized;
        let offset1d = stride * ix;
        if (ix == ${S-1}) {
          stride = hidden_size_vectorized - stride * ix;
        }
        for (var i: u32 = 0; i < stride; i++) {
          let skip_value = skip[offset + i];
          let bias_value = ${g?"bias[offset1d + i]":v+"(0.0)"};
          let input_value = x[offset + i];
          let value = input_value + skip_value + bias_value;
          ${$?"input_skip_bias_sum[offset + i] = value;":""}
          output[offset + i] = value;
          let f32_value = ${jt(v,x,"value")};
          sum_shared[ix] += f32_value;
          sum_squared_shared[ix] += f32_value * f32_value;
        }
        workgroupBarrier();

        var reduce_size : u32 = ${S};
        for (var curr_size = reduce_size >> 1;  curr_size > 0; curr_size = reduce_size >> 1) {
          reduce_size = curr_size + (reduce_size & 1);
          if (ix < curr_size) {
            sum_shared[ix] += sum_shared[ix + reduce_size];
            sum_squared_shared[ix] += sum_squared_shared[ix + reduce_size];
          }
          workgroupBarrier();
        }

        let sum = sum_shared[0];
        let square_sum = sum_squared_shared[0];
        let mean = ${dt("sum",x)} / f32(uniforms.hidden_size);
        let inv_std_dev = inverseSqrt(${dt("square_sum",x)} / f32(uniforms.hidden_size) ${a?"":"- mean * mean"} + uniforms.epsilon);
        ${_?"mean_output[global_idx] = mean;":""}
        ${y?"inv_std_output[global_idx] = inv_std_dev;":""}

        for (var i: u32 = 0; i < stride; i++) {
          output[offset + i] = (output[offset + i] ${a?"":`- ${v}(mean)`}) *
            ${v}(inv_std_dev) * gamma[offset1d + i]
            ${c?"+ beta[offset1d + i]":""};
        }
      }`},k=[{dims:u,dataType:e[0].dataType}];return r>1&&k.push({dims:h,dataType:1}),r>2&&k.push({dims:h,dataType:1}),r>3&&k.push({dims:s,dataType:e[0].dataType}),{name:"SkipLayerNormalization",shaderCache:{hint:`${x};${_};${y};${$}`,inputDependencies:e.map((I,z)=>"type")},getShaderSource:E,getRunData:()=>({outputs:k,dispatchGroup:{x:Math.ceil(l/p)},programUniforms:b})}},sc=(e,t)=>{ac(e.inputs);let r=[0];e.outputCount>1&&r.push(-3),e.outputCount>2&&r.push(-3),e.outputCount>3&&r.push(3),e.compute(nc(e.inputs,t,e.outputCount,!1),{outputs:r})}}),oc,hr,uc,Ua,lc,dc,pc,cc,hg=P(()=>{"use strict";ee(),ie(),Se(),ae(),oc=(e,t)=>{if(!e||e.length<1)throw new Error("too few inputs");if(t.axes.length!==0){if(t.axes.length!==t.starts.length||t.axes.length!==t.ends.length)throw new Error("axes, starts and ends must have the same length")}else if(t.starts.length!==t.ends.length)throw new Error("starts and ends must have the same length");e.slice(1).forEach((r,i)=>{if(e[i+1].dataType!==6&&e[i+1].dataType!==7)throw new Error(`Input ${i} must be an array of int32 or int64`)})},hr=(e,t)=>{let r=[];if(e.length>t)if(e[t].dataType===7)e[t].getBigInt64Array().forEach(i=>r.push(Number(i)));else if(e[t].dataType===6)e[t].getInt32Array().forEach(i=>r.push(Number(i)));else throw new Error(`Input ${t} must be an array of int32 or int64`);return r},uc=(e,t)=>{if(e.length>1){let r=hr(e,1),i=hr(e,2),a=hr(e,3);return a.length===0&&(a=[...Array(e[0].dims.length).keys()]),he({starts:r,ends:i,axes:a})}else return t},Ua=(e,t,r,i,a)=>{let s=e;return e<0&&(s+=r[i[t]]),a[t]<0?Math.max(0,Math.min(s,r[i[t]]-1)):Math.max(0,Math.min(s,r[i[t]]))},lc=(e,t,r)=>`fn calculateInputIndices(output_indices: ${t.type.indices}) -> ${e.type.indices} {
          var input_indices: ${e.type.indices};
          var carry = 0u;
          for (var i = ${r.length-1}; i >= 0; i--) {
            let input_shape_i = ${j("uniforms.input_shape","i",r.length)};
            let steps_i = ${j("uniforms.steps","i",r.length)};
            let signs_i = ${j("uniforms.signs","i",r.length)};
            let starts_i = ${j("uniforms.starts","i",r.length)};
            var output_index = ${t.indicesGet("output_indices","i")};
            var input_index = output_index * steps_i + starts_i + carry;
            carry = input_index / input_shape_i;
            input_index = input_index % input_shape_i;
            if (signs_i < 0) {
              input_index = input_shape_i - input_index - 1u + starts_i;
            }
            ${e.indicesSet("input_indices","i","input_index")};
          }
          return input_indices;
      }`,dc=(e,t)=>{let r=e[0].dims,i=O.size(r),a=t.axes.length>0?O.normalizeAxes(t.axes,r.length):[...Array(r.length).keys()],s=hr(e,4);s.forEach(x=>x!==0||(()=>{throw new Error("step cannot be 0")})),s.length===0&&(s=Array(a.length).fill(1));let n=t.starts.map((x,b)=>Ua(x,b,r,a,s)),u=t.ends.map((x,b)=>Ua(x,b,r,a,s));if(a.length!==n.length||a.length!==u.length)throw new Error("start, ends and axes should have the same number of elements");if(a.length!==r.length)for(let x=0;x<r.length;++x)a.includes(x)||(n.splice(x,0,0),u.splice(x,0,r[x]),s.splice(x,0,1));let l=s.map(x=>Math.sign(x));s.forEach((x,b,E)=>{if(x<0){let k=(u[b]-n[b])/x,I=n[b],z=I+k*s[b];n[b]=z,u[b]=I,E[b]=-x}});let p=r.slice(0);a.forEach((x,b)=>{p[x]=Math.ceil((u[x]-n[x])/s[x])});let h={dims:p,dataType:e[0].dataType},c=G("output",e[0].dataType,p.length),g=B("input",e[0].dataType,e[0].dims.length),_=O.size(p),y=[{name:"outputSize",type:"u32"},{name:"starts",type:"u32",length:n.length},{name:"signs",type:"i32",length:l.length},{name:"steps",type:"u32",length:s.length}],$=[{type:12,data:_},{type:12,data:n},{type:6,data:l},{type:12,data:s},...Z(e[0].dims,p)],S=x=>`
      ${x.registerUniforms(y).declareVariables(g,c)}
        ${lc(g,c,r)}
        ${x.mainStart()}
          ${x.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
          let output_indices = ${c.offsetToIndices("global_idx")};
          let input_indices = calculateInputIndices(output_indices);
          ${c.setByOffset("global_idx",g.getByIndices("input_indices"))}
      }`;return{name:"Slice",shaderCache:{hint:`${l.length}_${n.length}_${s.length}`,inputDependencies:["rank"]},getShaderSource:S,getRunData:()=>({outputs:[h],dispatchGroup:{x:Math.ceil(i/64)},programUniforms:$})}},pc=(e,t)=>{oc(e.inputs,t);let r=uc(e.inputs,t);e.compute(dc(e.inputs,r),{inputs:[0]})},cc=e=>{let t=e.starts,r=e.ends,i=e.axes;return he({starts:t,ends:r,axes:i})}}),hc,fc,mc,gc,fg=P(()=>{"use strict";ee(),ie(),Se(),pt(),ae(),hc=e=>{if(!e||e.length!==1)throw new Error("Softmax op requires 1 input.")},fc=(e,t)=>{let r=e.inputs[0],i=r.dims,a=O.size(i),s=i.length,n=O.normalizeAxis(t.axis,s),u=n<i.length-1,l,p=[];u?(p=Array.from({length:s},(A,v)=>v),p[n]=s-1,p[s-1]=n,l=e.compute(Ue(r,p),{inputs:[r],outputs:[-1]})[0]):l=r;let h=l.dims,c=h[s-1],g=a/c,_=ke(c),y=c/_,$=64;g===1&&($=256);let S=(A,v)=>v===4?`max(max(${A}.x, ${A}.y), max(${A}.z, ${A}.w))`:v===2?`max(${A}.x, ${A}.y)`:v===3?`max(max(${A}.x, ${A}.y), ${A}.z)`:A,x=B("x",l.dataType,l.dims,_),b=G("result",l.dataType,l.dims,_),E=x.type.value,k=Ee(l.dataType)==="f32"?`var threadMax = ${E}(-3.4028234663852886e+38f);`:`var threadMax = ${E}(-65504.0h);`,I=A=>`
      var<workgroup> rowMaxShared : ${E};
      var<workgroup> rowSumShared : ${E};
      var<workgroup> threadShared : array<${E}, ${$}>;

      fn getValue(row: i32, col: i32, row_stride: i32) -> ${E} {
        let index = row * row_stride + col;
        return x[index];
      }

      fn setValue(row: i32, col: i32, row_stride: i32, value: ${E}) {
        let index = row * row_stride + col;
        result[index] = value;
      }
      ${A.registerUniform("packedCols","i32").declareVariables(x,b)}
      ${A.mainStart($)}
        let gindex = i32(global_idx);
        let lindex = i32(local_idx);
        const wg = ${$};
        let row = gindex / wg;
        let cols = uniforms.packedCols;
        let row_stride : i32 = uniforms.packedCols;

        // find the rows max
        ${k}
        for (var col = lindex; col < cols; col += wg) {
          let value = getValue(row, col, row_stride);
          threadMax = max(threadMax, value);
        }
        if (lindex < cols) {
          threadShared[lindex] = threadMax;
        }
        workgroupBarrier();

        var reduceSize = min(cols, wg);
        for (var currSize = reduceSize >> 1;  currSize > 0; currSize = reduceSize >> 1) {
          reduceSize = currSize + (reduceSize & 1);
          if (lindex < currSize) {
            threadShared[lindex] = max(threadShared[lindex], threadShared[lindex + reduceSize]);
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowMaxShared = ${E}(${S("threadShared[0]",_)});
        }
        workgroupBarrier();

        // find the rows sum
        var threadSum = ${E}(0.0);
        for (var col = lindex; col < cols; col += wg) {
          let subExp = exp(getValue(row, col, row_stride) - rowMaxShared);
          threadSum += subExp;
        }
        threadShared[lindex] = threadSum;
        workgroupBarrier();

        for (var currSize = wg >> 1;  currSize > 0; currSize = currSize >> 1) {
          if (lindex < currSize) {
            threadShared[lindex] = threadShared[lindex] + threadShared[lindex + currSize];
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowSumShared = ${E}(${dt("threadShared[0]",_)});
        }
        workgroupBarrier();

        // calculate final value for each element in the row
        for (var col = lindex; col < cols; col += wg) {
          var value = exp(getValue(row, col, row_stride) - rowMaxShared) / rowSumShared;
          // max operation protects against NaN since all values should be >=0
          value = max(value, ${E}(0.0));
          setValue(row, col, row_stride, value);
        }
      }`,z=e.compute({name:"Softmax",shaderCache:{hint:`${_};${$}`,inputDependencies:["type"]},getRunData:()=>({outputs:[{dims:h,dataType:l.dataType}],dispatchGroup:{x:g},programUniforms:[{type:6,data:y}]}),getShaderSource:I},{inputs:[l],outputs:[u?-1:0]})[0];u&&e.compute(Ue(z,p),{inputs:[z]})},mc=(e,t)=>{hc(e.inputs),fc(e,t)},gc=e=>he({axis:e.axis})}),Pa,yc,_c,bc,wc,mg=P(()=>{"use strict";ee(),ie(),ae(),Pa=e=>Array.from(e.getBigInt64Array(),Number),yc=e=>{if(!e||e.length!==2)throw new Error("Tile requires 2 inputs.");if(e[0].dataType!==1&&e[0].dataType!==10&&e[0].dataType!==6&&e[0].dataType!==12)throw new Error("Tile only support float, float16, int32, and uint32 data types");if(e[1].dataType!==7)throw new Error("Tile `repeats` input should be of int64 data type");if(e[1].dims.length!==1)throw new Error("Tile `repeats` input should be 1-D");if(Pa(e[1]).length!==e[0].dims.length)throw new Error("Tile `repeats` input should have same number of elements as rank of input data tensor")},_c=(e,t)=>{let r=[];for(let i=0;i<e.length;++i)r.push(e[i]*t[i]);return r},bc=(e,t)=>{let r=e[0].dims,i=t??Pa(e[1]),a=_c(r,i),s=O.size(a),n=e[0].dataType,u=B("input",n,r.length),l=G("output",n,a.length),p=h=>`
      const inputShape = ${u.indices(...r)};
      ${h.registerUniform("output_size","u32").declareVariables(u,l)}
      ${h.mainStart()}
      ${h.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let output_indices = ${l.offsetToIndices("global_idx")};
      var input_indices: ${u.type.indices};
      for (var i = 0; i < ${r.length}; i++) {
        let input_dim_i = ${u.indicesGet("uniforms.input_shape","i")};
        let input_dim_value = ${l.indicesGet("output_indices","i")}  % input_dim_i;

        ${u.indicesSet("input_indices","i","input_dim_value")}
      }
      ${l.setByOffset("global_idx",u.getByIndices("input_indices"))}
    }`;return{name:"Tile",shaderCache:{hint:`${i}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:a,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(s/64)},programUniforms:[{type:12,data:s},...Z(e[0].dims,a)]}),getShaderSource:p}},wc=e=>{yc(e.inputs),e.compute(bc(e.inputs),{inputs:[0]})}}),$c,vc,xc,gg=P(()=>{"use strict";ee(),ie(),ae(),$c=(e,t,r,i,a)=>{let s=G("output_data",a,r.length,4),n=B("a_data",t[1].dataType,t[1].dims.length,4),u=B("b_data",t[2].dataType,t[2].dims.length,4),l=B("c_data",t[0].dataType,t[0].dims.length,4),p,h=(c,g,_)=>`select(${g}, ${c}, ${_})`;if(!i)p=s.setByOffset("global_idx",h(n.getByOffset("global_idx"),u.getByOffset("global_idx"),l.getByOffset("global_idx")));else{let c=(g,_,y="")=>{let $=`a_data[index_a${_}][component_a${_}]`,S=`b_data[index_b${_}][component_b${_}]`,x=`bool(c_data[index_c${_}] & (0xffu << (component_c${_} * 8)))`;return`
            let output_indices${_} = ${s.offsetToIndices(`global_idx * 4u + ${_}u`)};
            let offset_a${_} = ${n.broadcastedIndicesToOffset(`output_indices${_}`,s)};
            let offset_b${_} = ${u.broadcastedIndicesToOffset(`output_indices${_}`,s)};
            let offset_c${_} = ${l.broadcastedIndicesToOffset(`output_indices${_}`,s)};
            let index_a${_} = offset_a${_} / 4u;
            let index_b${_} = offset_b${_} / 4u;
            let index_c${_} = offset_c${_} / 4u;
            let component_a${_} = offset_a${_} % 4u;
            let component_b${_} = offset_b${_} % 4u;
            let component_c${_} = offset_c${_} % 4u;
            ${g}[${_}] = ${y}(${h($,S,x)});
          `};a===9?p=`
            var data = vec4<u32>(0);
            ${c("data",0,"u32")}
            ${c("data",1,"u32")}
            ${c("data",2,"u32")}
            ${c("data",3,"u32")}
            output_data[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:p=`
            ${c("output_data[global_idx]",0)}
            ${c("output_data[global_idx]",1)}
            ${c("output_data[global_idx]",2)}
            ${c("output_data[global_idx]",3)}
          `}return`
        ${e.registerUniform("vec_size","u32").declareVariables(l,n,u,s)}
        ${e.mainStart()}
        ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${p}
      }`},vc=e=>{let t=e[1].dims,r=e[2].dims,i=e[0].dims,a=e[1].dataType,s=!(O.areEqual(t,r)&&O.areEqual(r,i)),n=t,u=O.size(t);if(s){let p=Ht.calcShape(Ht.calcShape(t,r,!1),i,!1);if(!p)throw new Error("Can't perform where op on the given tensors");n=p,u=O.size(n)}let l=Math.ceil(u/4);return{name:"Where",shaderCache:{inputDependencies:["rank","rank","rank"]},getShaderSource:p=>$c(p,e,n,s,a),getRunData:()=>({outputs:[{dims:n,dataType:a}],dispatchGroup:{x:Math.ceil(u/64/4)},programUniforms:[{type:12,data:l},...Z(i,t,r,n)]})}},xc=e=>{e.compute(vc(e.inputs))}}),Sc,yg=P(()=>{"use strict";Cm(),Xi(),Am(),Om(),Rm(),Bm(),Nm(),qm(),Wm(),Vm(),Gm(),Hm(),Fm(),jm(),Km(),Zm(),Xm(),Qm(),Ym(),Jm(),eg(),tg(),rg(),ig(),ag(),ng(),Md(),sg(),og(),ug(),lg(),dg(),ji(),pg(),Fd(),cg(),hg(),fg(),Vd(),mg(),pt(),ea(),gg(),Sc=new Map([["Abs",[Zo]],["Acos",[Xo]],["Acosh",[Qo]],["Add",[Pu]],["ArgMax",[Bo,Zi]],["ArgMin",[Ro,Zi]],["Asin",[Yo]],["Asinh",[Jo]],["Atan",[eu]],["Atanh",[tu]],["Attention",[qo]],["AveragePool",[vp,$p]],["BatchNormalization",[Go]],["BiasAdd",[jo]],["BiasSplitGelu",[Mu]],["Cast",[iu,ru]],["Ceil",[su]],["Clip",[nu]],["Concat",[Ju,el]],["Conv",[ha,pa]],["ConvTranspose",[Il,Sl]],["Cos",[ou]],["Cosh",[uu]],["CumSum",[zl,Cl]],["DepthToSpace",[Bl,Nl]],["DequantizeLinear",[Ap,Op]],["DFT",[Wl,Vl]],["Div",[qu]],["Einsum",[Zl,Xl]],["Elu",[lu,sr]],["Equal",[Lu]],["Erf",[du]],["Exp",[pu]],["Expand",[ed]],["FastGelu",[rd]],["Floor",[cu]],["FusedConv",[ha,pa]],["Gather",[sd,nd]],["GatherElements",[yd,gd]],["GatherBlockQuantized",[cd,hd]],["GatherND",[ud,ld]],["Gelu",[hu]],["Gemm",[$d,wd]],["GlobalAveragePool",[Sp,xp]],["GlobalMaxPool",[Ep,Ip]],["Greater",[Hu]],["GreaterOrEqual",[ju]],["GridSample",[Cd,Ad]],["GroupQueryAttention",[Xd]],["HardSigmoid",[$u,wu]],["HardSwish",[vu]],["InstanceNormalization",[Jd]],["LayerNormalization",[rp]],["LeakyRelu",[fu,sr]],["Less",[Fu]],["LessOrEqual",[Ku]],["Log",[Cu]],["MatMul",[ap]],["MatMulNBits",[up,lp]],["MaxPool",[kp,Tp]],["Mul",[Wu]],["MultiHeadAttention",[Nd,Rd]],["Neg",[gu]],["Not",[mu]],["Pad",[_p]],["Pow",[Vu]],["QuickGelu",[Ru,sr]],["Range",[Np]],["Reciprocal",[yu]],["ReduceMin",[Eo]],["ReduceMean",[xo]],["ReduceMax",[Io]],["ReduceSum",[Co]],["ReduceProd",[zo]],["ReduceL1",[So]],["ReduceL2",[ko]],["ReduceLogSum",[Oo]],["ReduceLogSumExp",[To]],["ReduceSumSquare",[Ao]],["Relu",[_u]],["Resize",[rc,ic]],["RotaryEmbedding",[Hd]],["ScatterND",[Pp,Up]],["Sigmoid",[bu]],["Sin",[xu]],["Sinh",[Su]],["Slice",[pc,cc]],["SkipLayerNormalization",[sc]],["Split",[Ld,Wd]],["Sqrt",[ku]],["Softmax",[mc,gc]],["Sub",[Gu]],["Tan",[Tu]],["Tanh",[Iu]],["ThresholdedRelu",[zu,sr]],["Tile",[wc]],["Transpose",[Vs,Gs]],["Where",[xc]]])}),kc,_g=P(()=>{"use strict";qe(),at(),ae(),kc=class{constructor(e){this.backend=e,this.repo=new Map,this.attributesBound=!1}getArtifact(e){return this.repo.get(e)}setArtifact(e,t){this.repo.set(e,t)}run(e,t,r,i,a){Qe(e.programInfo.name);let s=this.backend.device,n=this.backend.getComputePassEncoder();this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2);let u=[];for(let p of t)u.push({binding:u.length,resource:{buffer:p.buffer}});for(let p of r)u.push({binding:u.length,resource:{buffer:p.buffer}});a&&u.push({binding:u.length,resource:a});let l=s.createBindGroup({layout:e.computePipeline.getBindGroupLayout(0),entries:u,label:e.programInfo.name});if(this.backend.sessionStatus==="capturing"){let p={kernelId:this.backend.currentKernelId,computePipeline:e.computePipeline,bindGroup:l,dispatchGroup:i};this.backend.capturedCommandList.get(this.backend.currentSessionId).push(p)}n.setPipeline(e.computePipeline),n.setBindGroup(0,l),n.dispatchWorkgroups(...i),this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2+1),this.backend.pendingDispatchNumber++,(this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber||this.backend.queryType==="at-passes")&&this.backend.endComputePass(),this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber&&this.backend.flush(),Ve(e.programInfo.name)}dispose(){}build(e,t){Qe(e.name);let r=this.backend.device,i=[];[{feature:"shader-f16",extension:"f16"},{feature:"subgroups",extension:"subgroups"}].forEach(p=>{r.features.has(p.feature)&&i.push(`enable ${p.extension};`)});let a=Ds(t,this.backend.device.limits),s=e.getShaderSource(a),n=`${i.join(`
`)}
${a.additionalImplementations}
${s}`,u=r.createShaderModule({code:n,label:e.name});de("verbose",()=>`[WebGPU] ${e.name} shader code: ${n}`);let l=r.createComputePipeline({compute:{module:u,entryPoint:"main"},layout:"auto",label:e.name});return Ve(e.name),{programInfo:e,computePipeline:l,uniformVariablesInfo:a.variablesInfo}}normalizeDispatchGroupSize(e){let t=typeof e=="number"?e:e.x,r=typeof e=="number"?1:e.y||1,i=typeof e=="number"?1:e.z||1,a=this.backend.device.limits.maxComputeWorkgroupsPerDimension;if(t<=a&&r<=a&&i<=a)return[t,r,i];let s=t*r*i,n=Math.ceil(Math.sqrt(s));if(n>a){if(n=Math.ceil(Math.cbrt(s)),n>a)throw new Error("Total dispatch size exceeds WebGPU maximum.");return[n,n,n]}else return[n,n,1]}}}),Tc={};Vt(Tc,{WebGpuBackend:()=>Cc});var Ic,Ec,zc,Cc,bg=P(()=>{"use strict";qe(),ee(),at(),vs(),Em(),yg(),_g(),Ic=(e,t)=>{if(t.length!==e.length)throw new Error(`inputDependencies length ${t.length} is not equal to inputTensors length ${e.length}.`);let r=[];for(let i=0;i<e.length;++i){let a=e[i].dataType;switch(t[i]){case"none":{r.push("");break}case"type":{r.push(`${a}`);break}case"rank":{let s=e[i].dims.length;r.push(`${a};${s}`);break}case"dims":{let s=e[i].dims.join(",");r.push(`${a};${s}`);break}default:throw new Error(`unsupported input dependency: ${t[i]}`)}}return r.join("|")},Ec=(e,t,r)=>{let i=e.name;return e.shaderCache?.hint&&(i+="["+e.shaderCache.hint+"]"),i+=":"+r+`:${Ic(t,e.shaderCache?.inputDependencies??new Array(t.length).fill("dims"))}`,i},zc=class{constructor(e){e&&(this.architecture=e.architecture,this.vendor=e.vendor)}isArchitecture(e){return this.architecture===e}isVendor(e){return this.vendor===e}},Cc=class{constructor(){this.currentSessionId=null,this.currentKernelId=null,this.commandEncoder=null,this.computePassEncoder=null,this.maxDispatchNumber=16,this.pendingDispatchNumber=0,this.pendingKernels=[],this.pendingQueries=new Map,this.sessionStatus="default",this.capturedCommandList=new Map,this.capturedPendingKernels=new Map,this.sessionExternalDataMapping=new Map}get currentKernelCustomData(){if(this.currentKernelId===null)throw new Error("currentKernelCustomData(): currentKernelId is null. (should not happen)");let e=this.kernelCustomData.get(this.currentKernelId);return e||(e={},this.kernelCustomData.set(this.currentKernelId,e)),e}async initialize(e,t){this.env=e;let r=[],i={requiredLimits:{maxComputeWorkgroupStorageSize:t.limits.maxComputeWorkgroupStorageSize,maxComputeWorkgroupsPerDimension:t.limits.maxComputeWorkgroupsPerDimension,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize,maxBufferSize:t.limits.maxBufferSize,maxComputeInvocationsPerWorkgroup:t.limits.maxComputeInvocationsPerWorkgroup,maxComputeWorkgroupSizeX:t.limits.maxComputeWorkgroupSizeX,maxComputeWorkgroupSizeY:t.limits.maxComputeWorkgroupSizeY,maxComputeWorkgroupSizeZ:t.limits.maxComputeWorkgroupSizeZ},requiredFeatures:r},a=u=>t.features.has(u)&&r.push(u)&&!0;a("chromium-experimental-timestamp-query-inside-passes")||a("timestamp-query"),a("shader-f16"),a("subgroups"),this.device=await t.requestDevice(i);let s=t,n=t.info??(typeof s.requestAdapterInfo=="function"?await s.requestAdapterInfo():void 0);this.adapterInfo=new zc(n),this.gpuDataManager=Rs(this),this.programManager=new kc(this),this.kernels=new Map,this.kernelPersistentData=new Map,this.kernelCustomData=new Map,Ai(e.logLevel,!!e.debug),this.device.onuncapturederror=u=>{u.error instanceof GPUValidationError&&console.error(`An uncaught WebGPU validation error was raised: ${u.error.message}`)},Object.defineProperty(this.env.webgpu,"device",{value:this.device,writable:!1,enumerable:!0,configurable:!0}),Object.defineProperty(this.env.webgpu,"adapter",{value:t,writable:!1,enumerable:!0,configurable:!1}),this.setQueryType()}dispose(){typeof this.querySet<"u"&&this.querySet.destroy(),this.gpuDataManager.dispose(),this.device&&this.env?.webgpu&&this.device.lost.then(()=>{delete this.env.webgpu.device})}getCommandEncoder(){return this.commandEncoder||(this.commandEncoder=this.device.createCommandEncoder()),this.commandEncoder}getComputePassEncoder(){if(!this.computePassEncoder){let e=this.getCommandEncoder(),t={};this.queryType==="at-passes"&&(t.timestampWrites={querySet:this.querySet,beginningOfPassWriteIndex:this.pendingDispatchNumber*2,endOfPassWriteIndex:this.pendingDispatchNumber*2+1}),this.computePassEncoder=e.beginComputePass(t)}return this.computePassEncoder}endComputePass(){this.computePassEncoder&&(this.computePassEncoder.end(),this.computePassEncoder=null)}flush(){if(!this.commandEncoder)return;Qe(),this.endComputePass();let e;this.queryType!=="none"&&(this.commandEncoder.resolveQuerySet(this.querySet,0,this.pendingDispatchNumber*2,this.queryResolveBuffer,0),e=this.device.createBuffer({size:this.pendingDispatchNumber*2*8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.pendingQueries.set(e,this.pendingKernels),this.pendingKernels=[],this.commandEncoder.copyBufferToBuffer(this.queryResolveBuffer,0,e,0,this.pendingDispatchNumber*2*8)),this.device.queue.submit([this.commandEncoder.finish()]),this.gpuDataManager.refreshPendingBuffers(),this.commandEncoder=null,this.pendingDispatchNumber=0,this.queryType!=="none"&&e.mapAsync(GPUMapMode.READ).then(()=>{let t=new BigUint64Array(e.getMappedRange()),r=this.pendingQueries.get(e);for(let i=0;i<t.length/2;i++){let a=r[i],s=a.kernelId,n=this.kernels.get(s),u=n.kernelType,l=n.kernelName,p=a.programName,h=a.inputTensorViews,c=a.outputTensorViews,g=t[i*2],_=t[i*2+1];typeof this.queryTimeBase>"u"&&(this.queryTimeBase=g);let y=Number(g-this.queryTimeBase),$=Number(_-this.queryTimeBase);if(!Number.isSafeInteger(y)||!Number.isSafeInteger($))throw new RangeError("incorrect timestamp range");if(this.env.webgpu.profiling?.ondata)this.env.webgpu.profiling.ondata({version:1,inputsMetadata:h.map(S=>({dims:S.dims,dataType:it(S.dataType)})),outputsMetadata:c.map(S=>({dims:S.dims,dataType:it(S.dataType)})),kernelId:s,kernelType:u,kernelName:l,programName:p,startTime:y,endTime:$});else{let S="";h.forEach((b,E)=>{S+=`input[${E}]: [${b.dims}] | ${it(b.dataType)}, `});let x="";c.forEach((b,E)=>{x+=`output[${E}]: [${b.dims}] | ${it(b.dataType)}, `}),console.log(`[profiling] kernel "${s}|${u}|${l}|${p}" ${S}${x}start time: ${y} ns, execution time: ${$-y} ns`)}xr("GPU",`${p}::${g}::${_}`)}e.unmap(),this.pendingQueries.delete(e)}),Ve()}run(e,t,r,i,a,s){Qe(e.name);let n=[];for(let b=0;b<t.length;++b){let E=t[b].data;if(E===0)continue;let k=this.gpuDataManager.get(E);if(!k)throw new Error(`no GPU data for input: ${E}`);n.push(k)}let{outputs:u,dispatchGroup:l,programUniforms:p}=e.getRunData(t),h=r.length===0?u.map((b,E)=>E):r;if(h.length!==u.length)throw new Error(`Output size ${h.length} must be equal to ${u.length}.`);let c=[],g=[];for(let b=0;b<u.length;++b){if(!Number.isInteger(h[b])||h[b]<-3||h[b]>=s)throw new Error(`Invalid output index: ${h[b]}`);if(h[b]===-3)continue;let E=h[b]===-1,k=h[b]===-2,I=E||k?a(u[b].dataType,u[b].dims):i(h[b],u[b].dataType,u[b].dims);if(c.push(I),I.data===0)continue;let z=this.gpuDataManager.get(I.data);if(!z)throw new Error(`no GPU data for output: ${I.data}`);if(E&&this.temporaryData.push(z),k){let A=this.kernelPersistentData.get(this.currentKernelId);A||(A=[],this.kernelPersistentData.set(this.currentKernelId,A)),A.push(z)}g.push(z)}if(n.length!==t.length||g.length!==c.length){if(g.length===0)return Ve(e.name),c;throw new Error(`Program ${e.name} has zero-sized tensor(s) in inputs or outputs. This is not supported now.`)}let _;if(p){let b=0,E=[];p.forEach(A=>{let v=typeof A.data=="number"?[A.data]:A.data;if(v.length===0)return;let D=A.type===10?2:4,q,Q;A.type===10?(Q=v.length>4?16:v.length>2?8:v.length*D,q=v.length>4?16:D*v.length):(Q=v.length<=2?v.length*D:16,q=16),b=Math.ceil(b/Q)*Q,E.push(b);let F=A.type===10?8:4;b+=v.length>4?Math.ceil(v.length/F)*q:v.length*D});let k=16;b=Math.ceil(b/k)*k;let I=new ArrayBuffer(b);p.forEach((A,v)=>{let D=E[v],q=typeof A.data=="number"?[A.data]:A.data;if(A.type===6)new Int32Array(I,D,q.length).set(q);else if(A.type===12)new Uint32Array(I,D,q.length).set(q);else if(A.type===10)new Uint16Array(I,D,q.length).set(q);else if(A.type===1)new Float32Array(I,D,q.length).set(q);else throw new Error(`Unsupported uniform type: ${it(A.type)}`)});let z=this.gpuDataManager.create(b,GPUBufferUsage.COPY_DST|GPUBufferUsage.UNIFORM);this.device.queue.writeBuffer(z.buffer,0,I,0,b),this.gpuDataManager.release(z.id),_={offset:0,size:b,buffer:z.buffer}}let y=this.programManager.normalizeDispatchGroupSize(l),$=y[1]===1&&y[2]===1,S=Ec(e,t,$),x=this.programManager.getArtifact(S);if(x||(x=this.programManager.build(e,y),this.programManager.setArtifact(S,x),de("info",()=>`[artifact] key: ${S}, programName: ${e.name}`)),p&&x.uniformVariablesInfo){if(p.length!==x.uniformVariablesInfo.length)throw new Error(`Uniform variables count mismatch: expect ${x.uniformVariablesInfo.length}, got ${p.length} in program "${x.programInfo.name}".`);for(let b=0;b<p.length;b++){let E=p[b],k=E.type,I=typeof E.data=="number"?1:E.data.length,[z,A]=x.uniformVariablesInfo[b];if(k!==z||I!==A)throw new Error(`Uniform variable ${b} mismatch: expect type ${z} with size ${A}, got type ${k} with size ${I} in program "${x.programInfo.name}".`)}}if(de("info",()=>`[ProgramManager] run "${e.name}" (key=${S}) with ${y[0]}x${y[1]}x${y[2]}`),this.queryType!=="none"||this.sessionStatus==="capturing"){let b={kernelId:this.currentKernelId,programName:x.programInfo.name,inputTensorViews:t,outputTensorViews:c};this.pendingKernels.push(b),this.sessionStatus==="capturing"&&this.capturedPendingKernels.get(this.currentSessionId).push(b)}return this.programManager.run(x,n,g,y,_),Ve(e.name),c}upload(e,t){this.gpuDataManager.upload(e,t)}memcpy(e,t){this.gpuDataManager.memcpy(e,t)}async download(e,t){await this.gpuDataManager.download(e,t)}alloc(e){return this.gpuDataManager.create(e).id}free(e){return this.gpuDataManager.release(e)}createKernel(e,t,r,i){let a=Sc.get(e);if(!a)throw new Error(`kernel not implemented: ${e}`);let s={kernelType:e,kernelName:i,kernelEntry:a[0],attributes:[a[1],r]};this.kernels.set(t,s)}releaseKernel(e){let t=this.kernelPersistentData.get(e);if(t){for(let r of t)this.gpuDataManager.release(r.id);this.kernelPersistentData.delete(e)}this.kernelCustomData.delete(e),this.kernels.delete(e)}computeKernel(e,t,r){let i=this.kernels.get(e);if(!i)throw new Error(`kernel not created: ${e}`);let a=i.kernelType,s=i.kernelName,n=i.kernelEntry,u=i.attributes;if(this.currentKernelId!==null)throw new Error(`kernel "[${a}] ${s}" is not allowed to be called recursively`);this.currentKernelId=e,u[0]&&(u[1]=u[0](u[1]),u[0]=void 0),de("info",()=>`[WebGPU] Start to run kernel "[${a}] ${s}"...`);let l=this.env.debug;this.temporaryData=[];try{return l&&this.device.pushErrorScope("validation"),n(t,u[1]),0}catch(p){return r.push(Promise.resolve(`[WebGPU] Kernel "[${a}] ${s}" failed. ${p}`)),1}finally{l&&r.push(this.device.popErrorScope().then(p=>p?`GPU validation error for kernel "[${a}] ${s}": ${p.message}`:null));for(let p of this.temporaryData)this.gpuDataManager.release(p.id);this.temporaryData=[],this.currentKernelId=null}}registerBuffer(e,t,r,i){let a=this.sessionExternalDataMapping.get(e);a||(a=new Map,this.sessionExternalDataMapping.set(e,a));let s=a.get(t),n=this.gpuDataManager.registerExternalBuffer(r,i,s);return a.set(t,[n,r]),n}unregisterBuffers(e){let t=this.sessionExternalDataMapping.get(e);t&&(t.forEach(r=>this.gpuDataManager.unregisterExternalBuffer(r[0])),this.sessionExternalDataMapping.delete(e))}getBuffer(e){let t=this.gpuDataManager.get(e);if(!t)throw new Error(`no GPU data for buffer: ${e}`);return t.buffer}createDownloader(e,t,r){return async()=>{let i=await Wi(this,e,t);return Oi(i.buffer,r)}}writeTimestamp(e){this.queryType==="inside-passes"&&this.computePassEncoder.writeTimestamp(this.querySet,e)}setQueryType(){this.queryType="none",(this.env.webgpu.profiling?.mode==="default"||(typeof this.env.trace>"u"?this.env.wasm.trace:this.env.trace))&&(this.device.features.has("chromium-experimental-timestamp-query-inside-passes")?this.queryType="inside-passes":this.device.features.has("timestamp-query")&&(this.queryType="at-passes"),this.queryType!=="none"&&typeof this.querySet>"u"&&(this.querySet=this.device.createQuerySet({type:"timestamp",count:this.maxDispatchNumber*2}),this.queryResolveBuffer=this.device.createBuffer({size:this.maxDispatchNumber*2*8,usage:GPUBufferUsage.COPY_SRC|GPUBufferUsage.QUERY_RESOLVE})))}captureBegin(){de("info","captureBegin"),this.capturedCommandList.get(this.currentSessionId)||this.capturedCommandList.set(this.currentSessionId,[]),this.capturedPendingKernels.get(this.currentSessionId)||this.capturedPendingKernels.set(this.currentSessionId,[]),this.flush(),this.sessionStatus="capturing"}captureEnd(){de("info","captureEnd"),this.flush(),this.sessionStatus="default"}replay(){de("info","replay"),this.sessionStatus="replaying";let e=this.capturedCommandList.get(this.currentSessionId),t=this.capturedPendingKernels.get(this.currentSessionId),r=e.length;this.pendingKernels=[];for(let i=0;i<r;i++){let a=this.getComputePassEncoder(),s=e[i];this.writeTimestamp(this.pendingDispatchNumber*2),a.setPipeline(s.computePipeline),a.setBindGroup(0,s.bindGroup),a.dispatchWorkgroups(...s.dispatchGroup),this.writeTimestamp(this.pendingDispatchNumber*2+1),this.pendingDispatchNumber++,this.queryType!=="none"&&this.pendingKernels.push(t[i]),(this.pendingDispatchNumber>=this.maxDispatchNumber||this.queryType==="at-passes")&&this.endComputePass(),this.pendingDispatchNumber>=this.maxDispatchNumber&&this.flush()}this.flush(),this.sessionStatus="default"}onCreateSession(){this.gpuDataManager.onCreateSession()}onReleaseSession(e){this.unregisterBuffers(e),this.capturedCommandList.has(e)&&this.capturedCommandList.delete(e),this.capturedPendingKernels.has(e)&&this.capturedPendingKernels.delete(e),this.gpuDataManager.onReleaseSession(e)}onRunStart(e){this.currentSessionId=e,this.setQueryType()}}}),Ac={};Vt(Ac,{init:()=>Rc});var Wr,Oc,Rc,wg=P(()=>{"use strict";ee(),at(),ie(),Im(),Wr=class Ff{constructor(t,r,i,a){this.module=t,this.dataType=r,this.data=i,this.dims=a}getFloat32Array(){if(this.dataType!==1)throw new Error("Invalid data type");let t=O.size(this.dims);return t===0?new Float32Array:new Float32Array(this.module.HEAP8.buffer,this.data,t)}getBigInt64Array(){if(this.dataType!==7)throw new Error("Invalid data type");let t=O.size(this.dims);return t===0?new BigInt64Array:new BigInt64Array(this.module.HEAP8.buffer,this.data,t)}getInt32Array(){if(this.dataType!==6)throw new Error("Invalid data type");let t=O.size(this.dims);return t===0?new Int32Array:new Int32Array(this.module.HEAP8.buffer,this.data,t)}getUint16Array(){if(this.dataType!==10&&this.dataType!==4)throw new Error("Invalid data type");let t=O.size(this.dims);return t===0?new Uint16Array:new Uint16Array(this.module.HEAP8.buffer,this.data,t)}reshape(t){if(O.size(t)!==O.size(this.dims))throw new Error("Invalid new shape");return new Ff(this.module,this.dataType,this.data,t)}},Oc=class{constructor(e,t,r){this.module=e,this.backend=t,this.customDataOffset=0,this.customDataSize=0,this.adapterInfo=t.adapterInfo;let i=e.PTR_SIZE,a=r/e.PTR_SIZE,s=i===4?"i32":"i64";this.opKernelContext=Number(e.getValue(i*a++,s));let n=Number(e.getValue(i*a++,s));this.outputCount=Number(e.getValue(i*a++,s)),this.customDataOffset=Number(e.getValue(i*a++,"*")),this.customDataSize=Number(e.getValue(i*a++,s));let u=[];for(let l=0;l<n;l++){let p=Number(e.getValue(i*a++,s)),h=Number(e.getValue(i*a++,"*")),c=Number(e.getValue(i*a++,s)),g=[];for(let _=0;_<c;_++)g.push(Number(e.getValue(i*a++,s)));u.push(new Wr(e,p,h,g))}this.inputs=u}get kernelCustomData(){return this.backend.currentKernelCustomData}get customDataBuffer(){return this.module.HEAPU8.subarray(this.customDataOffset,this.customDataOffset+this.customDataSize)}compute(e,t){let r=t?.inputs?.map(n=>typeof n=="number"?this.inputs[n]:n)??this.inputs,i=t?.outputs??[],a=(n,u,l)=>new Wr(this.module,u,this.output(n,l),l),s=(n,u)=>{let l=zt(n,u);if(!l)throw new Error(`Unsupported data type: ${n}`);let p=l>0?this.backend.gpuDataManager.create(l).id:0;return new Wr(this.module,n,p,u)};return this.backend.run(e,r,i,a,s,this.outputCount)}output(e,t){let r=this.module.stackSave();try{let i=this.module.PTR_SIZE,a=i===4?"i32":"i64",s=this.module.stackAlloc((1+t.length)*i);this.module.setValue(s,t.length,a);for(let n=0;n<t.length;n++)this.module.setValue(s+i*(n+1),t[n],a);return this.module._JsepOutput(this.opKernelContext,e,s)}catch(i){throw new Error(`Failed to generate kernel's output[${e}] with dims [${t}]. If you are running with pre-allocated output, please make sure the output type/dims are correct. Error: ${i}`)}finally{this.module.stackRestore(r)}}},Rc=async(e,t,r,i)=>{let a=t.jsepInit;if(!a)throw new Error("Failed to initialize JSEP. The WebAssembly module is not built with JSEP support.");if(e==="webgpu"){let s=(bg(),Jt(Tc)).WebGpuBackend,n=new s;await n.initialize(r,i),a("webgpu",[n,u=>n.alloc(Number(u)),u=>n.free(u),(u,l,p,h=!1)=>{if(h)de("verbose",()=>`[WebGPU] jsepCopyGpuToGpu: src=${Number(u)}, dst=${Number(l)}, size=${Number(p)}`),n.memcpy(Number(u),Number(l));else{de("verbose",()=>`[WebGPU] jsepCopyCpuToGpu: dataOffset=${Number(u)}, gpuDataId=${Number(l)}, size=${Number(p)}`);let c=t.HEAPU8.subarray(Number(u>>>0),Number(u>>>0)+Number(p));n.upload(Number(l),c)}},async(u,l,p)=>{de("verbose",()=>`[WebGPU] jsepCopyGpuToCpu: gpuDataId=${u}, dataOffset=${l}, size=${p}`),await n.download(Number(u),()=>t.HEAPU8.subarray(Number(l)>>>0,Number(l+p)>>>0))},(u,l,p)=>n.createKernel(u,Number(l),p,t.UTF8ToString(t._JsepGetNodeName(Number(l)))),u=>n.releaseKernel(u),(u,l,p,h)=>{de("verbose",()=>`[WebGPU] jsepRun: sessionHandle=${p}, kernel=${u}, contextDataOffset=${l}`);let c=new Oc(t,n,Number(l));return n.computeKernel(Number(u),c,h)},()=>n.captureBegin(),()=>n.captureEnd(),()=>n.replay()])}else{let s=new zs(r);a("webnn",[s,()=>s.reserveTensorId(),n=>s.releaseTensorId(n),async(n,u,l,p,h)=>s.ensureTensor(n,u,l,p,h),(n,u)=>{s.uploadTensor(n,u)},async(n,u)=>s.downloadTensor(n,u),(n,u)=>s.registerMLContext(n,u),!!r.trace])}}}),Bc,qa,La,ht,Nc,Wa,Vr,Va,Ga,Ha,Fa,ja,Ka,Mc=P(()=>{"use strict";qe(),Sm(),km(),ee(),Tt(),Ti(),cs(),Bc=(e,t)=>{_e()._OrtInit(e,t)!==0&&fe("Can't initialize onnxruntime.")},qa=async e=>{Bc(e.wasm.numThreads,Er(e.logLevel))},La=async(e,t)=>{_e().asyncInit?.();let r=e.webgpu.adapter;if(t==="webgpu"){if(typeof navigator>"u"||!navigator.gpu)throw new Error("WebGPU is not supported in current environment");if(r){if(typeof r.limits!="object"||typeof r.features!="object"||typeof r.requestDevice!="function")throw new Error("Invalid GPU adapter set in `env.webgpu.adapter`. It must be a GPUAdapter object.")}else{let i=e.webgpu.powerPreference;if(i!==void 0&&i!=="low-power"&&i!=="high-performance")throw new Error(`Invalid powerPreference setting: "${i}"`);let a=e.webgpu.forceFallbackAdapter;if(a!==void 0&&typeof a!="boolean")throw new Error(`Invalid forceFallbackAdapter setting: "${a}"`);if(r=await navigator.gpu.requestAdapter({powerPreference:i,forceFallbackAdapter:a}),!r)throw new Error('Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are using Chrome.')}}if(t==="webnn"&&(typeof navigator>"u"||!navigator.ml))throw new Error("WebNN is not supported in current environment");{let i=(wg(),Jt(Ac)).init;t==="webgpu"&&await i("webgpu",_e(),e,r),t==="webnn"&&await i("webnn",_e(),e)}},ht=new Map,Nc=e=>{let t=_e(),r=t.stackSave();try{let i=t.PTR_SIZE,a=t.stackAlloc(2*i);t._OrtGetInputOutputCount(e,a,a+i)!==0&&fe("Can't get session input/output count.");let s=i===4?"i32":"i64";return[Number(t.getValue(a,s)),Number(t.getValue(a+i,s))]}finally{t.stackRestore(r)}},Wa=(e,t)=>{let r=_e(),i=r.stackSave(),a=0;try{let s=r.PTR_SIZE,n=r.stackAlloc(2*s);r._OrtGetInputOutputMetadata(e,t,n,n+s)!==0&&fe("Can't get session input/output metadata.");let u=Number(r.getValue(n,"*"));a=Number(r.getValue(n+s,"*"));let l=r.HEAP32[a/4];if(l===0)return[u,0];let p=r.HEAPU32[a/4+1],h=[];for(let c=0;c<p;c++){let g=Number(r.getValue(a+8+c*s,"*"));h.push(g!==0?r.UTF8ToString(g):Number(r.getValue(a+8+(c+p)*s,"*")))}return[u,l,h]}finally{r.stackRestore(i),a!==0&&r._OrtFree(a)}},Vr=e=>{let t=_e(),r=t._malloc(e.byteLength);if(r===0)throw new Error(`Can't create a session. failed to allocate a buffer of size ${e.byteLength}.`);return t.HEAPU8.set(e,r),[r,e.byteLength]},Va=async(e,t)=>{let r,i,a=_e();Array.isArray(e)?[r,i]=e:e.buffer===a.HEAPU8.buffer?[r,i]=[e.byteOffset,e.byteLength]:[r,i]=Vr(e);let s=0,n=0,u=0,l=[],p=[],h=[];try{if([n,l]=await ps(t),t?.externalData&&a.mountExternalData){let k=[];for(let I of t.externalData){let z=typeof I=="string"?I:I.path,A=typeof I=="string"?I:I.data;k.push(Ci(A).then(v=>{a.mountExternalData(z,v)}))}await Promise.all(k)}for(let k of t?.executionProviders??[])if((typeof k=="string"?k:k.name)==="webnn"){if(a.shouldTransferToMLTensor=!1,typeof k!="string"){let I=k,z=I?.context,A=I?.gpuDevice,v=I?.deviceType,D=I?.powerPreference;z?a.currentContext=z:A?a.currentContext=await a.webnnCreateMLContext(A):a.currentContext=await a.webnnCreateMLContext({deviceType:v,powerPreference:D})}else a.currentContext=await a.webnnCreateMLContext();break}s=await a._OrtCreateSession(r,i,n),a.webgpuOnCreateSession?.(s),s===0&&fe("Can't create a session."),a.jsepOnCreateSession?.(),a.currentContext&&(a.webnnRegisterMLContext(s,a.currentContext),a.currentContext=void 0,a.shouldTransferToMLTensor=!0);let[c,g]=Nc(s),_=!!t?.enableGraphCapture,y=[],$=[],S=[],x=[],b=[];for(let k=0;k<c;k++){let[I,z,A]=Wa(s,k);I===0&&fe("Can't get an input name."),p.push(I);let v=a.UTF8ToString(I);y.push(v),S.push(z===0?{name:v,isTensor:!1}:{name:v,isTensor:!0,type:it(z),shape:A})}for(let k=0;k<g;k++){let[I,z,A]=Wa(s,k+c);I===0&&fe("Can't get an output name."),h.push(I);let v=a.UTF8ToString(I);$.push(v),x.push(z===0?{name:v,isTensor:!1}:{name:v,isTensor:!0,type:it(z),shape:A});{if(_&&t?.preferredOutputLocation===void 0){b.push("gpu-buffer");continue}let D=typeof t?.preferredOutputLocation=="string"?t.preferredOutputLocation:t?.preferredOutputLocation?.[v]??"cpu",q=a.webnnIsGraphOutput;if(D==="cpu"&&q&&q(s,v)){b.push("ml-tensor-cpu-output");continue}if(D!=="cpu"&&D!=="cpu-pinned"&&D!=="gpu-buffer"&&D!=="ml-tensor")throw new Error(`Not supported preferred output location: ${D}.`);if(_&&D!=="gpu-buffer")throw new Error(`Not supported preferred output location: ${D}. Only 'gpu-buffer' location is supported when enableGraphCapture is true.`);b.push(D)}}let E=null;return b.some(k=>k==="gpu-buffer"||k==="ml-tensor"||k==="ml-tensor-cpu-output")&&(u=a._OrtCreateBinding(s),u===0&&fe("Can't create IO binding."),E={handle:u,outputPreferredLocations:b,outputPreferredLocationsEncoded:b.map(k=>k==="ml-tensor-cpu-output"?"ml-tensor":k).map(k=>zi(k))}),ht.set(s,[s,p,h,E,_,!1]),[s,y,$,S,x]}catch(c){throw p.forEach(g=>a._OrtFree(g)),h.forEach(g=>a._OrtFree(g)),u!==0&&a._OrtReleaseBinding(u)!==0&&fe("Can't release IO binding."),s!==0&&a._OrtReleaseSession(s)!==0&&fe("Can't release session."),c}finally{a._free(r),n!==0&&a._OrtReleaseSessionOptions(n)!==0&&fe("Can't release session options."),l.forEach(c=>a._free(c)),a.unmountExternalData?.()}},Ga=e=>{let t=_e(),r=ht.get(e);if(!r)throw new Error(`cannot release session. invalid session id: ${e}`);let[i,a,s,n,u]=r;n&&(u&&t._OrtClearBoundOutputs(n.handle)!==0&&fe("Can't clear bound outputs."),t._OrtReleaseBinding(n.handle)!==0&&fe("Can't release IO binding.")),t.jsepOnReleaseSession?.(e),t.webnnOnReleaseSession?.(e),t.webgpuOnReleaseSession?.(e),a.forEach(l=>t._OrtFree(l)),s.forEach(l=>t._OrtFree(l)),t._OrtReleaseSession(i)!==0&&fe("Can't release session."),ht.delete(e)},Ha=async(e,t,r,i,a,s,n=!1)=>{if(!e){t.push(0);return}let u=_e(),l=u.PTR_SIZE,p=e[0],h=e[1],c=e[3],g=c,_,y;if(p==="string"&&(c==="gpu-buffer"||c==="ml-tensor"))throw new Error("String tensor is not supported on GPU.");if(n&&c!=="gpu-buffer")throw new Error(`External buffer must be provided for input/output index ${s} when enableGraphCapture is true.`);if(c==="gpu-buffer"){let x=e[2].gpuBuffer;y=zt(Et(p),h);{let b=u.jsepRegisterBuffer;if(!b)throw new Error('Tensor location "gpu-buffer" is not supported without using WebGPU.');_=b(i,s,x,y)}}else if(c==="ml-tensor"){let x=e[2].mlTensor;y=zt(Et(p),h);let b=u.webnnRegisterMLTensor;if(!b)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');_=b(i,x,Et(p),h)}else{let x=e[2];if(Array.isArray(x)){y=l*x.length,_=u._malloc(y),r.push(_);for(let b=0;b<x.length;b++){if(typeof x[b]!="string")throw new TypeError(`tensor data at index ${b} is not a string`);u.setValue(_+b*l,Ge(x[b],r),"*")}}else{let b=u.webnnIsGraphInput,E=u.webnnIsGraphOutput;if(p!=="string"&&b&&E){let k=u.UTF8ToString(a);if(b(i,k)||E(i,k)){let I=Et(p);y=zt(I,h),g="ml-tensor";let z=u.webnnCreateTemporaryTensor,A=u.webnnUploadTensor;if(!z||!A)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');let v=await z(i,I,h);A(v,new Uint8Array(x.buffer,x.byteOffset,x.byteLength)),_=v}else y=x.byteLength,_=u._malloc(y),r.push(_),u.HEAPU8.set(new Uint8Array(x.buffer,x.byteOffset,y),_)}else y=x.byteLength,_=u._malloc(y),r.push(_),u.HEAPU8.set(new Uint8Array(x.buffer,x.byteOffset,y),_)}}let $=u.stackSave(),S=u.stackAlloc(4*h.length);try{h.forEach((b,E)=>u.setValue(S+E*l,b,l===4?"i32":"i64"));let x=u._OrtCreateTensor(Et(p),_,y,S,h.length,zi(g));x===0&&fe(`Can't create tensor for input/output. session=${i}, index=${s}.`),t.push(x)}finally{u.stackRestore($)}},Fa=async(e,t,r,i,a,s)=>{let n=_e(),u=n.PTR_SIZE,l=ht.get(e);if(!l)throw new Error(`cannot run inference. invalid session id: ${e}`);let p=l[0],h=l[1],c=l[2],g=l[3],_=l[4],y=l[5],$=t.length,S=i.length,x=0,b=[],E=[],k=[],I=[],z=[],A=n.stackSave(),v=n.stackAlloc($*u),D=n.stackAlloc($*u),q=n.stackAlloc(S*u),Q=n.stackAlloc(S*u);try{[x,b]=ss(s),St("wasm prepareInputOutputTensor");for(let M=0;M<$;M++)await Ha(r[M],E,I,e,h[t[M]],t[M],_);for(let M=0;M<S;M++)await Ha(a[M],k,I,e,c[i[M]],$+i[M],_);kt("wasm prepareInputOutputTensor");for(let M=0;M<$;M++)n.setValue(v+M*u,E[M],"*"),n.setValue(D+M*u,h[t[M]],"*");for(let M=0;M<S;M++)n.setValue(q+M*u,k[M],"*"),n.setValue(Q+M*u,c[i[M]],"*");if(g&&!y){let{handle:M,outputPreferredLocations:H,outputPreferredLocationsEncoded:J}=g;if(h.length!==$)throw new Error(`input count from feeds (${$}) is expected to be always equal to model's input count (${h.length}).`);St("wasm bindInputsOutputs");for(let te=0;te<$;te++){let re=t[te];await n._OrtBindInput(M,h[re],E[te])!==0&&fe(`Can't bind input[${te}] for session=${e}.`)}for(let te=0;te<S;te++){let re=i[te];a[te]?.[3]?(z.push(k[te]),n._OrtBindOutput(M,c[re],k[te],0)!==0&&fe(`Can't bind pre-allocated output[${te}] for session=${e}.`)):n._OrtBindOutput(M,c[re],0,J[re])!==0&&fe(`Can't bind output[${te}] to ${H[te]} for session=${e}.`)}kt("wasm bindInputsOutputs"),ht.set(e,[p,h,c,g,_,!0])}n.jsepOnRunStart?.(p),n.webnnOnRunStart?.(p);let F;g?F=await n._OrtRunWithBinding(p,g.handle,S,q,x):F=await n._OrtRun(p,D,v,$,Q,S,q,x),F!==0&&fe("failed to call OrtRun().");let K=[],R=[];St("wasm ProcessOutputTensor");for(let M=0;M<S;M++){let H=Number(n.getValue(q+M*u,"*"));if(H===k[M]||z.includes(k[M])){K.push(a[M]),H!==k[M]&&n._OrtReleaseTensor(H)!==0&&fe("Can't release tensor.");continue}let J=n.stackSave(),te=n.stackAlloc(4*u),re=!1,ne,U=0;try{n._OrtGetTensorData(H,te,te+u,te+2*u,te+3*u)!==0&&fe(`Can't access output tensor data on index ${M}.`);let Y=u===4?"i32":"i64",X=Number(n.getValue(te,Y));U=n.getValue(te+u,"*");let V=n.getValue(te+u*2,"*"),Ie=Number(n.getValue(te+u*3,Y)),Oe=[];for(let ge=0;ge<Ie;ge++)Oe.push(Number(n.getValue(V+ge*u,Y)));n._OrtFree(V)!==0&&fe("Can't free memory for tensor dims.");let xe=Oe.reduce((ge,$e)=>ge*$e,1);ne=it(X);let Re=g?.outputPreferredLocations[i[M]];if(ne==="string"){if(Re==="gpu-buffer"||Re==="ml-tensor")throw new Error("String tensor is not supported on GPU.");let ge=[];for(let $e=0;$e<xe;$e++){let Ne=n.getValue(U+$e*u,"*"),Fr=n.getValue(U+($e+1)*u,"*"),Je=$e===xe-1?void 0:Fr-Ne;ge.push(n.UTF8ToString(Ne,Je))}K.push([ne,Oe,ge,"cpu"])}else if(Re==="gpu-buffer"&&xe>0){let ge=n.jsepGetBuffer;if(!ge)throw new Error('preferredLocation "gpu-buffer" is not supported without using WebGPU.');let $e=ge(U),Ne=zt(X,xe);if(Ne===void 0||!Ii(ne))throw new Error(`Unsupported data type: ${ne}`);re=!0,K.push([ne,Oe,{gpuBuffer:$e,download:n.jsepCreateDownloader($e,Ne,ne),dispose:()=>{n._OrtReleaseTensor(H)!==0&&fe("Can't release tensor.")}},"gpu-buffer"])}else if(Re==="ml-tensor"&&xe>0){let ge=n.webnnEnsureTensor,$e=n.webnnIsGraphInputOutputTypeSupported;if(!ge||!$e)throw new Error('preferredLocation "ml-tensor" is not supported without using WebNN.');if(zt(X,xe)===void 0||!Ei(ne))throw new Error(`Unsupported data type: ${ne}`);if(!$e(e,ne,!1))throw new Error(`preferredLocation "ml-tensor" for ${ne} output is not supported by current WebNN Context.`);let Ne=await ge(e,U,X,Oe,!1);re=!0,K.push([ne,Oe,{mlTensor:Ne,download:n.webnnCreateMLTensorDownloader(U,ne),dispose:()=>{n.webnnReleaseTensorId(U),n._OrtReleaseTensor(H)}},"ml-tensor"])}else if(Re==="ml-tensor-cpu-output"&&xe>0){let ge=n.webnnCreateMLTensorDownloader(U,ne)(),$e=K.length;re=!0,R.push((async()=>{let Ne=[$e,await ge];return n.webnnReleaseTensorId(U),n._OrtReleaseTensor(H),Ne})()),K.push([ne,Oe,[],"cpu"])}else{let ge=Ir(ne),$e=new ge(xe);new Uint8Array($e.buffer,$e.byteOffset,$e.byteLength).set(n.HEAPU8.subarray(U,U+$e.byteLength)),K.push([ne,Oe,$e,"cpu"])}}finally{n.stackRestore(J),ne==="string"&&U&&n._free(U),re||n._OrtReleaseTensor(H)}}g&&!_&&(n._OrtClearBoundOutputs(g.handle)!==0&&fe("Can't clear bound outputs."),ht.set(e,[p,h,c,g,_,!1]));for(let[M,H]of await Promise.all(R))K[M][2]=H;return kt("wasm ProcessOutputTensor"),K}finally{n.webnnOnRunEnd?.(p),n.stackRestore(A),E.forEach(F=>n._OrtReleaseTensor(F)),k.forEach(F=>n._OrtReleaseTensor(F)),I.forEach(F=>n._free(F)),x!==0&&n._OrtReleaseRunOptions(x),b.forEach(F=>n._free(F))}},ja=e=>{let t=_e(),r=ht.get(e);if(!r)throw new Error("invalid session id");let i=r[0],a=t._OrtEndProfiling(i);a===0&&fe("Can't get an profile file name."),t._OrtFree(a)},Ka=e=>{let t=[];for(let r of e){let i=r[2];!Array.isArray(i)&&"buffer"in i&&t.push(i.buffer)}return t}}),ft,Le,Kt,fr,mr,Gr,Za,Hr,Mt,Dt,Dc,Uc,Pc,qc,Lc,Wc,Vc,Gc,Hc=P(()=>{"use strict";qe(),Mc(),Tt(),vi(),ft=()=>!!be.wasm.proxy&&typeof document<"u",Kt=!1,fr=!1,mr=!1,Hr=new Map,Mt=(e,t)=>{let r=Hr.get(e);r?r.push(t):Hr.set(e,[t])},Dt=()=>{if(Kt||!fr||mr||!Le)throw new Error("worker not ready")},Dc=e=>{switch(e.data.type){case"init-wasm":Kt=!1,e.data.err?(mr=!0,Za[1](e.data.err)):(fr=!0,Za[0]()),Gr&&(URL.revokeObjectURL(Gr),Gr=void 0);break;case"init-ep":case"copy-from":case"create":case"release":case"run":case"end-profiling":{let t=Hr.get(e.data.type);e.data.err?t.shift()[1](e.data.err):t.shift()[0](e.data.out);break}default:}},Uc=async()=>{if(!fr){if(Kt)throw new Error("multiple calls to 'initWasm()' detected.");if(mr)throw new Error("previous call to 'initWasm()' failed.");if(Kt=!0,ft())return new Promise((e,t)=>{Le?.terminate(),ts().then(([r,i])=>{try{Le=i,Le.onerror=s=>t(s),Le.onmessage=Dc,Za=[e,t];let a={type:"init-wasm",in:be};!a.in.wasm.wasmPaths&&(r||_i)&&(a.in.wasm.wasmPaths={wasm:new URL(""+new URL("ort-wasm-simd-threaded.jsep-MDYUKy93.wasm",self.location.href).href,self.location.href).href}),Le.postMessage(a),Gr=r}catch(a){t(a)}},t)});try{await ki(be.wasm),await qa(be),fr=!0}catch(e){throw mr=!0,e}finally{Kt=!1}}},Pc=async e=>{if(ft())return Dt(),new Promise((t,r)=>{Mt("init-ep",[t,r]);let i={type:"init-ep",in:{epName:e,env:be}};Le.postMessage(i)});await La(be,e)},qc=async e=>ft()?(Dt(),new Promise((t,r)=>{Mt("copy-from",[t,r]);let i={type:"copy-from",in:{buffer:e}};Le.postMessage(i,[e.buffer])})):Vr(e),Lc=async(e,t)=>{if(ft()){if(t?.preferredOutputLocation)throw new Error('session option "preferredOutputLocation" is not supported for proxy.');return Dt(),new Promise((r,i)=>{Mt("create",[r,i]);let a={type:"create",in:{model:e,options:{...t}}},s=[];e instanceof Uint8Array&&s.push(e.buffer),Le.postMessage(a,s)})}else return Va(e,t)},Wc=async e=>{if(ft())return Dt(),new Promise((t,r)=>{Mt("release",[t,r]);let i={type:"release",in:e};Le.postMessage(i)});Ga(e)},Vc=async(e,t,r,i,a,s)=>{if(ft()){if(r.some(n=>n[3]!=="cpu"))throw new Error("input tensor on GPU is not supported for proxy.");if(a.some(n=>n))throw new Error("pre-allocated output tensor is not supported for proxy.");return Dt(),new Promise((n,u)=>{Mt("run",[n,u]);let l=r,p={type:"run",in:{sessionId:e,inputIndices:t,inputs:l,outputIndices:i,options:s}};Le.postMessage(p,Ka(l))})}else return Fa(e,t,r,i,a,s)},Gc=async e=>{if(ft())return Dt(),new Promise((t,r)=>{Mt("end-profiling",[t,r]);let i={type:"end-profiling",in:e};Le.postMessage(i)});ja(e)}}),Xa,Fc,jc,$g=P(()=>{"use strict";qe(),Hc(),ee(),fi(),cs(),Xa=(e,t)=>{switch(e.location){case"cpu":return[e.type,e.dims,e.data,"cpu"];case"gpu-buffer":return[e.type,e.dims,{gpuBuffer:e.gpuBuffer},"gpu-buffer"];case"ml-tensor":return[e.type,e.dims,{mlTensor:e.mlTensor},"ml-tensor"];default:throw new Error(`invalid data location: ${e.location} for ${t()}`)}},Fc=e=>{switch(e[3]){case"cpu":return new Pe(e[0],e[2],e[1]);case"gpu-buffer":{let t=e[0];if(!Ii(t))throw new Error(`not supported data type: ${t} for deserializing GPU tensor`);let{gpuBuffer:r,download:i,dispose:a}=e[2];return Pe.fromGpuBuffer(r,{dataType:t,dims:e[1],download:i,dispose:a})}case"ml-tensor":{let t=e[0];if(!Ei(t))throw new Error(`not supported data type: ${t} for deserializing MLTensor tensor`);let{mlTensor:r,download:i,dispose:a}=e[2];return Pe.fromMLTensor(r,{dataType:t,dims:e[1],download:i,dispose:a})}default:throw new Error(`invalid data location: ${e[3]}`)}},jc=class{async fetchModelAndCopyToWasmMemory(e){return qc(await Ci(e))}async loadModel(e,t){Qe();let r;typeof e=="string"?r=await this.fetchModelAndCopyToWasmMemory(e):r=e,[this.sessionId,this.inputNames,this.outputNames,this.inputMetadata,this.outputMetadata]=await Lc(r,t),Ve()}async dispose(){return Wc(this.sessionId)}async run(e,t,r){Qe();let i=[],a=[];Object.entries(e).forEach(c=>{let g=c[0],_=c[1],y=this.inputNames.indexOf(g);if(y===-1)throw new Error(`invalid input '${g}'`);i.push(_),a.push(y)});let s=[],n=[];Object.entries(t).forEach(c=>{let g=c[0],_=c[1],y=this.outputNames.indexOf(g);if(y===-1)throw new Error(`invalid output '${g}'`);s.push(_),n.push(y)});let u=i.map((c,g)=>Xa(c,()=>`input "${this.inputNames[a[g]]}"`)),l=s.map((c,g)=>c?Xa(c,()=>`output "${this.outputNames[n[g]]}"`):null),p=await Vc(this.sessionId,a,u,n,l,r),h={};for(let c=0;c<p.length;c++)h[this.outputNames[n[c]]]=s[c]??Fc(p[c]);return Ve(),h}startProfiling(){}endProfiling(){Gc(this.sessionId)}}}),Kc={};Vt(Kc,{OnnxruntimeWebAssemblyBackend:()=>Ya,initializeFlags:()=>Qa,wasmBackend:()=>Zc});var Qa,Ya,Zc,vg=P(()=>{"use strict";qe(),Hc(),$g(),Qa=()=>{(typeof be.wasm.initTimeout!="number"||be.wasm.initTimeout<0)&&(be.wasm.initTimeout=0);let e=be.wasm.simd;if(typeof e!="boolean"&&e!==void 0&&e!=="fixed"&&e!=="relaxed"&&(console.warn(`Property "env.wasm.simd" is set to unknown value "${e}". Reset it to \`false\` and ignore SIMD feature checking.`),be.wasm.simd=!1),typeof be.wasm.proxy!="boolean"&&(be.wasm.proxy=!1),typeof be.wasm.trace!="boolean"&&(be.wasm.trace=!1),typeof be.wasm.numThreads!="number"||!Number.isInteger(be.wasm.numThreads)||be.wasm.numThreads<=0)if(typeof self<"u"&&!self.crossOriginIsolated)be.wasm.numThreads=1;else{let t=typeof navigator>"u"?sm("node:os").cpus().length:navigator.hardwareConcurrency;be.wasm.numThreads=Math.min(4,Math.ceil((t||1)/2))}},Ya=class{async init(e){Qa(),await Uc(),await Pc(e)}async createInferenceSessionHandler(e,t){let r=new jc;return await r.loadModel(e,t),r}},Zc=new Ya});qe(),qe(),qe();var xg="1.30.0";{let e=(vg(),Jt(Kc)).wasmBackend;Gt("webgpu",e,5),Gt("webnn",e,5),Gt("cpu",e,10),Gt("wasm",e,10)}Object.defineProperty(be.versions,"web",{value:xg,enumerable:!0});const Ut=new Map,Zt=e=>{self.postMessage(e)},Sg=e=>{switch(e){case"float32":return"float32";case"int32":return"int32";case"int64":return"int64"}},kg=e=>{switch(e){case"float32":return"float32";case"int32":return"int32";case"int64":return"int64";default:return $t(`Unsupported tensor element type: ${e}`)}},Tg=e=>new Pe(Sg(e.type),e.data,[...e.dims]),Ig=e=>{const t=e.data;return t instanceof Float32Array||t instanceof Int32Array||t instanceof BigInt64Array?{type:kg(e.type),data:t,dims:[...e.dims]}:$t(`Unsupported tensor output data type: ${e.type}`)},Eg=e=>{const t={};for(const r of Object.keys(e))t[r]=Tg(e[r]);return t},zg=e=>{const t={};for(const r of Object.keys(e)){const i=e[r];i instanceof Pe&&(t[r]=Ig(i))}return t},Cg=async e=>{let t=Ut.get(e.taskKey);Yt(t)||(t=await hi.create(e.modelBytes,{executionProviders:[...e.executionProviders,"wasm"]}),Ut.set(e.taskKey,t)),Zt({kind:"loaded",id:e.id,inputs:t.inputNames,outputs:t.outputNames})},Ag=async e=>{const t=Sn(Ut.get(e.taskKey),`Session not loaded for task: ${e.taskKey}`),r=Eg(e.feeds),i=await t.run(r);Zt({kind:"result",id:e.id,output:zg(i)})},Og=e=>{const t=Ut.get(e.taskKey);Yt(t)&&(t.release().catch(()=>{}),Ut.delete(e.taskKey)),Zt({kind:"ok",id:e.id})},Rg=e=>{for(const[t,r]of Ut)r.release().catch(()=>{}),Ut.delete(t);Zt({kind:"ok",id:e.id})},Bg=async e=>{switch(e.kind){case"load":return Cg(e);case"run":return Ag(e);case"release":return Og(e);case"shutdown":return Rg(e)}},Ng=async e=>{const t=await oi.tryCatch(Bg(e));if(t.status==="rejected"){const r=t.error,i=r instanceof Error?r.message:String(r);Zt({kind:"error",id:e.id,message:i})}};self.addEventListener("message",e=>{Ng(e.data)}),be.wasm.numThreads=Math.max(1,(navigator.hardwareConcurrency??4)-1),Zt({kind:"ready"})})();
//# sourceMappingURL=inference.worker-D9thYq_4.js.map
