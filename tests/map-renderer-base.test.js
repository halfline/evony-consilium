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
      setTransform() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
      stroke() { strokes++; },
      createRadialGradient: () => ({ addColorStop() {} }),
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

test("Server maps expose painted subcity marker hit regions", () => {
  const previousObserver = globalThis.ResizeObserver;
  const previousDpr = globalThis.devicePixelRatio;
  globalThis.ResizeObserver = class { observe() {} };
  globalThis.devicePixelRatio = 1;
  try {
    const ctx = new Proxy({}, { get: (_target, key) => key === "measureText"
      ? () => ({ width: 10 }) : key === "createRadialGradient"
        ? () => ({ addColorStop() {} }) : () => {} });
    const canvas = {
      parentElement: {}, getContext: () => ctx,
      getBoundingClientRect: () => ({ width: 800, height: 600 }),
    };
    const plan = createEmptyPlan();
    plan.map = "server";
    plan.subcities = [{ id: "city", name: "Harbor", culture: "Europe", color: "gold", x: 600, y: 600 }];
    const renderer = new MapRenderer(canvas, () => plan);
    renderer.resize();
    renderer.fit();
    const point = renderer.screen(600, 600);
    assert.equal(renderer.hitSubcity(point.x, point.y), "city");
    plan.map = "boc";
    renderer.draw();
    assert.equal(renderer.hitSubcity(point.x, point.y), null);
  } finally {
    globalThis.ResizeObserver = previousObserver;
    globalThis.devicePixelRatio = previousDpr;
  }
});

test("fit frames placed formation more closely than the whole map", () => {
  const previousObserver = globalThis.ResizeObserver;
  const previousDpr = globalThis.devicePixelRatio;
  globalThis.ResizeObserver = class { observe() {} };
  globalThis.devicePixelRatio = 1;
  try {
    const ctx = new Proxy({}, { get: (_target, key) => key === "measureText"
      ? () => ({ width: 10 }) : key === "createRadialGradient"
        ? () => ({ addColorStop() {} }) : () => {} });
    const canvas = { parentElement: {}, getContext: () => ctx,
      getBoundingClientRect: () => ({ width: 800, height: 600 }) };
    const plan = createEmptyPlan();
    plan.keeps.push({ id: "a", name: "A", skin: "missing", x: 600, y: 600,
      w: 2, h: 2, locked: false });
    const renderer = new MapRenderer(canvas, () => plan);
    renderer.resize();
    renderer.fit(true);
    const wholeZoom = renderer.camera.zoom;
    renderer.fit();
    assert.ok(renderer.camera.zoom > wholeZoom);
    assert.ok(renderer.camera.zoom <= 1.1);
  } finally {
    globalThis.ResizeObserver = previousObserver;
    globalThis.devicePixelRatio = previousDpr;
  }
});

test("map boundary remains visible when the grid is hidden", () => {
  const previousObserver = globalThis.ResizeObserver;
  const previousDpr = globalThis.devicePixelRatio;
  globalThis.ResizeObserver = class { observe() {} };
  globalThis.devicePixelRatio = 1;
  try {
    const strokes = [];
    const ctx = new Proxy({}, { get: (target, key) => key === "stroke"
      ? () => strokes.push(target.strokeStyle) : key === "createRadialGradient"
        ? () => ({ addColorStop() {} }) : target[key] ?? (() => {}) });
    const canvas = { parentElement: {}, getContext: () => ctx,
      getBoundingClientRect: () => ({ width: 800, height: 600 }) };
    const plan = createEmptyPlan();
    const renderer = new MapRenderer(canvas, () => plan);
    renderer.resize();
    assert.ok(strokes.includes("#17261b35"));
    assert.ok(strokes.includes("#e1d2a255"));
    const gridStrokes = strokes.filter((style) => style === "#17261b35").length;
    plan.showGrid = false;
    renderer.draw();
    assert.equal(strokes.filter((style) => style === "#17261b35").length, gridStrokes);
    assert.equal(strokes.at(-1), "#e1d2a255");
  } finally {
    globalThis.ResizeObserver = previousObserver;
    globalThis.devicePixelRatio = previousDpr;
  }
});

test("map vignette shades the canvas edge after painting", () => {
  const previousDpr = globalThis.devicePixelRatio;
  globalThis.devicePixelRatio = 1;
  try {
    const plan = createEmptyPlan();
    plan.showGrid = false;
    const stops = [], gradients = [], fills = [];
    const gradient = { addColorStop: (...args) => stops.push(args) };
    const ctx = {
      setTransform() {}, beginPath() {}, moveTo() {}, lineTo() {},
      closePath() {}, stroke() {},
      fillRect(...args) { fills.push([this.fillStyle, ...args]); },
      createRadialGradient(...args) { gradients.push(args); return gradient; },
    };
    const renderer = Object.assign(Object.create(MapRenderer.prototype), {
      ctx, width: 400, height: 300,
      camera: { x: 0, y: 0, zoom: 1 },
      getPlan: () => plan, terrainFor: () => undefined, onDraw() {},
    });
    renderer.draw();
    assert.deepEqual(gradients, [[200, 150, 50, 200, 150, 260]]);
    assert.deepEqual(stops, [[0, "#16271a00"], [1, "#14241b55"]]);
    assert.deepEqual(fills.at(-1), [gradient, 0, 0, 400, 300]);
  } finally {
    globalThis.devicePixelRatio = previousDpr;
  }
});
