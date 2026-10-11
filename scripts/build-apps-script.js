import { build } from "esbuild";

export async function appsScriptBundle() {
  const result = await build({
    entryPoints: ["apps-script/entry.js"],
    inject: ["apps-script/clone.js"],
    bundle: true,
    format: "iife",
    globalName: "ConsiliumSync",
    platform: "neutral",
    target: "es2020",
    write: false,
    footer: {
      js: `
function configureConsiliumSync() { return ConsiliumSync.configure(); }
function installConsiliumSync() { return ConsiliumSync.install(); }
function syncConsiliumTeam() { return ConsiliumSync.sync(); }
function previewConsiliumSync() { return ConsiliumSync.preview(); }
function uninstallConsiliumSync() { return ConsiliumSync.uninstall(); }
function showConsiliumSyncStatus() { return ConsiliumSync.status(); }
`,
    },
  });
  return result.outputFiles[0].text;
}
