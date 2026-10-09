import test from "node:test";
import assert from "node:assert/strict";
import { TerrainCatalog, terrainAllowsPlacement, terrainTileAt } from "../web/src/domain/terrain.js";
import { loadTerrain } from "../web/src/services/terrain-loader.js";
import { drawTerrain, drawMoatOverlay } from "../web/src/rendering/terrain-painter.js";

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

test("terrain checks the whole footprint, map bounds, and fixed landmarks", () => {
  const terrain = {
    extent: 4, width: 4, height: 4,
    blocked: Uint8Array.from({ length: 16 }, (_, index) => Number(index === 5)),
    landmarks: [{ x: 3, y: 3, w: 1, h: 1 }],
  };
  assert.equal(terrainAllowsPlacement(terrain, { x: 0, y: 0, w: 2, h: 2 }), false);
  assert.equal(terrainAllowsPlacement(terrain, { x: 2, y: 0, w: 2, h: 2 }), true);
  assert.equal(terrainAllowsPlacement(terrain, { x: 3, y: 0, w: 2, h: 2 }), false);
  assert.equal(terrainAllowsPlacement(terrain, { x: 3, y: 3, w: 1, h: 1 }), false);
  assert.equal(terrainAllowsPlacement(undefined, { x: 3, y: 3, w: 1, h: 1 }), true);
});
