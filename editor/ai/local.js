(function(){
  const root=window.EditorAI=window.EditorAI||{};
  function generatedText(result,fallback){
    const value=result&&result[0]&&result[0].generated_text;
    if(Array.isArray(value)){
      const last=value[value.length-1];
      if(typeof last==='string')return last;
      if(last&&typeof last.content==='string')return last.content;
    }
    if(typeof value==='string')return value;
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
  async function generateWebGPUChunked(generator,lib,messages,generationOptions,streamer,signal,onProgress){
    const tokenizer=generator.tokenizer,model=generator.model;
    if(!model?.forward||!model?.generate||!tokenizer?.apply_chat_template||!lib.DynamicCache||!lib.Tensor||!lib.ones)return null;
    const inputs=tokenizer.apply_chat_template(messages,{add_generation_prompt:true,return_dict:true});
    const inputIds=inputs?.input_ids;
    const dims=inputIds?.dims||[];
    const tokenCount=Number(dims[dims.length-1]||0);
    if(!inputIds||tokenCount<=256)return null;
    const targetEnd=tokenCount-1; // leave at least one token for generate() to consume
    let cache=null,start=0,chunkSize=256;
    try{
      while(start<targetEnd){
        if(signal?.aborted)throw new DOMException('Aborted','AbortError');
        const stop=Math.min(start+chunkSize,targetEnd);
        const started=performance.now?.()??Date.now();
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
        const elapsed=Math.max(1,(performance.now?.()??Date.now())-started);
        const rate=(stop-start)/elapsed;
        start=stop;
        chunkSize=Math.max(32,Math.min(1024,chunkSize*2,Math.round(rate*1500)));
        onProgress?.({processed:start,total:targetEnd,chunkSize});
      }
      if(signal?.aborted)throw new DOMException('Aborted','AbortError');
      return await model.generate({
        ...inputs,
        ...(cache?{past_key_values:cache,attention_mask:lib.ones(dims)}:{}),
        ...generationOptions,
        streamer
      });
    }finally{
      await cache?.dispose?.();
    }
  }
  class LocalModelManager{
    constructor(){this.libraryPromise=null;this.generator=null;this.model=null;this.loadedModelId='';this.loading=false;this.progress=0;this.statusText='';this.device='';this.dtype='';this.stopper=null;this.listeners=new Set();}
    subscribe(fn){if(typeof fn!=='function')return ()=>{};this.listeners.add(fn);fn(this.status());return ()=>this.listeners.delete(fn);}
    status(){return {loading:this.loading,loadedModelId:this.loadedModelId,loaded:!!this.generator,progress:this.progress,text:this.statusText,device:this.device,dtype:this.dtype};}
    emit(patch){Object.assign(this,patch||{});const state=this.status();for(const fn of this.listeners){try{fn(state);}catch(e){console.warn('Local AI status listener failed:',e);}}}
    isLoaded(id){return !!this.generator&&(!id||this.loadedModelId===String(id));}
    async library(){if(!this.libraryPromise)this.libraryPromise=import(root.LOCAL_MODEL_LIBRARY_URL||'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1');return this.libraryPromise;}
    async unload(notify=true){const old=this.generator;this.generator=null;this.model=null;this.loadedModelId='';this.stopper=null;if(old&&old.dispose){try{await old.dispose();}catch(e){console.warn('Local AI model disposal failed:',e);}}if(notify)this.emit({loading:false,progress:0,statusText:'Model unloaded.'});}
    async load(model,options={}){
      if(!model||model.protocol!=='local-transformers')throw new Error('Not a local browser model.');
      if(this.loading)throw new Error('A local model is already loading.');
      if(this.isLoaded(model.id)){this.emit({loading:false,progress:100,statusText:model.model+' ready.'});return model;}
      const requestedDevice=options.device==='wasm'?'wasm':options.device==='webgpu'?'webgpu':(navigator.gpu?'webgpu':'wasm');
      this.loading=true;this.progress=0;this.device=requestedDevice;this.dtype=(this.device==='webgpu'?'q4f16':'q4');
      this.statusText='Loading '+model.model+'…';this.emit({loading:true,progress:0,statusText:this.statusText});
      try{
        const lib=await this.library();
        if(lib.env){lib.env.useBrowserCache=true;lib.env.allowRemoteModels=true;lib.env.allowLocalModels=false;}
        await this.unload(false);this.loading=true;this.device=requestedDevice;this.dtype=(this.device==='webgpu'?'q4f16':'q4');
        this.emit({loading:true,progress:0,statusText:this.device.toUpperCase()+' · loading '+model.model+'…'});
        const progress=info=>{
          let p=Number(info&&info.progress);if(!Number.isFinite(p))p=null;if(info&&info.status==='ready')p=100;
          if(p!=null)this.progress=Math.max(0,Math.min(100,p));
          const file=String((info&&((info.file||info.name)))||'').trim();
          const suffix=file?' · '+file.split('/').pop():'';
          this.statusText=this.device.toUpperCase()+' · loading '+model.model+suffix+(p!=null?' · '+p.toFixed(1)+'%':'');
          this.emit({loading:true});
        };
        this.generator=await lib.pipeline('text-generation',model.model,{device:this.device,dtype:this.dtype,progress_callback:progress});
        this.model=model;this.loadedModelId=model.id;this.loading=false;this.progress=100;this.statusText=this.device.toUpperCase()+' · '+model.model+' ready';this.emit({loading:false,progress:100,statusText:this.statusText});return model;
      }catch(e){this.generator=null;this.loadedModelId='';this.loading=false;this.emit({loading:false,progress:0,statusText:'Model load failed: '+(e&&e.message||String(e))});throw e;}
    }
    cancel(){try{if(this.stopper&&this.stopper.interrupt)this.stopper.interrupt();}catch(_){}}
    requireGenerator(){if(!this.generator)throw new Error('No local AI model is loaded. Open AI Settings and load a local model.');return this.generator;}
    async generate(messages,options,onText){
      options=options||{};
      const signal=options.signal,model=this.model;
      if(signal&&signal.aborted)throw new DOMException('Aborted','AbortError');
      let generated='';
      const run=async()=>{
        generated='';
        const generator=this.requireGenerator();
        const lib=await this.library();const Stopper=lib.InterruptableStoppingCriteria;const stopper=Stopper?new Stopper():null;this.stopper=stopper;
        const streamer=new lib.TextStreamer(generator.tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:piece=>{generated+=String(piece||'');if(onText)onText(generated,String(piece||''));}});
        try{
          const generationOptions={max_new_tokens:Math.max(64,Math.min(4096,Number(options.maxTokens)||1024)),do_sample:true,temperature:options.temperature!=null?options.temperature:.7,top_p:options.topP!=null?options.topP:.9,...(stopper?{stopping_criteria:[stopper]}:{})};
          let result=null;
          if(this.device==='webgpu'){
            result=await generateWebGPUChunked(generator,lib,messages,generationOptions,streamer,signal,progress=>{
              this.emit({statusText:'WEBGPU · preparing prompt '+progress.processed+'/'+progress.total+' tokens'});
            });
          }
          if(result===null)result=await generator(messages,{...generationOptions,streamer});
          if(signal&&signal.aborted)throw new DOMException('Aborted','AbortError');
          return generatedText(result,generated)||generated;
        }finally{if(this.stopper===stopper)this.stopper=null;}
      };
      const abort=()=>this.cancel();if(signal&&signal.addEventListener)signal.addEventListener('abort',abort,{once:true});
      try{
        try{return await run();}
        catch(error){
          // ORT's WebGPU buffer-download failure means the GPU inference context
          // is no longer usable. If prefill failed before emitting any text, retry
          // this exact request on WASM rather than making the user restart Agent.
          const canFallback=this.device==='webgpu'&&!!model&&!generated&&isWebGPUBufferFailure(error)&&!(signal&&signal.aborted);
          if(!canFallback)throw error;
          this.emit({loading:true,statusText:'WebGPU inference failed. Retrying this request on CPU (WASM)…'});
          try{await this.unload(false);await this.load(model,{device:'wasm'});}
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