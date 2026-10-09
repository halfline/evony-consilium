import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
// Check development output by default, or the completed production site.
export const assetURL = (path) =>
  pathToFileURL(resolve(process.env.ASSET_ROOT || "web", path));
