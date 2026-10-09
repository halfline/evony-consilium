import { loadTerrain } from "./terrain-loader.js";

async function readJSON(url, message) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(message);
  return response.json();
}
// Immutable game resources load independently of account/team workflows.
export async function loadResources() {
  const [catalog, avatarCatalog, terrainCatalog] = await Promise.all([
    readJSON(
      "assets/catalog.json",
      "The graphics catalog could not be loaded.",
    ),
    readJSON(
      "assets/avatar-catalog.json",
      "The avatar catalog could not be loaded.",
    ),
    loadTerrain(),
  ]);
  return { catalog, avatarCatalog, terrainCatalog };
}
