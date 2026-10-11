import { policyPage } from "./policy-pages.js";
import { browserConfigModule } from "./browser-config.js";
import { prepareAssets } from "./assets.js";
import { buildAppsScript } from "./build-apps-script.js";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(path) : [path];
    }),
  );
  return files.flat().sort();
}

const config = browserConfigModule();
const appSources = [
  "web/app.js",
  "web/style.css",
  ...(await sourceFiles("web/src")),
  ...(await sourceFiles("web/styles")),
];
const hash = createHash("sha256");
for (const path of appSources) {
  hash.update(path);
  hash.update(await readFile(path));
}
hash.update(config);
const appPath = `releases/${hash.digest("hex").slice(0, 12)}`;

await rm("dist", { recursive: true, force: true });
await mkdir("dist");
await buildAppsScript("dist/apps-script");
const assets = resolve("web/assets");
const branding = resolve(assets, "branding");
await cp("web", "dist", {
  recursive: true,
  filter: (source) => {
    const path = resolve(source);
    return (
      !path.startsWith(assets + sep) ||
      path === branding ||
      path.startsWith(branding + sep)
    );
  },
});
await mkdir(`dist/${appPath}`, { recursive: true });
await Promise.all([
  cp("web/app.js", `dist/${appPath}/app.js`),
  cp("web/src", `dist/${appPath}/src`, { recursive: true }),
  cp("web/style.css", `dist/${appPath}/style.css`),
  cp("web/styles", `dist/${appPath}/styles`, { recursive: true }),
  cp("web/assets/branding", `dist/${appPath}/assets/branding`, {
    recursive: true,
  }),
  writeFile(`dist/${appPath}/google-config.js`, config),
]);
let index = await readFile("dist/index.html", "utf8");
for (const path of [
  "style.css",
  "styles/entry.css",
  "styles/planner-screens.css",
  "styles/polish.css",
  "styles/notes.css",
  "app.js",
]) {
  const attribute = path.endsWith(".css") ? "href" : "src";
  const original = `${attribute}="${path}"`;
  if (!index.includes(original))
    throw new Error(`Missing entry asset: ${path}`);
  index = index.replace(original, `${attribute}="${appPath}/${path}"`);
}
await writeFile("dist/index.html", index);
await prepareAssets("dist/assets");
await Promise.all([
  writeFile("dist/privacy.html", await policyPage("PRIVACY.md")),
  writeFile("dist/terms.html", await policyPage("TERMS.md")),
  writeFile("dist/google-config.js", config),
]);
console.log("Static site built in dist/");
