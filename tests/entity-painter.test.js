import test from "node:test";
import assert from "node:assert/strict";
import { drawEntity } from "../web/src/rendering/entity-painter.js";
import { MapRenderer } from "../web/src/rendering/map-renderer.js";
import { createEmptyPlan } from "../web/src/domain/plan.js";

test("placed entities paint a sprite and expose a selectable hit region", () => {
  const images = [];
  const view = {
    ctx: { drawImage: (...args) => images.push(args) },
    screen: (x, y) => ({ x, y }),
    assets: new Map([["castle", { src: "castle.webp", width: 100, height: 80 }]]),
    image: (src) => src,
    hits: [],
  };
  drawEntity(view, { id: "keep", skin: "castle", x: 10, y: 20, w: 2, h: 2 },
    { grid: { ax: 48, ay: 24, bx: -48, by: 24 } }, 1);
  assert.equal(images.length, 1);
  assert.equal(images[0][0], "castle.webp");
  assert.ok(Math.abs(images[0][3] - 167.04) < 1e-6);
  assert.ok(Math.abs(images[0][4] - 133.632) < 1e-6);
  assert.ok(Math.abs(images[0][2] - (-79.032)) < 1e-6);
  assert.equal(view.hits[0].id, "keep");
  assert.ok(view.hits[0].left < 11 && view.hits[0].right > 11);
  assert.ok(Math.abs(view.hits[0].top - (images[0][2] - 10)) < 1e-6);
});

test("map anchor metadata positions large and pixel-scale sprites", () => {
  const images = [];
  const asset = { src: "landmark.webp", width: 200, height: 100, mapAnchor: {
    footprintFill: 0.8, footprintWidth: 100, pivotX: 40, groundPivotY: 90,
  } };
  const view = {
    ctx: { drawImage: (...args) => images.push(args) },
    screen: (x, y) => ({ x, y }),
    assets: new Map([["landmark", asset]]), image: (src) => src, hits: [],
  };
  const entity = { id: "landmark", skin: "landmark", x: 10, y: 20, w: 2, h: 2 };
  const plan = { grid: { ax: 48, ay: 24, bx: -48, by: 24 }, labels: false };
  drawEntity(view, entity, plan, 1);
  assert.equal(images[0][0], "landmark.webp");
  for (const [index, expected] of [[1, -49.44], [2, -116.24], [3, 307.2], [4, 153.6]])
    assert.ok(Math.abs(images[0][index] - expected) < 1e-6);
  asset.mapAnchor = { pixelScale: 2, pivotX: 100, pivotY: 50 };
  drawEntity(view, entity, plan, 1);
  assert.equal(images[1][0], "landmark.webp");
  for (const [index, expected] of [[1, -7.75], [2, 11.625], [3, 37.5], [4, 18.75]])
    assert.ok(Math.abs(images[1][index] - expected) < 1e-6);
});

test("fixed landmarks are inert and major ones stay visible at distant zoom", () => {
  const images = [];
  let outlines = 0;
  const view = {
    ctx: { drawImage: (...args) => images.push(args), stroke: () => outlines++ },
    path: () => outlines++, screen: (x, y) => ({ x, y }),
    assets: new Map([
      ["map-kingdom", { src: "throne.webp", width: 200, height: 100 }],
      ["minor", { src: "minor.webp", width: 200, height: 100 }],
    ]), image: (src) => src, hits: [], selected: "throne",
  };
  const plan = {
    grid: { ax: 48, ay: 24, bx: -48, by: 24 },
    obstacles: [], rallyId: "throne", labels: false,
  };
  drawEntity(view, { id: "throne", skin: "map-kingdom", x: 10, y: 20, w: 5, h: 5 }, plan, 0.02, true);
  drawEntity(view, { id: "minor", skin: "minor", x: 10, y: 20, w: 1, h: 1 }, plan, 0.02, true);
  assert.equal(images.length, 1);
  assert.ok(images[0][3] >= 60);
  assert.equal(outlines, 0);
  assert.deepEqual(view.hits, []);
});

