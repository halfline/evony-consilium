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
    },
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
