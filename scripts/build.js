import { policyPage } from "./policy-pages.js";
import { prepareAssets } from "./assets.js";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
await rm("dist", { recursive: true, force: true });
await mkdir("dist");
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
await prepareAssets("dist/assets");
await Promise.all([
  writeFile("dist/privacy.html", await policyPage("PRIVACY.md")),
  writeFile("dist/terms.html", await policyPage("TERMS.md")),
]);
console.log("Static site built in dist/");
