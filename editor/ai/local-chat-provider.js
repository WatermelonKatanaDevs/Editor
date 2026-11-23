(function(){
  const root=window.EditorAI=window.EditorAI||{};
  root.LOCAL_MODEL_PROTOCOL='local-transformers';
  root.LOCAL_MODEL_LIBRARY_URL='https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js';
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
    beginModel(id,model,variant,capabilities={}){
      this.activeModel={id:String(id),model:String(model),variant:String(variant),capabilities:capabilities&&typeof capabilities==='object'?{...capabilities}:{},files:new Map()};
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
        capabilities:{...session.capabilities},
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
    return /Failed to download data from buffer|mapAsync.{0,180}GPUBuffer|MapAsyncStatus|Invalid Buffer|out of memory|out-of-memory|failed to allocate|allocation failed|GPU device was lost|device lost/i.test(parts.join('\n'));
  }
  function cacheName(name){
    return String(name).replace('present_conv','past_conv').replace('present_ssm','past_ssm').replace('present_recurrent','past_recurrent').replace('present','past_key_values');
  }
  function inspectCacheHardware(){
    const GiB=1024*1024*1024;
    let memoryGiB=null;
    try{
      const reported=Number(typeof navigator!=='undefined'?navigator.deviceMemory:NaN);
      if(Number.isFinite(reported)&&reported>0)memoryGiB=reported;
    }catch(_){}
    // Browsers deliberately coarsen this value. Budget 40% of reported RAM for
    // one retained KV cache, capped to avoid reserving most of a large machine.
    // When unavailable, use a smaller fallback; WebGPU exposes no free-VRAM API.
    const cacheBudgetBytes=memoryGiB===null?3*GiB:Math.max(512*1024*1024,Math.min(6*GiB,memoryGiB*.4*GiB));
    return {memoryGiB,cacheBudgetBytes,source:memoryGiB===null?'fallback':'navigator.deviceMemory'};
  }
  function tensorByteLength(value){
    if(!value||typeof value!=='object')return 0;
    const dims=Array.isArray(value.dims)?value.dims:(Array.isArray(value.shape)?value.shape:null);
    if(!dims||!dims.length)return 0;
    const elements=dims.reduce((total,dimension)=>{
      const size=Number(dimension);
      return Number.isFinite(size)&&size>=0?total*size:NaN;
    },1);
    if(!Number.isFinite(elements)||elements<=0)return 0;
    const type=String(value.type||value.dtype||'').toLowerCase();
    const bytes=/float64|double|int64|uint64/.test(type)?8:
      /float32|single|int32|uint32/.test(type)?4:
      /float16|half|bfloat16|int16|uint16/.test(type)?2:
      /int8|uint8|bool/.test(type)?1:0;
    return bytes?elements*bytes:0;
  }
  function estimateDynamicCacheBytes(cache){
    let total=0;
    const visited=new Set();
    const visit=(value,depth)=>{
      if(!value||typeof value!=='object'||visited.has(value)||depth>4)return;
      visited.add(value);
      const bytes=tensorByteLength(value);
      if(bytes>0){total+=bytes;return;}
      if(Array.isArray(value)){
        for(const child of value)visit(child,depth+1);
        return;
      }
      for(const [key,child] of Object.entries(value)){
        if(key==='data'||key==='buffer'||key==='location')continue;
        visit(child,depth+1);
      }
    };
    visit(cache,0);
    return total;
  }
  function modelContextLimit(generator){
    const model=generator?.model||generator;
    const configs=[model?.config,model?.config?.text_config,model?.config?.language_config,model?.model?.config].filter(Boolean);
    const keys=['max_position_embeddings','max_sequence_length','max_seq_len','max_model_len','n_positions','seq_length'];
    for(const config of configs)for(const key of keys){
      const value=Number(config?.[key]);
      if(Number.isFinite(value)&&value>0)return Math.floor(value);
    }
    return 131072;
  }
  function estimateModelKVBytesPerToken(generator,dtype){
    const model=generator?.model||generator;
    const configs=[model?.config,model?.config?.text_config,model?.config?.language_config,model?.model?.config].filter(Boolean);
    const read=names=>{
      for(const config of configs)for(const name of names){
        const value=Number(config?.[name]);
        if(Number.isFinite(value)&&value>0)return value;
      }
      return 0;
    };
    const layers=read(['num_hidden_layers','n_layer','num_layers']);
    const attentionHeads=read(['num_attention_heads','n_head','num_heads']);
    const kvHeads=read(['num_key_value_heads','num_kv_heads'])||attentionHeads;
    const headDim=read(['head_dim'])||(attentionHeads?read(['hidden_size','n_embd'])/attentionHeads:0);
    if(!layers||!kvHeads||!headDim)return 0;
    const type=String(dtype||'').toLowerCase();
    const bytesPerElement=/float32|fp32/.test(type)?4:/float64|fp64/.test(type)?8:2;
    return 2*layers*kvHeads*headDim*bytesPerElement;
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
  function commonTokenPrefixLength(current,cached,limit){
    if(!Array.isArray(current)||!Array.isArray(cached))return 0;
    const max=Math.max(0,Math.min(Number(limit)||0,current.length,cached.length));
    let index=0;
    while(index<max&&current[index]===cached[index])index++;
    return index;
  }
  async function cropDynamicCache(cache,targetLength,lib){
    const currentLength=Number(cache?.get_seq_length?.())||0;
    targetLength=Math.max(0,Math.min(currentLength,Math.floor(Number(targetLength)||0)));
    if(targetLength===currentLength)return cache;
    if(targetLength===0){await cache?.dispose?.();return null;}
    // Transformers.js exposes cache tensors as named entries. Slice their sequence
    // dimension to preserve the matching prefix without copying the entire prompt
    // through the CPU or throwing away the reusable KV state.
    const tensorEntries=Object.entries(cache||{}).filter(([,tensor])=>tensor&&typeof tensor==='object'&&Array.isArray(tensor.dims));
    const unsupported=!tensorEntries.length||tensorEntries.some(([,tensor])=>{
      const sequenceAxis=tensor.dims.length-2;
      return tensor.dims.length<3||typeof tensor.slice!=='function'||Number(tensor.dims[sequenceAxis])!==currentLength;
    });
    if(unsupported){await cache?.dispose?.();return null;}
    const entries={};
    try{
      // Slice and release one tensor at a time to avoid holding two full KV caches
      // in memory while preserving the common prefix.
      for(const [name,tensor] of tensorEntries){
        const slices=new Array(tensor.dims.length).fill(null);
        slices[tensor.dims.length-2]=[0,targetLength];
        entries[name]=tensor.slice(...slices);
        await tensor.dispose?.();
      }
      const cropped=new lib.DynamicCache(entries);
      if((Number(cropped.get_seq_length?.())||0)!==targetLength)throw new Error('The cropped KV cache has an unexpected sequence length.');
      return cropped;
    }catch(error){
      for(const tensor of Object.values(entries)){try{await tensor?.dispose?.();}catch(_){}}
      try{await cache?.dispose?.();}catch(_){}
      if(isWebGPUBufferFailure(error))throw error;
      return null;
    }
  }
  async function generateWebGPUChunked(generator,lib,messages,generationOptions,streamer,signal,onProgress,cacheState,tools){
    const tokenizer=generator.tokenizer,model=generator.model;
    if(!model?.forward||!model?.generate||!tokenizer?.apply_chat_template||!lib.DynamicCache||!lib.Tensor||!lib.ones)return null;
    const inputs=tokenizer.apply_chat_template(messages,{add_generation_prompt:true,return_dict:true,...(Array.isArray(tools)&&tools.length?{tools}:{})});
    const inputIds=inputs?.input_ids;
    const dims=inputIds?.dims||[];
    const tokenCount=Number(dims[dims.length-1]||0);
    if(!inputIds||tokenCount<=1)return null;
    const inputTokenIds=await tensorTokenIds(inputIds);
    if(inputTokenIds.length<tokenCount)return null;
    const targetEnd=tokenCount-1; // Leave the final prompt token for generate() to consume.
    let cache=cacheState?.cache||null,reusedTokens=0,start=0,chunkSize=256;
    if(cache){
      let cacheLength=0;
      try{cacheLength=Number(cache.get_seq_length())||0;}catch(_){}
      reusedTokens=commonTokenPrefixLength(inputTokenIds,cacheState?.tokenIds,Math.min(cacheLength,targetEnd));
      if(reusedTokens<cacheLength){
        const previousCache=cache;
        cache=await cropDynamicCache(cache,reusedTokens,lib);
        if(cacheState){
          cacheState.cache=cache;
          cacheState.cacheLength=reusedTokens;
          cacheState.tokenIds=(cacheState.tokenIds||[]).slice(0,reusedTokens);
          cacheState.cacheBytes=cache?estimateDynamicCacheBytes(cache):0;
        }
        if(!cache&&previousCache){
          reusedTokens=0;
          if(cacheState){cacheState.cache=null;cacheState.cacheLength=0;cacheState.tokenIds=[];cacheState.cacheBytes=0;}
        }
      }
      if(reusedTokens<=0){
        if(cache){try{await cache.dispose();}catch(_){}}
        cache=null;
        if(cacheState){cacheState.cache=null;cacheState.cacheLength=0;cacheState.tokenIds=[];cacheState.cacheBytes=0;}
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
        // Keep the raw generated IDs so the next agent prompt can preserve the
        // exact assistant tool-call prefix emitted by the model.
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
      onProgress?.({stage:'generating',processed:targetEnd,total:targetEnd,cached:reusedTokens,chunkSize});
      const result=await model.generate({
        ...inputs,
        ...(cache?{past_key_values:cache,attention_mask:lib.ones(dims)}:{}),
        ...generationOptions,
        streamer
      });
      const cacheLength=Number(cache?.get_seq_length?.())||0;
      const tokenIds=[...inputTokenIds,...streamedTokenIds].slice(0,cacheLength);
      if(!cache||cacheLength<=0||tokenIds.length!==cacheLength){
        try{await cache?.dispose?.();}catch(_){}
        cache=null;
        return {result,cache:null,cacheLength:0,tokenIds:inputTokenIds,reusedTokens,generatedTokenIds:[]};
      }
      // Preserve the complete generated body, including a final sampled token
      // that may not yet have been added to the KV cache. The cache's tokenIds
      // remain sliced to cacheLength, so the next prompt can reuse the cached prefix
      // and prefill any generated tail that was not part of that cache.
      const generatedTokenIds=[...streamedTokenIds];
      const eosIds=new Set([tokenizer?.eos_token_id,tokenizer?.eos_token_ids].flat().filter(value=>value!=null).map(Number));
      while(generatedTokenIds.length&&eosIds.has(Number(generatedTokenIds[generatedTokenIds.length-1])))generatedTokenIds.pop();
      return {result,cache,cacheLength,tokenIds,reusedTokens,generatedTokenIds};
    }catch(error){
      try{await cache?.dispose?.();}catch(_){}
      throw error;
    }
  }
  async function createGemma4Generator(lib,modelId,device,dtype,progress){
    const Gemma4Model=lib.Gemma4ForConditionalGeneration||lib.AutoModelForImageTextToText;
    if(typeof Gemma4Model?.from_pretrained!=='function'||typeof lib.AutoProcessor?.from_pretrained!=='function'){
      throw new Error('This Transformers.js runtime does not expose the Gemma 4 model and processor APIs. Update the local AI runtime and reload the editor.');
    }
    const [processor,model]=await Promise.all([
      lib.AutoProcessor.from_pretrained(modelId,{progress_callback:progress}),
      Gemma4Model.from_pretrained(modelId,{device,dtype,progress_callback:progress})
    ]);
    if(!processor?.tokenizer||typeof processor.apply_chat_template!=='function'){
      try{await model?.dispose?.();}catch(_){}
      throw new Error('Transformers.js could not initialize the Gemma 4 processor and tokenizer.');
    }
    if(typeof lib.load_audio!=='function'){
      try{await model?.dispose?.();}catch(_){}
      throw new Error('This Transformers.js runtime does not include browser audio decoding support.');
    }
    const generateOnce=async(messages,generationOptions,tools,audio=null)=>{
      const prompt=processor.apply_chat_template(messages,{
        add_generation_prompt:true,
        ...(Array.isArray(tools)&&tools.length?{tools}:{})
      });
      const imageSources=[];
      for(const message of messages||[]){
        if(!Array.isArray(message?.content))continue;
        for(const part of message.content){
          if(part?.type!=='image')continue;
          const source=part.url||part.image||part.data;
          if(source)imageSources.push(source);
        }
      }
      const images=imageSources.length
        ? await Promise.all(imageSources.map(image=>image instanceof lib.RawImage?image:lib.load_image(image)))
        : null;
      const inputs=await processor(prompt,images,audio,{add_special_tokens:false});
      let output=null;
      try{
        output=await model.generate({...inputs,...generationOptions});
        const sequences=output?.sequences||output;
        const allTokenIds=await tensorTokenIds(sequences);
        const promptLength=Number(inputs?.input_ids?.dims?.at(-1))||0;
        const generatedIds=allTokenIds.slice(promptLength);
        const generated=processor.tokenizer.decode(generatedIds,{skip_special_tokens:true});
        return String(generated||'');
      }finally{
        const tensors=new Set([...Object.values(inputs||{}),output?.sequences||output].filter(value=>value&&typeof value.dispose==='function'));
        for(const tensor of tensors){try{await tensor.dispose();}catch(_){}}
      }
    };
    const loadAudio=async source=>{
      let objectUrl='';
      try{
        const response=await fetch(source);
        if(!response.ok)throw new Error('Could not read the attached audio file ('+response.status+').');
        const blob=await response.blob();
        objectUrl=URL.createObjectURL(blob);
        const waveform=await lib.load_audio(objectUrl,16000);
        if(!waveform?.length)throw new Error('The attached audio file contains no decodable audio.');
        return waveform instanceof Float32Array?waveform:Float32Array.from(waveform);
      }catch(error){
        throw new Error('Could not decode the attached audio. Try WAV, MP3, M4A, AAC, OGG, or FLAC. '+(error?.message||String(error)));
      }finally{
        if(objectUrl)URL.revokeObjectURL(objectUrl);
      }
    };
    const generate=async(messages,callOptions={})=>{
      const {tools,audioProgress,...generationOptions}=callOptions||{};
      let audioMessageIndex=-1,audioParts=[];
      for(let i=0;i<(messages||[]).length;i++){
        const message=messages[i];
        if(message?.role!=='user'||!Array.isArray(message.content))continue;
        const parts=message.content.filter(part=>part?.type==='audio');
        if(parts.length){audioMessageIndex=i;audioParts=parts;}
      }
      if(!audioParts.length)return [{generated_text:[{role:'assistant',content:await generateOnce(messages,generationOptions,tools,null)}]}];
      const audioMessage=messages[audioMessageIndex];
      const allContent=audioMessage.content||[];
      const originalPrompt=allContent.filter(part=>part?.type==='text').map(part=>String(part.text||'')).join('\n').trim()||'Please analyze this audio.';
      const imageParts=allContent.filter(part=>part?.type==='image');
      const maxSamples=30*16000;
      const segments=[];
      let totalDuration=0;
      for(let partIndex=0;partIndex<audioParts.length;partIndex++){
        const part=audioParts[partIndex];
        const source=part.url||part.data||part.src;
        if(!source)throw new Error('An audio attachment is missing its file data.');
        audioProgress?.({stage:'decoding',index:partIndex+1,total:audioParts.length,name:String(part.name||part.filename||'Audio')});
        const waveform=await loadAudio(source);
        if(typeof processor._compute_audio_num_tokens==='function'&&processor._compute_audio_num_tokens(waveform.length,16000)<=0){
          throw new Error('The audio in "'+String(part.name||part.filename||'attachment')+'" is too short to process. Use a clip at least 0.05 seconds long.');
        }
        const segmentCount=Math.max(1,Math.ceil(waveform.length/maxSamples));
        const segmentSamples=Math.ceil(waveform.length/segmentCount);
        totalDuration+=waveform.length/16000;
        if(totalDuration>10*60)throw new Error('Audio attachments are limited to 10 minutes in total. Trim the recording and try again.');
        for(let index=0;index<segmentCount;index++){
          const start=index*segmentSamples,end=Math.min(waveform.length,start+segmentSamples);
          if(end<=start)continue;
          segments.push({
            samples:waveform.slice(start,end),
            name:String(part.name||part.filename||'Audio'),
            startSeconds:start/16000,
            endSeconds:end/16000
          });
        }
      }
      if(!segments.length)throw new Error('No usable audio segments were found.');
      if(segments.length===1){
        audioProgress?.({index:1,total:1,name:segments[0].name,startSeconds:0,endSeconds:totalDuration});
        const singleMessage={...audioMessage,content:[...imageParts,{type:'audio'},{type:'text',text:originalPrompt}]};
        return [{generated_text:[{role:'assistant',content:await generateOnce([...messages.slice(0,audioMessageIndex),singleMessage],generationOptions,tools,segments[0].samples)}]}];
      }

      // Gemma 4 accepts at most 30 seconds of audio per processor call. Analyze
      // evenly sized segments in order, carrying text summaries forward, then
      // synthesize one answer to the user's original prompt.
      const workingMessages=messages.slice(0,audioMessageIndex);
      const segmentSummaries=[];
      const segmentOptions={...generationOptions,max_new_tokens:Math.min(384,Number(generationOptions.max_new_tokens)||384)};
      delete segmentOptions.streamer;
      for(let index=0;index<segments.length;index++){
        const segment=segments[index];
        const segmentPrompt=originalPrompt+
          '\n\nThis is audio segment '+(index+1)+' of '+segments.length+
          ' from "'+segment.name+'", covering '+segment.startSeconds.toFixed(1)+'–'+segment.endSeconds.toFixed(1)+
          ' seconds. Analyze this segment in relation to the original request. Give concise observations grounded only in what is audible; do not guess details that this segment cannot establish.';
        audioProgress?.({index:index+1,total:segments.length,name:segment.name,startSeconds:segment.startSeconds,endSeconds:segment.endSeconds});
        const segmentMessage={...audioMessage,content:[...imageParts,{type:'audio'},{type:'text',text:segmentPrompt}]};
        const summary=await generateOnce([...workingMessages,segmentMessage],segmentOptions,null,segment.samples);
        segmentSummaries.push({name:segment.name,startSeconds:segment.startSeconds,endSeconds:segment.endSeconds,text:summary});
        workingMessages.push({role:'user',content:segmentPrompt},{role:'assistant',content:summary});
      }
      const notes=segmentSummaries.map((item,index)=>
        'Segment '+(index+1)+' ('+item.name+', '+item.startSeconds.toFixed(1)+'–'+item.endSeconds.toFixed(1)+'s):\n'+item.text
      ).join('\n\n');
      workingMessages.push({
        role:'user',
        content:'Original request: '+originalPrompt+
          '\n\nThe complete recording was analyzed in sequential segments. Combine the observations below and answer the original request. Preserve useful timestamps, distinguish observations from uncertain guesses, and avoid inventing details.\n\n'+notes
      });
      audioProgress?.({stage:'synthesizing',index:segments.length,total:segments.length,name:'Combining segment analyses'});
      const finalText=await generateOnce(workingMessages,generationOptions,tools,null);
      return [{generated_text:[{role:'assistant',content:finalText}]}];
    };
    generate.model=model;
    generate.processor=processor;
    generate.tokenizer=processor.tokenizer;
    generate.dispose=()=>model?.dispose?.();
    return generate;
  }
  class LocalModelManager{
    constructor(){this.libraryPromise=null;this.libraryBlobUrl='';this.generator=null;this.model=null;this.loadedModelId='';this.loading=false;this.progress=0;this.downloads=new Map();this.trackingFiles=false;this.inference=null;this.statusText='';this.device='';this.dtype='';this.stopper=null;this.listeners=new Set();this.cache=root.LocalModelCache||new root.IndexedDBModelCache();this.offlineOnly=false;this.cacheHit=false;this.runtimeAssets=[];this.kvCaches=new Map();this.hardwareProfile=inspectCacheHardware();this.cacheBudgetBytes=this.hardwareProfile.cacheBudgetBytes;this.cacheBytesPerToken=0;this.maxReusableCacheTokens=16384;this.maxReusableCacheSessions=1;this.modelContextLimit=131072;}
    subscribe(fn){if(typeof fn!=='function')return ()=>{};this.listeners.add(fn);fn(this.status());return ()=>this.listeners.delete(fn);}
    status(){return {loading:this.loading,loadedModelId:this.loadedModelId,loaded:!!this.generator,progress:this.progress,downloads:Array.from(this.downloads.values()),trackingFiles:this.trackingFiles,inference:this.inference,text:this.statusText,device:this.device,dtype:this.dtype,offlineOnly:this.offlineOnly,cacheHit:this.cacheHit,cacheBudgetBytes:this.cacheBudgetBytes,cacheTokenLimit:this.maxReusableCacheTokens,deviceMemoryGiB:this.hardwareProfile?.memoryGiB??null};}
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
      const totalBytes=()=>[...this.kvCaches.values()].reduce((sum,state)=>sum+(Number(state.cacheBytes)||0),0);
      while(this.kvCaches.size>this.maxReusableCacheSessions||totalBytes()>this.cacheBudgetBytes){
        const candidates=[...this.kvCaches.entries()]
          .filter(([id,state])=>id!==String(preferredConversationId||'')&&!state.inUse)
          .sort((a,b)=>(a[1].lastUsed||0)-(b[1].lastUsed||0));
        if(!candidates.length)break;
        await this.clearKVCache(candidates[0][0]);
      }
    }
    async unload(notify=true){this.downloads.clear();this.trackingFiles=false;this.inference=null;await this.clearKVCache();const old=this.generator;this.generator=null;this.model=null;this.loadedModelId='';this.stopper=null;if(old&&old.dispose){try{await old.dispose();}catch(e){console.warn('Local AI model disposal failed:',e);}}if(notify)this.emit({loading:false,progress:0,statusText:'Model unloaded.'});}
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
        const cachedManifest=cached?await this.cache.getModel(model.id,model.model,variant):null;
        if(cachedManifest?.capabilities){model.capabilities={...cachedManifest.capabilities,...(model.capabilities||{})};model.supportsVision=model.capabilities.vision===true;model.supportsAudio=model.capabilities.audio===true;model.pipelineTask=String(model.capabilities.pipelineTask||model.pipelineTask||'');}
        this.cacheHit=!!cached;
        this.offlineOnly=!!(strictOffline||cached);
        if(lib.env)lib.env.allowRemoteModels=!this.offlineOnly;
        await this.unload(false);
        this.loading=true;this.device=requestedDevice;this.dtype=(this.device==='webgpu'?'q4f16':'q4');
        this.cache.beginModel(model.id,model.model,variant,{...(model.capabilities||{}),vision:model.supportsVision===true,audio:model.supportsAudio===true,pipelineTask:model.pipelineTask||model.capabilities?.pipelineTask||''});
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
        const isGemma4=/gemma[-_/]?4/i.test(modelId);
        if(isGemma4){
          // Transformers.js 4.3.2 registers Gemma4's model architecture and
          // processor, but does not expose an 'any-to-any' pipeline task. Load
          // the multimodal model directly rather than calling that unsupported task.
          this.generator=await createGemma4Generator(lib,model.model,this.device,this.dtype,progress);
        }else{
          const pipelineTask=(model.supportsVision===true||model.supportsAudio===true)?(model.pipelineTask||'image-text-to-text'):'text-generation';
          this.generator=await lib.pipeline(pipelineTask,model.model,{device:this.device,dtype:this.dtype,progress_callback:progress});
        }
        if(this.device==='webgpu'){
          this.hardwareProfile=inspectCacheHardware();
          this.cacheBudgetBytes=this.hardwareProfile.cacheBudgetBytes;
          this.cacheBytesPerToken=estimateModelKVBytesPerToken(this.generator,this.dtype)||256*1024;
          this.modelContextLimit=modelContextLimit(this.generator);
          this.maxReusableCacheTokens=Math.max(1,Math.min(this.modelContextLimit,Math.floor(this.cacheBudgetBytes/this.cacheBytesPerToken)));
        }
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
      const hasAudio=messages.some(message=>Array.isArray(message?.audios)&&message.audios.length>0);
      const hasVideos=messages.some(message=>Array.isArray(message?.videos)&&message.videos.length>0);
      const requestMessages=messages.map(message=>{
        const next={...message};
        const images=Array.isArray(message?.images)?message.images:[];
        const audios=Array.isArray(message?.audios)?message.audios:[];
        const videos=Array.isArray(message?.videos)?message.videos:[];
        if(images.length||audios.length||videos.length){
          next.content=[
            ...images.map(image=>({type:'image',url:image.dataUrl})),
            ...audios.map(audio=>({type:'audio',url:audio.dataUrl,name:audio.name})),
            ...videos.map(video=>({type:'video',source:video.file||video.blob||video.source,name:video.name||'Video'})),
            {type:'text',text:String(message.content||'')}
          ];
          delete next.images;
          delete next.audios;
          delete next.videos;
        }
        return next;
      });
      const readVideoDuration=source=>new Promise((resolve,reject)=>{
        if(!(source instanceof Blob)){reject(new Error('The video attachment is not a readable browser file.'));return;}
        const video=document.createElement('video'),url=URL.createObjectURL(source);
        let timeout=null,settled=false;
        const finish=(error,value)=>{
          if(settled)return;settled=true;
          if(timeout)clearTimeout(timeout);
          video.onloadedmetadata=null;video.onerror=null;
          video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);
          if(error)reject(error);else resolve(value);
        };
        timeout=setTimeout(()=>finish(new Error('Timed out reading video metadata.')),15000);
        video.preload='metadata';video.muted=true;video.playsInline=true;
        video.onloadedmetadata=()=>finish(null,Number(video.duration));
        video.onerror=()=>finish(new Error('The browser could not read this video format.'));
        video.src=url;
        try{video.load();}catch(error){finish(error);}
      });
      const prepareVideoFrames=async(lib,sourceMessages)=>{
        if(typeof lib.load_video!=='function')throw new Error('This Transformers.js runtime does not include browser video decoding. Reload the editor to update its local AI runtime.');
        const videoCount=sourceMessages.reduce((count,message)=>count+(Array.isArray(message?.content)?message.content.filter(part=>part?.type==='video').length:0),0);
        if(!videoCount)return sourceMessages;
        const perVideoFrameBudget=Math.max(1,Math.floor(32/videoCount));
        let decoded=0;
        const prepared=[];
        const formatTimestamp=value=>{
          const seconds=Math.max(0,Number(value)||0),minutes=Math.floor(seconds/60),whole=Math.floor(seconds%60),tenths=Math.floor((seconds-Math.floor(seconds))*10);
          return String(minutes).padStart(2,'0')+':'+String(whole).padStart(2,'0')+'.'+tenths;
        };
        for(const message of sourceMessages){
          if(signal&&signal.aborted)throw new DOMException('Aborted','AbortError');
          if(message.role!=='user'||!Array.isArray(message.content)||!message.content.some(part=>part?.type==='video')){
            prepared.push(message);continue;
          }
          const content=[];
          for(const part of message.content){
            if(part?.type!=='video'){content.push(part);continue;}
            const source=part.source||part.blob||part.file;
            if(!source)throw new Error('The video attachment "'+String(part.name||'Video')+'" is missing its file data.');
            this.emit({inference:{stage:'prompt',label:'Reading video metadata '+String(decoded+1)+'/'+String(videoCount)+' · '+String(part.name||'Video'),progress:Math.round(decoded/videoCount*100)}});
            let duration=0;
            try{duration=await readVideoDuration(source);}
            catch(error){throw new Error('Could not read video "'+String(part.name||'Video')+'". Try MP4 (H.264) or WebM (VP9). '+(error?.message||String(error)));}
            if(!Number.isFinite(duration)||duration<=0)throw new Error('The video "'+String(part.name||'Video')+'" has no readable duration.');
            if(duration>60)throw new Error('Video attachments are limited to 60 seconds. Trim "'+String(part.name||'Video')+'" and try again.');
            let video;
            try{video=await lib.load_video(source,{fps:1});}
            catch(error){throw new Error('Could not decode video "'+String(part.name||'Video')+'". Try MP4 (H.264) or WebM (VP9). '+(error?.message||String(error)));}
            duration=Number(video?.duration)||duration;
            const frames=Array.isArray(video?.frames)?video.frames:[];
            if(!frames.length)throw new Error('No frames could be decoded from "'+String(part.name||'Video')+'".');
            const indexes=frames.length<=perVideoFrameBudget
              ?frames.map((_,index)=>index)
              :Array.from({length:perVideoFrameBudget},(_,index)=>Math.round(index*(frames.length-1)/Math.max(1,perVideoFrameBudget-1)));
            const selected=[...new Set(indexes)].map(index=>frames[index]).filter(Boolean);
            content.push({type:'text',text:'Video attachment "'+String(part.name||'Video')+'" · '+duration.toFixed(1)+' seconds. The following sampled frames are in chronological order; each has its original timestamp. Treat them as a sequence, not unrelated images.'});
            for(let index=0;index<selected.length;index++){
              const frame=selected[index],image=frame?.image||frame;
              if(!image)continue;
              const timestamp=Number.isFinite(Number(frame?.timestamp))?Number(frame.timestamp):(duration*index/Math.max(1,selected.length));
              content.push({type:'text',text:'Video frame '+(index+1)+'/'+selected.length+' at '+formatTimestamp(timestamp)+':'});
              content.push({type:'image',image});
            }
            decoded++;
            this.emit({inference:{stage:'prompt',label:'Sampled video '+decoded+'/'+videoCount+' · '+selected.length+' frames',progress:Math.round(decoded/videoCount*100)}});
          }
          prepared.push({...message,content});
        }
        return prepared;
      };
      let generated='';
      const run=async()=>{
        generated='';
        this.emit({inference:{stage:'preparing',label:'Processing prompt',progress:null}});
        const generator=this.requireGenerator();
        const lib=await this.library();
        const preparedMessages=hasVideos?await prepareVideoFrames(lib,requestMessages):requestMessages;
        const Stopper=lib.InterruptableStoppingCriteria;const stopper=Stopper?new Stopper():null;this.stopper=stopper;
        const tokenizer=generator.tokenizer||generator.processor?.tokenizer;
        const streamer=lib.TextStreamer&&tokenizer?new lib.TextStreamer(tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:piece=>{if(this.inference?.stage!=='generating')this.emit({inference:{stage:'generating',label:'Generating response',progress:null}});generated+=String(piece||'');if(onText)onText(generated,String(piece||''));}}):null;
        try{
          const generationOptions={max_new_tokens:Math.max(64,Math.min(4096,Number(options.maxTokens)||1024)),do_sample:true,temperature:options.temperature!=null?options.temperature:.7,top_p:options.topP!=null?options.topP:.9,...(stopper?{stopping_criteria:[stopper]}:{})};
          let result=null;
          if(this.device==='webgpu'&&!hasImages&&!hasAudio&&!hasVideos&&model?.supportsVision!==true){
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
              cachedGeneration=await generateWebGPUChunked(generator,lib,preparedMessages,generationOptions,streamer,signal,progress=>{
                if(progress.stage==='generating')this.emit({inference:{stage:'generating',label:'Generating response',progress:null}});
                else{
                  const total=Math.max(0,Number(progress.total)||0),processed=Math.max(0,Number(progress.processed)||0);
                  const reused=progress.cached?' · reused '+progress.cached+' cached tokens':'';
                  this.emit({inference:{stage:'prompt',label:'Preparing prompt',processed,total,cached:Math.max(0,Number(progress.cached)||0),progress:total?Math.min(100,processed/total*100):null,detail:processed+'/'+total+' tokens'+reused}});
                }
              },cacheState,options.tools);
            }catch(error){
              if(conversationId)await this.clearKVCache(conversationId);
              throw error;
            }
            if(cachedGeneration!==null){
              result=cachedGeneration.result;
              if(typeof options.onRawGeneratedText==='function'&&cachedGeneration.generatedTokenIds?.length){
                try{
                  const raw=tokenizer.decode(cachedGeneration.generatedTokenIds,{skip_special_tokens:false,clean_up_tokenization_spaces:false});
                  options.onRawGeneratedText(String(raw||''));
                }catch(error){console.warn('Could not decode the raw local assistant tokens for cache reuse:',error);}
              }
              const nextCache=cachedGeneration.cache;
              const measuredCacheBytes=estimateDynamicCacheBytes(nextCache);
              if(measuredCacheBytes>0&&cachedGeneration.cacheLength>0){
                this.cacheBytesPerToken=measuredCacheBytes/cachedGeneration.cacheLength;
                this.maxReusableCacheTokens=Math.max(1,Math.min(this.modelContextLimit,Math.floor(this.cacheBudgetBytes/this.cacheBytesPerToken)));
              }
              const cacheBytes=measuredCacheBytes||(this.cacheBytesPerToken*cachedGeneration.cacheLength);
              const canRetain=!!conversationId&&!!nextCache&&cacheBytes>0&&cacheBytes<=this.cacheBudgetBytes&&cachedGeneration.cacheLength<=this.maxReusableCacheTokens;
              if(canRetain){
                this.kvCaches.set(conversationId,{
                  cache:nextCache,
                  tokenIds:cachedGeneration.tokenIds,
                  cacheLength:cachedGeneration.cacheLength,
                  cacheBytes,
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
          if(result===null){
            // Keep the indeterminate status on prompt processing until the streamer
            // confirms that generated output has started.
            result=await generator(preparedMessages,{
              ...generationOptions,
              ...(streamer?{streamer}:{}),
              ...(Array.isArray(options.tools)&&options.tools.length?{tools:options.tools}:{}),
              ...(hasAudio?{audioProgress:info=>{
                const label=info?.stage==='synthesizing'
                  ?'Combining audio segment analyses…'
                  :info?.stage==='decoding'
                    ?'Decoding audio file '+String(info?.index||1)+'/'+String(info?.total||1)+' · '+String(info?.name||'Audio')
                    :'Analyzing audio segment '+String(info?.index||1)+'/'+String(info?.total||1)+' · '+String(info?.name||'Audio');
                this.emit({inference:{stage:'prompt',label,progress:info?.stage==='decoding'?null:info?.total?Math.max(0,Math.min(100,(Number(info.index)||0)/Number(info.total)*100)):null}});
              }}:{})
            });
          }
          if(signal&&signal.aborted)throw new DOMException('Aborted','AbortError');
          return generatedText(result,generated)||generated;
        }finally{if(this.stopper===stopper)this.stopper=null;}
      };
      const abort=()=>this.cancel();if(signal&&signal.addEventListener)signal.addEventListener('abort',abort,{once:true});
      try{
        try{return await run();}
        catch(error){
          if(options.conversationId)await this.clearKVCache(String(options.conversationId));
          // A WebGPU allocation/buffer failure means the GPU inference context may
          // no longer be usable. If prefill failed before emitting any text, retry
          // this exact request on WASM rather than making the user restart Agent.
          const canFallback=this.device==='webgpu'&&!!model&&!generated&&isWebGPUBufferFailure(error)&&!(signal&&signal.aborted);
          if(!canFallback)throw error;
          this.emit({loading:true,statusText:'WebGPU inference failed. Retrying this request on CPU (WASM)…'});
          try{await this.unload(false);await this.load(model,{device:'wasm',offlineOnly:true});}
          catch(fallbackError){throw new Error('WebGPU inference failed and the CPU (WASM) fallback could not load: '+(fallbackError&&fallbackError.message||String(fallbackError)));}
          if(signal&&signal.aborted)throw new DOMException('Aborted','AbortError');
          return await run();
        }
      }finally{this.emit({inference:null});if(signal&&signal.removeEventListener)signal.removeEventListener('abort',abort);}
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