test("offscreen sprites leave no draw call or hit region", () => {
  let drawings = 0;
  const view = {
    ctx: { drawImage: () => drawings++ },
    screen: (x, y) => ({ x, y }), width: 400, height: 300,
    assets: new Map([["castle", { src: "castle.webp", width: 100, height: 80 }]]),
    image: (src) => src, hits: [],
  };
  const plan = { grid: { ax: 48, ay: 24, bx: -48, by: 24 }, labels: false };
  drawEntity(view, { id: "far", skin: "castle", x: 1000, y: 1000, w: 2, h: 2 }, plan, 1);
  assert.equal(drawings, 0);
  assert.deepEqual(view.hits, []);
  drawEntity(view, { id: "near", skin: "castle", x: 10, y: 10, w: 2, h: 2 }, plan, 1);
  assert.equal(drawings, 1);
  assert.equal(view.hits[0].id, "near");
});

test("entity labels follow the map preference and mark the rally keep", () => {
  const labels = [];
  const plates = [];
  const outlined = [];
  const view = {
    ctx: {
      drawImage() {},
      fillText: (label) => labels.push(label),
      strokeText: (label) => outlined.push(label),
      measureText: (label) => ({ width: label.length * 6 }),
      fillRect: (...args) => plates.push(args),
      beginPath() {}, arc() {}, ellipse() {}, fill() {}, stroke() {},
    },
    path() {},
    screen: (x, y) => ({ x, y }),
    assets: new Map([["castle", { src: "castle.webp", width: 100, height: 80 }]]),
    image: (src) => src,
    hits: [],
  };
  const entity = { id: "keep", name: "Central Keep", allianceTag: "ABC", level: 35, skin: "castle", x: 10, y: 20, w: 2, h: 2 };
  const plan = { labels: true, rallyId: "keep", grid: { ax: 48, ay: 24, bx: -48, by: 24 } };
  drawEntity(view, entity, plan, 1);
  assert.deepEqual(labels, ["★ [ABC] Central Keep", "K35"]);
  assert.deepEqual(outlined, ["K35"]);
  assert.equal(plates.length, 1);
  assert.equal(plates[0][2], "★ [ABC] Central Keep".length * 6 + 14);
  plan.labels = false;
  drawEntity(view, entity, plan, 1);
  assert.deepEqual(labels, ["★ [ABC] Central Keep", "K35"]);
  plan.labels = true;
  drawEntity(view, entity, plan, 0.1);
  assert.deepEqual(labels, ["★ [ABC] Central Keep", "K35"]);
});

test("low zoom paints selectable dots with selected, rally, and obstacle emphasis", () => {
  const circles = [];
  const fills = [];
  const view = {
    ctx: {
      beginPath() {},
      arc: (_x, _y, radius) => circles.push(radius),
      fill() { fills.push(this.fillStyle); },
      stroke() {},
      drawImage() { assert.fail("low zoom should not paint a sprite"); },
    },
    screen: (x, y) => ({ x, y }),
    assets: new Map(), image: () => null, hits: [],
    selectedIds: new Set(["selected"]),
  };
  const plan = {
    grid: { ax: 48, ay: 24, bx: -48, by: 24 },
    rallyId: "rally", obstacles: [{ id: "obstacle" }], labels: true,
  };
  for (const id of ["selected", "rally", "obstacle"])
    drawEntity(view, { id, x: 10, y: 20, w: 1, h: 1 }, plan, 0.1);
  assert.deepEqual(circles, [6, 5, 3]);
  assert.deepEqual(fills, ["#e0e9ce", "#f4d386", "#e5a887"]);
  assert.deepEqual(view.hits.map(({ id }) => id), ["selected", "rally", "obstacle"]);
  assert.equal(view.hits[0].right - view.hits[0].left, 14);
});

