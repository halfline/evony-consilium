import test from "node:test";
import assert from "node:assert/strict";
import { MapRenderer } from "../web/src/rendering/map-renderer.js";
import { createEmptyPlan } from "../web/src/domain/plan.js";

test("map background uses the active map anchor, dimensions, and opacity", () => {
  const originalObserver = globalThis.ResizeObserver;
  const originalRatio = globalThis.devicePixelRatio;
  globalThis.ResizeObserver = class { observe() {} };
  globalThis.devicePixelRatio = 1;
  try {
    const plan = createEmptyPlan();
    plan.showGrid = false;
    plan.backgrounds[plan.map] = {
      src: "custom.webp", x: 2, y: 3, width: 600, height: 400, opacity: 0.4,
    };
    const calls = [];
    const ctx = {
      setTransform() {}, fillRect() {}, save() { calls.push("save"); },
      restore() { calls.push("restore"); },
      beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {},
      translate(...args) { calls.push(["translate", ...args]); },
      scale(...args) { calls.push(["scale", ...args]); },
      set globalAlpha(value) { calls.push(["alpha", value]); },
      drawImage(...args) { calls.push(["image", ...args]); },
    };
    const renderer = new MapRenderer(
      { getContext: () => ctx, parentElement: {} }, () => plan);
    renderer.images.get = (src) => src;
    renderer.width = 400;
    renderer.height = 300;
    renderer.draw();
    assert.deepEqual(calls, [
      "save", ["translate", 200, 150], ["scale", 1, 1], ["alpha", 0.4],
      ["image", "custom.webp", -48, 120, 600, 400], "restore",
    ]);
    calls.length = 0;
    plan.backgrounds[plan.map].src = "missing.webp";
    renderer.images.get = () => null;
    renderer.draw();
    assert.deepEqual(calls, []);
  } finally {
    globalThis.ResizeObserver = originalObserver;
    globalThis.devicePixelRatio = originalRatio;
  }
});
