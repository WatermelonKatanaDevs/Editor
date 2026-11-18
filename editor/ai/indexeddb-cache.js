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
      return (values||[]).filter(item=>item?.complete).sort((a,b)=>(b.cachedAt||0)-(a.cachedAt||0));
    }
    async deleteModel(id){
      const db=await this.open();
      const read=db.transaction([MODELS,FILES],'readonly'),readDone=transactionDone(read);
      const [allModels,allFiles]=await Promise.all([
        requestResult(read.objectStore(MODELS).getAll()),
        requestResult(read.objectStore(FILES).getAll())
      ]);
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
        this.persistencePromise=(async()=>{
          if(!navigator.storage)return {supported:false,persisted:false};
          let persisted=false;
          try{persisted=await navigator.storage.persisted?.()||false;}catch(_){}
          if(!persisted&&typeof navigator.storage.persist==='function'){
            try{persisted=await navigator.storage.persist();}catch(_){}
          }
          return {supported:typeof navigator.storage.persist==='function',persisted:!!persisted};
        })();
      }
      return this.persistencePromise;
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