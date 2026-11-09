#!/usr/bin/env node
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const editorRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(editorRoot, "editor/previews/vendor/opendaw-src");
const outputRoot = resolve(editorRoot, "editor/previews/vendor/opendaw");
const studioRoot = resolve(sourceRoot, "packages/app/studio");
const basePath = "/editor/editor/previews/vendor/opendaw/";
const integrationVersion = 3;
const markerPath = resolve(outputRoot, ".wk-openDAW-build.json");

function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd || sourceRoot,
      env: options.env || process.env,
      stdio: "inherit",
      shell: process.platform === "win32"
    });
    child.once("error", rejectPromise);
    child.once("exit", code => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(command + " " + args.join(" ") + " exited with status " + code));
    });
  });
}

function commandAvailable(command) {
  return spawnSync(command, ["--version"], {stdio:"ignore"}).status === 0;
}

async function installRust(env) {
  if (!commandAvailable("rustup")) {
    console.log("[openDAW] Installing rustup...");
    await run("sh", ["-c", "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal"], {
      cwd: sourceRoot,
      env
    });
  }
  await run("rustup", ["toolchain", "install", "stable", "--profile", "minimal"], {cwd:sourceRoot, env});
  await run("rustup", ["target", "add", "wasm32-unknown-unknown", "--toolchain", "stable"], {cwd:sourceRoot, env});
  await run("rustup", ["toolchain", "install", "nightly", "--profile", "minimal", "--component", "rust-src"], {cwd:sourceRoot, env});
  await run("rustup", ["target", "add", "wasm32-unknown-unknown", "--toolchain", "nightly"], {cwd:sourceRoot, env});
}

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error("Could not apply openDAW integration patch: " + label);
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error("openDAW integration patch is ambiguous: " + label);
  }
  return source.slice(0, index) + after + source.slice(index + before.length);
}

