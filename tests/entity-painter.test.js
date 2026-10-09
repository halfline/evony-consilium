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
  assert.equal(view.hits[0].id, "keep");
  assert.ok(view.hits[0].left < 11 && view.hits[0].right > 11);
});

test("entity labels follow the map preference and mark the rally keep", () => {
  const labels = [];
  const view = {
    ctx: {
      drawImage() {},
      fillText: (label) => labels.push(label),
      beginPath() {}, arc() {}, fill() {}, stroke() {},
    },
    path() {},
    screen: (x, y) => ({ x, y }),
    assets: new Map([["castle", { src: "castle.webp", width: 100, height: 80 }]]),
    image: (src) => src,
    hits: [],
  };
  const entity = { id: "keep", name: "Central Keep", skin: "castle", x: 10, y: 20, w: 2, h: 2 };
  const plan = { labels: true, rallyId: "keep", grid: { ax: 48, ay: 24, bx: -48, by: 24 } };
  drawEntity(view, entity, plan, 1);
  assert.deepEqual(labels, ["★ Central Keep"]);
  plan.labels = false;
  drawEntity(view, entity, plan, 1);
  assert.deepEqual(labels, ["★ Central Keep"]);
  plan.labels = true;
  drawEntity(view, entity, plan, 0.1);
  assert.deepEqual(labels, ["★ Central Keep"]);
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
  const view = {
    ctx: {
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
    ["fill", "#22372620"], ["stroke", "#b1d0ba"],
    ["fill", "#513e37aa"], ["stroke", "#e6b19788"],
  ]);
});

test("formation renderer paints placed keeps and exposes their hit region", () => {
  const original = globalThis.ResizeObserver;
  const originalRatio = globalThis.devicePixelRatio;
  globalThis.ResizeObserver = class { observe() {} };
  globalThis.devicePixelRatio = 1;
  try {
    const plan = createEmptyPlan();
    plan.showGrid = false;
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
    renderer.draw();
    assert.deepEqual(images, ["back.webp", "front.webp"]);
    const point = renderer.screen(102, 102);
    assert.equal(renderer.hit(point.x, point.y), "front");
  } finally {
    globalThis.ResizeObserver = original;
    globalThis.devicePixelRatio = originalRatio;
  }
});
