// Each resource load owns its terrain catalog; domain rules have no shared registry.
export class TerrainCatalog {
  #maps = new Map();
  constructor(manifest, buffers) {
    for (const [id, map] of Object.entries(manifest.maps)) {
      const buffer = buffers.get(id);
      const length = map.width * map.height;
      if (!buffer || buffer.byteLength !== map.blockedOffset + length)
        throw new Error("Invalid terrain data: " + id);
      this.#maps.set(id, {
        ...structuredClone(map),
        layers: map.layers.map((layer) => ({
          ...layer,
          tiles: new Uint8Array(buffer, layer.offset, length),
        })),
        blocked: new Uint8Array(buffer, map.blockedOffset, length),
      });
    }
  }
  get(id) {
    return this.#maps.get(id);
  }
}

export function terrainTileAt(terrain, layer, x, y) {
  const clearing = terrain.landmarks.find(
    (landmark) =>
      landmark.groundTile &&
      x >= landmark.x &&
      x < landmark.x + landmark.w &&
      y >= landmark.y &&
      y < landmark.y + landmark.h,
  );
  if (clearing) return layer.name === "surface" ? clearing.groundTile : 0;
  return layer.tiles[y * terrain.width + x];
}
