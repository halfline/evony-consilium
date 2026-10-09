import test from "node:test";
import assert from "node:assert/strict";
import { MapRenderer } from "../web/src/rendering/map-renderer.js";
import { createEmptyPlan } from "../web/src/domain/plan.js";

test("map grid fits the canvas and zoom preserves the pointer world location", () => {
  const previousObserver = globalThis.ResizeObserver;
  const previousDpr = globalThis.devicePixelRatio;
  globalThis.ResizeObserver = class { observe() {} };
  globalThis.devicePixelRatio = 1;
  try {
    let strokes = 0, draws = 0;
    const ctx = {
      setTransform() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
      stroke() { strokes++; },
    };
    const canvas = {
      parentElement: {},
      getContext: () => ctx,
      getBoundingClientRect: () => ({ width: 800, height: 600 }),
    };
    const renderer = new MapRenderer(canvas, createEmptyPlan, { onDraw: () => draws++ });
    renderer.resize();
    renderer.fit();
    assert.equal(canvas.width, 800);
    assert.ok(renderer.camera.zoom > 0);
    assert.ok(strokes > 0);
    const before = renderer.world(300, 200);
    renderer.zoom(1.2, 300, 200);
    const after = renderer.world(300, 200);
    assert.ok(Math.abs(before.x - after.x) < 1e-7);
    assert.ok(Math.abs(before.y - after.y) < 1e-7);
    assert.ok(draws >= 3);
  } finally {
    globalThis.ResizeObserver = previousObserver;
    globalThis.devicePixelRatio = previousDpr;
  }
});
