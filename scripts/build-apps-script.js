import { build } from "esbuild";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

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
function setupConsiliumSync() { return ConsiliumSync.setup(); }
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

export async function buildAppsScript(directory = "apps-script/build") {
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "Code.gs"), await appsScriptBundle());
  await copyFile(
    "apps-script/appsscript.json",
    resolve(directory, "appsscript.json"),
  );
  // Preserve a locally edited deployment configuration when rebuilding.
  try {
    await writeFile(
      resolve(directory, "Config.gs"),
      await readFile("apps-script/config.js"),
      { flag: "wx" },
    );
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await buildAppsScript();
  console.log(
    "Apps Script files built in apps-script/build/ (local Config.gs preserved).",
  );
}
