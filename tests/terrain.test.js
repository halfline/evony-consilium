import test from "node:test";
import assert from "node:assert/strict";
import { TerrainCatalog, terrainTileAt } from "../web/src/domain/terrain.js";
import { loadTerrain } from "../web/src/services/terrain-loader.js";
import { drawTerrain } from "../web/src/rendering/terrain-painter.js";

test("terrain catalogs remain independent across resource loads", () => {
  const manifest = {
    maps: {
      tiny: {
        width: 1,
        height: 1,
        extent: 1,
        blockedOffset: 1,
        layers: [{ name: "surface", offset: 0 }],
        landmarks: [],
      },
    },
  };
  const first = new TerrainCatalog(
    manifest,
    new Map([["tiny", Uint8Array.of(2, 0).buffer]]),
  );
  const second = new TerrainCatalog(
    manifest,
    new Map([["tiny", Uint8Array.of(3, 1).buffer]]),
  );
  manifest.maps.tiny.extent = 7;
  assert.equal(first.get("tiny").layers[0].tiles[0], 2);
  assert.equal(second.get("tiny").layers[0].tiles[0], 3);
  assert.equal(first.get("tiny").extent, 1);
  assert.equal(first.get("tiny").blocked[0], 0);
  assert.equal(second.get("tiny").blocked[0], 1);
  assert.throws(() => new TerrainCatalog(manifest, new Map()), /Invalid terrain data/);
});

test("terrain loader fetches each manifest buffer and rejects missing data", async () => {
  const original = globalThis.fetch;
  const requests = [];
  const manifest = {
    maps: {
      tiny: {
        src: "assets/terrain/tiny.bin",
        width: 1, height: 1, extent: 1, blockedOffset: 1,
        layers: [{ name: "surface", offset: 0 }], landmarks: [],
      },
    },
  };
  try {
    globalThis.fetch = async (url) => {
      requests.push(url);
      return url.endsWith("manifest.json")
        ? { ok: true, json: async () => manifest }
        : { ok: true, arrayBuffer: async () => Uint8Array.of(4, 0).buffer };
    };
    assert.equal((await loadTerrain()).get("tiny").layers[0].tiles[0], 4);
    assert.deepEqual(requests, ["assets/terrain/manifest.json", "assets/terrain/tiny.bin"]);
    globalThis.fetch = async () => ({ ok: false });
    await assert.rejects(loadTerrain(), /Map terrain could not be loaded/);
  } finally {
    globalThis.fetch = original;
  }
});

test("landmark clearings override ground and vegetation only within the footprint", () => {
  const terrain = {
    width: 3,
    landmarks: [{ x: 1, y: 0, w: 1, h: 1, groundTile: 9 }],
  };
  const surface = { name: "surface", tiles: Uint8Array.of(1, 2, 3) };
  const vegetation = { name: "vegetation", tiles: Uint8Array.of(4, 5, 6) };
  assert.equal(terrainTileAt(terrain, surface, 1, 0), 9);
  assert.equal(terrainTileAt(terrain, vegetation, 1, 0), 0);
  assert.equal(terrainTileAt(terrain, surface, 2, 0), 3);
  assert.equal(terrainTileAt(terrain, vegetation, 2, 0), 6);
});

test("terrain painter draws overview and decoded surface tile", () => {
  const images = [];
  const ctx = {
    save() {}, restore() {}, transform() {},
    drawImage(image) { images.push(image); },
  };
  const view = { ctx, image: (src) => src };
  const terrain = {
    overview: "overview", width: 1, height: 1,
    tiles: { 1: { src: "tile", width: 256, height: 128 } },
    layers: [{ name: "surface", tiles: Uint8Array.of(1) }],
    landmarks: [],
  };
  drawTerrain(view, terrain, 0, 0, 1, 1, { ax: 48, ay: 24, bx: -48, by: 24 });
  assert.deepEqual(images, ["overview", "tile"]);
});
