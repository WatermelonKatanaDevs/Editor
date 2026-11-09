#!/usr/bin/env node
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const sourceRoot=resolve(root,"editor/previews/vendor/photocraft-src");
const appRoot=resolve(sourceRoot,"apps/photocraft-web");
const outputRoot=resolve(root,"editor/previews/vendor/photocraft");
const bridgePath=resolve(root,"editor/previews/photocraft-bridge.js");
const markerPath=resolve(outputRoot,".wk-photocraft-build.json");
const outputIndexPath=resolve(outputRoot,"index.html");

function run(command,args,cwd,env){return new Promise((ok,no)=>{const p=spawn(command,args,{cwd,env,stdio:"inherit",shell:process.platform==="win32"});p.once("error",no);p.once("exit",n=>n===0?ok():no(Error(command+" "+args.join(" ")+" exited with status "+n)))})}
function available(command,env){return spawnSync(command,["--version"],{env,stdio:"ignore"}).status===0}
async function setup(env){
  if(!available("rustup",env)) await run("sh",["-c","curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal"],sourceRoot,env);
  await run("rustup",["toolchain","install","stable","--profile","minimal"],sourceRoot,env);
  await run("rustup",["target","add","wasm32-unknown-unknown","--toolchain","stable"],sourceRoot,env);
  if(!available("trunk",env)) await run("cargo",["+stable","install","trunk","--locked"],sourceRoot,env);
}
async function sourceRevision(){return new Promise((ok,no)=>{const p=spawn("git",["rev-parse","HEAD"],{cwd:sourceRoot,stdio:["ignore","pipe","inherit"]});let s="";p.stdout.on("data",d=>s+=d);p.once("error",no);p.once("exit",n=>n===0?ok(s.trim()):no(Error("Cannot identify PhotoCraft source revision")))})}
async function stageBridge(hash){
  await writeFile(resolve(outputRoot,"wk-photocraft-bridge.js"),await readFile(bridgePath,"utf8"));
  const html=await readFile(outputIndexPath,"utf8");
  const tag='<script src="./wk-photocraft-bridge.js?v='+hash.slice(0,12)+'"></script>';
  const existing=/<script\b[^>]*src=["'][^"']*wk-photocraft-bridge\.js[^"']*["'][^>]*>\s*<\/script>/i;
  if(existing.test(html)) await writeFile(outputIndexPath,html.replace(existing,tag));
  else {const i=html.toLowerCase().lastIndexOf("</head>");if(i<0)throw Error("Built PhotoCraft HTML has no closing head tag");await writeFile(outputIndexPath,html.slice(0,i)+tag+html.slice(i))}
}
async function main(){
  if(!existsSync(resolve(sourceRoot,"Cargo.toml"))) throw Error("PhotoCraft source submodule is missing; initialize recursive submodules.");
  const config=await readFile(resolve(appRoot,"Trunk.toml"),"utf8");
  if(!/^public_url\s*=\s*["']\.\/["']\s*$/m.test(config)) throw Error('PhotoCraft Trunk.toml must use public_url = "./".');
  const rev=await sourceRevision(), bridge=await readFile(bridgePath,"utf8"), hash=createHash("sha256").update(bridge).digest("hex");
  if(existsSync(markerPath)&&existsSync(outputIndexPath)){
    try{
      const marker=JSON.parse(await readFile(markerPath,"utf8"));
      if(marker.sourceRevision===rev&&marker.publicUrl==="./"){
        if(marker.bridgeHash!==hash||!existsSync(resolve(outputRoot,"wk-photocraft-bridge.js"))){await stageBridge(hash);marker.bridgeHash=hash;marker.builtAt=new Date().toISOString();await writeFile(markerPath,JSON.stringify(marker,null,2)+"\n");console.log("[PhotoCraft] Refreshed optional workspace bridge.");}
        else console.log("[PhotoCraft] Standalone build is already current.");
        return;
      }
    }catch(e){console.warn("[PhotoCraft] Rebuilding existing output:",e.message||e)}
  }
  const env={...process.env,PATH:[join(homedir(),".cargo","bin"),process.env.PATH||""].filter(Boolean).join(delimiter),RUSTUP_TOOLCHAIN:"stable"};
  const sourceIndex=resolve(appRoot,"index.html"),original=await readFile(sourceIndex,"utf8");
  const patched=original.replace(' data-wasm-opt="z" data-wasm-opt-params="--converge"',"");
  if(patched===original)throw Error("Could not apply the PhotoCraft wasm-opt build adjustment.");
  try{
    await writeFile(sourceIndex,patched);await setup(env);
    console.log("[PhotoCraft] Building with relative asset URLs...");
    await run("trunk",["build","--release"],appRoot,env);
    const dist=resolve(sourceRoot,"dist/web");
    if(!existsSync(resolve(dist,"index.html")))throw Error("Trunk output is missing index.html.");
    await rm(outputRoot,{recursive:true,force:true});await mkdir(dirname(outputRoot),{recursive:true});await cp(dist,outputRoot,{recursive:true});
    await stageBridge(hash);
    await writeFile(markerPath,JSON.stringify({sourceRevision:rev,publicUrl:"./",bridgeHash:hash,builtAt:new Date().toISOString()},null,2)+"\n");
    console.log("[PhotoCraft] Standalone page ready: "+outputIndexPath);
  }finally{await writeFile(sourceIndex,original)}
}
main().catch(e=>{console.error("[PhotoCraft]",e);process.exitCode=1});
