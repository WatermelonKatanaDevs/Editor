(function(){
  const root=window.EditorAI=window.EditorAI||{};
  root.LOCAL_MODEL_PROTOCOL='local-transformers';
  root.LOCAL_MODEL_LIBRARY_URL='https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js';
  root.DEFAULT_LOCAL_MODEL_ID='local-qwen3-4b-instruct-2507';
  root.LOCAL_MODELS=[
    {id:'local-qwen3-4b-instruct-2507',name:'Qwen3 4B Instruct · Local',model:'onnx-community/Qwen3-4B-Instruct-2507-ONNX',protocol:'local-transformers',provider:'local',local:true,builtInLocal:true,public:true,requiresKey:false,supportsTools:false,supportsAgentTools:true,supportsReasoning:false,supportsStreaming:true},
    {id:'local-qwen25-1.5b',name:'Qwen2.5 1.5B · Local',model:'onnx-community/Qwen2.5-1.5B-Instruct',protocol:'local-transformers',provider:'local',local:true,builtInLocal:true,public:true,requiresKey:false,supportsTools:false,supportsAgentTools:true,supportsReasoning:false,supportsStreaming:true},
    {id:'local-qwen25-0.5b',name:'Qwen2.5 0.5B · Local',model:'onnx-community/Qwen2.5-0.5B-Instruct',protocol:'local-transformers',provider:'local',local:true,builtInLocal:true,public:true,requiresKey:false,supportsTools:false,supportsAgentTools:true,supportsReasoning:false,supportsStreaming:true}
  ];
})();

