(function() {
  const factories = window.EditorBuiltinFactories = window.EditorBuiltinFactories || {};
  const aiRoot = window.EditorAI = window.EditorAI || {};
  const CHAT_PREFIX = 'editor.aiChat.';
const makeEditorTools = (() => {
  const root = aiRoot;
  function normalize(path) {
    const out = [];
    for (const part of String(path || '').replace(/\\/g,'/').split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') { out.pop(); continue; }
      out.push(part);
    }
    return out.join('/');
  }
  function textFile(path) {
    const n = String(path).split('/').pop().toLowerCase();
    const ext = n.includes('.') ? n.slice(n.lastIndexOf('.') + 1) : '';
    return new Set(['js','mjs','cjs','ts','tsx','jsx','json','html','htm','css','md','txt','xml','svg','yaml','yml','py','java','c','h','cpp','hpp','cc','rs','go','wgsl','glsl','vert','frag','shader','toml','ini','env','sh','bat','ps1','vue','svelte']).has(ext) || !ext;
  }
  function quoteCommand(path) { return /[\s"']/.test(path) ? '"' + String(path).replace(/"/g,'\\"') + '"' : String(path); }
  function currentTab(state) {
    if (!state?.workbench) return null;
    for (const instance of Workbench.getInstances?.() || [state.workbench]) for (const g of instance.groups.values()) {
      const t = g.tabs.find(x => x.id === g.active);
      if (t) return t;
    }
    return null;
  }
  function fileDiff(oldText, newText) {
    oldText = String(oldText || ''); newText = String(newText || '');
    if (oldText === newText) return '';
    const oldLines = oldText.split(/\r?\n/), newLines = newText.split(/\r?\n/);
    let start = 0;
    while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start++;
    let oldEnd = oldLines.length - 1, newEnd = newLines.length - 1;
    while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) { oldEnd--; newEnd--; }
    const removed = oldLines.slice(start, oldEnd + 1).slice(0, 80).map(x => '- ' + x);
    const added = newLines.slice(start, newEnd + 1).slice(0, 80).map(x => '+ ' + x);
    return [...removed, ...added].join('\n');
  }
  function makeTools(options) {
    const {state, openFile, onRefresh, runConfigured, ensureNodeRuntime} = options;
    const tools = new Map();
    function add(def) { tools.set(def.name, def); }
    add({name:'exit_early', permission:'none', description:'Finish the task immediately and return the supplied message directly as the final answer. Use when all necessary tool work is complete and no further tool or model turn is needed. Put the complete answer or summary in message; do not leave the message empty.', parameters:{type:'object',properties:{message:{type:'string',description:'Optional final message to show the user.'}},additionalProperties:false}, execute:async args => ({exitEarly:true,message:String(args?.message||'')})});
    add({name:'list_files', permission:'readFiles', description:'List project files and optionally directories.', parameters:{type:'object',properties:{directories:{type:'boolean'}},additionalProperties:false}, execute:async args => ({files:state.fs?.listFilesSync?.() || [], directories:args.directories ? state.fs?.listDirectoriesSync?.() || [] : undefined})});
    add({name:'read_file', permission:'readFiles', description:'Read a UTF-8 text file from the project.', parameters:{type:'object',required:['path'],properties:{path:{type:'string'},startLine:{type:'integer',minimum:1},endLine:{type:'integer',minimum:1},maxChars:{type:'integer',minimum:1000,maximum:500000}},additionalProperties:false}, execute:async args => { const path=normalize(args.path); if(!state.fs?.existsSync(path)) throw new Error(`File not found: ${path}`); const value=state.fs.readFileSync(path,'utf8'); if (value == null) throw new Error(`Unable to read: ${path}`); let content=String(value); const hasRange=args.startLine!=null||args.endLine!=null; if(hasRange){ const lines=content.split(/\r?\n/); const start=Math.max(1,Number(args.startLine)||1); const end=Math.min(lines.length,Math.max(start,Number(args.endLine)||lines.length)); content=lines.slice(start-1,end).join('\n'); } const maxChars=Math.max(1000,Math.min(500000,Number(args.maxChars)||200000)); const truncated=content.length>maxChars; if(truncated)content=content.slice(0,maxChars); return {path,content,startLine:hasRange?Math.max(1,Number(args.startLine)||1):1,endLine:hasRange?Math.min(String(value).split(/\r?\n/).length,Math.max(1,Number(args.endLine)||String(value).split(/\r?\n/).length)):String(value).split(/\r?\n/).length,truncated,totalChars:String(value).length}; }});
    add({name:'search_project', permission:'searchFiles', description:'Search text files in the project, case-insensitive.', parameters:{type:'object',required:['query'],properties:{query:{type:'string'},path:{type:'string'},maxResults:{type:'number',minimum:1,maximum:500}} ,additionalProperties:false}, execute:async args => {
      const query=String(args.query||'').toLowerCase(); if(!query) return {results:[]}; const prefix=normalize(args.path||''); const limit=Math.max(1,Math.min(500,Number(args.maxResults)||100)); const results=[];
      for(const path of state.fs?.listFilesSync?.()||[]) { if(prefix && path!==prefix && !path.startsWith(prefix+'/')) continue; if(!textFile(path)) continue; let content=''; try{content=String(state.fs.readFileSync(path,'utf8')||'')}catch(_){continue;} const lines=content.split(/\r?\n/); for(let i=0;i<lines.length;i++){let from=0;const lower=lines[i].toLowerCase();while(from<lower.length){const col=lower.indexOf(query,from);if(col<0)break;results.push({path,line:i+1,column:col+1,text:lines[i]});if(results.length>=limit)return {results};from=col+Math.max(query.length,1);}}} return {results};
    }});
    add({name:'create_file', permission:'createFiles', description:'Create a new text file in the project.', parameters:{type:'object',required:['path','content'],properties:{path:{type:'string'},content:{type:'string'}},additionalProperties:false}, execute:async args => { const path=normalize(args.path); if(!path)throw new Error('Invalid file path.'); if(state.fs.existsSync(path))throw new Error(`File already exists: ${path}`); state.fs.writeFileSync(path,String(args.content??'')); state.markDirty?.(path); onRefresh?.(); return {path,created:true}; }});
    add({name:'write_file', permission:'modifyFiles', description:'Create a new text file or replace the contents of an existing file.', parameters:{type:'object',required:['path','content'],properties:{path:{type:'string'},content:{type:'string'}},additionalProperties:false}, execute:async args => { const path=normalize(args.path); if(!path)throw new Error('Invalid file path.'); const exists=!!state.fs.existsSync(path); const old=exists?String(state.fs.readFileSync(path,'utf8')||''):''; const content=String(args.content??''); state.fs.writeFileSync(path,content); state.markDirty?.(path); onRefresh?.(); return {path,created:!exists,changed:!exists||old!==content,diff:exists?fileDiff(old,content):null}; }});
    add({name:'delete_file', permission:'deleteFiles', description:'Delete a file or directory from the project.', parameters:{type:'object',required:['path'],properties:{path:{type:'string'},directory:{type:'boolean'}},additionalProperties:false}, execute:async args => { const path=normalize(args.path); if(!path)throw new Error('Cannot delete the project root.'); const isDir=!!args.directory || state.fs.isDirectorySync?.(path); const ok=isDir ? state.fs.deleteDirectorySync(path) : state.fs.deleteFileSync(path); if(!ok)throw new Error(`Nothing deleted at ${path}`); state.markDirty?.(path); onRefresh?.(); return {path,deleted:true,directory:isDir}; }});
    add({name:'move_file', permission:'modifyFiles', description:'Move or rename a file or directory without reading its contents into the agent.', parameters:{type:'object',required:['source','destination'],properties:{source:{type:'string',description:'Existing file or directory path.'},destination:{type:'string',description:'New file or directory path.'}},additionalProperties:false}, execute:async args => { const source=normalize(args.source); const destination=normalize(args.destination); if(!source)throw new Error('Source path is required.'); if(!destination)throw new Error('Destination path is required.'); if(source===destination)return {source,destination,moved:false}; if(!state.fs?.existsSync(source) && !state.fs?.isDirectorySync?.(source))throw new Error(`Path not found: ${source}`); const isDir=!!state.fs.isDirectorySync?.(source); state.fs.moveSync(source,destination); state.markDirty?.(source); state.markDirty?.(destination); state.fileManager?.onMove?.(source,destination,isDir); onRefresh?.(); return {source,destination,moved:true,directory:isDir}; }});    add({name:'copy_file', permission:'modifyFiles', description:'Copy a file or directory without reading its contents into the agent.', parameters:{type:'object',required:['source','destination'],properties:{source:{type:'string',description:'Existing file or directory path.'},destination:{type:'string',description:'New file or directory path.'}},additionalProperties:false}, execute:async args => { const source=normalize(args.source); const destination=normalize(args.destination); if(!source)throw new Error('Source path is required.'); if(!destination)throw new Error('Destination path is required.'); if(!state.fs?.existsSync(source) && !state.fs?.isDirectorySync?.(source))throw new Error(`Path not found: ${source}`); if(state.fs.existsSync(destination) || state.fs.isDirectorySync?.(destination))throw new Error(`Destination already exists: ${destination}`); if(source===destination)throw new Error('Source and destination are the same.'); if(destination.startsWith(source+'/'))throw new Error('Cannot copy a path into itself.'); const isDir=!!state.fs.isDirectorySync?.(source); const files=(isDir ? state.fs.listFilesSync().filter(path=>path===source||path.startsWith(source+'/')) : [source]); for(const path of files){ const target=destination+path.slice(source.length); state.fs.writeFileSync(target,state.fs.readFileSync(path,'binary')); } state.markDirty?.(destination); onRefresh?.(); return {source,destination,copied:true,directory:isDir,files:files.length}; }});
    add({name:'get_file_info', permission:'readFiles', description:'Get filesystem metadata without reading a file into the agent.', parameters:{type:'object',required:['path'],properties:{path:{type:'string'}},additionalProperties:false}, execute:async args => { const path=normalize(args.path); if(!path)throw new Error('Path is required.'); const isDir=!!state.fs?.isDirectorySync?.(path); if(!state.fs?.existsSync(path) && !isDir)throw new Error(`Path not found: ${path}`); if(isDir){ const prefix=path+'/'; const files=(state.fs.listFilesSync?.()||[]).filter(p=>p===path||p.startsWith(prefix)); const dirs=(state.fs.listDirectoriesSync?.()||[]).filter(p=>p===path||p.startsWith(prefix)); return {path,type:'directory',fileCount:files.length,directoryCount:dirs.length}; } const data=state.fs.readFileSync(path,'binary'); const bytes=data?.byteLength ?? data?.length ?? 0; return {path,type:'file',size:bytes,extension:(path.match(/\.([^.\/]+)$/)?.[1]||'').toLowerCase(),textFile:textFile(path)}; }});
    add({name:'find_files', permission:'searchFiles', description:'Find project files by glob-like path pattern without reading their contents.', parameters:{type:'object',properties:{pattern:{type:'string'},path:{type:'string'},extension:{type:'string'},maxResults:{type:'number',minimum:1,maximum:2000}},additionalProperties:false}, execute:async args => { const pattern=String(args.pattern||'').trim(); const prefix=normalize(args.path||''); const extension=String(args.extension||'').trim().toLowerCase(); const limit=Math.max(1,Math.min(2000,Number(args.maxResults)||500)); const files=state.fs?.listFilesSync?.()||[]; const globToRegex=g=>{let out='';for(let i=0;i<g.length;i++){const c=g[i];if(c==='*'){if(g[i+1]==='*'){out+='.*';i++;}else out+='[^/]*';}else if(c==='?')out+='[^/]';else out+=c.replace(/[\\^$+?.()|{}\[\]]/g,'\\$&');}return new RegExp('^'+out+'$','i');}; const re=pattern?globToRegex(pattern):null; const results=[]; for(const file of files){if(prefix&&file!==prefix&&!file.startsWith(prefix+'/'))continue;if(extension&&!file.toLowerCase().endsWith(extension.startsWith('.')?extension:'.'+extension))continue;if(re&&!re.test(file))continue;results.push(file);if(results.length>=limit)break;} return {pattern:pattern||null,results}; }});
    add({name:'replace_in_files', permission:'modifyFiles', description:'Replace text across selected project files without requiring the agent to rewrite whole files.', parameters:{type:'object',required:['search','replace'],properties:{search:{type:'string'},replace:{type:'string'},path:{type:'string'},regex:{type:'boolean'},caseSensitive:{type:'boolean'},maxFiles:{type:'number'},dryRun:{type:'boolean'}},additionalProperties:false}, execute:async args => { const search=String(args.search??''); if(!search)throw new Error('Search text is required.'); const replacement=String(args.replace??''); const prefix=normalize(args.path||''); const maxFiles=Math.max(1,Math.min(500,Number(args.maxFiles)||100)); let matcher; try { matcher=args.regex ? new RegExp(search,args.caseSensitive?'g':'gi') : new RegExp(search.replace(/[\\^$.*+?()[\]{}|]/g,'\\$&'),args.caseSensitive?'g':'gi'); } catch(e){throw new Error(`Invalid search pattern: ${e.message}`);} const changes=[]; for(const path of state.fs?.listFilesSync?.()||[]){if(changes.length>=maxFiles)break;if(prefix&&path!==prefix&&!path.startsWith(prefix+'/'))continue;if(!textFile(path))continue;let old='';try{old=String(state.fs.readFileSync(path,'utf8')||'')}catch(_){continue;} matcher.lastIndex=0;const matches=old.match(matcher);if(!matches?.length)continue;const next=old.replace(matcher,replacement);changes.push({path,count:matches.length,changed:old!==next});if(!args.dryRun&&old!==next){state.fs.writeFileSync(path,next);state.markDirty?.(path);}} if(!args.dryRun)onRefresh?.(); return {changed:changes.filter(x=>x.changed).length,files:changes,dryRun:!!args.dryRun}; }});


    add({name:'get_active_file', permission:'readEditor', description:'Get the active editor file, cursor, and selection.', parameters:{type:'object',properties:{includeContent:{type:'boolean'}},additionalProperties:false}, execute:async args => { const t=currentTab(state); if(!t || t.kind!=='file')return {path:null}; const model=t.editor?.getModel?.(); const selection=t.editor?.getSelection?.(); const result={path:t.path,view:t.view||null}; if(t.editor?.getPosition)result.cursor=t.editor.getPosition(); if(selection && model)result.selection=model.getValueInRange(selection); if(args.includeContent)result.content=String(t.editor?.getValue?.()||state.fs.readFileSync(t.path,'utf8')||''); return result; }});
    add({name:'open_file', permission:'readEditor', description:'Open a file in the editor.', parameters:{type:'object',required:['path'],properties:{path:{type:'string'}}}, execute:async args => { const path=normalize(args.path); if(!state.fs?.existsSync(path))throw new Error(`File not found: ${path}`); openFile?.(path); return {opened:path}; }});
    add({name:'insert_code', permission:'modifyEditor', description:'Insert code at the current editor selection or cursor.', parameters:{type:'object',required:['code'],properties:{code:{type:'string'}}}, execute:async args => { const t=currentTab(state); if(!t?.editor)throw new Error('There is no active text editor.'); const editor=t.editor; const model=editor.getModel?.(); if(!model)throw new Error('The active editor has no model.'); const selection=editor.getSelection?.(); const range=selection || {startLineNumber:1,startColumn:1,endLineNumber:1,endColumn:1}; editor.executeEdits('ai',[{range,text:String(args.code),forceMoveMarkers:true}]); state.markDirty?.(t.path); state.updateStatus?.(); return {path:t.path,inserted:true}; }});
    add({name:'run_command', permission:'runCommands', description:"Run a short-lived command in the editor's virtual Node runtime, not a real OS shell. Do not include the terminal prompt character ($). Supported commands are pwd, cd, cat, echo, printf, true, false, whoami, hostname, env, which, ls/dir, node, and npm. Do not use this tool to start a long-running server or watcher such as 'node server.js', 'npm start', 'npm run start', or 'npm run dev'; use run_project for the configured project instead. Shell features such as pipes and redirection are not supported; use the project/editor tools for filesystem operations instead.", parameters:{type:'object',required:['command'],properties:{command:{type:'string',description:'Command only, without a leading shell prompt such as $. Supported commands: pwd, cd, cat, echo, printf, true, false, whoami, hostname, env, which, ls/dir, node, npm.'}}}, execute:async args => {
      const runner=await ensureNodeRuntime?.();
      if(!runner)throw new Error('Node runtime is unavailable for this project.');
      attachOutput(runner);
      const command=String(args.command||'').trim();
      if(!command)throw new Error('Command is empty.');
      const longRunning=/^(?:(?:npm|npx)\s+(?:run\s+)?(?:start|dev|serve|watch)\b|node(?:js)?\s+.+)$/i.test(command);
      if(longRunning) throw new Error('This command appears to start a long-running process. Use run_project to run the configured application instead of run_command.');
      const start=outputBuffer.length;
      const result=await runner.terminalCommand(command);
      return {command,result,output:outputBuffer.slice(start)};
    }});
    add({name:'run_script', permission:'runScripts', description:'Run a project JavaScript file with the virtual Node runtime.', parameters:{type:'object',required:['path'],properties:{path:{type:'string'}}}, execute:async args => { const runner=await ensureNodeRuntime?.(); if(!runner)throw new Error('Node runtime is unavailable for this project.'); attachOutput(runner); const path=normalize(args.path); if(!state.fs?.existsSync(path))throw new Error(`File not found: ${path}`); const start=outputBuffer.length; const result=await runner.terminalCommand('node '+quoteCommand(path)); return {path,result,output:outputBuffer.slice(start)}; }});
    add({name:'run_project', permission:'runProject', description:'Run the configured project and open its browser preview.', parameters:{type:'object',properties:{},additionalProperties:false}, execute:async () => { await runConfigured?.(); return {running:true}; }});
    const outputBuffer = [];
    let attachedRunner = null;
    let onConsole = null;
    let onError = null;
    function attachOutput(runner) {
      if(attachedRunner===runner)return;
      if(attachedRunner){attachedRunner.removeEventListener?.('console',onConsole);attachedRunner.removeEventListener?.('error',onError);}
      attachedRunner=runner; if(!runner)return;
      onConsole=(method,args)=>{outputBuffer.push({type:method,args:Array.isArray(args)?args:[]});if(outputBuffer.length>250)outputBuffer.splice(0,outputBuffer.length-250);};
      onError=(error,source)=>{outputBuffer.push({type:'error',args:[error?.message||String(error),source||'']});if(outputBuffer.length>250)outputBuffer.splice(0,outputBuffer.length-250);};
      runner.addEventListener?.('console',onConsole);runner.addEventListener?.('error',onError);
    }
    add({name:'get_runtime_output', permission:'readOutput', description:'Read recent output/errors from the Node runtime.', parameters:{type:'object',properties:{clear:{type:'boolean'}},additionalProperties:false}, execute:async args => { const runner=state.nodeEmulator; if(runner)attachOutput(runner); const result=outputBuffer.slice(-100); if(args.clear)outputBuffer.length=0; return {running:!!runner,output:result}; }});
    add({name:'get_browser_state', permission:'browser', description:'Inspect the editor browser preview.', parameters:{type:'object',properties:{},additionalProperties:false}, execute:async () => { const info=state.browserFrame; if(!info)return {available:false}; let url='';let title='';try{url=info.contentWindow?.getStartupUrl?.()||info.contentWindow?.location?.href||''}catch(_){} try{title=info.contentWindow?.document?.title||''}catch(_){} return {available:true,url,title}; }});
    function getBrowserFrame() {
      let active = null;
      try { active = currentTab(state); } catch (_) {}
      if (active?.kind === 'builtin' && active.builtin === 'browser') {
        const info = state.browserTabs?.get(active.id);
        if (info?.frame?.contentWindow) return info.frame;
      }
      if (state.browserFrame?.contentWindow) return state.browserFrame;
      for (const info of state.browserTabs?.values?.() || []) if (info?.frame?.contentWindow) return info.frame;
      return null;
    }
    function getBrowserWindow() {
      const frame = getBrowserFrame();
      return frame?.contentWindow || null;
    }
    add({name:'get_browser_tabs', permission:'browser', description:'List tabs in the active editor Browser, including the active tab.', parameters:{type:'object',properties:{},additionalProperties:false}, execute:async () => { const win=getBrowserWindow(); if(!win)return {available:false,tabs:[]}; return {available:true,tabs:win.getAIBrowserTabs?.()||[]}; }});
    add({name:'open_browser_tab', permission:'browser', description:'Open a new tab in the editor Browser.', parameters:{type:'object',required:['url'],properties:{url:{type:'string'},activate:{type:'boolean'}},additionalProperties:false}, execute:async args => { const win=getBrowserWindow(); if(!win?.openAIBrowserTab)throw new Error('Browser tab controls are unavailable.'); const id=win.openAIBrowserTab(String(args.url||''),args.activate!==false); if(!id)throw new Error('Browser tab could not be opened.'); return {opened:true,id}; }});
    add({name:'switch_browser_tab', permission:'browser', description:'Switch the active tab in the editor Browser.', parameters:{type:'object',required:['tabId'],properties:{tabId:{type:'string'}}}, execute:async args => { const win=getBrowserWindow(); if(!win?.switchAIBrowserTab)throw new Error('Browser tab controls are unavailable.'); return await win.switchAIBrowserTab(String(args.tabId)); }});
    add({name:'navigate_browser_tab', permission:'browser', description:'Navigate an existing Browser tab to a URL.', parameters:{type:'object',required:['tabId','url'],properties:{tabId:{type:'string'},url:{type:'string'}}}, execute:async args => { const win=getBrowserWindow(); if(!win?.navigateAIBrowserTab)throw new Error('Browser navigation controls are unavailable.'); return await win.navigateAIBrowserTab(String(args.tabId),String(args.url||'')); }});
    add({name:'close_browser_tab', permission:'browser', description:'Close a Browser tab.', parameters:{type:'object',required:['tabId'],properties:{tabId:{type:'string'}}}, execute:async args => { const win=getBrowserWindow(); if(!win?.closeAIBrowserTab)throw new Error('Browser tab controls are unavailable.'); return win.closeAIBrowserTab(String(args.tabId)); }});
    add({name:'reload_browser_tab', permission:'browser', description:'Reload a Browser tab.', parameters:{type:'object',properties:{tabId:{type:'string'}},additionalProperties:false}, execute:async args => { const win=getBrowserWindow(); if(!win?.reloadAIBrowserTab)throw new Error('Browser tab controls are unavailable.'); return await win.reloadAIBrowserTab(args.tabId?String(args.tabId):null); }});
    add({name:'get_browser_html', permission:'browser', description:'Read the rendered HTML of a Browser tab. This is the sanitized page DOM visible to the emulated page, not editor internals.', parameters:{type:'object',properties:{tabId:{type:'string'},maxChars:{type:'number'}},additionalProperties:false}, execute:async args => { const win=getBrowserWindow(); if(!win?.getAIBrowserHTML)throw new Error('Browser HTML inspection is unavailable.'); return win.getAIBrowserHTML(args.tabId?String(args.tabId):null,args.maxChars); }});
    add({name:'run_browser_console', permission:'browser', description:'Run JavaScript in a Browser tab using its DevTools-style console execution context and return the result.', parameters:{type:'object',required:['code'],properties:{tabId:{type:'string'},code:{type:'string'}},additionalProperties:false}, execute:async args => { const win=getBrowserWindow(); if(!win?.runAIBrowserConsole)throw new Error('Browser console is unavailable.'); return await win.runAIBrowserConsole(args.tabId?String(args.tabId):null,String(args.code||'')); }});
    add({name:'browser_network_request', permission:'network', description:'Make an arbitrary HTTP request through the editor Network API. The request uses the normal Network endpoint chain, so proxy/direct fallback rules still apply. Returns status, headers, and textual/JSON response data.', parameters:{type:'object',required:['url'],properties:{url:{type:'string'},method:{type:'string'},headers:{type:'object'},body:{type:'string'},maxChars:{type:'number'}},additionalProperties:false}, execute:async args => { const network=state.browserNetwork||window.__sharedBrowserNetwork; if(!network?.request)throw new Error('Network API is unavailable.'); const url=String(args.url||'').trim(); if(!url)throw new Error('URL is required.'); const method=String(args.method||'GET').toUpperCase(); const headers={...(args.headers&&typeof args.headers==='object'?args.headers:{})}; const init={method,headers}; if(args.body!=null && !['GET','HEAD'].includes(method))init.body=String(args.body); const response=await network.request(new Request(url,init),'ai'); if(!response)throw new Error('No endpoint returned a response.'); const maxChars=Math.max(1000,Math.min(500000,Number(args.maxChars)||100000)); const raw=await response.text(); let json=null; try{json=JSON.parse(raw);}catch(_){} return {url:response.url||url,status:response.status,statusText:response.statusText,ok:response.ok,headers:Object.fromEntries(response.headers.entries()),text:raw.slice(0,maxChars),json,truncated:raw.length>maxChars,totalLength:raw.length}; }});
    add({name:'get_browser_output', permission:'browser', description:'Read recent console errors and output from emulated browser pages.', parameters:{type:'object',properties:{limit:{type:'number'},clear:{type:'boolean'}},additionalProperties:false}, execute:async args => { const win=state.browserFrame?.contentWindow; if(!win)return {available:false,output:[]}; const output=win.getAIBrowserOutput?.({limit:Math.max(1,Math.min(200,Number(args.limit)||100))}) || []; if(args.clear)win.clearAIBrowserOutput?.(); return {available:true,output}; }});
    // Built-in GitHub tools. These use the editor's existing OAuth session and are
    // deliberately permission-gated separately from generic network access.
    const github = window.GitHubService;
    const requireGitHub = () => {
      if (!github?.isSignedIn?.()) throw new Error('Sign in to GitHub from the editor Profile before using GitHub tools.');
      return github;
    };
    add({name:'github_status', permission:'githubRead', description:'Check whether the user is signed in to GitHub and return the signed-in account.', parameters:{type:'object',properties:{},additionalProperties:false}, execute:async () => {
      const service=github;
      if (!service?.isSignedIn?.()) return {signedIn:false,user:null};
      const user=service.getUser?.() || null;
      return {signedIn:true,user:user ? {login:user.login,name:user.name,avatarUrl:user.avatar_url||user.avatarUrl||''} : null};
    }});
    add({name:'github_list_repositories', permission:'githubRead', description:'List repositories available to the signed-in GitHub account.', parameters:{type:'object',properties:{},additionalProperties:false}, execute:async () => {
      return requireGitHub().listRepositories();
    }});
    add({name:'github_get_repository', permission:'githubRead', description:'Get metadata for a GitHub repository.', parameters:{type:'object',required:['owner','repo'],properties:{owner:{type:'string'},repo:{type:'string'}},additionalProperties:false}, execute:async args => {
      return requireGitHub().getRepository(String(args.owner||''),String(args.repo||''));
    }});
    add({name:'github_create_repository', permission:'githubWrite', description:'Create a GitHub repository for the signed-in user.', parameters:{type:'object',required:['name'],properties:{name:{type:'string'},description:{type:'string'},privateRepo:{type:'boolean'},autoInit:{type:'boolean'}},additionalProperties:false}, execute:async args => {
      const result=await requireGitHub().createRepository({name:String(args.name||''),description:String(args.description||''),privateRepo:!!args.privateRepo,autoInit:args.autoInit!==false});
      return {id:result?.id,name:result?.name,fullName:result?.full_name,url:result?.html_url,defaultBranch:result?.default_branch};
    }});
    add({name:'github_list_branches', permission:'githubRead', description:'List branches in a GitHub repository.', parameters:{type:'object',required:['owner','repo'],properties:{owner:{type:'string'},repo:{type:'string'}},additionalProperties:false}, execute:async args => {
      return requireGitHub().listBranches(String(args.owner||''),String(args.repo||''));
    }});
    add({name:'github_list_commits', permission:'githubRead', description:'List recent commits for a GitHub repository branch.', parameters:{type:'object',required:['owner','repo'],properties:{owner:{type:'string'},repo:{type:'string'},branch:{type:'string'},count:{type:'integer',minimum:1,maximum:100}},additionalProperties:false}, execute:async args => {
      return requireGitHub().listCommits(String(args.owner||''),String(args.repo||''),String(args.branch||'main'),Math.max(1,Math.min(100,Number(args.count)||20)));
    }});
    add({name:'github_compare_working_tree', permission:'githubRead', description:'Compare the current editor workspace with a GitHub repository branch and report added, modified, and deleted files.', parameters:{type:'object',required:['owner','repo','branch'],properties:{owner:{type:'string'},repo:{type:'string'},branch:{type:'string'}},additionalProperties:false}, execute:async args => {
      const service=requireGitHub();
      const remote=await service.getRemoteState(String(args.owner||''),String(args.repo||''),String(args.branch||'main'));
      const changes=await service.compareWorkingTree(state.fs,remote.tree);
      return {remoteCommitSha:remote.commitSha,changes:changes.map(x=>({path:x.path,type:x.type}))};
    }});
    add({name:'github_commit_and_push', permission:'githubWrite', description:'Commit the current editor workspace changes to a GitHub repository branch and push them. This changes the remote repository.', parameters:{type:'object',required:['owner','repo','branch','message'],properties:{owner:{type:'string'},repo:{type:'string'},branch:{type:'string'},message:{type:'string'}},additionalProperties:false}, execute:async args => {
      const result=await requireGitHub().commitAndPush({owner:String(args.owner||''),repo:String(args.repo||''),branch:String(args.branch||'main'),message:String(args.message||''),fs:state.fs});
      return {changed:!!result.changed,commitSha:result.commitSha,changes:(result.changes||[]).map(x=>({path:x.path,type:x.type}))};
    }});
    add({name:'github_read_file', permission:'githubRead', description:'Read a text file from a GitHub repository using the signed-in account.', parameters:{type:'object',required:['owner','repo','path'],properties:{owner:{type:'string'},repo:{type:'string'},path:{type:'string'}},additionalProperties:false}, execute:async args => {
      const service=requireGitHub();
      const path=String(args.path||'').replace(/^\/+/, '');
      const data=await service.request('/repos/'+encodeURIComponent(String(args.owner||''))+'/'+encodeURIComponent(String(args.repo||''))+'/contents/'+path.split('/').map(encodeURIComponent).join('/'));
      if(Array.isArray(data)) return {directory:true,entries:data.map(x=>({name:x.name,path:x.path,type:x.type,sha:x.sha}))};
      if(!data?.content) throw new Error('GitHub returned no file content.');
      const binary=atob(String(data.content).replace(/\s/g,''));
      const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
      const content=new TextDecoder().decode(bytes);
      return {path:data.path,sha:data.sha,content};
    }});
    add({name:'github_write_file', permission:'githubWrite', description:'Create or replace a text file in a GitHub repository. This changes the remote repository.', parameters:{type:'object',required:['owner','repo','path','content','message'],properties:{owner:{type:'string'},repo:{type:'string'},path:{type:'string'},content:{type:'string'},message:{type:'string'},sha:{type:'string',description:'Current blob SHA when replacing an existing file. If omitted, the tool reads it first.'}},additionalProperties:false}, execute:async args => {
      const service=requireGitHub();
      const owner=String(args.owner||''), repoName=String(args.repo||''), path=String(args.path||'').replace(/^\/+/, '');
      let sha=String(args.sha||'');
      if(!sha){
        try {
          const current=await service.request('/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repoName)+'/contents/'+path.split('/').map(encodeURIComponent).join('/'));
          sha=String(current?.sha||'');
        } catch(e) {
          if(e?.status!==404) throw e;
        }
      }
      const bytes=new TextEncoder().encode(String(args.content??''));
      let binary=''; for(let p=0;p<bytes.length;p+=0x8000) binary+=String.fromCharCode(...bytes.subarray(p,Math.min(p+0x8000,bytes.length)));
      const body={message:String(args.message||''),content:btoa(binary)}; if(sha) body.sha=sha;
      const result=await service.request('/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repoName)+'/contents/'+path.split('/').map(encodeURIComponent).join('/'),{method:'PUT',body:JSON.stringify(body)});
      return {written:true,path,sha:result?.content?.sha||null,commitSha:result?.commit?.sha||null};
    }});
    add({name:'github_delete_file', permission:'githubWrite', description:'Delete a file from a GitHub repository. This changes the remote repository.', parameters:{type:'object',required:['owner','repo','path','message'],properties:{owner:{type:'string'},repo:{type:'string'},path:{type:'string'},message:{type:'string'},sha:{type:'string',description:'The current blob SHA. If omitted, the tool reads the file first.'}},additionalProperties:false}, execute:async args => {
      const service=requireGitHub();
      const owner=String(args.owner||''), repoName=String(args.repo||''), path=String(args.path||'').replace(/^\/+/, '');
      let sha=String(args.sha||'');
      if(!sha){ const current=await service.request('/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repoName)+'/contents/'+path.split('/').map(encodeURIComponent).join('/')); sha=String(current?.sha||''); }
      if(!sha) throw new Error('A current file SHA is required to delete a GitHub file.');
      const result=await service.request('/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repoName)+'/contents/'+path.split('/').map(encodeURIComponent).join('/'),{method:'DELETE',body:JSON.stringify({message:String(args.message||''),sha})});
      return {deleted:true,path,commitSha:result?.commit?.sha||null};
    }});
    for (const extensionTool of window.EditorExtensionAPI?.getAITools?.() || []) add(extensionTool);
    return {map:tools, list:()=>[...tools.values()]};
  }
  return makeTools;
})();


  const SYSTEM = 'You are the AI coding assistant inside a browser-based code editor. Be practical, precise, and concise. Use Markdown for explanations and fenced code blocks for code. Use the minimum number of tool calls necessary to complete the user\'s request. Decide after each tool result whether another tool call is actually needed; do not inspect files or run commands merely to be thorough. Once you have enough information to answer, give the final answer instead of taking another tool step. For read-only requests such as summarizing or explaining a file, stop after you have gathered the relevant information. For modification tasks, make the requested changes, perform a targeted verification when appropriate, and then stop once the task is complete. If you have already completed all necessary tool work and need to finish the agent immediately, use the exit_early tool and put the complete final answer in its message. Do not claim a change was made unless the tool succeeded. When working on the project, inspect existing files before changing them, preserve the project\'s existing style, and verify changes by running relevant commands when available. The run_command tool uses the editor\'s virtual Node runtime, not a real operating-system shell: never prefix commands with $ and do not assume arbitrary shell features such as pipes or shell redirection are available; simple commands such as echo are supported. For project filesystem work, use the dedicated file tools.';
  const AGENT_TOOL_INSTRUCTIONS = [
    'You can use the editor actions listed in the tool schemas below.',
    'When you need a tool, emit one or more <tool_call> JSON tags, each with a name and arguments object.',
    'Do not put tool calls inside Markdown code fences. Use valid JSON arguments matching the supplied schemas.',
    'After receiving tool results, continue the task and call more tools only when needed.'
  ].join(' ');
  const AGENT_FINAL_INSTRUCTIONS = '\n\nThe tool-step limit has been reached. Do not call more tools. Give the user the best final answer using the results already collected.';
  const TOOL_PERMISSION_LABELS = {
    readFiles:'Read project files', searchFiles:'Search project', createFiles:'Create files', modifyFiles:'Modify files', deleteFiles:'Delete files',
    runCommands:'Run commands', runScripts:'Run scripts', runProject:'Run project', readOutput:'Read runtime output', readEditor:'Read editor state', modifyEditor:'Modify editor', browser:'Access browser', network:'Network requests', githubRead:'Read GitHub', githubWrite:'Write to GitHub', extensionActions:'Extension actions'
  };
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function markdown(text) {
    try {
      if (typeof showdown !== 'undefined') return new showdown.Converter({tables:true,ghCodeBlocks:true,openLinksInNewWindow:true}).makeHtml(String(text || ''));
    } catch (_) {}
    return '<p>' + escapeHtml(text).replace(/\n/g,'<br>') + '</p>';
  }

  function protectMath(value) {
    const source = String(value || '');
    const expressions = [];
    const pattern = /(\x60{3,}[\s\S]*?\x60{3,}|~{3,}[\s\S]*?~{3,}|\x60[^\x60\n]*\x60|\x24\x24[\s\S]+?\x24\x24|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\x24[^\x24\n]+\x24)/g;
    const text = source.replace(pattern, match => {
      if (match.charCodeAt(0) === 96 || match.startsWith('~~~')) return match;
      const doubleDollar = match.charCodeAt(0) === 36 && match.charCodeAt(1) === 36;
      const display = doubleDollar || match.startsWith('\\[');
      const delimiterLength = doubleDollar || match.startsWith('\\[') || match.startsWith('\\(') ? 2 : 1;
      expressions.push({tex:match.slice(delimiterLength,-delimiterLength),display,raw:match});
      return 'KATEXMATH' + (expressions.length - 1) + 'TOKEN';
    });
    return {text,expressions};
  }
  function renderMathExpressions(container, expressions) {
    if (!expressions.length) return;
    const katexReady = typeof window.katex?.renderToString === 'function';
    const nodes = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) if (node.nodeValue.includes('KATEXMATH')) nodes.push(node);
    for (const textNode of nodes) {
      const parts = textNode.nodeValue.split(/KATEXMATH(\d+)TOKEN/g);
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
          if (parts[i]) fragment.appendChild(document.createTextNode(parts[i]));
          continue;
        }
        const expression = expressions[Number(parts[i])];
        if (!expression) continue;
        const element = document.createElement('span');
        element.className = expression.display ? 'ai-katex-display' : 'ai-katex-inline';
        if (!katexReady) element.textContent = expression.raw;
        else {
          try {
            element.innerHTML = window.katex.renderToString(expression.tex,{displayMode:expression.display,throwOnError:false,strict:'ignore',trust:false});
          } catch (_) { element.textContent = expression.raw; }
        }
        fragment.appendChild(element);
      }
      textNode.replaceWith(fragment);
    }
  }

  function sanitizeHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString('<div>' + String(html || '') + '</div>', 'text/html');
    const root = doc.body.firstElementChild;
    const allowed = new Set(['DIV','P','BR','HR','H1','H2','H3','H4','H5','H6','UL','OL','LI','BLOCKQUOTE','PRE','CODE','EM','I','STRONG','B','DEL','S','TABLE','THEAD','TBODY','TR','TH','TD','A','DETAILS','SUMMARY','SPAN']);
    root.querySelectorAll('*').forEach(el => {
      if (!allowed.has(el.tagName)) { el.replaceWith(...Array.from(el.childNodes)); return; }
      for (const attr of [...el.attributes]) {
        const n = attr.name.toLowerCase();
        if (n.startsWith('on') || n === 'style' || n === 'srcdoc') { el.removeAttribute(attr.name); continue; }
        if (n === 'href') {
          try { const u = new URL(attr.value, location.href); if (!['http:','https:','mailto:'].includes(u.protocol)) el.removeAttribute(attr.name); else el.setAttribute('rel','noreferrer noopener'); }
          catch (_) { el.removeAttribute(attr.name); }
          continue;
        }
        if (el.tagName === 'CODE' && n === 'class' && !/^language-[\w+-]+$/.test(attr.value)) el.removeAttribute(attr.name);
        else if (!['class','title','href'].includes(n)) el.removeAttribute(attr.name);
      }
    });
    root.querySelectorAll('script,iframe,object,embed,form,link,meta,style').forEach(x => x.remove());
    return root.innerHTML;
  }
  function getCodeInfo(pre) {
    const code = pre.querySelector('code');
    if (!code) return null;
    const cls = [...code.classList].find(x => x.startsWith('language-') || x.startsWith('lang-')) || '';
    return {code:code.textContent || '', language:cls.replace(/^language-/, '').replace(/^lang-/, '') || 'text'};
  }
  function activeEditor(state) {
    for (const instance of Workbench.getInstances?.() || [state.workbench]) for (const g of instance.groups.values()) {
      const t = g.tabs.find(x => x.id === g.active);
      if (t?.kind === 'file') return t;
    }
    return state.lastTextTab?.kind === 'file' ? state.lastTextTab : null;
  }
  function renderMessage(container, text, onInsertCode) {
    const math = protectMath(text);
    container.innerHTML = sanitizeHtml(markdown(math.text));
    renderMathExpressions(container, math.expressions);
    container.querySelectorAll('pre').forEach(pre => {
      const info = getCodeInfo(pre); if (!info) return;
      const wrap = document.createElement('div'); wrap.className = 'ai-code-wrap';
      pre.parentNode.insertBefore(wrap, pre); wrap.appendChild(pre);
      const bar = document.createElement('div'); bar.className = 'ai-code-bar';
      const label = document.createElement('span'); label.textContent = info.language || 'code';
      const copy = document.createElement('button'); copy.textContent = 'Copy';
      copy.onclick = async () => { try { await navigator.clipboard.writeText(info.code); copy.textContent='Copied'; setTimeout(()=>copy.textContent='Copy',900); } catch (_) {} };
      bar.append(label,copy);
      if (typeof onInsertCode === 'function') {
        const insert = document.createElement('button'); insert.textContent = 'Insert';
        insert.onclick = () => onInsertCode(info.code);
        bar.appendChild(insert);
      }
      wrap.insertBefore(bar, pre);
    });
    container.querySelectorAll('a').forEach(a => { a.target = '_blank'; a.rel = 'noreferrer noopener'; });
  }
  const CHAT_DIR = '.editor/chats';
  const CHAT_INDEX = CHAT_DIR + '/index.json';
  function chatId() { return 'chat-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8); }
  function chatTitle(text) {
    const first = String(text || '').split(/\r?\n/).map(x => x.trim()).find(Boolean) || 'New Chat';
    return first.length > 48 ? first.slice(0, 45) + '…' : first;
  }
  function validMessages(messages) {
    return Array.isArray(messages) ? messages.filter(m => m && ['user','assistant'].includes(m.role) && typeof m.content === 'string') : [];
  }
  function makeChatStore(state) {
    let loadedProjectId = null;
    let chats = [];
    const memory = new Map();
    function readJson(path, fallback = null) {
      try {
        if (!state.fs?.existsSync(path)) return fallback;
        const value = JSON.parse(state.fs.readFileSync(path, 'utf8') || 'null');
        return value ?? fallback;
      } catch (_) { return fallback; }
    }
    function writeJson(path, value) {
      state.fs?.mkdirSync?.(CHAT_DIR);
      state.fs?.writeFileSync?.(path, JSON.stringify(value, null, 2));
    }
    function loadChat(id) {
      if (memory.has(id)) return memory.get(id);
      const raw = readJson(CHAT_DIR + '/' + id + '.json', null);
      const chat = raw && typeof raw === 'object' ? {
        id: String(raw.id || id),
        title: String(raw.title || 'New Chat'),
        createdAt: Number(raw.createdAt) || Date.now(),
        updatedAt: Number(raw.updatedAt) || Number(raw.createdAt) || Date.now(),
        messages: validMessages(raw.messages),
        ...(raw.agentId ? {agentId:String(raw.agentId)} : {})
      } : {id, title:'New Chat', createdAt:Date.now(), updatedAt:Date.now(), messages:[]};
      memory.set(chat.id, chat);
      return chat;
    }
    function saveChat(chat) {
      if (!state.fs || !chat?.id) return;
      chat.updatedAt = Date.now();
      memory.set(chat.id, chat);
      const meta = chats.find(x => x.id === chat.id);
      if (meta) {
        meta.title = chat.title;
        meta.createdAt = chat.createdAt;
        meta.updatedAt = chat.updatedAt;
        meta.messageCount = chat.messages.length;
      }
      writeJson(CHAT_DIR + '/' + chat.id + '.json', chat);
      writeJson(CHAT_INDEX, {version:1, chats});
      if (!state.loading) state.markDirty?.(CHAT_DIR + '/' + chat.id + '.json');
    }
    function ensureLoaded() {
      const pid = state.projectId || 'global';
      if (loadedProjectId === pid && chats.length) return;
      loadedProjectId = pid;
      chats = [];
      memory.clear();
      const index = readJson(CHAT_INDEX, {version:1,chats:[]});
      if (Array.isArray(index?.chats)) {
        chats = index.chats.map(x => ({id:String(x.id||''),title:String(x.title||'New Chat'),createdAt:Number(x.createdAt)||Date.now(),updatedAt:Number(x.updatedAt)||0,messageCount:Number(x.messageCount)||0})).filter(x=>x.id);
      }
      if (!chats.length) {
        let legacy = [];
        try {
          const legacyRaw = JSON.parse(localStorage.getItem(CHAT_PREFIX + pid) || '[]');
          legacy = validMessages(legacyRaw);
        } catch (_) {}
        const created = createChatInternal(legacy, legacy.length ? chatTitle(legacy.find(m=>m.role==='user')?.content) : 'New Chat', false);
        if (legacy.length) saveChat(created);
        chats = [{id:created.id,title:created.title,createdAt:created.createdAt,updatedAt:created.updatedAt,messageCount:created.messages.length}];
        try { localStorage.removeItem(CHAT_PREFIX + pid); } catch (_) {}
      }
      chats.sort((a,b)=>b.updatedAt-a.updatedAt);
    }
    function createChatInternal(messages, title, persist) {
      const now = Date.now();
      const chat = {id:chatId(),title:title || 'New Chat',createdAt:now,updatedAt:now,messages:validMessages(messages)};
      memory.set(chat.id, chat);
      chats.unshift({id:chat.id,title:chat.title,createdAt:now,updatedAt:now,messageCount:chat.messages.length});
      if (persist) saveChat(chat);
      return chat;
    }
    function create() { ensureLoaded(); return createChatInternal([], 'New Chat', true); }
    function get(id) { ensureLoaded(); return loadChat(id); }
    function list(recentOnly = false) { ensureLoaded(); const ordered=[...chats].sort((a,b)=>b.updatedAt-a.updatedAt); return recentOnly ? ordered.slice(0,12) : ordered; }
    function rename(id, title) { const chat=get(id); chat.title=String(title||'New Chat').trim().slice(0,80)||'New Chat'; saveChat(chat); }
    function touch(id) { const chat=get(id); saveChat(chat); }
    function remove(id) {
      ensureLoaded();
      const idx=chats.findIndex(x=>x.id===id); if(idx<0)return false;
      chats.splice(idx,1); memory.delete(id);
      try { state.fs?.deleteFileSync?.(CHAT_DIR + '/' + id + '.json'); } catch (_) {}
      writeJson(CHAT_INDEX, {version:1,chats});
      if (!state.loading) state.markDirty?.(CHAT_INDEX);
      return true;
    }
    return {ensureLoaded,list,get,create,rename,touch,remove};
  }
  function makeModelLabel(model, registry, localManager) {
    if(model?.local || model?.protocol==='local-transformers'){
      const loaded=!!localManager?.isLoaded?.(model.id);
      return model.name+' · local'+(loaded?' · loaded':' · not loaded');
    }
    if(aiRoot.isHuggingFaceEndpoint?.(model?.endpoint)){
      const source=registry?.getHuggingFaceKeySource?.(model)||'none';
      return model.name+' · '+(source==='model'?'model key':source==='user'?'your key':source==='shared'?'shared fallback':'no key');
    }
    return model.public ? model.name+' · no key' : model.name+(model.apiKey ? ' · key set' : '');
  }

  function permissionPrompt(request) {
    return new Promise(resolve => {
      const modal=document.createElement('div'); modal.className='editor-modal ai-permission-modal';
      const title=TOOL_PERMISSION_LABELS[request.tool.permission] || request.tool.permission || 'AI action';
      let detail=''; try { detail=JSON.stringify(request.preview||request.args,null,2); } catch(_){detail=String(request.preview||'');}
      modal.innerHTML=`<div class="editor-modal-content ai-permission-content"><button class="editor-modal-close" aria-label="Close">×</button><h2>AI wants permission</h2><p>${escapeHtml(title)}</p><div class="ai-permission-tool">${escapeHtml(request.tool.name)}</div>${detail ? `<pre class="ai-permission-preview">${escapeHtml(detail.slice(0,8000))}</pre>` : ''}<div class="ai-permission-actions"><button data-deny>Deny</button><button data-once>Allow once</button><button data-always>Always allow</button></div></div>`;
      document.body.appendChild(modal); requestAnimationFrame(()=>modal.classList.add('show'));
      const done=v=>{modal.remove();resolve(v);};
      modal.querySelector('[data-deny]').onclick=()=>done('deny'); modal.querySelector('[data-once]').onclick=()=>done('once'); modal.querySelector('[data-always]').onclick=()=>done('always');
      modal.querySelector('.editor-modal-close').onclick=()=>done('deny'); modal.onclick=e=>{if(e.target===modal)done('deny');};
    });
  }
  function settingsModal(registry, permissions, onChange, network, localManager, useModel) {
    const modal=document.createElement('div'); modal.className='editor-modal ai-settings-modal';
    let editingId='';
    const render=()=>{
      const models=registry.settings.models, providers=registry.providers();
      modal.innerHTML=`<div class="editor-modal-content ai-settings-content"><button class="editor-modal-close" aria-label="Close">×</button><h2>AI Settings</h2><p>Configure models, the extra instructions you give them, and usage behavior.</p><div class="ai-settings-tabs"><button data-settings-tab="models" class="active">Models</button><button data-settings-tab="context">Context</button><button data-settings-tab="analytics">Analytics</button></div><div data-settings-panel="models"><div class="ai-settings-columns"><section><div class="ai-section-title ai-settings-section-heading"><span>Models</span><span class="ai-settings-transfer"><button type="button" data-export-ai>Export JSON</button><button type="button" data-import-ai>Import JSON</button><button type="button" data-reset-models>Reset defaults</button><input data-import-ai-file type="file" accept="application/json,.json" hidden></span></div><label class="ai-check ai-export-keys"><input data-preserve-ai-keys type="checkbox" checked> Preserve API keys in export</label><div class="ai-export-warning">API keys are written to the JSON file in plain text when enabled. Only share the exported file if you are comfortable sharing those keys.</div><div class="ai-model-list">${models.map(m=>{
  const local=!!m.local||m.protocol==='local-transformers';
  const active=m.id===registry.settings.activeModelId;
  const loaded=local&&!!localManager?.isLoaded?.(m.id);
  const action=active&&(!local||loaded)?'Active':local?'Load':'Use';
  const details=(local?'Local model':'Remote · '+registry.protocolLabel(m.protocol))+' · '+m.model;
  const edit=local?'<button data-local-edit="'+escapeHtml(m.id)+'">Edit</button>':'<button data-edit="'+escapeHtml(m.id)+'">Edit</button>';
  return '<div class="ai-model-row '+(active?'active ':'')+(local?'local':'remote')+'"><div class="ai-model-main"><strong>'+escapeHtml(m.name)+'</strong><span title="'+escapeHtml(details)+'">'+escapeHtml(details)+'</span></div><button data-use="'+escapeHtml(m.id)+'" '+(active&&(!local||loaded)?'disabled':'')+'>'+action+'</button>'+edit+'<button data-remove="'+escapeHtml(m.id)+'" '+(models.length<=1?'disabled title="At least one model must remain"':'')+'>×</button></div>';
}).join('')}</div>
<div class="ai-local-cache"><div class="ai-local-cache-heading"><strong>Persistent local AI cache</strong><button type="button" data-refresh-local-cache>Refresh</button></div><p>Model files and the Transformers.js runtime are stored in IndexedDB. Completed models can be loaded without network access.</p><div class="ai-local-cache-summary" data-local-cache-summary>Checking browser storage…</div><div class="ai-local-cache-list" data-local-cache-list></div></div>
<div class="ai-model-actions"><button class="ai-settings-add" data-add>+ Add remote model</button><button class="ai-settings-add" data-add-local>+ Add local model</button></div><div class="ai-model-editor-slot"><div class="ai-local-model-editor" data-local-editor hidden><h3 data-local-editor-title>Add local model</h3><label>Name<input data-local-name placeholder="Qwen3 4B Instruct · Local"></label><label>Model ID<div class="ai-model-input-row"><input data-local-model placeholder="onnx-community/owner-model-ONNX"><button type="button" data-browse-local-models>Browse</button></div></label><div class="ai-local-editor-status" data-local-editor-status></div><div class="ai-add-actions"><button type="button" data-cancel-local>Cancel</button><button type="button" data-save-local>Save model</button></div></div>
<div class="ai-add-model" hidden><label>Provider<select data-provider>${Object.entries(providers).filter(([id])=>id!=='local').map(([id,p])=>`<option value="${escapeHtml(id)}">${escapeHtml(p.label)}</option>`).join('')}</select></label><label>API format<select data-format>${Object.entries(aiRoot.AI_PROTOCOLS||{}).map(([id,p])=>`<option value="${escapeHtml(id)}">${escapeHtml(p.label)}</option>`).join('')}</select></label><label>Name<input data-name placeholder="My model"></label><label>Endpoint<input data-endpoint placeholder="https://api.example.com/v1"></label><label>Model ID <div class="ai-model-input-row"><input data-model placeholder="model-name"><button type="button" data-browse-models>Browse models</button></div></label><label>API key <input data-key type="password" placeholder="Enter your provider key"></label><label class="ai-check"><input data-remember type="checkbox"> Remember API key on this device</label><label class="ai-check"><input data-tools type="checkbox" checked> Supports native tool calling</label><label class="ai-check"><input data-thinking type="checkbox" checked> Supports reasoning</label><div class="ai-add-hint" data-protocol-hint>Select a provider to fill in its API format and endpoint. You can override the endpoint for compatible services.</div><div class="ai-add-actions"><button data-cancel-model>Cancel</button><button data-save-model>Save model</button></div></div></div><div class="ai-local-load-status" data-local-settings-status hidden><div data-local-settings-text></div><div class="ai-local-progress"><span data-local-settings-progress></span></div></div><div class="ai-hf-account"><div class="ai-section-title">Hugging Face</div><label>Your API key<input data-hf-global-key type="password" placeholder="hf_..."></label><label class="ai-check"><input data-hf-global-remember type="checkbox"> Remember your key on this device</label><div class="ai-add-hint">Used for Hugging Face models that do not have their own key. Add a key here or on an individual model.</div></div></section><section><div class="ai-section-title">Permissions</div><div class="ai-permission-list">${Object.entries(permissions.all()).map(([k,v])=>`<label><span>${escapeHtml(TOOL_PERMISSION_LABELS[k]||k)}</span><select data-permission="${k}"><option value="always" ${v==='always'?'selected':''}>Always allow</option><option value="ask" ${v==='ask'?'selected':''}>Ask each time</option><option value="never" ${v==='never'?'selected':''}>Never allow</option></select></label>`).join('')}</div><button data-reset-permissions class="ai-settings-reset">Reset permissions</button></section></div><div class="ai-settings-note">Providers can fill in the API format and default endpoint automatically. Providers may expose either a live model list or a fixed set of known models.</div></div><div data-settings-panel="context" hidden><div class="ai-context-panel"><h3 class="ai-section-title">Model context &amp; instructions</h3><p class="ai-settings-note-inline">These are added to the built-in coding-assistant instructions. They persist on this device and apply to your AI chats.</p><label>Additional instructions<textarea data-custom-instructions placeholder="Example: Prefer small, focused changes. Explain tradeoffs briefly."></textarea></label><label>Agent-only instructions<textarea data-agent-instructions placeholder="Example: Before editing, inspect related files and run a targeted verification after each major change."></textarea></label><label class="ai-check"><input data-show-activity type="checkbox"> Show agent activity in chat</label><h3 class="ai-section-title">Request recovery</h3><label class="ai-check"><input data-retry-429 type="checkbox"> Automatically retry HTTP 429 rate limits</label><div class="ai-retry-grid"><label>Max 429 retries<input data-max-retries type="number" min="0" max="10"></label><label>Base delay (ms)<input data-base-delay type="number" min="250" max="30000" step="250"></label></div><label class="ai-check"><input data-retry-transport type="checkbox"> Retry transport/CORS failures</label><div class="ai-retry-grid"><label>Max transport retries<input data-max-transport-retries type="number" min="0" max="10"></label><label>Transport delay (ms)<input data-transport-delay type="number" min="250" max="30000" step="250"></label></div><p class="ai-settings-note-inline">HTTP responses such as 429 are handled separately from transport failures such as CORS or connection errors.</p><h3 class="ai-section-title">Tool-call recovery</h3><label class="ai-check"><input data-tool-recovery type="checkbox"> Retry supported tool-call parse failures</label><div class="ai-retry-grid"><label>Max recovery retries<input data-tool-recovery-retries type="number" min="0" max="10"></label><span></span></div><p class="ai-settings-note-inline">Providers can opt into a recovery strategy through their API adapter. The agent itself does not special-case providers.</p></div></div><div data-settings-panel="analytics" hidden><div class="ai-analytics-panel"><div class="ai-analytics-cards" data-analytics-cards></div><h3 class="ai-section-title">By model</h3><div data-analytics-models class="ai-analytics-models"></div><button data-reset-analytics class="ai-settings-reset">Reset analytics</button></div></div></div>`;
      modal.querySelector('.editor-modal-close').onclick=()=>modal.remove(); modal.onclick=e=>{if(e.target===modal)modal.remove();};
      const cacheSummary=modal.querySelector('[data-local-cache-summary]');
      const cacheList=modal.querySelector('[data-local-cache-list]');
      function formatCacheBytes(value){
        const bytes=Math.max(0,Number(value)||0);
        if(bytes<1024)return bytes+' B';
        const units=['KB','MB','GB','TB'];let size=bytes/1024,index=0;
        while(size>=1024&&index<units.length-1){size/=1024;index++;}
        return size.toFixed(size>=100?0:size>=10?1:2)+' '+units[index];
      }
      async function renderLocalCache(){
        if(!cacheSummary||!cacheList)return;
        const cache=localManager?.cache;
        if(!cache){cacheSummary.textContent='IndexedDB cache is unavailable.';return;}
        cacheSummary.textContent='Reading IndexedDB…';cacheList.innerHTML='';
        try{
          const [entries,stats,storage]=await Promise.all([cache.listModels(),cache.cacheStats(),cache.storageInfo()]);
          const groups=new Map();
          for(const entry of entries){
            const key=entry.id+'::'+entry.model;
            if(!groups.has(key))groups.set(key,{id:entry.id,model:entry.model,variants:new Set(),files:new Map(),cachedAt:entry.cachedAt||0});
            const group=groups.get(key);group.variants.add(entry.variant);
            for(const file of entry.files||[])group.files.set(file.url,Number(file.size)||0);
            group.cachedAt=Math.max(group.cachedAt,Number(entry.cachedAt)||0);
          }
          const modelBytes=[...groups.values()].reduce((sum,group)=>sum+[...group.files.values()].reduce((a,b)=>a+b,0),0);
          const quota=storage.quota?formatCacheBytes(storage.quota):'unreported';
          const persistence=storage.persisted?'persistent storage granted':'persistent storage not granted';
          cacheSummary.textContent=groups.size+' cached model'+(groups.size===1?'':'s')+' · '+formatCacheBytes(modelBytes)+' model files · '+stats.fileCount+' total cached assets including runtime files · '+persistence+' · origin quota '+quota;
          if(!groups.size){
            cacheList.innerHTML='<div class="ai-local-cache-empty">No completed local models are cached yet. Loading a local model will save it here.</div>';
          }else{
            cacheList.innerHTML=[...groups.values()].sort((a,b)=>b.cachedAt-a.cachedAt).map(group=>{
              const name=registry.settings.models.find(model=>model.id===group.id)?.name||group.model;
              const bytes=[...group.files.values()].reduce((sum,size)=>sum+size,0);
              return '<div class="ai-local-cache-row"><div><strong>'+escapeHtml(name)+'</strong><span>'+escapeHtml(group.model)+' · '+escapeHtml([...group.variants].join(', '))+' · '+formatCacheBytes(bytes)+' · '+group.files.size+' files</span></div><button type="button" data-cache-remove="'+escapeHtml(group.id)+'">Delete cache</button></div>';
            }).join('');
            cacheList.querySelectorAll('[data-cache-remove]').forEach(button=>button.onclick=async()=>{
              const id=button.dataset.cacheRemove;
              const model=registry.settings.models.find(item=>item.id===id);
              if(!confirm('Delete the cached files for "'+(model?.name||id)+'"? This does not remove the model from AI Settings.'))return;
              button.disabled=true;
              try{await cache.deleteModel(id);await renderLocalCache();}
              catch(error){alert('Could not delete the cached model: '+(error?.message||String(error)));button.disabled=false;}
            });
          }
          if(!storage.persisted){
            const persist=document.createElement('button');persist.type='button';persist.className='ai-local-cache-persist';persist.textContent='Request persistent storage';
            persist.onclick=async()=>{
              persist.disabled=true;
              try{
                const result=await cache.requestPersistence();
                persist.textContent=result.persisted?'Persistent storage granted':'Browser declined persistent storage';
                await renderLocalCache();
              }catch(error){persist.textContent='Could not request storage';}
            };
            cacheSummary.appendChild(document.createTextNode(' '));cacheSummary.appendChild(persist);
          }
        }catch(error){
          cacheSummary.textContent='Could not read IndexedDB cache: '+(error?.message||String(error));
        }
      }
      modal.querySelector('[data-refresh-local-cache]')?.addEventListener('click',renderLocalCache);
      renderLocalCache();
      const prefs=aiRoot.getAIPreferences?.()||{};
      const tabButtons=[...modal.querySelectorAll('[data-settings-tab]')], panels=[...modal.querySelectorAll('[data-settings-panel]')];
      function selectSettingsTab(name){tabButtons.forEach(b=>b.classList.toggle('active',b.dataset.settingsTab===name));panels.forEach(p=>p.hidden=p.dataset.settingsPanel!==name);if(name==='analytics')renderAnalytics();}
      tabButtons.forEach(b=>b.onclick=()=>selectSettingsTab(b.dataset.settingsTab));
      const customInstructions=modal.querySelector('[data-custom-instructions]'),agentInstructions=modal.querySelector('[data-agent-instructions]'),retry429=modal.querySelector('[data-retry-429]'),maxRetries=modal.querySelector('[data-max-retries]'),baseDelay=modal.querySelector('[data-base-delay]'),retryTransport=modal.querySelector('[data-retry-transport]'),maxTransportRetries=modal.querySelector('[data-max-transport-retries]'),transportDelay=modal.querySelector('[data-transport-delay]'),toolRecovery=modal.querySelector('[data-tool-recovery]'),toolRecoveryRetries=modal.querySelector('[data-tool-recovery-retries]'),showActivity=modal.querySelector('[data-show-activity]');
      customInstructions.value=prefs.customInstructions||''; agentInstructions.value=prefs.agentInstructions||''; retry429.checked=prefs.retry429!==false; maxRetries.value=prefs.max429Retries??5; baseDelay.value=prefs.baseRetryDelay??1500; retryTransport.checked=prefs.retryTransport!==false; maxTransportRetries.value=prefs.maxTransportRetries??2; transportDelay.value=prefs.transportRetryDelay??1000; toolRecovery.checked=prefs.toolRecovery!==false; toolRecoveryRetries.value=prefs.maxToolRecoveryRetries??2; showActivity.checked=prefs.showActivity!==false;
      const savePrefs=()=>{aiRoot.setAIPreferences?.({customInstructions:customInstructions.value,agentInstructions:agentInstructions.value,retry429:retry429.checked,max429Retries:Number(maxRetries.value),baseRetryDelay:Number(baseDelay.value),retryTransport:retryTransport.checked,maxTransportRetries:Number(maxTransportRetries.value),transportRetryDelay:Number(transportDelay.value),toolRecovery:toolRecovery.checked,maxToolRecoveryRetries:Number(toolRecoveryRetries.value),showActivity:showActivity.checked});onChange?.();};
      [customInstructions,agentInstructions,retry429,maxRetries,baseDelay,retryTransport,maxTransportRetries,transportDelay,toolRecovery,toolRecoveryRetries,showActivity].forEach(x=>x.addEventListener('change',savePrefs));
      function fmt(n){return Number(n||0).toLocaleString();}
      function renderAnalytics(){const a=aiRoot.getAIAnalytics?.()||{};const cards=modal.querySelector('[data-analytics-cards]');if(!cards)return;cards.innerHTML=[["Requests",a.requests],["Input tokens",a.inputTokens],["Output tokens",a.outputTokens],["Reasoning tokens",a.reasoningTokens],["Total tokens",a.totalTokens],["429 retries",a.retries429],["Transport retries",a.transportRetries],["Tool recoveries",a.toolRecoveries]].map(([k,v])=>`<div class="ai-analytics-card"><strong>${fmt(v)}</strong><span>${k}</span></div>`).join('');const list=modal.querySelector('[data-analytics-models]');const rows=Object.values(a.byModel||{}).sort((x,y)=>y.totalTokens-x.totalTokens);list.innerHTML=rows.length?rows.map(m=>`<div class="ai-analytics-row"><strong>${escapeHtml(m.name)}</strong><span>${fmt(m.totalTokens)} total · ${fmt(m.inputTokens)} in · ${fmt(m.outputTokens)} out · ${fmt(m.reasoningTokens)} reasoning · ${fmt(m.retries429)} retries</span></div>`).join(''):'<div class="ai-settings-note-inline">No usage recorded yet.</div>';}
      modal.querySelector('[data-reset-analytics]').onclick=()=>{aiRoot.resetAIAnalytics?.();renderAnalytics();};
      const preserveAIKeys=modal.querySelector('[data-preserve-ai-keys]');
      modal.querySelector('[data-export-ai]').onclick=()=>{
        const preserveKeys=!!preserveAIKeys?.checked;
        const payload={version:1,product:'Node-Editor AI Settings',exportedAt:new Date().toISOString(),models:registry.exportSettings?.({preserveKeys})||{},preferences:aiRoot.exportAIPreferences?.()||{},permissions:permissions.all?.()||{}};
        const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
        const url=URL.createObjectURL(blob),a=document.createElement('a'); a.href=url; a.download='node-editor-ai-settings.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
        if(preserveKeys) alert('AI settings exported. API keys are included in plain text in this JSON file. Do not share the exported file unless you intend to share those keys.');
      };
      const importInput=modal.querySelector('[data-import-ai-file]');
      modal.querySelector('[data-reset-models]').onclick=async()=>{
        const message='Restore the default AI model list? This will remove custom models and restore built-in models to their original names and model IDs. Your Hugging Face key, AI preferences, and permissions will be kept.';
        if(!confirm(message))return;
        try{
          if(localManager?.isLoaded?.())await localManager.unload();
          registry.resetDefaults();
          editingId='';
          editingLocalId='';
          localEditor.hidden=true;
          form.hidden=true;
          render();
          onChange?.();
        }catch(e){alert('Could not reset AI models: '+(e?.message||String(e)));}
      };
      modal.querySelector('[data-import-ai]').onclick=()=>importInput.click();
      importInput.onchange=async()=>{
        const file=importInput.files?.[0]; if(!file)return;
        try{
          const payload=JSON.parse(await file.text());
          const modelData=payload.models&&payload.models.models?payload.models:payload;
          if(modelData?.models) registry.importSettings?.(modelData);
          if(payload.preferences) aiRoot.importAIPreferences?.(payload.preferences);
          if(payload.permissions) aiRoot.savePermissions?.(payload.permissions);
          alert('AI settings imported. API keys included in the file have been restored.');
          render(); onChange?.();
        }catch(err){alert(`Could not import AI settings: ${err?.message||err}`);}
        finally{importInput.value='';}
      };
      modal.querySelectorAll('[data-use]').forEach(button=>button.onclick=async()=>{
        const model=registry.settings.models.find(m=>m.id===button.dataset.use);
        if(!model)return;
        if(model.local||model.protocol==='local-transformers'){
          if(model.id===registry.settings.activeModelId&&localManager?.isLoaded?.(model.id))return;
          modal.remove();
          try{await useModel?.(model.id);}catch(e){alert(e?.message||String(e));}
        }else{
          registry.setActive(model.id);editingId='';render();onChange?.();
        }
      });
      modal.querySelectorAll('[data-remove]').forEach(button=>button.onclick=async()=>{
        const id=button.dataset.remove;
        if(registry.settings.models.length<=1)return;
        const model=registry.settings.models.find(x=>x.id===id);
        if(!model)return;
        if(!confirm('Remove model "'+model.name+'" from AI Settings?'))return;
        try{
          if(localManager?.isLoaded?.(id))await localManager.unload();
          const removed=registry.remove(id);
          if(!removed){alert('At least one AI model must remain.');return;}
          if(editingId===id)editingId='';
          editingLocalId=editingLocalId===id?'':editingLocalId;
          localEditor.hidden=true;
          render();onChange?.();
        }catch(e){alert(e?.message||String(e));}
      });
      const localEditor=modal.querySelector('[data-local-editor]');
      const localNameInput=modal.querySelector('[data-local-name]');
      const localModelInput=modal.querySelector('[data-local-model]');
      const localEditorStatus=modal.querySelector('[data-local-editor-status]');
      let editingLocalId='';
      function openLocalModelEditor(model=null){
        form.hidden=true;
        editingId='';
        editingLocalId=model?.id||'';
        localEditor.querySelector('[data-local-editor-title]').textContent=editingLocalId?'Edit local model':'Add local model';
        localNameInput.value=model?.name||'';
        localModelInput.value=model?.model||'';
        localEditorStatus.textContent='';
        localEditor.hidden=false;
        localEditor.querySelector('[data-save-local]').textContent=editingLocalId?'Save changes':'Save model';
        localEditor.scrollIntoView({block:'nearest',behavior:'smooth'});
        if(!editingLocalId)localNameInput.focus();
      }
      function openLocalModelBrowser(onSelect){
        const browser=document.createElement('div');
        browser.className='editor-modal ai-hf-browser-modal';
        browser.innerHTML='<div class="editor-modal-content ai-hf-browser-content"><button class="editor-modal-close" aria-label="Close">×</button><h2>Browse local models</h2><p>Choose a Hugging Face model supported by Transformers.js, or use a model ID directly.</p><div class="ai-hf-browser-toolbar"><input data-local-search placeholder="Search model IDs…"><button data-local-search-button>Search</button><button data-local-search-refresh>Refresh</button></div><div class="ai-local-add-row"><input data-local-model-id placeholder="Hugging Face model ID"><button data-local-use-id>Use ID</button></div><div class="ai-hf-browser-status" data-local-status>Loading models…</div><div class="ai-hf-browser-list" data-local-list></div></div>';
        document.body.appendChild(browser);requestAnimationFrame(()=>browser.classList.add('show'));
        const search=browser.querySelector('[data-local-search]'),status=browser.querySelector('[data-local-status]'),list=browser.querySelector('[data-local-list]'),idInput=browser.querySelector('[data-local-model-id]');
        let all=[];
        browser.querySelector('.editor-modal-close').onclick=()=>browser.remove();browser.onclick=e=>{if(e.target===browser)browser.remove();};
        const choose=id=>{const modelId=String(id||'').trim();if(!modelId){status.textContent='Enter a Hugging Face model ID first.';return;}onSelect?.(modelId);browser.remove();};
        async function load(){
          status.textContent='Searching Hugging Face…';list.innerHTML='';
          try{
            if(!network?.request)throw new Error('Network API is unavailable.');
            const q=search.value.trim();
            const params=new URLSearchParams({pipeline_tag:'text-generation',library:'transformers.js',sort:'downloads',direction:'-1',limit:'50'});
            if(q)params.set('search',q);
            const response=await network.request(new Request('https://huggingface.co/api/models?'+params.toString()),'ai');
            if(!response)throw new Error('Hugging Face returned no response.');
            if(!response.ok)throw new Error('Hugging Face returned '+response.status+': '+await response.text());
            all=await response.json();if(!Array.isArray(all))all=[];renderList();
          }catch(e){status.textContent=e?.message||String(e);}
        }
        function renderList(){
          const q=search.value.trim().toLowerCase();
          const rows=all.filter(m=>{const id=String(m?.id||'');return id&&(!q||id.toLowerCase().includes(q));}).slice(0,200);
          status.textContent=rows.length+' compatible model'+(rows.length===1?'':'s')+' found';
          list.innerHTML=rows.map(m=>'<div class="ai-hf-model-row"><div class="ai-model-main"><strong>'+escapeHtml(m.id)+'</strong><span>'+Number(m.downloads||0).toLocaleString()+' downloads · '+Number(m.likes||0).toLocaleString()+' likes</span></div><button data-local-select="'+escapeHtml(m.id)+'">Select</button></div>').join('');
          list.querySelectorAll('[data-local-select]').forEach(b=>b.onclick=()=>choose(b.dataset.localSelect));
        }
        browser.querySelector('[data-local-search-button]').onclick=load;browser.querySelector('[data-local-search-refresh]').onclick=load;search.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();load();}};
        browser.querySelector('[data-local-use-id]').onclick=()=>choose(idInput.value);
        idInput.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();choose(idInput.value);}};
        load();
      }
      modal.querySelector('[data-add-local]').onclick=()=>openLocalModelEditor();
      modal.querySelector('[data-cancel-local]').onclick=()=>{editingLocalId='';localEditor.hidden=true;};
      modal.querySelector('[data-browse-local-models]').onclick=()=>openLocalModelBrowser(id=>{
        localModelInput.value=id;
        if(!localNameInput.value.trim())localNameInput.value=id.split('/').pop()+' · Local';
        localEditorStatus.textContent='';
      });
      modal.querySelector('[data-save-local]').onclick=async()=>{
        const name=localNameInput.value.trim(),modelId=localModelInput.value.trim();
        if(!name||!modelId){localEditorStatus.textContent='Enter both a name and a model ID.';return;}
        const isLocal=m=>m.local||m.protocol==='local-transformers';
        const existing=registry.settings.models.find(m=>m.id===editingLocalId);
        if(!editingLocalId&&registry.settings.models.some(m=>isLocal(m)&&m.model===modelId)){
          localEditorStatus.textContent='That model is already in the list. Edit its existing entry instead.';return;
        }
        let id=editingLocalId;
        if(!id){
          const slug=modelId.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'model';
          id='local-'+slug;
          if(registry.settings.models.some(m=>m.id===id))id+='-'+Math.random().toString(36).slice(2,7);
        }
        try{
          if(existing&&existing.model!==modelId&&localManager?.isLoaded?.(id))await localManager.unload();
          registry.add({...existing,id,name,model:modelId,remoteModel:modelId,protocol:'local-transformers',kind:'local-transformers',endpoint:'',provider:'local',local:true,requiresKey:false,supportsTools:false,supportsAgentTools:true,supportsReasoning:false,supportsStreaming:true,builtInLocal:!!existing?.builtInLocal});
          registry.save();
          editingLocalId='';localEditor.hidden=true;render();onChange?.();
        }catch(e){localEditorStatus.textContent=e?.message||String(e);}
      };
      modal.querySelectorAll('[data-local-edit]').forEach(button=>button.onclick=()=>{
        const model=registry.settings.models.find(m=>m.id===button.dataset.localEdit);
        if(model)openLocalModelEditor(model);
      });
      const form=modal.querySelector('.ai-add-model'),add=modal.querySelector('[data-add]'),providerInput=form.querySelector('[data-provider]'),formatInput=form.querySelector('[data-format]'),endpointInput=form.querySelector('[data-endpoint]'),nameInput=form.querySelector('[data-name]'),modelInput=form.querySelector('[data-model]'),keyInput=form.querySelector('[data-key]'),hint=form.querySelector('[data-protocol-hint]');
      const hfGlobalKey=modal.querySelector('[data-hf-global-key]'),hfGlobalRemember=modal.querySelector('[data-hf-global-remember]');
      hfGlobalKey.value=registry.getHuggingFaceApiKey?.()||''; hfGlobalRemember.checked=!!registry.settings.huggingFaceRememberKey;
      function updateProviderFields(force=true){
        const id=providerInput.value, preset=registry.provider(id)||registry.provider('custom');
        formatInput.value=preset.protocol; formatInput.disabled=id!=='custom';
        if(force){
          endpointInput.value=preset.endpoint||'';
          modelInput.value=preset.model||'';
          keyInput.value='';
          form.querySelector('[data-tools]').checked=preset.supportsTools!==false;
          form.querySelector('[data-thinking]').checked=preset.supportsReasoning!==false;
          if(!nameInput.value.trim() && preset.name) nameInput.value=preset.model ? `${preset.name} • ${preset.model.split('/').pop()}` : preset.name;
        }
        if(id==='groq')hint.textContent='Groq uses OpenAI-compatible chat completions. Enter your Groq API key, then Browse models for the live /models list.';
        else if(id==='huggingface')hint.textContent='Hugging Face Router uses OpenAI Chat Completions. Browse models queries its live /v1/models list.';
        else if(id==='google-gemini')hint.textContent='Google Gemini uses the native generateContent API. Browse models uses GET /v1beta/models and only shows models that advertise generateContent.';
        else hint.textContent='Custom provider. Choose or override the API format and endpoint as needed.';
      }
      function openModelBrowser(providerId){
        const provider=registry.provider(providerId),config=provider?.modelBrowser,browser=document.createElement('div');
        if(!config){alert(`${providers[providerId]?.label||providerId} does not have a model browser yet.`);return;}
        browser.className='editor-modal ai-hf-browser-modal';
        const title=providers[providerId]?.label||providerId,showFree=!!config.freeFilter;
        browser.innerHTML=`<div class="editor-modal-content ai-hf-browser-content"><button class="editor-modal-close" aria-label="Close">×</button><h2>${escapeHtml(title)} Models</h2><p>Models currently available through this provider.</p><div class="ai-hf-browser-toolbar"><input data-model-search placeholder="Search model IDs…">${showFree?'<label class="ai-check"><input data-model-free type="checkbox"> Free only</label>':''}<button data-model-refresh>Refresh</button></div><div class="ai-hf-browser-status" data-model-status>Loading models…</div><div class="ai-hf-browser-list" data-model-list></div></div>`;
        document.body.appendChild(browser); requestAnimationFrame(()=>browser.classList.add('show'));
        const search=browser.querySelector('[data-model-search]'),free=browser.querySelector('[data-model-free]'),status=browser.querySelector('[data-model-status]'),list=browser.querySelector('[data-model-list]');
        let all=[];
        browser.querySelector('.editor-modal-close').onclick=()=>browser.remove(); browser.onclick=e=>{if(e.target===browser)browser.remove();};
        function modelId(model){return String(model?.[config.idField||'id']||model?.id||'').replace(/^models\//,'');}
        function modelIsEligible(model){const filter=config.filter;if(filter==='generateContent')return Array.isArray(model?.supportedGenerationMethods)&&model.supportedGenerationMethods.includes('generateContent');return true;}
        async function load(){
          status.textContent='Loading models…'; list.innerHTML='';
          try {
            if(!network?.request) throw new Error('Network API is unavailable.');
            const key=String(keyInput?.value||'').trim() || (providerId==='huggingface' ? registry.getHuggingFaceRequestKey?.()||'' : '');
            if(!key) throw new Error(`Enter your ${title} API key first.`);
            const base=String(endpointInput.value||provider.endpoint||'').replace(/\/+$/,'');
            if(!base) throw new Error(`${title} has no model-list endpoint configured.`);
            all=[]; let nextToken='',pages=0;
            do {
              let url=base+(config.path||'/models');
              const query=[]; if(config.query)query.push(config.query); if(nextToken)query.push('pageToken='+encodeURIComponent(nextToken)); if(query.length)url+=(url.includes('?')?'&':'?')+query.join('&');
              const headers=config.auth==='bearer'?{Authorization:'Bearer '+key}:config.auth==='google'?{'x-goog-api-key':key}:{};
              const response=await network.request(new Request(url,{headers}),'ai');
              if(!response)throw new Error(`No response from ${title}.`);
              if(!response.ok)throw new Error(`${title} returned ${response.status}: ${await response.text()}`);
              const data=await response.json();
              const page=Array.isArray(data?.[config.responseKey||'data'])?data[config.responseKey||'data']:[];
              all.push(...page.filter(modelIsEligible));
              nextToken=config.kind==='dynamic'?(data?.nextPageToken||''):'';
              pages++;
            } while(nextToken&&pages<10);
            if(nextToken)status.textContent='Showing the first 10 model-list pages.';
            renderList();
          } catch(e){status.textContent=e?.message||String(e);}
        }
        function renderList(){
          const q=search.value.trim().toLowerCase(),onlyFree=!!free?.checked;
          const rows=all.filter(m=>{
            const id=modelId(m).toLowerCase(); if(!id)return false;
            if(q&&!id.includes(q)&&!String(m.displayName||'').toLowerCase().includes(q))return false;
            if(m.active===false)return false;
            if(onlyFree){const pricing=m.pricing||m.providers?.[0]?.pricing;const freeNow=Array.isArray(m.providers)?m.providers.some(p=>p.is_free===true||(p.pricing&&Number(p.pricing.input)===0&&Number(p.pricing.output)===0)):!!pricing&&(Number(pricing.input??pricing.prompt??-1)===0&&Number(pricing.output??pricing.completion??-1)===0);if(!freeNow)return false;}
            return true;
          }).slice(0,200);
          status.textContent=`${rows.length}${rows.length===200?'+':''} model${rows.length===1?'':'s'} shown`;
          list.innerHTML=rows.map(m=>{
            const id=modelId(m),ctx=Number(m.context_window||m.context_length||m.inputTokenLimit||0),owner=m.owned_by||m.publisher||'',display=m.displayName||'',meta=providerId==='google-gemini'?[display,ctx?ctx.toLocaleString()+' input ctx':'',m.version?String(m.version):''].filter(Boolean).join(' · '):providerId==='huggingface'?`${Array.isArray(m.providers)?m.providers.length:0} provider${Array.isArray(m.providers)&&m.providers.length===1?'':'s'}${ctx?' · '+ctx.toLocaleString()+' ctx':''}`:`${owner?owner+' · ':''}${ctx?ctx.toLocaleString()+' ctx':''}`;
            return `<div class="ai-hf-model-row"><div class="ai-model-main"><strong>${escapeHtml(id)}</strong><span>${escapeHtml(meta||'available')}</span></div><button data-pick="${escapeHtml(id)}">Use</button></div>`;
          }).join('');
          list.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{modelInput.value=b.dataset.pick;if(!endpointInput.value)endpointInput.value=provider.endpoint||'';if(!nameInput.value.trim()||nameInput.value===provider.name)nameInput.value=`${title} • ${b.dataset.pick.split('/').pop()}`;form.querySelector('[data-tools]').checked=provider.supportsTools!==false;form.querySelector('[data-thinking]').checked=provider.supportsReasoning!==false;browser.remove();});
        }
        search.oninput=renderList; if(free)free.onchange=renderList; browser.querySelector('[data-model-refresh]').onclick=load; load();
      }
      form.querySelector('[data-browse-models]').onclick=()=>openModelBrowser(providerInput.value);
      providerInput.onchange=()=>updateProviderFields(true);
      endpointInput.oninput=()=>{if(providerInput.value==='custom')hint.textContent='Custom provider. The endpoint and API format will be used as entered.';};
      function fill(model){editingLocalId='';localEditor.hidden=true;editingId=model?.id||'';form.hidden=false;const providerId=registry.providerForModel(model);providerInput.value=providerId;formatInput.value=model?.protocol||registry.provider(providerId)?.protocol||'openai-chat';formatInput.disabled=providerId!=='custom';nameInput.value=model?.name||'';endpointInput.value=model?.endpoint||'';modelInput.value=model?.model||'';keyInput.value=model?.apiKey||'';form.querySelector('[data-remember]').checked=!!model?.rememberKey;form.querySelector('[data-tools]').checked=model?.supportsTools!==false;form.querySelector('[data-thinking]').checked=model?.supportsReasoning!==false;form.querySelector('[data-save-model]').textContent=editingId?'Save changes':'Save model';updateProviderFields(false);}
      add.onclick=()=>{
        const wasOpen=!form.hidden&&!editingId;
        editingLocalId='';
        localEditor.hidden=true;
        if(wasOpen){form.hidden=true;return;}
        editingId='';
        providerInput.value='custom';formatInput.value='openai-chat';formatInput.disabled=false;
        nameInput.value='';endpointInput.value='';modelInput.value='';keyInput.value='';
        form.querySelector('[data-remember]').checked=false;
        form.querySelector('[data-tools]').checked=true;form.querySelector('[data-thinking]').checked=true;
        hint.textContent='Select a provider to fill in its API format and endpoint.';
        form.hidden=false;
      };
      modal.querySelectorAll('[data-edit]').forEach(x=>x.onclick=()=>{const model=registry.settings.models.find(m=>m.id===x.dataset.edit);if(model)fill(model);});
      modal.querySelector('[data-cancel-model]').onclick=()=>{editingId='';form.hidden=true;};
      modal.querySelector('[data-save-model]').onclick=()=>{const provider=providerInput.value.trim()||'custom',preset=registry.provider(provider)||registry.provider('custom'),name=nameInput.value.trim(),endpoint=endpointInput.value.trim(),modelId=modelInput.value.trim(),apiKey=keyInput.value,remember=form.querySelector('[data-remember]').checked,tools=form.querySelector('[data-tools]').checked,thinking=form.querySelector('[data-thinking]').checked,protocol=provider==='custom'?formatInput.value:preset.protocol;if(!name||!endpoint||!modelId){alert('Name, endpoint, and model ID are required.');return;}registry.setHuggingFaceApiKey(hfGlobalKey.value,hfGlobalRemember.checked);registry.save();const id=editingId||'model-'+Math.random().toString(36).slice(2);try{const clean=registry.add({id,provider,name,endpoint,model:modelId,apiKey,rememberKey:remember,supportsTools:tools,supportsReasoning:thinking,requiresKey:!!apiKey,protocol});registry.setActive(clean.id);editingId='';render();onChange?.();}catch(e){alert(e?.message||String(e));}};
      hfGlobalKey.onchange=()=>{registry.setHuggingFaceApiKey(hfGlobalKey.value,hfGlobalRemember.checked);registry.save();onChange?.();}; hfGlobalRemember.onchange=()=>{registry.setHuggingFaceApiKey(hfGlobalKey.value,hfGlobalRemember.checked);registry.save();onChange?.();};
      modal.querySelectorAll('[data-permission]').forEach(x=>x.onchange=()=>{permissions.set(x.dataset.permission,x.value);onChange?.();});
      modal.querySelector('[data-reset-permissions]').onclick=()=>{permissions.reset();render();onChange?.();};
      if(editingId){const model=registry.settings.models.find(m=>m.id===editingId);if(model)fill(model);}
    };
    document.body.appendChild(modal);render();requestAnimationFrame(()=>modal.classList.add('show'));
  }

  async function editorExtensionHooks(name, payload) { try { return await window.EditorExtensionAPI?.runAIHook?.(name, payload) || payload; } catch (e) { console.warn('Editor AI extension hook failed:', name, e); return payload; } }

  factories.ai = function(ctx) {
    const {state, onOpen, runConfigured}=ctx;
    const updateStatus = state.updateStatus;
    let currentGroup = null, currentTab = null;
    const registry=new aiRoot.ProviderRegistry();
    const localManager=new aiRoot.LocalModelManager();
    const permissions=new aiRoot.PermissionManager();
    const chatStore=makeChatStore(state);
    let currentChatId='';
    let chatMessages=[];
    let loadedProjectId=null;
    let busy=false, controller=null, editingIndex=-1;
    const toolset=makeEditorTools({state,openFile:onOpen,onRefresh:()=>{state.fileManager?.refresh?.();updateStatus?.();},runConfigured,ensureNodeRuntime:()=>state.ensureNodeRuntime?.()});
    const client=new aiRoot.AIClient(registry,state.browserNetwork||window.__sharedBrowserNetwork);
    // All editor conversations share one agent; each conversation opts in independently.
    const chatAI=new aiRoot.ChatAI({registry,client,localManager});
    const agent=chatAI.createAgent({id:'editor',name:'Editor Assistant',client,permissions,requestPermission:permissionPrompt,toolInstructions:AGENT_TOOL_INSTRUCTIONS,finalInstructions:AGENT_FINAL_INSTRUCTIONS,beforeTool:async payload=>(await editorExtensionHooks('ai.beforeTool',payload))||payload,afterTool:async payload=>(await editorExtensionHooks('ai.afterTool',payload))||payload});
    agent.registerTools(toolset.list());
    let currentConversation=null;
    async function activateModel(id){
      const target=registry.settings.models.find(x=>x.id===id);
      if(!target)throw new Error('AI model not found.');
      const previous=registry.active();
      registry.setActive(target.id);
      render(currentGroup,currentTab);
      try{
        if(target.local||target.protocol==='local-transformers'){
          if(!localManager.isLoaded(target.id))await localManager.load(target);
        }else if(localManager.isLoaded()){
          await localManager.unload();
        }
      }catch(e){
        if(previous?.id&&previous.id!==target.id){
          try{registry.setActive(previous.id);}catch(_){}
          render(currentGroup,currentTab);
        }
        throw e;
      }
      render(currentGroup,currentTab);
      return target;
    }
    function updateLocalStatusUI(info){
      const tree=currentTab?._viewElement;
      if(!tree)return;
      const model=registry.active(),local=!!model?.local||model?.protocol==='local-transformers';
      const label=tree.querySelector('.ai-model-label');if(label)label.textContent=makeModelLabel(model,registry,localManager);
      const loaded=local&&localManager.isLoaded(model.id);
      const status=tree.querySelector('[data-local-status]'),text=tree.querySelector('[data-local-status-text]'),bar=tree.querySelector('[data-local-status-progress]'),button=tree.querySelector('[data-local-load]'),input=tree.querySelector('[data-input]'),send=tree.querySelector('[data-send]');
      if(status){status.hidden=!local||(!info?.loading&&!loaded);}
      if(text)text.textContent=info?.loading?(info.text||'Loading local model…'):(loaded?(info?.text||'Local model ready.'):'Local model is not loaded.');
      if(bar)bar.style.width=(info?.loading?Math.max(0,Math.min(100,Number(info.progress)||0)):loaded?100:0)+'%';
      if(button){button.disabled=!!info?.loading;button.textContent=info?.loading?'Loading…':loaded?'Loaded':'Load model';}
      const needsLoad=local&&!loaded;
      if(input){input.disabled=needsLoad||busy;input.placeholder=needsLoad?'Load the local model first…':'Ask anything about your project…';}
      if(send)send.disabled=needsLoad||busy||!input?.value?.trim();
    }
    localManager.subscribe(updateLocalStatusUI);
    function syncChats() {
      const pid=state.projectId || 'global';
      if (loadedProjectId===pid && currentChatId) return;
      loadedProjectId=pid;
      chatStore.ensureLoaded();
      const recent=chatStore.list(false);
      if (!currentChatId || !recent.some(x=>x.id===currentChatId)) currentChatId=recent[0]?.id || chatStore.create().id;
      const chat=chatStore.get(currentChatId);
      chatMessages=chat.messages;
      currentConversation=chatAI.openConversation({id:currentChatId,messages:chatMessages,modelId:registry.active()?.id,agentId:chat.agentId||null});
    }
    function currentChat() { syncChats(); return chatStore.get(currentChatId); }
    function activeMessages() { return (currentConversation?.getMessages?.() || chatMessages).map(m=>({role:m.role,content:m.content})); }
    function persist() {
      const chat=currentChat();chat.messages=chatMessages;currentConversation?.setMessages?.(chatMessages);
      const attached=currentConversation?.getAgent?.();if(attached)chat.agentId=attached.id;else delete chat.agentId;
      chatStore.touch(chat.id);
    }
    function beginEdit(index) {
      if (busy || !Number.isInteger(index) || chatMessages[index]?.role !== 'user') return;
      const view=getAIView(); if (!view) return;
      const input=view.t?._viewElement?.querySelector?.('[data-input]') || view.g?.viewBody?.querySelector?.('[data-input]');
      if (!input) return;
      editingIndex=index;
      input.value=chatMessages[index].content;
      input.focus();
      input.setSelectionRange(input.value.length,input.value.length);
      const send=view.t?._viewElement?.querySelector?.('[data-send]');
      if (send) send.textContent='Resend';
    }
    function cancelEdit() { editingIndex=-1; }
    function resendMessage(index,text,g,t,tree) {
      if (!Number.isInteger(index) || chatMessages[index]?.role !== 'user') return;
      chatMessages=chatMessages.slice(0,index);
      editingIndex=-1;
      persist();
      sendMessage(text,g,t,tree);
    }
    function getAIView() {
      let t=currentTab;
      if (!t || t.kind !== 'builtin' || t.builtin !== 'ai') return null;
      let g=t.group?.ownerWorkbench?.groups?.get(t.group.id) || null;
      if (!g || !g.tabs.includes(t)) {
        for (const instance of Workbench.getInstances?.() || [state.workbench]) for (const gg of instance.groups.values()) {
          const found=gg.tabs.find(x=>x===t || (x.id===t.id && x.kind==='builtin' && x.builtin==='ai'));
          if (found) { t=found; g=gg; break; }
        }
      }
      if (!g || !g.tabs.includes(t)) return null;
      return {g,t};
    }
    function addMessage(chat,role,text,index,message){const row=document.createElement('div');row.className='ai-message '+(role==='user'?'ai-user':'ai-assistant');if(role==='assistant'&&message?.activity?.length){const activity=renderActivity(chat,message.activity,false);row.appendChild(activity);}const bubble=document.createElement('div');bubble.className='ai-bubble';if(role==='user')bubble.textContent=text;else renderMessage(bubble,text,code=>insertCode(code));row.appendChild(bubble);if(role==='user'&&Number.isInteger(index)){const edit=document.createElement('button');edit.className='ai-edit-message';edit.textContent='✎';edit.title='Edit and resend';edit.setAttribute('aria-label','Edit and resend prompt');edit.disabled=busy;edit.onclick=()=>beginEdit(index);row.appendChild(edit);}chat.appendChild(row);return bubble;}
    async function insertCode(code){
      const tab=activeEditor(state); if(!tab){alert('Open a text file to insert this snippet.');return;} if(!tab.editor){onOpen?.(tab.path);setTimeout(()=>insertCode(code),150);return;}
      const tool=toolset.map.get('insert_code'); if(!tool)return;
      try { await (async()=>{const policy=permissions.get(tool.permission);if(policy==='never')throw new Error('Editor modification permission is disabled.');if(policy==='ask'){const d=await permissionPrompt({tool,args:{code},preview:{path:tab.path,code:code.slice(0,4000)}});if(d==='deny')return;if(d==='always')permissions.set(tool.permission,'always');}await tool.execute({code});})(); } catch(e){alert(e?.message||String(e));}
    }
    function systemPrompt(forAgent=false) {
      const context=aiRoot.buildContext(state,{maxFileChars:20000});
      const toolNames=toolset.list().map(x=>x.name).join(', ');
      const prefs=aiRoot.getAIPreferences?.()||{};
      const custom=String(prefs.customInstructions||'').trim();
      const agentExtra=forAgent?String(prefs.agentInstructions||'').trim():'';
      return [SYSTEM,custom?`User instructions:\n${custom}`:'',agentExtra?`Agent instructions:\n${agentExtra}`:'',`Current project context:\n${context}\n\nAvailable tools: ${toolNames}. Use tools rather than guessing file contents. Do not claim a change was made unless the tool succeeded.`].filter(Boolean).join('\n\n');
    }
    function chatManageModal() {
      const modal=document.createElement('div'); modal.className='editor-modal ai-chat-manage-modal';
      const render=()=>{
        const chats=chatStore.list(false);
        modal.innerHTML=`<div class="editor-modal-content ai-chat-manage-content"><button class="editor-modal-close" aria-label="Close">×</button><h2>Chats</h2><p>Your conversations are saved in <code>.editor/chats/</code> inside this project.</p><div class="ai-chat-list">${chats.map(c=>`<div class="ai-chat-row ${c.id===currentChatId?'active':''}"><div class="ai-chat-main"><strong>${escapeHtml(c.title)}</strong><span>${c.messageCount} messages · ${new Date(c.updatedAt||c.createdAt).toLocaleString()}</span></div><button data-open="${escapeHtml(c.id)}">Open</button><button data-rename="${escapeHtml(c.id)}">Rename</button>${chats.length>1?`<button data-delete="${escapeHtml(c.id)}">Delete</button>`:''}</div>`).join('')}</div><button data-new-chat class="ai-settings-add">+ New chat</button></div>`;
        modal.querySelector('.editor-modal-close').onclick=()=>modal.remove();
        modal.onclick=e=>{if(e.target===modal)modal.remove();};
        modal.querySelector('[data-new-chat]').onclick=()=>{newChat();modal.remove();};
        modal.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{switchChat(b.dataset.open);modal.remove();});
        modal.querySelectorAll('[data-rename]').forEach(b=>b.onclick=()=>{const chat=chatStore.get(b.dataset.rename);const title=prompt('Chat name:',chat.title);if(title!=null){chatStore.rename(chat.id,title);render();}});
        modal.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{if(!confirm('Delete this chat?'))return;const id=b.dataset.delete;if(id===currentChatId){const ordered=chatStore.list(false).filter(x=>x.id!==id);chatStore.remove(id);currentChatId=ordered[0]?.id||chatStore.create().id;chatMessages=chatStore.get(currentChatId).messages;currentConversation=chatAI.openConversation({id:currentChatId,messages:chatMessages,modelId:registry.active()?.id,agentId:chatStore.get(currentChatId)?.agentId||null});loadedProjectId=state.projectId||'global';}else chatStore.remove(id);render();});
      };
      document.body.appendChild(modal);render();requestAnimationFrame(()=>modal.classList.add('show'));
    }
    function switchChat(id) {
      if (busy || !id || id===currentChatId) return;
      const view=getAIView(); if (!view) return;
      persist();
      currentChatId=id;
      chatMessages=chatStore.get(id).messages;
      currentConversation=chatAI.openConversation({id,messages:chatMessages,modelId:registry.active()?.id,agentId:chatStore.get(id)?.agentId||null});
      render(view.g,view.t);
    }
    function newChat() {
      if (busy) return;
      const view=getAIView(); if (!view) return;
      persist();
      const chat=chatStore.create();
      currentChatId=chat.id;
      chatMessages=chat.messages;
      currentConversation=chatAI.openConversation({id:currentChatId,messages:chatMessages,modelId:registry.active()?.id,agentId:chatStore.get(currentChatId)?.agentId||null});
      render(view.g,view.t);
    }
    function renameCurrent() {
      const view=getAIView(); if (!view) return;
      const chat=currentChat();
      const title=prompt('Chat name:',chat.title);
      if(title!=null){chatStore.rename(chat.id,title);render(view.g,view.t);}
    }
    function render(g, t) {
      currentGroup = g || currentGroup || state.workbench?.getFirstLeaf?.();
      currentTab = t || currentTab || currentGroup?.tabs?.find(x => x.builtin === 'ai');
      if (!currentGroup || !currentTab) return;
      syncChats();
      let tree = currentTab._viewElement;
      if (!tree || tree.parentNode !== currentGroup.viewBody) {
        tree = document.createElement('div');
        tree.className = 'builtin-ai';
        currentTab._viewElement = tree;
        currentGroup.viewBody.appendChild(tree);
      }
      tree.style.display = '';
      const model=registry.active(); const localModel=!!model?.local||model?.protocol==='local-transformers'; const localLoaded=!localModel||localManager.isLoaded(model.id); const chats=chatStore.list(true); const current=currentChat();
      if(!model.supportsTools&&!model.supportsAgentTools&&currentConversation?.getAgent?.()){currentConversation.removeAgent();delete current.agentId;persist();}
      const agentMode=!!currentConversation?.getAgent?.();
      tree.innerHTML=`<div class="ai-panel-inner"><div class="ai-header"><div class="ai-header-left"><strong>AI Chat</strong><span class="ai-model-label">${escapeHtml(makeModelLabel(model,registry,localManager))}</span></div><div class="ai-header-right"><select class="ai-chat-select" data-chat-select ${busy?'disabled':''} title="Recent chats">${chats.map(c=>`<option value="${escapeHtml(c.id)}" ${c.id===currentChatId?'selected':''}>${escapeHtml(c.title)}</option>`).join('')}${!chats.length?'<option>No chats</option>':''}</select><div class="ai-head-actions"><button data-chat-manage ${busy?'disabled':''} title="Manage chats" aria-label="Manage chats">☰</button><button data-new ${busy?'disabled':''} title="New chat" aria-label="New chat">＋</button><button data-settings title="AI Settings" aria-label="AI Settings">⚙</button></div><div class="ai-local-head-action">${localModel&&!localLoaded?'<button data-local-load>Load model</button>':''}</div></div></div><div class="ai-chat" data-chat>${chatMessages.length ? '' : '<div class="ai-chat-disclaimer">Chats are saved inside this project. If this project is published or pushed to Git, saved chats may be visible to others.</div>'}</div><div class="ai-request-status" data-status ${busy?'':'hidden'}>${busy?'Working…':''}</div><div class="ai-local-status" data-local-status hidden><div data-local-status-text></div><div class="ai-local-progress"><span data-local-status-progress></span></div></div><div class="ai-compose"><textarea data-input placeholder="Ask anything about your project…" rows="3"></textarea><div class="ai-compose-bar"><label class="ai-agent-toggle"><input data-agent type="checkbox" ${agentMode?'checked':''} ${model.supportsTools||model.supportsAgentTools?'':'disabled'}> Agent mode${model.supportsTools||model.supportsAgentTools?'':' (not supported by this model)'}</label><label class="ai-agent-steps">Steps <input data-agent-steps type="number" min="1" max="100" step="1" value="${Math.max(1,Math.min(100,Number(agent.maxSteps)||24))}" ${model.supportsTools||model.supportsAgentTools?'':'disabled'}></label><button data-stop ${busy?'':'disabled'}>Stop</button><button class="primary" data-send ${busy?'disabled':''}>Send</button></div></div></div>`;
      const chat=tree.querySelector('[data-chat]');
      for(let i=0;i<chatMessages.length;i++){const m=chatMessages[i];addMessage(chat,m.role,m.content,i,m);}
      tree.querySelector('[data-agent]').onchange=e=>{if(e.target.checked)currentConversation?.setAgent(agent);else currentConversation?.removeAgent();persist();};
      const stepsInput=tree.querySelector('[data-agent-steps]');
      stepsInput.onchange=()=>{const n=Math.max(1,Math.min(100,Math.floor(Number(stepsInput.value)||24)));agent.maxSteps=n;stepsInput.value=n;};
      tree.querySelector('[data-settings]').onclick=()=>settingsModal(registry,permissions,()=>{persist();render(g,t);},state.browserNetwork||window.__sharedBrowserNetwork,localManager,activateModel);
      tree.querySelector('[data-chat-select]').onchange=e=>switchChat(e.target.value);
      tree.querySelector('[data-chat-manage]').onclick=()=>chatManageModal();
      tree.querySelector('[data-local-load]')?.addEventListener('click',async()=>{try{await activateModel(model.id);render(g,t);}catch(e){alert(e?.message||String(e));updateLocalStatusUI(localManager.status());}});
      updateLocalStatusUI(localManager.status());
      tree.querySelector('[data-new]').onclick=()=>newChat();
      tree.querySelector('[data-stop]').onclick=()=>{controller?.abort();chatAI.cancel();busy=false;render(g,t);};
      const input=tree.querySelector('[data-input]'); const send=tree.querySelector('[data-send]');
      const submit=async()=>{const text=input.value.trim();if(!text||busy)return;if(editingIndex>=0){const index=editingIndex;input.value='';resendMessage(index,text,g,t,tree);}else{input.value='';await sendMessage(text,g,t,tree);}};
      send.textContent=editingIndex>=0?'Resend':'Send';
      const updateSendState=()=>{const active=registry.active();send.disabled=!input.value.trim()||busy||!!((active?.local||active?.protocol==='local-transformers')&&!localManager.isLoaded(active.id));};
      input.addEventListener('input',updateSendState);
      send.onclick=submit; input.addEventListener('keydown',e=>{if(e.key==='Enter' && !e.shiftKey){e.preventDefault();submit();}});
      updateSendState();
      if(editingIndex>=0){const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.title='Cancel prompt editing';cancel.onclick=()=>{cancelEdit();render(g,t);};send.parentNode.insertBefore(cancel,send);}
      if(chatMessages.length)chat.scrollTop=chat.scrollHeight;
    }
    async function sendMessage(text,g,t,tree){
      if(!g?.viewBody || !t) return;
      const chatRecord=currentChat();
      busy=true; controller=new AbortController();
      currentConversation=currentConversation||chatAI.openConversation({id:chatRecord.id,messages:chatMessages,modelId:registry.active()?.id,agentId:chatRecord.agentId||null});
      currentConversation.modelId=registry.active()?.id||null;
      currentConversation.setMessages(chatMessages);
      if(chatRecord.title==='New Chat') chatStore.rename(chatRecord.id,chatTitle(text));
      persist();
      render(g,t);
      await new Promise(resolve => requestAnimationFrame(resolve));
      tree=t._viewElement || tree;
      const chat=tree.querySelector('[data-chat]');
      if(!chat) { busy=false; controller=null; return; }
      const setStatus=text=>{const el=tree.querySelector('[data-status]');if(!el)return;el.replaceChildren(document.createTextNode(text||''));el.hidden=!text;};
      // Show the user's prompt immediately. ConversationAI.send() records the same
      // message in history below; the final render rebuilds the transcript from that history.
      addMessage(chat,'user',text);
      chat.scrollTop=chat.scrollHeight;
      const activeAgent=currentConversation?.getAgent?.()||null;
      const prefs=aiRoot.getAIPreferences?.()||{}; const liveActivity=activeAgent&&prefs.showActivity!==false?beginActivity(chat,true):null;
      const bubble=addMessage(chat,'assistant',''); if(liveActivity && bubble.parentNode?.parentNode===chat) chat.insertBefore(liveActivity.host,bubble.parentNode); let partial='';
      try {
        if(activeAgent){
          const emitAgentEvent=event=>{
            if(event.type==='assistant_delta'){partial=event.text??(partial+String(event.delta||''));renderMessage(bubble,partial,code=>insertCode(code));chat.scrollTop=chat.scrollHeight;}
            else if(event.type==='assistant'){partial=event.text??partial;renderMessage(bubble,partial,code=>insertCode(code));chat.scrollTop=chat.scrollHeight;}
            else if(event.type==='assistant_activity'){appendActivity(liveActivity,{kind:'assistant',text:event.text});}
            else if(event.type==='tool_call'){appendActivity(liveActivity,{kind:'tool_call',name:event.name,args:event.args});}
            else if(event.type==='tool_result'){appendActivity(liveActivity,{kind:'tool_result',name:event.name,args:event.args,result:event.result,ok:event.ok});}
            else if(event.type==='step'){appendActivity(liveActivity,{kind:'step',text:`Step ${event.step}/${event.maxSteps}`});tree.querySelector('[data-status]')?.replaceChildren(document.createTextNode(`Step ${event.step}/${event.maxSteps}`));}
            else if(event.type==='retry'){appendActivity(liveActivity,{kind:'retry',text:`Rate limited — retrying in ${Math.ceil(event.waitMs/1000)}s (attempt ${event.attempt}/${event.maxRetries})`});} else if(event.type==='request_retry' || event.type==='transport_retry'){appendActivity(liveActivity,{kind:'transport_retry',text:`Network request failed — retrying in ${Math.ceil((event.waitMs||0)/1000)}s (attempt ${event.attempt}/${event.maxRetries})`});} else if(event.type==='request_response'){appendActivity(liveActivity,{kind:'request_response',text:`HTTP ${event.status}${event.ok?'':' · error'}`});}
            else if(event.type==='provider_retry'){appendActivity(liveActivity,{kind:'retry',text:event.text||`Retrying ${event.model||''}`.trim()});}
            else if(event.type==='request_start'){appendActivity(liveActivity,{kind:'request_start',text:`Requesting ${event.model} (${event.protocol})…`});}
            else if(event.type==='reasoning_summary'){appendActivity(liveActivity,{kind:'reasoning_summary',text:event.text});} else if(event.type==='reasoning'){appendActivity(liveActivity,{kind:'reasoning',text:event.text||'Model reasoning is active.'});}
          };
          const prompt=systemPrompt(true);
          let hookInput={messages:[...activeMessages(),{role:'user',content:text}],agentMode:true,projectId:state.projectId||null,projectName:state.projectName||'Workspace'};
          const response=await currentConversation.send(text,{
            systemPrompt:prompt,maxTokens:2048,retryTransport:prefs.retryTransport,maxTransportRetries:prefs.maxTransportRetries,
            transportRetryDelay:prefs.transportRetryDelay,signal:controller.signal,emit:emitAgentEvent,
            prepareMessages:async messages=>{
              hookInput={...hookInput,messages:[...messages]};
              const prepared=await editorExtensionHooks('ai.beforeRun',hookInput);
              return [{role:'system',content:prompt},...(prepared?.messages||messages.filter(message=>message.role!=='system'))];
            },
            onRetry:info=>emitAgentEvent({type:info?.kind==='tool_parse_recovery'?'provider_retry':info?.kind==='transport_retry'?'transport_retry':'retry',...info})
          });
          await editorExtensionHooks('ai.afterRun',{...hookInput,result:response.result});
          partial=response.text||partial;renderMessage(bubble,partial,code=>insertCode(code));
          if(response.message)response.message.activity=liveActivity?.items||[];
          if(liveActivity)liveActivity.details.open=false;
        } else {
          // Unlike the agent path, plain chat streams directly from the provider.
          // Record the prompt in the conversation before building the request so
          // the final render cannot discard the temporary user bubble.
          currentConversation.addMessage({role:'user',content:text});
          chatMessages=currentConversation.getMessages();
          const messages=[{role:'system',content:systemPrompt(false)},...activeMessages()];
          const model=chatAI.getModel();
          for await(const chunk of chatAI.stream(messages,{modelId:model?.id,thinking:true,maxTokens:2048,temperature:.7,topP:.9,signal:controller.signal,systemPrompt:systemPrompt(false),onRetry:info=>setStatus(info?.kind==='tool_parse_recovery' ? (info.text||'Retrying tool-call generation…') : info?.kind==='transport_retry' ? `Network retry in ${Math.ceil((info.waitMs||0)/1000)}s (attempt ${info.attempt}/${info.maxRetries})` : `Rate limited — retrying in ${Math.ceil(info.waitMs/1000)}s (attempt ${info.attempt}/${info.maxRetries})`)})){
            partial=chunk.text??partial;
            renderMessage(bubble,partial,code=>insertCode(code));
            chat.scrollTop=chat.scrollHeight;
          }
          currentConversation.addMessage({role:'assistant',content:partial});
          chatMessages=currentConversation.getMessages();
        }
        persist();
      } catch(e) {
        if(e?.name!=='AbortError') { partial=`**Error:** ${e?.message||String(e)}`; renderMessage(bubble,partial); if(liveActivity) appendActivity(liveActivity,{kind:'error',text:e?.message||String(e)}); const activityData=liveActivity?.items||[]; chatMessages.push({role:'assistant',content:partial,activity:activityData}); if(liveActivity) liveActivity.details.open=false; persist(); }
      } finally {
        // Keep the editor's persisted transcript aligned with ConversationAI, which
        // owns insertion of both the user and assistant messages.
        if(currentConversation?.getMessages)chatMessages=currentConversation.getMessages();
        persist();
        busy=false; controller=null; render(g,t);
      }
    }
    function activityValue(value,maxChars=20000){let text;try{text=JSON.stringify(value,null,2);}catch(_){text=String(value);}text=String(text??'');return text.length<=maxChars?text:text.slice(0,maxChars)+`\n… [truncated ${text.length-maxChars} characters]`;}
    function activitySummary(items){const list=items||[];const steps=list.filter(x=>x?.kind==='step').length;const tools=list.filter(x=>x?.kind==='tool_call').length;const retries=list.filter(x=>['retry','transport_retry','provider_retry'].includes(x?.kind)).length;const parts=['Agent activity'];if(steps)parts.push(`${steps} step${steps===1?'':'s'}`);if(tools)parts.push(`${tools} tool${tools===1?'':'s'}`);if(retries)parts.push(`${retries} retr${retries===1?'y':'ies'}`);return parts.join(' · ');}
    function renderActivity(chat,items,open){
      const details=document.createElement('details'); details.className='ai-activity'; details.open=!!open;
      const summary=document.createElement('summary'); summary.textContent=activitySummary(items); details.appendChild(summary);
      const body=document.createElement('div'); body.className='ai-activity-body'; details.appendChild(body);
      const activity={body,items:items||[],details}; for(const item of [...(items||[])]) appendActivity(activity,item,false); summary.textContent=activitySummary(activity.items);
      return details;
    }
    function beginActivity(chat,open){
      const details=renderActivity(chat,[],open); const body=details.querySelector('.ai-activity-body');
      chat.appendChild(details); return {details,body,host:details,items:[]};
    }
    function appendActivity(activity,item,record=true){
      if(!activity?.body)return;
      if(record && activity.items)activity.items.push(item);
      const row=document.createElement('div'); row.className='ai-activity-row';
      if(typeof item==='string'){row.textContent=item;}
      else if(item.kind==='assistant'){row.innerHTML=`<strong>Assistant</strong><div class="ai-activity-assistant">${sanitizeHtml(markdown(item.text||''))}</div>`;}
      else if(item.kind==='tool_call'){row.innerHTML=`<strong>Tool call: ${escapeHtml(item.name)}</strong><pre>${escapeHtml(activityValue(item.args||{}))}</pre>`;}
      else if(item.kind==='tool_result'){const suffix=Number.isFinite(Number(item.durationMs))?` · ${Math.max(0,Math.round(item.durationMs))} ms`:'';row.innerHTML=`<strong>${item.ok?'Tool result':'Tool error'}: ${escapeHtml(item.name)}${suffix}</strong><pre>${escapeHtml(activityValue(item.result))}</pre>`;}
      else if(item.kind==='step'){row.innerHTML=`<strong>Agent step</strong><span>${escapeHtml(String(item.text||''))}</span>`;}
      else if(item.kind==='request_start'){row.innerHTML=`<strong>Model request</strong><span>${escapeHtml(String(item.text||''))}</span>`;}
      else if(item.kind==='request_response'){row.innerHTML=`<strong>HTTP response</strong><span>${escapeHtml(String(item.text||''))}</span>`;}
      else if(item.kind==='reasoning_summary'){row.innerHTML=`<strong>Reasoning summary</strong><pre>${escapeHtml(String(item.text||''))}</pre>`;}
      else if(item.kind==='reasoning'){row.innerHTML=`<strong>Reasoning</strong><pre>${escapeHtml(String(item.text||''))}</pre>`;}
      else if(item.kind==='error'){row.innerHTML=`<strong>Error</strong><pre>${escapeHtml(String(item.text||''))}</pre>`;}
      else {row.innerHTML=`<strong>${escapeHtml(item.kind||'Activity')}</strong><span>${escapeHtml(String(item.text||''))}</span>`;}
      activity.body.appendChild(row);
      if(activity.details){const summary=activity.details.querySelector('summary');if(summary)summary.textContent=activitySummary(activity.items);activity.details.scrollIntoView?.({block:'nearest'});}
    }
    return {
      title:'AI',
      icon:'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3.8c-4.1 0-7.4 2.3-7.4 6.8 0 2.1 1 3.5 2.5 4.6-.2 1.9-1 3.2-2 4.7 2.1-.2 4.1-1 5.7-2.3.4.1.8.1 1.2.1 4.7 0 7.4-2.8 7.4-7.1 0-4.5-3.3-6.8-7.4-6.8Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8.8 10.5h6.4M12 7.3v6.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      render(g,t){ render(g,t); },
      openSettings:()=>settingsModal(registry,permissions,()=>{persist();render(currentGroup);},state.browserNetwork||window.__sharedBrowserNetwork),
      registry,
      permissions,
      chatAI,
      getHistory:()=>chatMessages,
      getChats:()=>chatStore.list(false),
      newChat,
      manageChats:chatManageModal,
      renameChat:renameCurrent
    };
  };


})();
