import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const help = `Apps Script link

  npm run apps-script:link -- SCRIPT_ID_OR_EDITOR_URL

Find the Script ID in Project Settings. Use --replace to switch projects.
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

export async function main(args = process.argv.slice(2)) {
  if (!args.length || args.includes("--help") || args.includes("-h")) {
    console.log(help);
    return;
  }
  const [command, ...rest] = args;
  if (command !== "link") throw new Error(help);
  const values = rest.filter((arg) => arg !== "--replace");
  if (values.length !== 1) throw new Error(help);
  const id = await linkProject(values[0], {
    replace: rest.includes("--replace"),
  });
  console.log(`Linked Apps Script project ${id}. No files uploaded.`);
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