/* -------------------------------------------------------------------------- */
/* Consolidated module */
(function(){
  const root=window.EditorAI=window.EditorAI||{};
  const DB_NAME='watermelonkatanadevs-local-ai';
  const DB_VERSION=1;
  const FILES='files';
  const MODELS='models';

  function requestResult(request){
    return new Promise((resolve,reject)=>{
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('IndexedDB request failed.'));
    });
  }
  function transactionDone(transaction){
    return new Promise((resolve,reject)=>{
      transaction.oncomplete=()=>resolve();
      transaction.onerror=()=>reject(transaction.error||new Error('IndexedDB transaction failed.'));
      transaction.onabort=()=>reject(transaction.error||new Error('IndexedDB transaction was aborted.'));
    });
  }
  function requestURL(request){
    if(typeof request==='string')return request;
    if(request instanceof URL)return request.href;
    if(request&&typeof request.url==='string')return request.url;
    return String(request||'');
  }
  function variantKey(id,model,variant){
    return [String(id||''),String(model||''),String(variant||'')].join('::');
  }

  class IndexedDBModelCache{
    constructor(){
      this.dbPromise=null;
      this.activeModel=null;
      this.persistencePromise=null;
    }
    open(){
      if(!('indexedDB' in window))return Promise.reject(new Error('This browser does not support IndexedDB, so local AI models cannot be cached.'));
      if(!this.dbPromise){
        this.dbPromise=new Promise((resolve,reject)=>{
          const request=indexedDB.open(DB_NAME,DB_VERSION);
          request.onupgradeneeded=()=>{
            const db=request.result;
            if(!db.objectStoreNames.contains(FILES))db.createObjectStore(FILES,{keyPath:'url'});
            if(!db.objectStoreNames.contains(MODELS))db.createObjectStore(MODELS,{keyPath:'key'});
          };
          request.onsuccess=()=>resolve(request.result);
          request.onerror=()=>reject(request.error||new Error('Could not open the local AI cache.'));
          request.onblocked=()=>reject(new Error('The local AI cache is blocked by another open editor tab. Close the other tab and try again.'));
        });
      }
      return this.dbPromise;
    }
    recordModelFile(url,size){
      const session=this.activeModel;
      if(!session)return;
      const repoPath=String(session.model||'').split('/').map(encodeURIComponent).join('/');
      if(!repoPath)return;
      try{
        const parsed=new URL(url);
        if(parsed.hostname!=='huggingface.co'||!parsed.pathname.includes('/'+repoPath+'/resolve/'))return;
      }catch(_){return;}
      session.files.set(url,Number(size)||session.files.get(url)||0);
    }
    async match(request){
      const url=requestURL(request);
      if(!url)return undefined;
      const db=await this.open();
      const tx=db.transaction(FILES,'readonly'),done=transactionDone(tx);
      const record=await requestResult(tx.objectStore(FILES).get(url));
      await done;
      if(!record)return undefined;
      this.recordModelFile(url,record.size);
      try{
        return new Response(record.body,{status:record.status||200,statusText:record.statusText||'OK',headers:record.headers||[]});
      }catch(error){
        console.warn('Could not restore a cached local AI response:',error);
        return undefined;
      }
    }
    async put(request,response,progressCallback){
      const url=requestURL(request);
      if(!url||!response)throw new Error('Invalid response supplied to the local AI cache.');
      if(response.type==='opaque')throw new Error('The browser returned an opaque model response that cannot be cached.');
      const body=await response.clone().blob();
      const record={
        url,
        body,
        size:body.size,
        status:response.status||200,
        statusText:response.statusText||'OK',
        headers:Array.from(response.headers.entries()),
        storedAt:Date.now()
      };
      // Record the expected file before writing. If IndexedDB quota is exhausted,
      // post-load verification can detect the missing blob and refuse to mark it cached.
      this.recordModelFile(url,body.size);
      const db=await this.open();
      const tx=db.transaction(FILES,'readwrite'),done=transactionDone(tx);
      tx.objectStore(FILES).put(record);
      await done;
      this.recordModelFile(url,body.size);
      if(typeof progressCallback==='function')progressCallback({progress:100,loaded:body.size,total:body.size});
    }
    async delete(request){
      const url=requestURL(request),db=await this.open();
      const tx=db.transaction(FILES,'readwrite'),done=transactionDone(tx);
      const store=tx.objectStore(FILES),existing=await requestResult(store.get(url));
      if(existing)store.delete(url);
      await done;
      return !!existing;
    }
    beginModel(id,model,variant){
      this.activeModel={id:String(id),model:String(model),variant:String(variant),files:new Map()};
    }
    async finishModel(){
      const session=this.activeModel;
      this.activeModel=null;
      if(!session||!session.files.size)throw new Error('The model loaded, but no model files were recorded in persistent storage. It cannot be marked as cached.');
      const files=Array.from(session.files,([url,size])=>({url,size:Number(size)||0}));
      const manifest={
        key:variantKey(session.id,session.model,session.variant),
        id:session.id,
        model:session.model,
        variant:session.variant,
        files,
        fileCount:files.length,
        bytes:files.reduce((sum,file)=>sum+file.size,0),
        cachedAt:Date.now(),
        complete:true
      };
      const db=await this.open(),tx=db.transaction(MODELS,'readwrite'),done=transactionDone(tx);
      tx.objectStore(MODELS).put(manifest);
      await done;
      return manifest;
    }
    cancelModel(){this.activeModel=null;}
    async getModel(id,model,variant){
      const db=await this.open(),tx=db.transaction(MODELS,'readonly'),done=transactionDone(tx);
      const value=await requestResult(tx.objectStore(MODELS).get(variantKey(id,model,variant)));
      await done;
      return value||null;
    }
    async isModelCached(id,model,variant){
      const manifest=await this.getModel(id,model,variant);
      if(!manifest?.complete||!Array.isArray(manifest.files)||!manifest.files.length)return false;
      const db=await this.open(),tx=db.transaction(FILES,'readonly'),done=transactionDone(tx);
      const store=tx.objectStore(FILES);
      const checks=await Promise.all(manifest.files.map(file=>requestResult(store.get(file.url))));
      await done;
      return checks.every(Boolean);
    }
    async listModels(){
      const db=await this.open(),tx=db.transaction(MODELS,'readonly'),done=transactionDone(tx);
      const values=await requestResult(tx.objectStore(MODELS).getAll());
      await done;
      const manifests=(values||[]).filter(item=>item?.complete);
      const valid=[];
      for(const manifest of manifests){
        if(await this.isModelCached(manifest.id,manifest.model,manifest.variant))valid.push(manifest);
      }
      return valid.sort((a,b)=>(b.cachedAt||0)-(a.cachedAt||0));
    }
    async deleteModel(id){
      const db=await this.open();
      const read=db.transaction(MODELS,'readonly'),readDone=transactionDone(read);
      const allModels=await requestResult(read.objectStore(MODELS).getAll());
      await readDone;
      const removed=(allModels||[]).filter(item=>item.id===String(id));
      if(!removed.length)return false;
      const retainedUrls=new Set((allModels||[]).filter(item=>item.id!==String(id)).flatMap(item=>(item.files||[]).map(file=>file.url)));
      const removedUrls=new Set(removed.flatMap(item=>(item.files||[]).map(file=>file.url)));
      const tx=db.transaction([MODELS,FILES],'readwrite'),done=transactionDone(tx);
      const modelStore=tx.objectStore(MODELS),fileStore=tx.objectStore(FILES);
      removed.forEach(item=>modelStore.delete(item.key));
      for(const url of removedUrls)if(!retainedUrls.has(url))fileStore.delete(url);
      await done;
      return true;
    }
    async deleteAllModels(){
      const db=await this.open();
      const read=db.transaction(MODELS,'readonly'),readDone=transactionDone(read);
      const manifests=await requestResult(read.objectStore(MODELS).getAll());
      await readDone;
      const urls=new Set((manifests||[]).flatMap(item=>(item.files||[]).map(file=>file.url)));
      const tx=db.transaction([MODELS,FILES],'readwrite'),done=transactionDone(tx);
      tx.objectStore(MODELS).clear();
      const fileStore=tx.objectStore(FILES);
      for(const url of urls)fileStore.delete(url);
      await done;
      return (manifests||[]).length;
    }
    requestPersistence(){
      if(!this.persistencePromise){
        const storage=navigator.storage;
        if(!storage)return Promise.resolve({supported:false,persisted:false});
        // Invoke persist() immediately, while the model-load click may still carry user activation.
        let request=Promise.resolve(false);
        try{if(typeof storage.persist==='function')request=storage.persist();}catch(_){}
        this.persistencePromise=(async()=>{
          let persisted=false;
          try{persisted=await storage.persisted?.()||false;}catch(_){}
          if(!persisted){try{persisted=await request;}catch(_){}}
          return {supported:typeof storage.persist==='function',persisted:!!persisted};
        })();
      }
      return this.persistencePromise;
    }
    async cacheStats(){
      const db=await this.open(),tx=db.transaction([FILES,MODELS],'readonly'),done=transactionDone(tx);
      const [fileCount,models]=await Promise.all([
        requestResult(tx.objectStore(FILES).count()),
        requestResult(tx.objectStore(MODELS).getAll())
      ]);
      await done;
      return {
        fileCount:Number(fileCount)||0,
        modelCount:new Set((models||[]).filter(item=>item?.complete).map(item=>item.id)).size
      };
    }
    async storageInfo(){
      let estimate={usage:null,quota:null};
      try{estimate=await navigator.storage?.estimate?.()||estimate;}catch(_){}
      let persisted=false;
      try{persisted=await navigator.storage?.persisted?.()||false;}catch(_){}
      return {usage:Number(estimate.usage)||0,quota:Number(estimate.quota)||0,persisted};
    }
  }

  root.IndexedDBModelCache=IndexedDBModelCache;
  root.LocalModelCache=new IndexedDBModelCache();
})();

