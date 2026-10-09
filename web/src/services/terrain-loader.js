import { TerrainCatalog } from "../domain/terrain.js";
export async function loadTerrain() {
  const response = await fetch("assets/terrain/manifest.json");
  if (!response.ok) throw new Error("Map terrain could not be loaded.");
  const manifest = await response.json();
  const entries = await Promise.all(
    Object.entries(manifest.maps).map(async ([id, map]) => {
      const response = await fetch(map.src);
      if (!response.ok)
        throw new Error("Map terrain could not be loaded: " + id);
      return [id, await response.arrayBuffer()];
    }),
  );
  return new TerrainCatalog(manifest, new Map(entries));
}