const tick = String.fromCharCode(96);
const dollar = String.fromCharCode(36);
const patches = [
  {
    path: resolve(studioRoot, "vite.config.ts"),
    label: "nested deployment base",
    before: '    const base = (command === "build" && isCI) ? ' + tick + '/' + dollar + '{envFolder}/releases/' + dollar + '{uuid}/' + tick + ' : "/"',
    after: '    const base = process.env.WK_OPENDAW_BASE_PATH || ((command === "build" && isCI) ? ' + tick + '/' + dollar + '{envFolder}/releases/' + dollar + '{uuid}/' + tick + ' : "/")'
  },
  {
    path: resolve(sourceRoot, "turbo.json"),
    label: "forward nested base through Turborepo",
    before: '    "VITE_WCLAP_ORIGIN"\n  ],',
    after: '    "VITE_WCLAP_ORIGIN",\n    "WK_OPENDAW_BASE_PATH"\n  ],'
  },
  {
    path: resolve(studioRoot, "src/boot.ts"),
    label: "nested build-info URL",
    before: 'const loadBuildInfo = async () => fetch(' + tick + '/build-info.json?v=' + dollar + '{Date.now()}' + tick + ')',
    after: "const loadBuildInfo = async () => fetch(import.meta.env.BASE_URL + 'build-info.json?v=' + Date.now())"
  },
  {
    path: resolve(sourceRoot, "packages/lib/jsx/src/routes.ts"),
    label: "nested route helper",
    before: "    // Pushes a new history entry, so the browser's back button returns to the previous path.\n    navigateTo(path: string): boolean {",
    after: '    private static toBasePath(path: string): string {\n        const base = document.querySelector("base")?.getAttribute("href") || "/"\n        if (base === "/" || path === base || path.startsWith(base)) {return path}\n        return base + path.replace(/^\\/+/, "")\n    }\n\n    // Pushes a new history entry, so the browser\'s back button returns to the previous path.\n    navigateTo(path: string): boolean {'
  },
  {
    path: resolve(sourceRoot, "packages/lib/jsx/src/routes.ts"),
    label: "prefixed pushState route",
    before: '        history.pushState(null, "", path)',
    after: '        history.pushState(null, "", RouteLocation.toBasePath(path))'
  },
  {
    path: resolve(sourceRoot, "packages/lib/jsx/src/routes.ts"),
    label: "prefixed replaceState route",
    before: '        history.replaceState(null, "", path)',
    after: '        history.replaceState(null, "", RouteLocation.toBasePath(path))'
  },
  {
    path: resolve(sourceRoot, "packages/lib/jsx/src/routes.ts"),
    label: "nested route pathname",
    before: '    get path(): string {return location.pathname}',
    after: '    get path(): string {\n        const base = document.querySelector("base")?.getAttribute("href") || "/"\n        const path = location.pathname\n        if (base !== "/" && path.startsWith(base)) {\n            const relative = path.slice(base.length)\n            return relative.length === 0 ? "/" : "/" + relative\n        }\n        return path\n    }'
  },
  {
        path: resolve(studioRoot, "src/service/ProjectProfileService.ts"),
    label: "mirror project saves to Editor workspace",
    before: "export class ProjectProfileService {",
    after: "const workspaceProjectPaths = (): Map<string, string> => {\n    const target = window as any\n    if (target.__WKOpenDAWProjectPaths instanceof Map) {return target.__WKOpenDAWProjectPaths}\n    let stored: Record<string, string> = {}\n    try {stored = JSON.parse(localStorage.getItem(\"wk-openDAW-project-paths\") || \"{}\") as Record<string, string>} catch {}\n    const paths = new Map<string, string>(Object.entries(stored))\n    target.__WKOpenDAWProjectPaths = paths\n    return paths\n}\n\nconst rememberWorkspaceProjectPath = (identity: string, path: string): void => {\n    const paths = workspaceProjectPaths()\n    paths.set(identity, path)\n    try {localStorage.setItem(\"wk-openDAW-project-paths\", JSON.stringify(Object.fromEntries(paths)))} catch {}\n}\n\nconst saveEditorWorkspaceBundle = async (profile: ProjectProfile): Promise<void> => {\n    const adapter = (window as any).__WKOpenDAWWorkspace\n    if (typeof adapter?.writeFile !== \"function\") {return}\n    const identity = UUID.toString(profile.uuid)\n    const safeName = String(profile.meta.name || \"Project\").replaceAll(\"/\", \"_\").replaceAll(String.fromCharCode(92), \"_\").trim() || \"Project\"\n    const path = workspaceProjectPaths().get(identity) || \"openDAW Projects/\" + safeName + \"-\" + identity.slice(0, 8) + \".odb\"\n    try {\n        const bundle = await ProjectBundle.encode(profile, () => {})\n        await adapter.writeFile(path, new Uint8Array(bundle))\n        rememberWorkspaceProjectPath(identity, path)\n    } catch (error) {\n        console.warn(\"Could not mirror openDAW project into the Editor workspace.\", error)\n        RuntimeNotifier.notify({message: \"Could not save a bundle to the Editor workspace.\", icon: \"Warning\"})\n    }\n}\nexport class ProjectProfileService {"
  },
  {
        path: resolve(studioRoot, "src/service/ProjectProfileService.ts"),
    label: "mirror normal saves",
    before: "            if (status === \"rejected\") {\n                console.warn(error)\n                RuntimeNotifier.notify({\n                    message: \"Could not save project (storage temporarily unavailable). Please try again.\",\n                    icon: \"Warning\"\n                })\n            }\n        })",
    after: "            if (status === \"rejected\") {\n                console.warn(error)\n                RuntimeNotifier.notify({\n                    message: \"Could not save project (storage temporarily unavailable). Please try again.\",\n                    icon: \"Warning\"\n                })\n            } else {\n                await saveEditorWorkspaceBundle(profile)\n            }\n        })"
  },
  {
        path: resolve(studioRoot, "src/service/ProjectProfileService.ts"),
    label: "mirror save-as projects",
    before: "            optProfile.ifSome(profile => this.#profile.wrap(profile))",
    after: "            const savedProfile = optProfile.unwrapOrNull()\n            if (savedProfile !== null) {this.#profile.wrap(savedProfile)}\n            await saveEditorWorkspaceBundle(savedProfile ?? profile)"
  },
  {
        path: resolve(studioRoot, "src/service/ProjectProfileService.ts"),
    label: "remember imported workspace bundle path",
    before: "            const profile = await ProjectBundle.decode(this.#env, arrayBuffer, exclude)\n            this.#profile.wrap(profile)",
    after: "            const profile = await ProjectBundle.decode(this.#env, arrayBuffer, exclude)\n            const workspacePath = (file as File & {__wkWorkspacePath?: string}).__wkWorkspacePath\n            if (workspacePath) {rememberWorkspaceProjectPath(UUID.toString(profile.uuid), workspacePath)}\n            this.#profile.wrap(profile)"
  },
  {
    path: resolve(studioRoot, "src/ui/App.tsx"),
    label: "nested live favicon",
    before: 'favicon.href = isDefined(owner.getValue()) ? "/favicon-live.svg" : "/favicon.svg"',
    after: 'favicon.href = isDefined(owner.getValue()) ? import.meta.env.BASE_URL + "favicon-live.svg" : import.meta.env.BASE_URL + "favicon.svg"'
  },
  {
    path: resolve(studioRoot, "index.html"),
    label: "nested document base",
    before: "<head>",
    after: '<head>\n    <base href="%BASE_URL%">'
  },
  {
    path: resolve(studioRoot, "index.html"),
    label: "nested favicon URL",
    before: 'href="/favicon.svg"',
    after: 'href="%BASE_URL%favicon.svg"'
  }
];

