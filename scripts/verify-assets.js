import { access, readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { MAP_ICONS } from "../web/src/domain/maps.js";

// Validate generated references before copying or publishing the site.
export async function verifyAssets(
  directory,
  branding = "web/assets/branding",
) {
  const root = resolve(directory);
  const references = new Set(Object.values(MAP_ICONS));
  for (const type of ["ground", "ranged", "mounted", "siege"])
    references.add(`assets/troop-icons/${type}.webp`);
  function collect(value) {
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (
        ["src", "previewSrc", "overview", "inventory"].includes(key) &&
        typeof item === "string"
      )
        references.add(item);
      else collect(item);
    }
  }
  for (const file of [
    "catalog.json",
    "castle-inventory.json",
    "avatar-catalog.json",
    "terrain/manifest.json",
    "map-icons/manifest.json",
    "troop-icons/manifest.json",
  ]) {
    collect(JSON.parse(await readFile(resolve(root, file), "utf8")));
  }
  for (const reference of references) {
    const file = resolve(root, reference.replace(/^assets\//, ""));
    if (!reference.startsWith("assets/") || !file.startsWith(root + sep))
      throw new Error(`Invalid generated asset reference: ${reference}`);
    const target = reference.startsWith("assets/branding/")
      ? resolve(branding, reference.slice("assets/branding/".length))
      : file;
    try {
      await access(target);
    } catch (error) {
      throw new Error(`Missing generated asset: ${reference}`, {
        cause: error,
      });
    }
  }
}
