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

test("moat overlay stays clipped to a landmark ground footprint", async () => {
  const { MapRenderer } = await import(
    "../../web/src/rendering/map-renderer.js"
  );
  const calls = [];
  const ctx = Object.fromEntries(
    [
      "save",
      "restore",
      "beginPath",
      "moveTo",
      "lineTo",
      "closePath",
      "clip",
      "translate",
      "scale",
      "drawImage",
    ].map((name) => [name, (...args) => calls.push([name, ...args])]),
  );
  const plan = createEmptyPlan();
  plan.map = "server";
  const renderer = Object.assign(Object.create(MapRenderer.prototype), {
    terrainFor: getTerrain,
    ctx,
    width: 1000,
    height: 800,
    camera: { x: 0, y: 0, zoom: 1 },
    getPlan: () => plan,
    image: (src) => ({ src }),
  });
  const tower = getTerrain("server").landmarks.find(
    (l) => l.name === "Magic Tower",
  );
  renderer.drawMoatOverlay(tower, plan, 1);
  assert.ok(calls.some(([name]) => name === "drawImage"));
  assert.ok(
    calls.findIndex(([name]) => name === "clip") <
      calls.findIndex(([name]) => name === "drawImage"),
  );
  const corners = calls.filter(
    ([name]) => name === "moveTo" || name === "lineTo",
  );
  assert.equal(corners.length, 4);
  assert.equal(calls.at(-1)[0], "restore");
  calls.length = 0;
  renderer.drawMoatOverlay(tower, { ...plan, map: "blank" }, 1);
  assert.equal(calls.length, 0);
  renderer.drawMoatOverlay({ ...tower, id: "player" }, plan, 1);
  assert.equal(calls.length, 0);
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


test("the moat is drawn after ground and before every building", async () => {
  const { MapRenderer } = await import(
    "../../web/src/rendering/map-renderer.js"
  );
  const calls = [];
  const plan = { ...createEmptyPlan(), map: "server", showGrid: false };
  const ctx = new Proxy(
    {},
    {
      get: (_, name) =>
        name === "createRadialGradient"
          ? () => ({ addColorStop() {} })
          : () => {},
    },
  );
  const renderer = Object.assign(Object.create(MapRenderer.prototype), {
    terrainFor: getTerrain,
    ctx,
    width: 1000,
    height: 800,
    camera: { x: 0, y: 0, zoom: 1 },
    getPlan: () => plan,
    onDraw: () => {},
    drawTerrain: () => calls.push("ground"),
    drawMoatOverlay: () => calls.push("moat"),
    entity: () => calls.push("building"),
  });
  const previousPixelRatio = globalThis.devicePixelRatio;
  globalThis.devicePixelRatio = 1;
  try {
    renderer.draw();
  } finally {
    globalThis.devicePixelRatio = previousPixelRatio;
  }
  assert.equal(calls[0], "ground");
  const firstBuilding = calls.indexOf("building");
  assert.ok(firstBuilding > 1);
  assert.ok(calls.slice(1, firstBuilding).every((call) => call === "moat"));
  assert.ok(calls.slice(firstBuilding).every((call) => call === "building"));
});


test("the throne base aligns with the front of its footprint", async () => {
  const { MapRenderer } = await import(
    "../../web/src/rendering/map-renderer.js"
  );
  const asset = JSON.parse(
    readFileSync(assetURL("assets/catalog.json")),
  ).assets.find((asset) => asset.id === "map-kingdom");
  const plan = { ...createEmptyPlan(), labels: false };
  const throne = getTerrain("server").landmarks[0];
  let bounds;
  const ctx = new Proxy(
    {},
    {
      get: (_, name) =>
        name === "drawImage"
          ? (_, left, top, width, height) => {
              bounds = { left, top, width, height };
            }
          : () => {},
    },
  );
  const renderer = Object.assign(Object.create(MapRenderer.prototype), {
    terrainFor: getTerrain,
    ctx,
    width: 1000,
    height: 800,
    camera: { x: 0, y: 28824, zoom: 1 },
    hits: [],
    assets: new Map([[asset.id, asset]]),
    getPlan: () => plan,
    image: () => ({}),
  });
  renderer.entity(throne, plan, 1, true);
  const front = renderer.screen(throne.x + throne.w, throne.y + throne.h);
  assert.ok(bounds);
  assert.ok(
    Math.abs(
      bounds.left +
        (asset.mapAnchor.pivotX * bounds.width) / asset.width -
        front.x,
    ) < 0.001,
  );
  assert.ok(Math.abs(bounds.top + bounds.height - front.y) < 0.001);
  assert.ok(Math.abs(bounds.width - 480 * 0.98) < 0.001);
});


test("temple ground bases fill and align with their occupied footprints", async () => {
  const { MapRenderer } = await import(
    "../../web/src/rendering/map-renderer.js"
  );
  const catalog = JSON.parse(readFileSync(assetURL("assets/catalog.json")));
  const plan = { ...createEmptyPlan(), labels: false };
  for (const temple of getTerrain("server").landmarks.filter((landmark) =>
    landmark.skin.endsWith("shrin"),
  )) {
    const asset = catalog.assets.find((asset) => asset.id === temple.skin);
    let bounds;
    const ctx = new Proxy(
      {},
      {
        get: (_, name) =>
          name === "drawImage"
            ? (_, left, top, width, height) => {
                bounds = { left, top, width, height };
              }
            : () => {},
      },
    );
    const renderer = Object.assign(Object.create(MapRenderer.prototype), {
      terrainFor: getTerrain,
      ctx,
      width: 1000,
      height: 800,
      camera: {
        x: (temple.x - temple.y) * 48,
        y: (temple.x + temple.y + temple.w) * 24,
        zoom: 1,
      },
      hits: [],
      assets: new Map([[asset.id, asset]]),
      getPlan: () => plan,
      image: () => ({}),
    });
    renderer.entity(temple, plan, 1, true);
    const scale = bounds.width / asset.width;
    const front = renderer.screen(temple.x + temple.w, temple.y + temple.h);
    assert.ok(
      Math.abs(bounds.left + asset.mapAnchor.pivotX * scale - front.x) < 0.001,
    );
    assert.ok(
      Math.abs(bounds.top + asset.mapAnchor.groundPivotY * scale - front.y) <
        0.001,
    );
    assert.ok(
      Math.abs(asset.mapAnchor.footprintWidth * scale - 384 * 0.98) < 0.001,
    );
  }
});


test("fixed landmarks have no outlines and major sprites stay visible at distant zoom", async () => {
  const { MapRenderer } = await import(
    "../../web/src/rendering/map-renderer.js"
  );
  const catalog = JSON.parse(readFileSync(assetURL("assets/catalog.json")));
  const plan = { ...createEmptyPlan(), labels: false };
  for (const landmark of getTerrain("server").landmarks) {
    const asset = catalog.assets.find((asset) => asset.id === landmark.skin);
    for (const zoom of [1, 0.02]) {
      let strokes = 0,
        spriteWidth = 0;
      const ctx = new Proxy(
        {},
        {
          get: (_, name) =>
            name === "stroke"
              ? () => strokes++
              : name === "drawImage"
                ? (_, left, top, width) => {
                    spriteWidth = width;
                  }
                : () => {},
        },
      );
      const renderer = Object.assign(Object.create(MapRenderer.prototype), {
        terrainFor: getTerrain,
        ctx,
        width: 1000,
        height: 800,
        camera: {
          x: (landmark.x - landmark.y) * 48,
          y: (landmark.x + landmark.y + landmark.w) * 24,
          zoom,
        },
        hits: [],
        assets: new Map([[asset.id, asset]]),
        getPlan: () => plan,
        image: () => ({}),
      });
      renderer.entity(landmark, plan, zoom, true);
      if (zoom === 1) assert.equal(strokes, 0, landmark.name);
      if (landmark.skin === "map-kingdom" || landmark.skin.endsWith("shrin")) {
        assert.ok(spriteWidth >= 60, landmark.name);
        assert.equal(strokes, 0, landmark.name);
      }
    }
  }
});


test("whole-map view fits all server corners on screen", async () => {
  const { MapRenderer } = await import(
    "../../web/src/rendering/map-renderer.js"
  );
  const plan = createEmptyPlan();
  const renderer = Object.assign(Object.create(MapRenderer.prototype), {
    terrainFor: getTerrain,
    width: 1000,
    height: 800,
    getPlan: () => plan,
    draw() {},
  });
  renderer.fit(true);
  for (const [x, y] of [
    [0, 0],
    [1200, 0],
    [0, 1200],
    [1200, 1200],
  ]) {
    const point = renderer.screen(x, y);
    assert.ok(point.x >= 0 && point.x <= renderer.width);
    assert.ok(point.y >= 0 && point.y <= renderer.height);
  }
});
