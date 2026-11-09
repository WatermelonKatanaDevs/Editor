#!/usr/bin/env node
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(root, "editor/previews/vendor/filmcraft-src");
const outputRoot = resolve(root, "editor/previews/vendor/filmcraft");
const distRoot = resolve(sourceRoot, "target/web/dist");
const markerPath = resolve(outputRoot, ".wk-filmcraft-build.json");
const indexPath = resolve(outputRoot, "index.html");
const WASM_BINDGEN_VERSION = "0.2.129";

function makeEnv() {
  return {
    ...process.env,
    PATH: [join(homedir(), ".cargo", "bin"), process.env.PATH || ""].filter(Boolean).join(delimiter),
    RUSTUP_TOOLCHAIN: "stable",
    CARGO_TARGET_DIR: resolve(sourceRoot, "target"),
    CARGO_BUILD_JOBS: process.env.CARGO_BUILD_JOBS || "4"
  };
}
function run(command, args, cwd, env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd, env, stdio: "inherit", shell: process.platform === "win32" });
    child.once("error", rejectRun);
    child.once("exit", code => code === 0
      ? resolveRun()
      : rejectRun(new Error(command + " " + args.join(" ") + " exited with status " + code)));
  });
}
function available(command, args, env) {
  return spawnSync(command, args, { env, stdio: "ignore" }).status === 0;
}
function capture(command, args, cwd, env) {
  return new Promise((resolveCapture, rejectCapture) => {
    const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "inherit"], shell: process.platform === "win32" });
    let output = "";
    child.stdout.on("data", chunk => output += chunk);
    child.once("error", rejectCapture);
    child.once("exit", code => code === 0
      ? resolveCapture(output.trim())
      : rejectCapture(new Error(command + " " + args.join(" ") + " exited with status " + code)));
  });
}
async function setupToolchain(env) {
  if (!available("rustup", ["--version"], env)) {
    await run("sh", ["-c", "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal"], sourceRoot, env);
    env.PATH = [join(homedir(), ".cargo", "bin"), process.env.PATH || ""].filter(Boolean).join(delimiter);
  }
  await run("rustup", ["toolchain", "install", "stable", "--profile", "minimal"], sourceRoot, env);
  await run("rustup", ["target", "add", "wasm32-unknown-unknown", "--toolchain", "stable"], sourceRoot, env);
  const current = available("wasm-bindgen", ["--version"], env)
    ? await capture("wasm-bindgen", ["--version"], sourceRoot, env)
    : "";
  if (!current.includes(WASM_BINDGEN_VERSION)) {
    console.log("[FilmCraft] Installing wasm-bindgen-cli " + WASM_BINDGEN_VERSION + ".");
    await run("cargo", ["+stable", "install", "wasm-bindgen-cli", "--version", WASM_BINDGEN_VERSION, "--locked", "--force"], sourceRoot, env);
  }
}
async function main() {
  for (const path of [
    "Cargo.toml",
    "apps/filmcraft-web/Cargo.toml",
    "apps/filmcraft-web/web/index.html"
  ]) {
    if (!existsSync(resolve(sourceRoot, path))) {
      throw new Error("FilmCraft source is missing " + path + "; initialize recursive submodules.");
    }
  }
  const env = makeEnv();
  const revision = await capture("git", ["rev-parse", "HEAD"], sourceRoot, env);
  if (existsSync(markerPath) && existsSync(indexPath) &&
      existsSync(resolve(outputRoot, "filmcraft_web.js")) &&
      existsSync(resolve(outputRoot, "filmcraft_web_bg.wasm"))) {
    try {
      const marker = JSON.parse(await readFile(markerPath, "utf8"));
      if (marker.sourceRevision === revision) {
        console.log("[FilmCraft] Standalone build is already current.");
        return;
      }
    } catch (_) {}
  }

  await setupToolchain(env);
  console.log("[FilmCraft] Building the WebAssembly app with cargo xtask web...");
  await run("cargo", ["xtask", "web"], sourceRoot, env);
  const required = ["index.html", "filmcraft_web.js", "filmcraft_web_bg.wasm", "audio-worklet.js"];
  for (const name of required) {
    if (!existsSync(resolve(distRoot, name))) throw new Error("FilmCraft web build is missing " + name + ".");
  }
  const html = await readFile(resolve(distRoot, "index.html"), "utf8");
  if (/(?:src|href)=["']\/(?!\/)/i.test(html)) {
    throw new Error("FilmCraft web output contains root-absolute asset URLs and will not work under the Editor path.");
  }
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(dirname(outputRoot), { recursive: true });
  await cp(distRoot, outputRoot, { recursive: true });
  await writeFile(markerPath, JSON.stringify({
    sourceRevision: revision,
    publicUrl: "./",
    builtAt: new Date().toISOString()
  }, null, 2) + "\n");
  console.log("[FilmCraft] Standalone page ready: " + indexPath);
}
main().catch(error => {
  console.error("[FilmCraft]", error);
  process.exitCode = 1;
});