async function main() {
  if (!existsSync(resolve(sourceRoot, "package.json"))) {
    throw new Error("The openDAW source submodule is missing. Run git submodule update --init --recursive from the WatermelonKatana repository.");
  }
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 23) {
    throw new Error("openDAW requires Node.js 23 or newer; this build is running Node.js " + process.versions.node + ".");
  }
  const sourceCommit = await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("git", ["rev-parse", "HEAD"], {cwd:sourceRoot, stdio:["ignore","pipe","inherit"]});
    let output = "";
    child.stdout.on("data", chunk => output += chunk);
    child.once("error", rejectPromise);
    child.once("exit", code => code === 0 ? resolvePromise(output.trim()) : rejectPromise(new Error("Could not identify the pinned openDAW source commit.")));
  });
  if (existsSync(markerPath) && existsSync(resolve(outputRoot, "index.html")) &&
      existsSync(resolve(outputRoot, "wasm-engine/wasm/engine.wasm"))) {
    try {
      const marker = JSON.parse(await readFile(markerPath, "utf8"));
      if (marker.sourceCommit === sourceCommit && marker.basePath === basePath && marker.integrationVersion === integrationVersion) {
        console.log("[openDAW] Local Studio is already built from " + sourceCommit.slice(0, 10) + ".");
        return;
      }
    } catch (_) {}
  }

  const env = {
    ...process.env,
    PATH: [join(homedir(), ".cargo", "bin"), process.env.PATH || ""].filter(Boolean).join(delimiter),
    WK_OPENDAW_BASE_PATH: basePath
  };
  const originals = [];
  try {
    for (const patch of patches) {
      const original = await readFile(patch.path, "utf8");
      const updated = replaceOnce(original, patch.before, patch.after, patch.label);
      originals.push({path:patch.path, original});
      await writeFile(patch.path, updated);
    }

    console.log("[openDAW] Installing pinned workspace dependencies...");
    await run("npm", ["ci"], {cwd:sourceRoot, env});
    await installRust(env);
    console.log("[openDAW] Building Studio and its worker/WASM dependencies...");
    await run("npx", ["turbo", "run", "build", "--filter=@opendaw/app-studio..."], {cwd:sourceRoot, env});

    const dist = resolve(studioRoot, "dist");
    if (!existsSync(resolve(dist, "index.html")) ||
        !existsSync(resolve(dist, "wasm-engine/wasm/engine.wasm"))) {
      throw new Error("The openDAW build did not produce the Studio page and WASM engine.");
    }
    await rm(outputRoot, {recursive:true, force:true});
    await mkdir(dirname(outputRoot), {recursive:true});
    await cp(dist, outputRoot, {recursive:true});
    const studioIndexPath = resolve(outputRoot, "index.html");
    let studioIndex = await readFile(studioIndexPath, "utf8");
    if (!studioIndex.includes("opendaw-bridge.js")) {
      const bridgeScript = '<script src="../../opendaw-bridge.js"></script>';
      if (!/<\/head>/i.test(studioIndex)) throw new Error("The openDAW Studio HTML has no closing head tag for its workspace bridge.");
      studioIndex = studioIndex.replace(/<\/head>/i, bridgeScript + "</head>");
      await writeFile(studioIndexPath, studioIndex);
    }
    await writeFile(markerPath, JSON.stringify({
      sourceCommit:sourceCommit,
      basePath:basePath,
      integrationVersion:integrationVersion,
      builtAt:new Date().toISOString()
    }, null, 2) + "\n");
    console.log("[openDAW] Built and staged the local Studio at " + outputRoot + ".");
  } finally {
    for (const entry of originals.reverse()) await writeFile(entry.path, entry.original);
  }
}

main().catch(error => {
  console.error("[openDAW] Build failed:", error);
  process.exitCode = 1;
});