/* -------------------------------------------------------------------------- */
/* Consolidated module */
(function(){
  const root=window.EditorAI=window.EditorAI||{};
  function generatedText(result,fallback){
    const value=result&&result[0]&&result[0].generated_text;
    const textOf=item=>{
      if(typeof item==='string')return item;
      if(!item||typeof item!=='object')return '';
      if(typeof item.content==='string')return item.content;
      if(Array.isArray(item.content))return item.content.filter(part=>part&&part.type!=='image'&&typeof part.text==='string').map(part=>part.text).join('');
      if(typeof item.text==='string')return item.text;
      return '';
    };
    if(Array.isArray(value)){const last=value[value.length-1];const text=textOf(last);if(text)return text;}
    const direct=textOf(value);if(direct)return direct;
    return String(fallback||'');
  }
  function isWebGPUBufferFailure(error){
    const parts=[];let current=error;
    for(let i=0;current&&i<4;i++,current=current.cause){
      parts.push(current.stack||current.message||String(current));
    }
    return /Failed to download data from buffer|mapAsync.{0,180}GPUBuffer|MapAsyncStatus|Invalid Buffer/i.test(parts.join('\n'));
  }
  function cacheName(name){
    return String(name).replace('present_conv','past_conv').replace('present_ssm','past_ssm').replace('present_recurrent','past_recurrent').replace('present','past_key_values');
  }
  function flattenTokenIds(value){
    const out=[];
    const visit=item=>{
      if(ArrayBuffer.isView(item)||Array.isArray(item)){
        for(const child of item)visit(child);
      }else if(typeof item==='number'||typeof item==='bigint'){
        const number=Number(item);
        if(Number.isFinite(number))out.push(number);
      }
    };
    visit(value);
    return out;
  }
  async function tensorTokenIds(value){
    if(value==null)return [];
    try{
      if(value.location&&value.location!=='cpu'&&value.location!=='cpu-pinned'&&typeof value.getData==='function'){
        return flattenTokenIds(await value.getData());
      }
      if(value.data!==undefined)return flattenTokenIds(value.data);
    }catch(error){
      if(typeof value.getData==='function')return flattenTokenIds(await value.getData());
      throw error;
    }
    return flattenTokenIds(value);
  }
  function tokenPrefixMatches(current,cached,length){
    if(!Array.isArray(current)||!Array.isArray(cached)||!Number.isFinite(length)||length<0||length>current.length||length>cached.length)return false;
    for(let i=0;i<length;i++)if(current[i]!==cached[i])return false;
    return true;
  }
  async function generateWebGPUChunked(generator,lib,messages,generationOptions,streamer,signal,onProgress,cacheState){
    const tokenizer=generator.tokenizer,model=generator.model;
    if(!model?.forward||!model?.generate||!tokenizer?.apply_chat_template||!lib.DynamicCache||!lib.Tensor||!lib.ones)return null;
    const inputs=tokenizer.apply_chat_template(messages,{add_generation_prompt:true,return_dict:true});
    const inputIds=inputs?.input_ids;
    const dims=inputIds?.dims||[];
    const tokenCount=Number(dims[dims.length-1]||0);
    if(!inputIds||tokenCount<=1)return null;
    const inputTokenIds=await tensorTokenIds(inputIds);
    if(inputTokenIds.length<tokenCount)return null;
    const targetEnd=tokenCount-1; // Leave the final prompt token for generate() to consume.
    let cache=cacheState?.cache||null,reusedTokens=0,start=0,chunkSize=256;
    if(cache){
      try{reusedTokens=Number(cache.get_seq_length())||0;}catch(_){reusedTokens=0;}
      if(reusedTokens<=0||reusedTokens>targetEnd||!tokenPrefixMatches(inputTokenIds,cacheState?.tokenIds,reusedTokens)){
        try{await cache.dispose();}catch(_){}
        cache=null;reusedTokens=0;
      }
    }
    // Preserve the established pipeline path for short, uncached prompts.
    // Once a conversation has a cache, even a short continuation can reuse it.
    if(tokenCount<=256&&!cache)return null;
    start=reusedTokens;
    const streamedTokenIds=[];
    if(streamer&&typeof streamer.put==='function'){
      const originalPut=streamer.put.bind(streamer);
      let firstPut=true;
      streamer.put=tokenIds=>{
        // Transformers.js sends the prompt to the streamer first. Later values are
        // generated token IDs (bigint[][]), which can be retained without touching
        // GPU-resident attention tensors.
        if(firstPut)firstPut=false;
        else streamedTokenIds.push(...flattenTokenIds(tokenIds));
        return originalPut(tokenIds);
      };
    }
    try{
      onProgress?.({processed:start,total:targetEnd,cached:reusedTokens,chunkSize});
      while(start<targetEnd){
        if(signal?.aborted)throw new DOMException('Aborted','AbortError');
        const stop=Math.min(start+chunkSize,targetEnd);
        const started=typeof performance!=='undefined'&&performance.now?performance.now():Date.now();
        const out=await model.forward({
          input_ids:inputIds.slice(null,[start,stop]),
          attention_mask:lib.ones([1,stop]),
          ...(cache?{past_key_values:cache}:{}),
          num_logits_to_keep:new lib.Tensor('int64',[1n],[])
        });
        const entries={};
        for(const [key,value] of Object.entries(out||{})){
          if(key.startsWith('present'))entries[cacheName(key)]=value;
          else value?.dispose?.();
        }
        if(cache)cache.update(entries);
        else cache=new lib.DynamicCache(entries);
        const now=typeof performance!=='undefined'&&performance.now?performance.now():Date.now();
        const elapsed=Math.max(1,now-started);
        const rate=(stop-start)/elapsed;
        start=stop;
        chunkSize=Math.max(32,Math.min(1024,chunkSize*2,Math.round(rate*1500)));
        onProgress?.({processed:start,total:targetEnd,cached:reusedTokens,chunkSize});
      }
      if(signal?.aborted)throw new DOMException('Aborted','AbortError');
      // generate() mutates this cache as it consumes the final prompt token and
      // emits new tokens. Keep the same GPU cache; never clone its GPU tensors.
      const result=await model.generate({
        ...inputs,
        ...(cache?{past_key_values:cache,attention_mask:lib.ones(dims)}:{}),
        ...generationOptions,
        streamer
      });
      const cacheLength=Number(cache?.get_seq_length?.())||0;
      const tokenIds=[...inputTokenIds,...streamedTokenIds];
      if(!cache||cacheLength<=0||cacheLength>tokenIds.length){
        try{await cache?.dispose?.();}catch(_){}
        cache=null;
        return {result,cache:null,cacheLength:0,tokenIds:inputTokenIds,reusedTokens};
      }
      return {result,cache,cacheLength,tokenIds,reusedTokens};
    }catch(error){
      try{await cache?.dispose?.();}catch(_){}
      throw error;
    }
  }
  class LocalModelManager{
    constructor(){this.libraryPromise=null;this.libraryBlobUrl='';this.generator=null;this.model=null;this.loadedModelId='';this.loading=false;this.progress=0;this.downloads=new Map();this.trackingFiles=false;this.statusText='';this.device='';this.dtype='';this.stopper=null;this.listeners=new Set();this.cache=root.LocalModelCache||new root.IndexedDBModelCache();this.offlineOnly=false;this.cacheHit=false;this.runtimeAssets=[];this.kvCaches=new Map();this.maxReusableCacheTokens=4096;this.maxReusableCacheSessions=2;this.maxReusableCacheTotalTokens=4096;}
    subscribe(fn){if(typeof fn!=='function')return ()=>{};this.listeners.add(fn);fn(this.status());return ()=>this.listeners.delete(fn);}
    status(){return {loading:this.loading,loadedModelId:this.loadedModelId,loaded:!!this.generator,progress:this.progress,downloads:Array.from(this.downloads.values()),trackingFiles:this.trackingFiles,text:this.statusText,device:this.device,dtype:this.dtype,offlineOnly:this.offlineOnly,cacheHit:this.cacheHit};}
    emit(patch){Object.assign(this,patch||{});const state=this.status();for(const fn of this.listeners){try{fn(state);}catch(e){console.warn('Local AI status listener failed:',e);}}}
    isLoaded(id){return !!this.generator&&(!id||this.loadedModelId===String(id));}
    async library(){
      if(!this.libraryPromise)this.libraryPromise=(async()=>{
        if(!this.cache)throw new Error('IndexedDB local model storage is unavailable.');
        await this.cache.open();
        const url=root.LOCAL_MODEL_LIBRARY_URL||'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js';
        let response=await this.cache.match(url);
        if(!response){
          if(typeof navigator!=='undefined'&&navigator.onLine===false)throw new Error('The Transformers.js runtime is not cached. Connect to the internet once to download the local AI runtime.');
          this.emit({loading:true,statusText:'Downloading the local AI runtime…'});
          response=await fetch(url,{credentials:'omit'});
          if(!response.ok)throw new Error('Could not download Transformers.js runtime ('+response.status+').');
          await this.cache.put(url,response.clone());
        }
        const source=await response.text();
        const blobUrl=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
        let lib;
        try{lib=await import(blobUrl);this.libraryBlobUrl=blobUrl;}
        catch(error){URL.revokeObjectURL(blobUrl);throw new Error('Could not load the cached Transformers.js runtime: '+(error&&error.message||String(error)));}
        if(lib.env){
          const env=lib.env;
          const wasmPaths=env.backends?.onnx?.wasm?.wasmPaths;
          if(wasmPaths&&typeof wasmPaths==='object')this.runtimeAssets=[wasmPaths.wasm,wasmPaths.mjs].filter(value=>typeof value==='string'&&/^https?:/i.test(value));
          env.useCustomCache=true;
          env.customCache=this.cache;
          env.useBrowserCache=false;
          env.useFSCache=false;
          env.useWasmCache=true;
          // Keep the local model backend enabled. Offline mode disables remote model
          // access separately; disabling both flags makes Transformers.js reject
          // pipeline creation before the IndexedDB cache can be consulted.
          env.allowLocalModels=true;
          const baseFetch=env.fetch||window.fetch.bind(window);
          env.fetch=async(input,options)=>{
            const requestUrl=String(input?.url||input);
            // Image/audio payloads use data: or blob: URLs and are user-provided
            // request inputs, not remote model assets. They must remain readable
            // even after model downloads are locked to the offline cache.
            if(/^(?:data|blob):/i.test(requestUrl))return baseFetch(input,options);
            if(this.offlineOnly){
              const cached=await this.cache.match(input);
              if(cached)return cached;
              throw new Error('Offline local AI cache miss: '+requestUrl);
            }
            return baseFetch(input,options);
          };
        }
        return lib;
      })();
      return this.libraryPromise;
    }
    async clearKVCache(conversationId){
      const ids=conversationId===undefined?[...this.kvCaches.keys()]:[String(conversationId)];
      for(const id of ids){
        const state=this.kvCaches.get(id);
        if(!state)continue;
        this.kvCaches.delete(id);
        try{await state.cache?.dispose?.();}catch(error){console.warn('Local AI KV cache disposal failed:',error);}
      }
    }
    async evictKVCache(preferredConversationId){
      const totalTokens=()=>[...this.kvCaches.values()].reduce((sum,state)=>sum+(Number(state.cacheLength)||0),0);
      while(this.kvCaches.size>this.maxReusableCacheSessions||totalTokens()>this.maxReusableCacheTotalTokens){
        const candidates=[...this.kvCaches.entries()]
          .filter(([id,state])=>id!==String(preferredConversationId||'')&&!state.inUse)
          .sort((a,b)=>(a[1].lastUsed||0)-(b[1].lastUsed||0));
        if(!candidates.length)break;
        await this.clearKVCache(candidates[0][0]);
      }
    }
    async unload(notify=true){this.downloads.clear();this.trackingFiles=false;await this.clearKVCache();const old=this.generator;this.generator=null;this.model=null;this.loadedModelId='';this.stopper=null;if(old&&old.dispose){try{await old.dispose();}catch(e){console.warn('Local AI model disposal failed:',e);}}if(notify)this.emit({loading:false,progress:0,statusText:'Model unloaded.'});}
    async load(model,options={}){
      if(!model||model.protocol!=='local-transformers')throw new Error('Not a local browser model.');
      if(this.loading)throw new Error('A local model is already loading.');
      if(this.isLoaded(model.id)){this.emit({loading:false,progress:100,statusText:model.model+' ready.'});return model;}
      const requestedDevice=options.device==='wasm'?'wasm':options.device==='webgpu'?'webgpu':(navigator.gpu?'webgpu':'wasm');
      this.device=requestedDevice;
      this.dtype=(this.device==='webgpu'?'q4f16':'q4');
      const variant=this.device+':'+this.dtype;
      const strictOffline=options.offlineOnly===true;
      this.loading=true;this.progress=0;this.downloads.clear();this.trackingFiles=false;this.cacheHit=false;this.offlineOnly=strictOffline;
      this.statusText='Preparing '+model.model+'…';this.emit({loading:true,progress:0,statusText:this.statusText});
      // Request persistent browser storage while the user is explicitly loading a model.
      try{this.cache.requestPersistence();}catch(_){}
      try{
        const lib=await this.library();
        const runtimeHits=await Promise.all(this.runtimeAssets.map(url=>this.cache.match(url).then(Boolean)));
        const runtimeCached=runtimeHits.every(Boolean);
        const cached=!strictOffline&&runtimeCached&&await this.cache.isModelCached(model.id,model.model,variant);
        this.cacheHit=!!cached;
        this.offlineOnly=!!(strictOffline||cached);
        if(lib.env)lib.env.allowRemoteModels=!this.offlineOnly;
        await this.unload(false);
        this.loading=true;this.device=requestedDevice;this.dtype=(this.device==='webgpu'?'q4f16':'q4');
        this.cache.beginModel(model.id,model.model,variant);
        this.emit({loading:true,progress:0,statusText:(this.offlineOnly?'INDEXEDDB CACHE':'DOWNLOADING')+' · '+this.device.toUpperCase()+' · '+model.model});
        const progress=info=>{
          let p=Number(info&&info.progress);if(!Number.isFinite(p))p=null;if(info&&info.status==='ready')p=100;
          if(p!=null)this.progress=Math.max(0,Math.min(100,p));
          const file=String((info&&((info.file||info.name)))||'').trim();
          const eventStatus=String(info&&info.status||'').toLowerCase();
          if(file){
            this.trackingFiles=true;
            if(eventStatus==='done')this.downloads.delete(file);
            else{
              const previous=this.downloads.get(file);
              const fileProgress=p!=null?Math.max(0,Math.min(100,p)):Number(previous?.progress)||0;
              this.downloads.set(file,{file,name:file.split('/').slice(-2).join('/'),progress:fileProgress,status:eventStatus});
            }
          }
          this.statusText=(this.offlineOnly?'INDEXEDDB CACHE':'DOWNLOADING')+' · '+this.device.toUpperCase()+' · '+model.model;
          this.emit({loading:true});
        };
        const modelId=String(model.model||'');
        const pipelineTask=model.supportsVision===true?(model.pipelineTask||(/gemma[-_/]?4/i.test(modelId)?'any-to-any':'image-text-to-text')):'text-generation';
        this.generator=await lib.pipeline(pipelineTask,model.model,{device:this.device,dtype:this.dtype,progress_callback:progress});
        const runtimePersisted=await Promise.all(this.runtimeAssets.map(url=>this.cache.match(url).then(Boolean)));
        if(!runtimePersisted.every(Boolean))throw new Error('ONNX Runtime WASM assets could not be saved in IndexedDB. The model cannot be used offline until the runtime files are cached.');
        const manifest=await this.cache.finishModel();
        const persisted=manifest?.complete&&await this.cache.isModelCached(model.id,model.model,variant);
        if(!persisted)throw new Error('The model loaded, but one or more files could not be persisted in IndexedDB. Check available browser storage and try again.');
        this.model=model;this.loadedModelId=model.id;this.loading=false;this.progress=100;this.downloads.clear();
        // Lock subsequent model/runtime reads to the persistent cache. Inference must not
        // silently fall back to downloading a missing asset.
        this.offlineOnly=true;
        if(lib.env)lib.env.allowRemoteModels=false;
        this.statusText=(this.cacheHit?'INDEXEDDB CACHE':'DOWNLOADED + CACHED')+' · '+this.device.toUpperCase()+' · '+model.model+' ready';
        this.emit({loading:false,progress:100,statusText:this.statusText});return model;
      }catch(e){
        this.cache.cancelModel();
        const failedGenerator=this.generator;
        this.generator=null;this.loadedModelId='';this.loading=false;this.downloads.clear();
        try{await failedGenerator?.dispose?.();}catch(_){}
        const detail=e&&e.message||String(e);
        const message=this.offlineOnly?'Offline cache could not fully load this model: '+detail:'Model load failed: '+detail;
        this.emit({loading:false,progress:0,statusText:message});
        throw new Error(message);
      }
    }
    cancel(){try{if(this.stopper&&this.stopper.interrupt)this.stopper.interrupt();}catch(_){}}
    requireGenerator(){if(!this.generator)throw new Error('No local AI model is loaded. Open AI Settings and load a local model.');return this.generator;}
    async generate(messages,options,onText){
      options=options||{};
      const signal=options.signal,model=this.model;
      if(signal&&signal.aborted)throw new DOMException('Aborted','AbortError');
      const hasImages=messages.some(message=>Array.isArray(message?.images)&&message.images.length>0);
      const requestMessages=messages.map(message=>{
        const next={...message};
        if(Array.isArray(message?.images)&&message.images.length){
          next.content=[
            ...message.images.map(image=>({type:'image',url:image.dataUrl})),
            {type:'text',text:String(message.content||'')}
          ];
          delete next.images;
        }
        return next;
      });
      let generated='';
      const run=async()=>{
        generated='';
        const generator=this.requireGenerator();
        const lib=await this.library();const Stopper=lib.InterruptableStoppingCriteria;const stopper=Stopper?new Stopper():null;this.stopper=stopper;
        const tokenizer=generator.tokenizer||generator.processor?.tokenizer;
        const streamer=lib.TextStreamer&&tokenizer?new lib.TextStreamer(tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:piece=>{generated+=String(piece||'');if(onText)onText(generated,String(piece||''));}}):null;
        try{
          const generationOptions={max_new_tokens:Math.max(64,Math.min(4096,Number(options.maxTokens)||1024)),do_sample:true,temperature:options.temperature!=null?options.temperature:.7,top_p:options.topP!=null?options.topP:.9,...(stopper?{stopping_criteria:[stopper]}:{})};
          let result=null;
          if(this.device==='webgpu'&&!hasImages&&model?.supportsVision!==true){
            const conversationId=String(options.conversationId||'');
            let cacheState=null;
            const previousState=conversationId?this.kvCaches.get(conversationId):null;
            if(previousState&&previousState.modelId===String(model?.id||'')){
              previousState.inUse=true;
              previousState.lastUsed=Date.now();
              cacheState=previousState;
            }else if(previousState){
              await this.clearKVCache(conversationId);
            }
            let cachedGeneration=null;
            try{
              cachedGeneration=await generateWebGPUChunked(generator,lib,requestMessages,generationOptions,streamer,signal,progress=>{
                const reused=progress.cached?' · reused '+progress.cached+' cached tokens':'';
                this.emit({statusText:'WEBGPU · preparing prompt '+progress.processed+'/'+progress.total+' tokens'+reused});
              },cacheState);
            }catch(error){
              if(conversationId)await this.clearKVCache(conversationId);
              throw error;
            }
            if(cachedGeneration!==null){
              result=cachedGeneration.result;
              const nextCache=cachedGeneration.cache;
              const canRetain=!!conversationId&&!!nextCache&&cachedGeneration.cacheLength<=this.maxReusableCacheTokens;
              if(canRetain){
                this.kvCaches.set(conversationId,{
                  cache:nextCache,
                  tokenIds:cachedGeneration.tokenIds,
                  cacheLength:cachedGeneration.cacheLength,
                  modelId:String(model?.id||''),
                  inUse:false,
                  lastUsed:Date.now()
                });
              }else{
                try{await nextCache?.dispose?.();}catch(_){}
                if(conversationId)await this.clearKVCache(conversationId);
              }
            }else if(conversationId){
              await this.clearKVCache(conversationId);
            }
            if(previousState)previousState.inUse=false;
            await this.evictKVCache(conversationId);
          }
          if(result===null)result=await generator(requestMessages,{...generationOptions,...(streamer?{streamer}:{})});
          if(signal&&signal.aborted)throw new DOMException('Aborted','AbortError');
          return generatedText(result,generated)||generated;
        }finally{if(this.stopper===stopper)this.stopper=null;}
      };
      const abort=()=>this.cancel();if(signal&&signal.addEventListener)signal.addEventListener('abort',abort,{once:true});
      try{
        try{return await run();}
        catch(error){
          if(options.conversationId)await this.clearKVCache(String(options.conversationId));
          // ORT's WebGPU buffer-download failure means the GPU inference context
          // is no longer usable. If prefill failed before emitting any text, retry
          // this exact request on WASM rather than making the user restart Agent.
          const canFallback=this.device==='webgpu'&&!!model&&!generated&&isWebGPUBufferFailure(error)&&!(signal&&signal.aborted);
          if(!canFallback)throw error;
          this.emit({loading:true,statusText:'WebGPU inference failed. Retrying this request on CPU (WASM)…'});
          try{await this.unload(false);await this.load(model,{device:'wasm',offlineOnly:true});}
          catch(fallbackError){throw new Error('WebGPU inference failed and the CPU (WASM) fallback could not load: '+(fallbackError&&fallbackError.message||String(fallbackError)));}
          if(signal&&signal.aborted)throw new DOMException('Aborted','AbortError');
          return await run();
        }
      }finally{if(signal&&signal.removeEventListener)signal.removeEventListener('abort',abort);}
    }
    async complete(messages,options){return {role:'assistant',content:await this.generate(messages,options||{}),tool_calls:[],reasoning_content:''};}
    async *stream(messages,options){
      let last='';const queue=[];let waiting=null,done=false,error=null;
      const wake=()=>{done=true;if(waiting){const resolve=waiting;waiting=null;resolve();}};
      const generation=this.generate(messages,options||{},(text,delta)=>{last=text;queue.push({text,delta,reasoning:''});if(waiting){const resolve=waiting;waiting=null;resolve();}}).then(final=>{if(final&&final!==last){queue.push({text:final,delta:final.slice(last.length),reasoning:''});}}).catch(e=>{error=e;}).finally(wake);
      while(!done||queue.length){if(!queue.length)await new Promise(resolve=>{waiting=resolve;});while(queue.length)yield queue.shift();}
      await generation;if(error)throw error;
    }
  }
  root.LocalModelManager=LocalModelManager;
})();

