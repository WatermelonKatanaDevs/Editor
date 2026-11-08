(function () {
  const THREE_VERSION = '0.180.0';
  const CDN = 'https://cdn.jsdelivr.net/npm/three@' + THREE_VERSION;
  const EXTENSIONS = /\.(?:gltf|glb|fbx|obj|stl|ply|dae|3ds|3mf|amf|wrl|vrml|usdz|vtk|pcd|xyz|gcode|md2|bvh)$/i;
  const MIME = {
    gltf:'model/gltf+json',glb:'model/gltf-binary',fbx:'application/octet-stream',obj:'text/plain',
    mtl:'text/plain',stl:'model/stl',ply:'application/octet-stream',dae:'model/vnd.collada+xml',
    '3ds':'application/octet-stream','3mf':'model/3mf',amf:'application/x-amf',wrl:'model/vrml',
    vrml:'model/vrml',usdz:'model/vnd.usdz+zip',vtk:'application/octet-stream',pcd:'application/octet-stream',
    xyz:'text/plain',gcode:'text/plain',md2:'application/octet-stream',bvh:'text/plain'
  };
  const element = (tag, cls, value) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (value != null) n.textContent = value;
    return n;
  };
  const bytesOf = value => {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (Array.isArray(value)) return Uint8Array.from(value);
    if (typeof value === 'string') return new TextEncoder().encode(value);
    throw new Error('Unable to read model bytes.');
  };
  const pathJoin = (a,b) => {
    const out=[];
    for (const part of (String(a||'')+'/'+String(b||'')).replace(/\\/g,'/').split('/')) {
      if (!part || part==='.') continue;
      if (part==='..') out.pop(); else out.push(part);
    }
    return out.join('/');
  };
  function installImportMap() {
    if (window.__editorThreeImportMap) return;
    if (document.querySelector('script[type="importmap"]')) {
      window.__editorThreeImportMap = true;
      return;
    }
    const map = document.createElement('script');
    map.type = 'importmap';
    map.textContent = JSON.stringify({imports:{
      'three':CDN+'/build/three.module.js',
      'three/addons/':CDN+'/examples/jsm/'
    }});
    document.head.appendChild(map);
    window.__editorThreeImportMap = true;
  }
  let modulesPromise;
  async function loadModules() {
    if (!modulesPromise) modulesPromise = (async()=>{
      installImportMap();
      const THREE = await import(CDN+'/build/three.module.js');
      const [controls,gltf,obj,mtl,fbx,stl,ply,collada,tds,threeMF,amf,vrml,usdz,vtk,pcd,xyz,gcode,md2,bvh] = await Promise.all([
        import(CDN+'/examples/jsm/controls/OrbitControls.js'),
        import(CDN+'/examples/jsm/loaders/GLTFLoader.js'),
        import(CDN+'/examples/jsm/loaders/OBJLoader.js'),
        import(CDN+'/examples/jsm/loaders/MTLLoader.js'),
        import(CDN+'/examples/jsm/loaders/FBXLoader.js'),
        import(CDN+'/examples/jsm/loaders/STLLoader.js'),
        import(CDN+'/examples/jsm/loaders/PLYLoader.js'),
        import(CDN+'/examples/jsm/loaders/ColladaLoader.js'),
        import(CDN+'/examples/jsm/loaders/TDSLoader.js'),
        import(CDN+'/examples/jsm/loaders/3MFLoader.js'),
        import(CDN+'/examples/jsm/loaders/AMFLoader.js'),
        import(CDN+'/examples/jsm/loaders/VRMLLoader.js'),
        import(CDN+'/examples/jsm/loaders/USDZLoader.js'),
        import(CDN+'/examples/jsm/loaders/VTKLoader.js'),
        import(CDN+'/examples/jsm/loaders/PCDLoader.js'),
        import(CDN+'/examples/jsm/loaders/XYZLoader.js'),
        import(CDN+'/examples/jsm/loaders/GCodeLoader.js'),
        import(CDN+'/examples/jsm/loaders/MD2Loader.js'),
        import(CDN+'/examples/jsm/loaders/BVHLoader.js')
      ]);
      return {THREE,OrbitControls:controls.OrbitControls,GLTFLoader:gltf.GLTFLoader,OBJLoader:obj.OBJLoader,MTLLoader:mtl.MTLLoader,FBXLoader:fbx.FBXLoader,STLLoader:stl.STLLoader,PLYLoader:ply.PLYLoader,ColladaLoader:collada.ColladaLoader,TDSLoader:tds.TDSLoader,ThreeMFLoader:threeMF.ThreeMFLoader,AMFLoader:amf.AMFLoader,VRMLLoader:vrml.VRMLLoader,USDZLoader:usdz.USDZLoader,VTKLoader:vtk.VTKLoader,PCDLoader:pcd.PCDLoader,XYZLoader:xyz.XYZLoader,GCodeLoader:gcode.GCodeLoader,MD2Loader:md2.MD2Loader,BVHLoader:bvh.BVHLoader};
    })();
    return modulesPromise;
  }
  function makeUI(ctx) {
    const root=element('section','editor-3d-viewer');
    const toolbar=element('div','editor-3d-toolbar');
    const stage=element('div','editor-3d-stage');
    const canvasHost=element('div','editor-3d-canvas-host');
    const canvas=element('canvas','editor-3d-canvas');
    const drop=element('div','editor-3d-drop','Drop a model, texture, material, or ZIP archive here');
    const overlay=element('div','editor-3d-loading','Loading 3D engine…');
    const side=element('aside','editor-3d-sidebar');
    const footer=element('div','editor-3d-footer');
    const fileInput=element('input'); fileInput.type='file';fileInput.multiple=true;fileInput.accept='.gltf,.glb,.fbx,.obj,.mtl,.stl,.ply,.dae,.3ds,.3mf,.amf,.wrl,.vrml,.usdz,.vtk,.pcd,.xyz,.gcode,.md2,.bvh,.png,.jpg,.jpeg,.webp,.ktx2,.hdr,.exr,.zip';
    fileInput.hidden=true;
    const addBtn=element('button','', 'Add files');
    const fitBtn=element('button','','Frame model');
    const resetBtn=element('button','','Reset view');
    const gridBtn=element('button','','Grid');
    const axesBtn=element('button','','Axes');
    const wireBtn=element('button','','Wireframe');
    const bgBtn=element('button','','Background');
    const legacyHint=element('span','editor-3d-engine','Three.js · WebGL');
    toolbar.append(addBtn,fitBtn,resetBtn,gridBtn,axesBtn,wireBtn,bgBtn,legacyHint);
    canvasHost.append(canvas,drop,overlay);
    stage.appendChild(canvasHost);
    root.append(toolbar,stage,side,footer,fileInput);
    ctx.host.appendChild(root);
    return {root,toolbar,stage,canvasHost,canvas,drop,overlay,side,footer,fileInput,addBtn,fitBtn,resetBtn,gridBtn,axesBtn,wireBtn,bgBtn};
  }
  async function createViewer(ctx) {
    const ui=makeUI(ctx), {canvas,overlay,side,footer,fileInput}=ui;
    let THREE,renderer,scene,camera,controls,modelRoot=null,mixer=null,clock=null,raf=0,resizeObserver=null;
    let grid=null,axes=null,skeletonHelper=null,wireframe=false,showGrid=true,showAxes=false,background=0x202124;
    let animationActions=[],activeAction=null,animationSelect=null,playButton=null,timeSlider=null,timeLabel=null;
    let disposed=false,modelFiles=new Map(),objectURLs=new Map(),selectedRoot=null,modelInfo=null,activeModelPath=ctx.file.path;
    const cleanup=()=>{
      disposed=true;cancelAnimationFrame(raf);resizeObserver?.disconnect();controls?.dispose();renderer?.dispose();
      for(const url of objectURLs.values())URL.revokeObjectURL(url);
      objectURLs.clear();
      if(renderer?.domElement?.parentNode)renderer.domElement.remove();
    };
    ctx.addCleanup(cleanup);
    function status(message){ui.footer.textContent=message;}
    function disposeObject(obj){
      if(!obj)return;
      obj.traverse?.(o=>{o.geometry?.dispose?.();if(o.material){for(const v of Array.isArray(o.material)?o.material:[o.material]){for(const k of Object.keys(v))if(v[k]?.isTexture)v[k].dispose();v.dispose?.();}}});
    }
    function clearModel(){
      if(modelRoot){scene.remove(modelRoot);disposeObject(modelRoot);modelRoot=null;}
      if(skeletonHelper){scene.remove(skeletonHelper);skeletonHelper=null;}
      mixer=null;animationActions=[];activeAction=null;modelInfo=null;selectedRoot=null;
    }
    function addResource(name,data,mime){
      const key=String(name).replace(/\\/g,'/').replace(/^\/+/,'');
      if(objectURLs.has(key)){URL.revokeObjectURL(objectURLs.get(key));objectURLs.delete(key);}
      const url=URL.createObjectURL(new Blob([data],{type:mime||MIME[key.split('.').pop().toLowerCase()]||'application/octet-stream'}));
      modelFiles.set(key,{data,mime:mime||''});
      objectURLs.set(key,url);
    }
    function resourceURL(requested){
      let raw=String(requested||'').split(/[?#]/)[0];
      try{raw=decodeURIComponent(raw);}catch(_){}
      const clean=pathJoin('',raw);
      const candidates=[clean,pathJoin(activeModelPath.split('/').slice(0,-1).join('/'),clean),pathJoin(ctx.file.path.split('/').slice(0,-1).join('/'),clean),...([...modelFiles.keys()].filter(k=>k.endsWith('/'+clean)||k.split('/').pop()===clean))];
      for(const c of candidates)if(objectURLs.has(c))return objectURLs.get(c);
      const name=clean.split('/').pop();
      for(const [k,v] of modelFiles)if(k.split('/').pop()===name)return objectURLs.get(k);
      return requested;
    }
    function setupManager(){
      const manager=new THREE.LoadingManager();
      manager.setURLModifier(url=>{
        if(/^data:|^blob:|^https?:/i.test(url))return url;
        return resourceURL(url);
      });
      return manager;
    }
    function fitObject(obj){
      const box=new THREE.Box3().setFromObject(obj);
      if(box.isEmpty())return;
      const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
      const max=Math.max(size.x,size.y,size.z)||1;
      controls.target.copy(center);
      const fov=camera.fov*Math.PI/180;
      const distance=(max/2)/Math.tan(fov/2)*1.65;
      camera.position.copy(center).add(new THREE.Vector3(distance*.85,distance*.62,distance));
      camera.near=Math.max(max/10000,.001);camera.far=Math.max(max*100,1000);camera.updateProjectionMatrix();
      controls.minDistance=max/1000;controls.maxDistance=max*100;
      controls.update();
    }
    function statsFor(obj){
      let meshes=0,vertices=0,triangles=0,materials=new Set(),textures=new Set(),bones=0,skinned=0;
      obj.traverse(o=>{
        if(o.isMesh||o.isPoints||o.isLine){meshes++;const g=o.geometry;if(g){const p=g.getAttribute('position');vertices+=p?.count||0;triangles+=g.index?g.index.count/3:(p?.count||0)/3;}for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){materials.add(m);for(const k of Object.keys(m))if(m[k]?.isTexture)textures.add(m[k]);}}
        if(o.isBone)bones++;if(o.isSkinnedMesh)skinned++;
      });
      return {meshes,vertices:Math.round(vertices),triangles:Math.round(triangles),materials:materials.size,textures:textures.size,bones,skinned};
    }
    function renderInspector(obj,animations){
      side.replaceChildren();
      const tabs=element('div','editor-3d-side-tabs');
      const sceneTab=element('button','active','Scene');const animTab=element('button','','Animation');const materialTab=element('button','','Materials');
      tabs.append(sceneTab,animTab,materialTab);
      const content=element('div','editor-3d-side-content');
      side.append(tabs,content);
      const switchTab=which=>{
        [sceneTab,animTab,materialTab].forEach((b,i)=>b.classList.toggle('active',i===which));
        content.replaceChildren();
        if(which===0){
          const s=statsFor(obj);
          const stats=element('div','editor-3d-stats');
          for(const [k,v] of Object.entries({Meshes:s.meshes,Vertices:s.vertices.toLocaleString(),Triangles:s.triangles.toLocaleString(),Materials:s.materials,Textures:s.textures,'Skinned meshes':s.skinned,Bones:s.bones,Animations:animations.length}))stats.append(element('div','',k+': '+v));
          const tree=element('div','editor-3d-object-tree');
          const addNode=(node,parent,depth=0)=>{
            const line=element('button','editor-3d-tree-node',((node.isMesh?'◈ ':node.isBone?'♧ ':'▸ ')+(node.name||node.type)));
            line.style.paddingLeft=(8+depth*12)+'px';line.title=node.type+' · '+node.name;
            line.addEventListener('click',()=>{selectedRoot=node;node.updateWorldMatrix(true,false);const p=new THREE.Vector3();node.getWorldPosition(p);controls.target.copy(p);controls.update();});
            parent.appendChild(line);
            for(const child of node.children||[])addNode(child,parent,depth+1);
          };
          addNode(obj,tree);content.append(stats,element('h4','','Scene hierarchy'),tree);
        }else if(which===1){
          if(!animations.length){content.append(element('p','editor-3d-empty','This model has no embedded animation clips.'));return;}
          const label=element('label','','Animation clip');
          animationSelect=element('select','editor-3d-select');
          animations.forEach((clip,i)=>{const option=element('option','',clip.name||('Animation '+(i+1)));option.value=String(i);animationSelect.appendChild(option);});
          playButton=element('button','','▶ Play');
          const loop=element('select','editor-3d-select');
          [['repeat','Loop'],['once','Play once'],['pingpong','Ping-pong']].forEach(([v,l])=>{const o=element('option','',l);o.value=v;loop.appendChild(o);});
          const row=element('div','editor-3d-control-row');row.append(playButton,loop);
          const seek=element('input');seek.type='range';seek.min='0';seek.max='1';seek.step='.001';seek.value='0';seek.className='editor-3d-range';timeSlider=seek;
          timeLabel=element('span','editor-3d-time','0.00s');
          const seekRow=element('div','editor-3d-control-row');seekRow.append(seek,timeLabel);
          const speed=element('input');speed.type='range';speed.min='.1';speed.max='3';speed.step='.1';speed.value='1';speed.className='editor-3d-range';
          const speedLabel=element('span','','Speed 1×');
          speed.addEventListener('input',()=>{if(mixer)mixer.timeScale=+speed.value;speedLabel.textContent='Speed '+speed.value+'×';});
          animationSelect.addEventListener('change',()=>playClip(+animationSelect.value,loop.value));
          loop.addEventListener('change',()=>playClip(+animationSelect.value,loop.value));
          playButton.addEventListener('click',()=>{if(!activeAction)return;if(activeAction.paused){activeAction.paused=false;activeAction.play();playButton.textContent='Ⅱ Pause';}else{activeAction.paused=true;playButton.textContent='▶ Play';}});
          seek.addEventListener('input',()=>{if(mixer&&activeAction){const clip=animations[+animationSelect.value];activeAction.time=+seek.value*clip.duration;mixer.update(0);timeLabel.textContent=activeAction.time.toFixed(2)+'s';}});
          content.append(label,animationSelect,row,element('label','','Timeline'),seekRow,element('label','','Playback speed'),speed,speedLabel);
          playClip(0,loop.value);
        }else{
          const mats=new Map();
          obj.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)mats.set(m.uuid,m);});
          if(!mats.size){content.append(element('p','editor-3d-empty','No materials found.'));return;}
          for(const m of mats.values()){
            const card=element('div','editor-3d-material');
            card.append(element('strong','',m.name||'Material'),element('small','',m.type));
            const color=element('input');color.type='color';color.value='#'+(m.color?.getHexString?.()||'ffffff');
            color.addEventListener('input',()=>{if(m.color)m.color.set(color.value);});
            const row=element('label','','Base color');row.appendChild(color);card.appendChild(row);
            const rough=element('input');rough.type='range';rough.min='0';rough.max='1';rough.step='.01';rough.value=String(m.roughness??.7);
            rough.addEventListener('input',()=>{if('roughness'in m)m.roughness=+rough.value;});
            const rr=element('label','','Roughness');rr.appendChild(rough);card.appendChild(rr);
            const metal=element('input');metal.type='range';metal.min='0';metal.max='1';metal.step='.01';metal.value=String(m.metalness??0);
            metal.addEventListener('input',()=>{if('metalness'in m)m.metalness=+metal.value;});
            const mr=element('label','','Metalness');mr.appendChild(metal);card.appendChild(mr);
            content.appendChild(card);
          }
        }
      };
      sceneTab.addEventListener('click',()=>switchTab(0));animTab.addEventListener('click',()=>switchTab(1));materialTab.addEventListener('click',()=>switchTab(2));switchTab(0);
    }
    function playClip(index,mode){
      if(!mixer||!modelInfo?.animations?.[index])return;
      if(activeAction)activeAction.stop();
      const clip=modelInfo.animations[index];activeAction=mixer.clipAction(clip);
      activeAction.reset();activeAction.clampWhenFinished=mode==='once';
      activeAction.setLoop(mode==='once'?THREE.LoopOnce:mode==='pingpong'?THREE.LoopPingPong:THREE.LoopRepeat,mode==='once'?1:Infinity);
      activeAction.play();if(playButton)playButton.textContent='Ⅱ Pause';
      if(timeSlider){timeSlider.value='0';timeSlider.max='1';}
    }
    function addPrimitiveGeometry(geometry,name,material){
      const mesh=new THREE.Mesh(geometry,material||new THREE.MeshStandardMaterial({color:0xb9c7d8,metalness:.1,roughness:.72}));
      mesh.name=name||'Model';return mesh;
    }
    async function parseModel(name,data,opts={}){
      const ext=name.split('.').pop().toLowerCase(), manager=setupManager(), bytes=bytesOf(data);
      const text=()=>new TextDecoder().decode(bytes);
      let object=null,animations=[];
      const url=objectURLs.get(name);
      if(ext==='gltf'||ext==='glb'){
        const loader=new THREE.GLTFLoader(manager);
        const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),url?url.substring(0,url.lastIndexOf('/')+1):'');
        object=gltf.scene||gltf.scenes?.[0];animations=gltf.animations||[];
      }else if(ext==='fbx'){const result=new THREE.FBXLoader(manager).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength), '');object=result;animations=result.animations||[];}
      else if(ext==='obj'){
        const mtlEntry=[...modelFiles.entries()].find(([k])=>k.toLowerCase()===name.replace(/\.obj$/i,'.mtl').toLowerCase()||k.split('/').pop().toLowerCase()===name.split('/').pop().replace(/\.obj$/i,'.mtl').toLowerCase());
        const loader=new THREE.OBJLoader(manager);
        if(mtlEntry){const creator=new THREE.MTLLoader(manager).parse(new TextDecoder().decode(bytesOf(mtlEntry[1].data)),'');creator.preload();loader.setMaterials(creator);}
        object=loader.parse(text());
      }else if(ext==='stl'){const geometry=new THREE.STLLoader(manager).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));object=addPrimitiveGeometry(geometry,'STL model');}
      else if(ext==='ply'){const geometry=new THREE.PLYLoader(manager).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));geometry.computeVertexNormals();object=addPrimitiveGeometry(geometry,'PLY model');}
      else if(ext==='dae'){const result=new THREE.ColladaLoader(manager).parse(text(),'');object=result.scene;animations=result.animations||[];}
      else if(ext==='3ds'){object=new THREE.TDSLoader(manager).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
      else if(ext==='3mf'){object=new THREE.ThreeMFLoader(manager).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));}
      else if(ext==='amf'){object=new THREE.AMFLoader(manager).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));}
      else if(ext==='wrl'||ext==='vrml'){object=new THREE.VRMLLoader(manager).parse(text());}
      else if(ext==='usdz'){object=await new THREE.USDZLoader(manager).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));}
      else if(ext==='vtk'){const geometry=new THREE.VTKLoader(manager).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));geometry.computeVertexNormals();object=addPrimitiveGeometry(geometry,'VTK model');}
      else if(ext==='pcd'){object=new THREE.PCDLoader(manager).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
      else if(ext==='xyz'){const geometry=new THREE.XYZLoader(manager).parse(text());object=addPrimitiveGeometry(geometry,'Point cloud');}
      else if(ext==='gcode'){object=new THREE.GCodeLoader(manager).parse(text());}
      else if(ext==='md2'){const geometry=new THREE.MD2Loader(manager).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));object=addPrimitiveGeometry(geometry,'MD2 model',new THREE.MeshStandardMaterial({color:0xb9c7d8,morphTargets:true}));}
      else if(ext==='bvh'){const result=new THREE.BVHLoader().parse(text());object=new THREE.SkeletonHelper(result.skeleton.bones[0]);animations=result.clip?[result.clip]:[];}
      if(!object)throw new Error('No loader is available for .' + ext + ' files.');
      return {object,animations};
    }
    async function loadModel(name,data){
      activeModelPath=name;
      overlay.style.display='flex';overlay.textContent='Loading '+name+'…';
      try{
        clearModel();
        const result=await parseModel(name,data);
        modelRoot=result.object;modelInfo=result;scene.add(modelRoot);
        if(result.animations?.length){mixer=new THREE.AnimationMixer(modelRoot);}
        if(modelRoot.traverse)modelRoot.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){m.side=THREE.DoubleSide;m.needsUpdate=true;}}}});
        if(showAxes&&modelRoot){skeletonHelper=new THREE.SkeletonHelper(modelRoot);skeletonHelper.visible=false;scene.add(skeletonHelper);}
        fitObject(modelRoot);renderInspector(modelRoot,result.animations||[]);
        const s=statsFor(modelRoot);status(name+' · '+s.meshes+' meshes · '+s.vertices.toLocaleString()+' vertices · '+(result.animations?.length||0)+' animations');
        overlay.style.display='none';
      }catch(error){overlay.style.display='flex';overlay.textContent='Could not load '+name+': '+error.message;status('Load failed · '+error.message);throw error;}
    }
    async function loadZip(file){
      if(typeof JSZip!=='function')throw new Error('ZIP support is not available.');
      const zip=await JSZip.loadAsync(file);
      let count=0,primary=null;
      for(const [path,entry] of Object.entries(zip.files)){
        if(entry.dir)continue;
        const clean=pathJoin('',path);
        const ext=clean.split('.').pop().toLowerCase();
        if(!EXTENSIONS.test(clean)&&!/\.(?:png|jpe?g|webp|ktx2|hdr|exr|mtl|bin)$/i.test(clean))continue;
        const bytes=await entry.async('uint8array');
        addResource(clean,bytes,MIME[ext]||'application/octet-stream');count++;
        if(!primary&&EXTENSIONS.test(clean))primary=clean;
      }
      if(!primary)throw new Error('No supported 3D model was found in this ZIP.');
      await loadModel(primary,modelFiles.get(primary).data);
      status(primary+' · loaded '+count+' model/texture/archive resources');
    }
    async function addFiles(files){
      const list=[...files];if(!list.length)return;
      const zip=list.find(f=>/\.zip$/i.test(f.name));if(zip){await loadZip(zip);return;}
      let main=null;
      for(const f of list){
        const path=pathJoin(ctx.file.path.split('/').slice(0,-1).join('/'),f.webkitRelativePath||f.name);
        const data=new Uint8Array(await f.arrayBuffer());
        addResource(path,data,f.type);
        if(!main&&EXTENSIONS.test(f.name))main=path;
      }
      if(main)await loadModel(main,modelFiles.get(main).data);
      else if(modelRoot){status('Added '+list.length+' resource file(s). Reload the model to apply newly added textures.');}
      else status('Added resources. Select a model file to load it.');
    }
    async function importWorkspaceFiles(){
      const fs=ctx.state?.fs;if(!fs?.listFilesSync)return;
      const base=ctx.file.path.split('/').slice(0,-1).join('/');
      const paths=fs.listFilesSync().filter(p=>{
        const normalized=String(p).replace(/\\/g,'/');
        return normalized.startsWith(base?base+'/':'') && normalized.split('/').length<=base.split('/').length+3;
      }).slice(0,800);
      let total=0;
      for(const path of paths){
        const ext=path.split('.').pop().toLowerCase();
        if(!EXTENSIONS.test(path)&&!/\.(?:png|jpe?g|webp|ktx2|hdr|exr|mtl|bin)$/i.test(path))continue;
        try{const data=ctx.state.fs.readFileSync(path,'binary');if(data){addResource(path,bytesOf(data),MIME[ext]||'application/octet-stream');total+=data.length||data.byteLength||0;}}catch(_){}
        if(total>180*1024*1024)break;
      }
    }
    try{
      const mods=await loadModules();THREE={...mods.THREE,...mods};
      const width=Math.max(320,ui.canvasHost.clientWidth||800),height=Math.max(240,ui.canvasHost.clientHeight||520);
      renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
      renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(width,height,false);
      renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
      scene=new THREE.Scene();scene.background=new THREE.Color(background);
      camera=new THREE.PerspectiveCamera(45,width/height,.01,10000);camera.position.set(3,2,4);
      controls=new THREE.OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.075;controls.screenSpacePanning=true;
      controls.minDistance=.001;controls.maxDistance=100000;
      scene.add(new THREE.HemisphereLight(0xffffff,0x43404a,2.0));
      const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(5,8,6);key.castShadow=true;scene.add(key);
      const fill=new THREE.DirectionalLight(0x9bbcff,1.2);fill.position.set(-5,2,-4);scene.add(fill);
      grid=new THREE.GridHelper(20,20,0x777777,0x444444);grid.position.y=-.001;scene.add(grid);
      axes=new THREE.AxesHelper(2);axes.visible=showAxes;scene.add(axes);
      clock=new THREE.Clock();
      const resize=()=>{if(disposed)return;const w=Math.max(1,ui.canvasHost.clientWidth),h=Math.max(1,ui.canvasHost.clientHeight);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};
      resizeObserver=new ResizeObserver(resize);resizeObserver.observe(ui.canvasHost);resize();
      const animate=()=>{if(disposed)return;raf=requestAnimationFrame(animate);const delta=Math.min(clock.getDelta(),.05);if(mixer)mixer.update(delta);controls.update();renderer.render(scene,camera);if(timeSlider&&activeAction&&modelInfo?.animations?.length){const clip=modelInfo.animations[+animationSelect?.value||0];if(clip?.duration){timeSlider.value=String(Math.min(1,activeAction.time/clip.duration));if(timeLabel)timeLabel.textContent=activeAction.time.toFixed(2)+'s';}}};
      animate();
      await importWorkspaceFiles();
      const current=ctx.readBinary();addResource(ctx.file.path,bytesOf(current),ctx.file.mime||MIME[ctx.file.name.split('.').pop().toLowerCase()]);
      await loadModel(ctx.file.path,modelFiles.get(ctx.file.path).data);
      ui.addBtn.addEventListener('click',()=>fileInput.click());
      fileInput.addEventListener('change',()=>{addFiles(fileInput.files).catch(e=>{overlay.style.display='flex';overlay.textContent=e.message;});fileInput.value='';});
      ui.fitBtn.addEventListener('click',()=>modelRoot&&fitObject(modelRoot));
      ui.resetBtn.addEventListener('click',()=>{controls.reset();if(modelRoot)fitObject(modelRoot);});
      ui.gridBtn.addEventListener('click',()=>{showGrid=!showGrid;grid.visible=showGrid;ui.gridBtn.classList.toggle('active',showGrid);});
      ui.axesBtn.addEventListener('click',()=>{showAxes=!showAxes;axes.visible=showAxes;ui.axesBtn.classList.toggle('active',showAxes);});
      ui.wireBtn.addEventListener('click',()=>{wireframe=!wireframe;if(modelRoot)modelRoot.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.wireframe=wireframe;});ui.wireBtn.classList.toggle('active',wireframe);});
      ui.bgBtn.addEventListener('click',()=>{background=background===0x202124?0xeeeeee:background===0xeeeeee?0x090b10:0x202124;scene.background.setHex(background);});
      ui.drop.addEventListener('dragover',e=>{e.preventDefault();ui.drop.classList.add('dragover');});
      ui.drop.addEventListener('dragleave',()=>ui.drop.classList.remove('dragover'));
      ui.drop.addEventListener('drop',e=>{e.preventDefault();ui.drop.classList.remove('dragover');if(e.dataTransfer?.files?.length)addFiles(e.dataTransfer.files).catch(err=>{overlay.style.display='flex';overlay.textContent=err.message;});});
      canvas.addEventListener('dragover',e=>{if(e.dataTransfer?.files?.length)e.preventDefault();});
      canvas.addEventListener('drop',e=>{if(e.dataTransfer?.files?.length){e.preventDefault();addFiles(e.dataTransfer.files).catch(err=>status(err.message));}});
      const handleWorkspaceDrop=async e=>{
        const raw=e.dataTransfer?.getData('application/x-file-manager-paths');
        if(!raw)return;
        e.preventDefault();
        let paths=[];try{paths=JSON.parse(raw);}catch(_){paths=[raw];}
        let main=null;
        for(const path of paths){
          try{
            const data=ctx.state.fs.readFileSync(path,'binary');
            if(data==null)continue;
            addResource(path,bytesOf(data),MIME[String(path).split('.').pop().toLowerCase()]);
            if(!main&&EXTENSIONS.test(path))main=path;
          }catch(_){}
        }
        if(main)await loadModel(main,modelFiles.get(main).data);
        else status('Added '+paths.length+' workspace resource(s). Reload the model to apply new textures.');
      };
      ui.canvasHost.addEventListener('dragover',e=>{if(e.dataTransfer?.types?.includes('application/x-file-manager-paths')||e.dataTransfer?.files?.length)e.preventDefault();});
      ui.canvasHost.addEventListener('drop',e=>handleWorkspaceDrop(e).catch(err=>status(err.message)));
      ui.drop.style.display='none';overlay.style.display='none';
      status('Ready · drag a texture or model into the viewer to add it');
    }catch(error){
      overlay.style.display='flex';overlay.textContent='3D viewer initialization failed: '+error.message;
      status('Three.js could not initialize');
      console.error('[3D Viewer]',error);
    }
  }
  window.EditorPreviewProviders=window.EditorPreviewProviders||[];
  window.EditorPreviewProviders.push({
    id:'model-3d',
    match(file){return EXTENSIONS.test(String(file.name||file.path||''));},
    views:[
      {id:'model-3d-viewer',label:'3D Viewer',default:true,priority:180,create:createViewer}
    ]
  });
})();