test("selected, rally, locked, and blocked tiles have distinct footprints", () => {
  const painted = [];
  const rings = [];
  const view = {
    ctx: {
      beginPath() {},
      ellipse: (...args) => rings.push(args),
      fill() { painted.push(["fill", this.fillStyle]); },
      stroke() { painted.push(["stroke", this.strokeStyle]); },
      drawImage() {},
    },
    path() {}, screen: (x, y) => ({ x, y }),
    assets: new Map([["castle", { src: "castle.webp", width: 100, height: 80 }]]),
    image: (src) => src, hits: [], selected: "selected",
  };
  const plan = {
    grid: { ax: 48, ay: 24, bx: -48, by: 24 },
    rallyId: "rally", obstacles: [{ id: "blocked" }], labels: false,
  };
  for (const entity of [
    { id: "selected" }, { id: "rally" }, { id: "locked", locked: true },
    { id: "blocked" },
  ])
    drawEntity(view, { ...entity, skin: "castle", x: 10, y: 20, w: 1, h: 1 }, plan, 1);
  assert.deepEqual(painted, [
    ["fill", "#e7d59728"], ["stroke", "#fff0b4"],
    ["fill", "#22372620"], ["stroke", "#e1c678"],
    ["stroke", "#e6cf86"],
    ["fill", "#22372620"], ["stroke", "#b1d0ba"],
    ["fill", "#513e37aa"], ["stroke", "#e6b19788"],
  ]);
  assert.equal(rings.length, 1);
  assert.deepEqual(rings[0].slice(2, 4), [75, 18]);
});

test("formation renderer paints placed keeps and exposes their hit region", () => {
  const original = globalThis.ResizeObserver;
  const originalRatio = globalThis.devicePixelRatio;
  globalThis.ResizeObserver = class { observe() {} };
  globalThis.devicePixelRatio = 1;
  try {
    const plan = createEmptyPlan();
    plan.showGrid = false;
    plan.labels = false;
    plan.keeps.push({ id: "keep", skin: "missing", x: 600, y: 600, w: 2, h: 2 });
    let painted = 0;
    const ctx = {
      setTransform() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
      closePath() {}, fill() { painted++; }, stroke() {}, fillText() {},
    };
    const canvas = { getContext: () => ctx, parentElement: {} };
    const renderer = new MapRenderer(canvas, () => plan);
    renderer.width = 200;
    renderer.height = 100;
    renderer.center(601, 601);
    assert.ok(painted > 0);
    assert.equal(renderer.hit(100, 50), "keep");
  } finally {
    globalThis.ResizeObserver = original;
    globalThis.devicePixelRatio = originalRatio;
  }
});

test("formation renderer paints overlapping entities back to front", () => {
  const original = globalThis.ResizeObserver;
  const originalRatio = globalThis.devicePixelRatio;
  globalThis.ResizeObserver = class { observe() {} };
  globalThis.devicePixelRatio = 1;
  try {
    const plan = createEmptyPlan();
    plan.showGrid = false;
    plan.labels = false;
    plan.keeps = [
      { id: "front", name: "Front", skin: "front", x: 101, y: 101, w: 2, h: 2 },
      { id: "back", name: "Back", skin: "back", x: 100, y: 100, w: 2, h: 2 },
    ];
    const images = [];
    const ctx = {
      setTransform() {}, fillRect() {}, drawImage: (image) => images.push(image),
    };
    const canvas = { getContext: () => ctx, parentElement: {} };
    const assets = new Map([
      ["front", { src: "front.webp", width: 100, height: 80 }],
      ["back", { src: "back.webp", width: 100, height: 80 }],
    ]);
    const renderer = new MapRenderer(canvas, () => plan, { assets });
    renderer.images.get = (src) => src;
    renderer.width = 400;
    renderer.height = 200;
    renderer.camera.y = 4896;
    renderer.draw();
    assert.deepEqual(images, ["back.webp", "front.webp"]);
    const point = renderer.screen(102, 102);
    assert.equal(renderer.hit(point.x, point.y), "front");
  } finally {
    globalThis.ResizeObserver = original;
    globalThis.devicePixelRatio = originalRatio;
  }
});
