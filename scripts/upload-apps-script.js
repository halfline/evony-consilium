import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildAppsScript } from "./build-apps-script.js";

const claspPackage = "@google/clasp@3.4.1";
const help = `Apps Script uploads (Node 20 or newer)

  npm run apps-script:login
  npm run apps-script:link -- SCRIPT_ID_OR_EDITOR_URL
  npm run apps-script:push

Enable Apps Script API at https://script.google.com/home/usersettings first.
Find the Script ID in your existing script's Project Settings (not a Drive ID).
Push downloads the project, rebuilds the sync code, and preserves remote Config
and extra files. Local apps-script/build/Config.gs is not used for updates.
Use link --replace SCRIPT_ID to switch an already-linked project.
`;

export function scriptId(value) {
  if (typeof value !== "string") throw new Error("A Script ID is required.");
  const input = value.trim();
  let id = input;
  if (input.includes("://")) {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.host !== "script.google.com") {
      throw new Error("Use a Script ID or a script.google.com editor URL.");
    }
    id = url.pathname.match(
      /^\/(?:u\/\d+\/)?(?:home\/projects|d)\/([\w-]+)(?:\/edit)?\/?$/,
    )?.[1];
  }
  if (!id || !/^[\w-]{1,200}$/.test(id)) {
    throw new Error("Use the Script ID from Apps Script Project Settings.");
  }
  return id;
}

export async function linkProject(
  value,
  { projectPath = resolve(".clasp.json"), replace = false } = {},
) {
  const id = scriptId(value);
  let existing;
  try {
    existing = JSON.parse(await readFile(projectPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (existing?.scriptId && existing.scriptId !== id && !replace) {
    throw new Error(
      "Another project is linked. Use link --replace SCRIPT_ID to switch.",
    );
  }
  await mkdir(dirname(projectPath), { recursive: true });
  await writeFile(
    projectPath,
    JSON.stringify(
      { scriptId: id, rootDir: "apps-script/build", scriptExtensions: [".gs"] },
      null,
      2,
    ) + "\n",
    { mode: 0o600 },
  );
  return id;
}

export function runClasp(args, { cwd = process.cwd() } = {}) {
  if (Number(process.versions.node.split(".")[0]) < 20) {
    throw new Error("Apps Script uploads require Node 20 or newer.");
  }
  return new Promise((resolveRun, reject) => {
    const child = spawn(
      "npx",
      ["--yes", `--package=${claspPackage}`, "clasp", ...args],
      { cwd, stdio: "inherit", shell: false },
    );
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else reject(new Error(`clasp failed (${signal || `exit ${code}`}).`));
    });
  });
}

export async function uploadProject({
  projectPath = resolve(".clasp.json"),
  stagingParent = tmpdir(),
  run = runClasp,
  build = buildAppsScript,
} = {}) {
  let project;
  try {
    project = JSON.parse(await readFile(projectPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "Link your existing script first: npm run apps-script:link -- SCRIPT_ID",
      );
    }
    throw error;
  }
  const id = scriptId(project.scriptId);
  const staging = await mkdtemp(join(stagingParent, "consilium-script-"));
  try {
    const configPath = join(staging, ".clasp.json");
    const ignorePath = join(staging, ".claspignore");
    await writeFile(
      configPath,
      JSON.stringify({
        scriptId: id,
        rootDir: ".",
        scriptExtensions: [".gs"],
        htmlExtensions: [".html"],
        jsonExtensions: [".json"],
      }),
      { mode: 0o600 },
    );
    await writeFile(
      ignorePath,
      "**/**\n!**/*.gs\n!**/*.html\n!**/*.json\n.clasp.json\n",
    );
    const options = ["--project", configPath, "--ignore", ignorePath];
    await run([...options, "pull"], { cwd: staging });
    // A complete pull is required before rebuilding: push replaces the entire
    // remote file list. In particular, never replace an operator's live Config
    // with a locally generated template or drop their extra project files.
    JSON.parse(await readFile(join(staging, "appsscript.json"), "utf8"));
    await build(staging);
    await run([...options, "push"], { cwd: staging });
    return id;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export async function main(args = process.argv.slice(2)) {
  if (!args.length || args.includes("--help") || args.includes("-h")) {
    console.log(help);
    return;
  }
  const [command, ...rest] = args;
  if (command === "login" && !rest.length) {
    await runClasp(["login"]);
  } else if (command === "link") {
    const values = rest.filter((arg) => arg !== "--replace");
    if (values.length !== 1) throw new Error(help);
    const id = await linkProject(values[0], {
      replace: rest.includes("--replace"),
    });
    console.log(`Linked Apps Script project ${id}. No files uploaded.`);
  } else if (command === "push" && !rest.length) {
    const id = await uploadProject();
    console.log(
      `clasp finished for ${id}; remote Config and extra files retained.`,
    );
  } else {
    throw new Error(help);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
