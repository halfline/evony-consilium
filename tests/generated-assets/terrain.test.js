import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assetURL } from "./paths.js";
import {
  TerrainCatalog,
  terrainAllowsPlacement,
  terrainTileAt,
} from "../../web/src/domain/terrain.js";
import { createEmptyPlan } from "../../web/src/domain/plan.js";
import { canPlace } from "../../web/src/domain/placement.js";
import { createMapPlan } from "../../web/src/domain/map-plans.js";
const manifest = JSON.parse(
  readFileSync(assetURL("assets/terrain/manifest.json")),
);
const buffers = new Map(
  Object.entries(manifest.maps).map(([id, map]) => {
    const bytes = readFileSync(assetURL(map.src));
    return [
      id,
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ];
  }),
);
const terrainCatalog = new TerrainCatalog(manifest, buffers);
const getTerrain = (id) => terrainCatalog.get(id);
test("all supported game maps have complete tile grids and correct dimensions", () => {
  for (const [id, extent] of [
    ["server", 1200],
    ["boc", 300],
    ["bog", 300],
    ["chalons", 300],
    ["allstars", 300],
    ["civilization", 600],
    ["toulon", 300],
  ]) {
    const terrain = getTerrain(id);
    assert.equal(terrain.extent, extent);
    for (const layer of terrain.layers) {
      assert.equal(layer.tiles.length, terrain.width * terrain.height);
      assert.ok(
        [...new Set(layer.tiles)].every(
          (gid) => gid === 0 || terrain.tiles[gid],
        ),
      );
    }
    const plan = createMapPlan(createEmptyPlan(), id, "Test", getTerrain(id));
    assert.equal(plan.extent, extent);
    assert.equal(plan.center.x, Math.floor(extent / 2));
  }
});
test("terrain rejects occupied ground and checks the whole keep footprint", () => {
  const terrain = getTerrain("server");
  const index = terrain.blocked.findIndex(
    (blocked, index) =>
      blocked && index % terrain.width > 1 && index % terrain.width < 1190,
  );
  const x = index % terrain.width,
    y = Math.floor(index / terrain.width);
  const plan = createEmptyPlan();
  assert.equal(
    canPlace({ id: "keep", w: 2, h: 2 }, x, y, plan, [], getTerrain("server")),
    false,
  );
  assert.equal(
    terrainAllowsPlacement(getTerrain("server"), { x: x - 1, y, w: 2, h: 2 }),
    false,
  );
  assert.equal(
    terrainAllowsPlacement(getTerrain("blank"), { x, y, w: 2, h: 2 }),
    true,
  );
  assert.equal(
    terrainAllowsPlacement(getTerrain("boc"), { x: 400, y: 400, w: 2, h: 2 }),
    false,
  );
});
test("fixed server landmarks preserve confirmed coordinates and footprints", () => {
  const terrain = getTerrain("server");
  assert.equal(terrain.landmarks.length, 9);
  assert.deepEqual(
    terrain.landmarks.slice(4).map((l) => l.coordinate),
    [
      { x: 606, y: 606 },
      { x: 593, y: 593 },
      { x: 606, y: 593 },
      { x: 593, y: 606 },
      { x: 600, y: 607 },
    ],
  );
  assert.equal(terrain.landmarks.at(-1).w, 3);
  const throne = terrain.landmarks[0],
    magic = terrain.landmarks[4];
  assert.deepEqual({ x: throne.x, y: throne.y }, { x: 598, y: 598 });
  assert.deepEqual({ x: magic.x, y: magic.y }, { x: 605, y: 605 });
  assert.equal(magic.x + magic.w / 2 - 0.5, magic.coordinate.x + 0.5);
  assert.equal(throne.x + throne.w / 2 - 0.5, throne.coordinate.x);
  assert.ok(
    terrain.landmarks.every(
      (l) =>
        !terrainAllowsPlacement(getTerrain("server"), {
          x: l.x,
          y: l.y,
          w: 2,
          h: 2,
        }),
    ),
  );
  assert.deepEqual(
    terrain.landmarks.slice(1, 4).map((l) => l.coordinate),
    [
      { x: 299, y: 899 },
      { x: 299, y: 299 },
      { x: 899, y: 299 },
    ],
  );
  assert.equal(
    canPlace(
      { id: "keep", w: 2, h: 2 },
      600,
      600,
      createEmptyPlan(),
      [],
      getTerrain("server"),
    ),
    false,
  );
  createMapPlan(createEmptyPlan(), "server", "Hive", getTerrain("server"));
  assert.equal(getTerrain("server").landmarks.length, 9);
  assert.equal(getTerrain("blank"), undefined);
});

test("fixed building clearings replace trees with original dirt tiles", () => {
  const terrain = getTerrain("server");
  const surface = terrain.layers.find((layer) => layer.name === "surface");
  const vegetation = terrain.layers.find(
    (layer) => layer.name === "vegetation",
  );
  for (const landmark of terrain.landmarks.filter(
    (landmark) => landmark.groundTile,
  )) {
    for (let y = landmark.y; y < landmark.y + landmark.h; y++)
      for (let x = landmark.x; x < landmark.x + landmark.w; x++) {
        assert.equal(terrainTileAt(terrain, surface, x, y), 76);
        assert.equal(terrainTileAt(terrain, vegetation, x, y), 0);
      }
  }
  assert.equal(
    terrainTileAt(terrain, vegetation, 607, 610),
    vegetation.tiles[610 * terrain.width + 607],
  );
});