/* -------------------------------------------------------------------------- */
/* Consolidated module */
(function(global){
  'use strict';
  const root=global.EditorAI=global.EditorAI||{};
  const Base=root.ProviderAI;
  if(typeof Base!=='function') throw new Error('Load ai-chat.js before local-chat-provider.js.');
  class LocalProviderAI extends Base {
    constructor(options={}) { super({...options,kind:'local'}); this.runtime=options.runtime||null; this.registry=options.registry||null; }
    getModel(){ const model=this.registry?.active?.()||null; return model&&(model.local||model.protocol==='local-transformers')?model:null; }
    complete(messages,options={}) { const model=options.model||this.getModel(); if(!model) throw new Error('The selected model is not a local model.'); if(!this.runtime?.complete) throw new Error('Local inference runtime is unavailable.'); return this.runtime.complete(messages,{...options,model}); }
    stream(messages,options={}) { const model=options.model||this.getModel(); if(!model) throw new Error('The selected model is not a local model.'); if(!this.runtime?.stream) throw new Error('Local inference runtime is unavailable.'); return this.runtime.stream(messages,{...options,model}); }
    load(model=this.getModel(),options={}) { if(!model) throw new Error('No local model is selected.'); return this.runtime?.load?.(model,options); }
    unload(){ return this.runtime?.unload?.(); }
    isLoaded(modelId){ return !!this.runtime?.isLoaded?.(modelId); }
    cancel(){ this.runtime?.cancel?.(); }
    dispose(){ this.cancel(); }
  }
  root.LocalProviderAI=LocalProviderAI;
  if(global.ChatAIFramework) global.ChatAIFramework.LocalProviderAI=LocalProviderAI;
})(window);