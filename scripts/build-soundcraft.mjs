#!/usr/bin/env node
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(root, "editor/previews/vendor/soundcraft-src");
const appRoot = resolve(sourceRoot, "apps/soundcraft-web");
const outputRoot = resolve(root, "editor/previews/vendor/soundcraft");
const bridgePath = resolve(root, "editor/previews/soundcraft-bridge.js");
const markerPath = resolve(outputRoot, ".wk-soundcraft-build.json");
const outputIndexPath = resolve(outputRoot, "index.html");

function run(command, args, cwd, env) {
  return new Promise((ok, no) => {
    const child = spawn(command, args, {cwd, env, stdio:"inherit", shell:process.platform === "win32"});
    child.once("error", no);
    child.once("exit", code => code === 0 ? ok() : no(Error(command + " " + args.join(" ") + " exited with status " + code)));
  });
}
function available(command, env) {
  return spawnSync(command, ["--version"], {env, stdio:"ignore"}).status === 0;
}
async function capture(command, args, cwd, env) {
  return new Promise((ok, no) => {
    const child = spawn(command, args, {cwd, env, stdio:["ignore","pipe","inherit"], shell:process.platform === "win32"});
    let output = "";
    child.stdout.on("data", chunk => output += chunk);
    child.once("error", no);
    child.once("exit", code => code === 0 ? ok(output.trim()) : no(Error(command + " " + args.join(" ") + " exited with status " + code)));
  });
}
async function setup(env) {
  if (!available("rustup", env)) {
    await run("sh", ["-c", "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal"], sourceRoot, env);
  }
  await run("rustup", ["toolchain", "install", "stable", "--profile", "minimal"], sourceRoot, env);
  const version = await capture("rustc", ["+stable", "--version"], sourceRoot, env);
  const parsed = version.match(/rustc (\d+)\.(\d+)/);
  if (!parsed || Number(parsed[1]) < 1 || (Number(parsed[1]) === 1 && Number(parsed[2]) < 95)) {
    throw new Error("SoundCraft's browser UI requires Rust 1.95 or newer; found " + version + ".");
  }
  await run("rustup", ["target", "add", "wasm32-unknown-unknown", "--toolchain", "stable"], sourceRoot, env);
  if (!available("trunk", env)) await run("cargo", ["+stable", "install", "trunk", "--locked"], sourceRoot, env);
}
async function sourceRevision() {
  return capture("git", ["rev-parse", "HEAD"], sourceRoot, process.env);
}
async function stageBridge(hash) {
  await writeFile(resolve(outputRoot, "wk-soundcraft-bridge.js"), await readFile(bridgePath, "utf8"));
  const html = await readFile(outputIndexPath, "utf8");
  const tag = '<script src="./wk-soundcraft-bridge.js?v=' + hash.slice(0,12) + '"></script>';
  const existing = /<script\b[^>]*src=["'][^"']*wk-soundcraft-bridge\.js[^"']*["'][^>]*>\s*<\/script>/i;
  if (existing.test(html)) await writeFile(outputIndexPath, html.replace(existing, tag));
  else {
    const head = html.toLowerCase().lastIndexOf("</head>");
    if (head < 0) throw new Error("Built SoundCraft HTML has no closing head tag.");
    await writeFile(outputIndexPath, html.slice(0, head) + tag + html.slice(head));
  }
}
async function main() {
  if (!existsSync(resolve(sourceRoot, "Cargo.toml")) || !existsSync(resolve(appRoot, "Trunk.toml"))) {
    throw new Error("SoundCraft source submodule is missing; initialize recursive submodules.");
  }
  const config = await readFile(resolve(appRoot, "Trunk.toml"), "utf8");
  if (!/^public_url\s*=\s*["']\.\/["']\s*$/m.test(config)) throw new Error('SoundCraft Trunk.toml must use public_url = "./".');

  const revision = await sourceRevision();
  const bridge = await readFile(bridgePath, "utf8");
  const bridgeHash = createHash("sha256").update(bridge).digest("hex");
  if (existsSync(markerPath) && existsSync(outputIndexPath)) {
    try {
      const marker = JSON.parse(await readFile(markerPath, "utf8"));
      if (marker.sourceRevision === revision && marker.publicUrl === "./") {
        if (marker.bridgeHash !== bridgeHash || !existsSync(resolve(outputRoot, "wk-soundcraft-bridge.js"))) {
          await stageBridge(bridgeHash);
          marker.bridgeHash = bridgeHash;
          marker.builtAt = new Date().toISOString();
          await writeFile(markerPath, JSON.stringify(marker, null, 2) + "\n");
          console.log("[SoundCraft] Refreshed optional workspace bridge.");
        } else console.log("[SoundCraft] Standalone build is already current.");
        return;
      }
    } catch (error) {
      console.warn("[SoundCraft] Rebuilding existing output:", error.message || error);
    }
  }

  const env = {
    ...process.env,
    PATH: [join(homedir(), ".cargo", "bin"), process.env.PATH || ""].filter(Boolean).join(delimiter),
    RUSTUP_TOOLCHAIN: "stable"
  };
  const sourceIndex = resolve(appRoot, "index.html");
  const original = await readFile(sourceIndex, "utf8");
  const patched = original.replace(/\sdata-wasm-opt=["']z["']/, "");
  if (patched === original) throw new Error('Could not remove the optional wasm-opt="z" Trunk attribute.');
  try {
    await writeFile(sourceIndex, patched);
    await setup(env);
    console.log("[SoundCraft] Building WebAssembly output with relative asset URLs...");
    await run("trunk", ["build", "--release"], appRoot, env);
    const dist = resolve(sourceRoot, "dist/web");
    if (!existsSync(resolve(dist, "index.html"))) throw new Error("Trunk output is missing index.html.");
    await rm(outputRoot, {recursive:true, force:true});
    await mkdir(dirname(outputRoot), {recursive:true});
    await cp(dist, outputRoot, {recursive:true});
    await stageBridge(bridgeHash);
    await writeFile(markerPath, JSON.stringify({
      sourceRevision: revision,
      publicUrl: "./",
      bridgeHash,
      builtAt: new Date().toISOString()
    }, null, 2) + "\n");
    console.log("[SoundCraft] Standalone page ready: " + outputIndexPath);
  } finally {
    await writeFile(sourceIndex, original);
  }
}
main().catch(error => {
  console.error("[SoundCraft]", error);
  process.exitCode = 1;
});
