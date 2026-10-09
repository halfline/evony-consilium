import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { bindMapInteraction } from "../web/src/ui/map-interaction.js";

test("pending keep placement commits only a free tile", () => {
  const plan = createEmptyPlan();
  plan.keeps.push({ id: "keep", x: null, y: null, w: 2, h: 2 });
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  let pending = "keep", message = "", at = { x: 1200, y: 0 };
  bindMapInteraction({
    canvas, renderer: { world: () => at }, getPlan: () => plan,
    getPending: () => pending, resetPending: () => { pending = null; },
    mutate: (change) => change(plan), toast: (text) => { message = text; },
  });
  canvas.onpointerdown({ button: 0, clientX: 0, clientY: 0 });
  assert.match(message, /free tile/);
  assert.equal(plan.keeps[0].x, null);
  at = { x: 600, y: 600 };
  canvas.onpointerdown({ button: 0, clientX: 0, clientY: 0 });
  assert.deepEqual([plan.keeps[0].x, plan.keeps[0].y], [600, 600]);
  assert.equal(pending, null);
});

test("dragging empty canvas pans the camera and releases pointer capture", () => {
  const captures = new Set();
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  };
  let draws = 0;
  const renderer = {
    camera: { x: 10, y: 20, zoom: 2 },
    hit: () => null,
    draw: () => { draws++; },
  };
  bindMapInteraction({ canvas, renderer, getPending: () => null });
  canvas.onpointerdown({ button: 0, pointerId: 1, clientX: 10, clientY: 20 });
  canvas.onpointermove({ pointerId: 1, clientX: 30, clientY: 40 });
  assert.deepEqual([renderer.camera.x, renderer.camera.y], [0, 10]);
  assert.equal(draws, 1);
  canvas.onpointerup({ pointerId: 1 });
  assert.equal(captures.size, 0);
  canvas.onpointermove({ pointerId: 1, clientX: 50, clientY: 60 });
  assert.deepEqual([renderer.camera.x, renderer.camera.y], [0, 10]);
});

test("mouse wheel zooms around the pointer and suppresses page scrolling", () => {
  const canvas = { getBoundingClientRect: () => ({ left: 5, top: 10 }) };
  const zooms = [];
  bindMapInteraction({
    canvas,
    renderer: { zoom: (...args) => zooms.push(args) },
    getPending: () => null,
  });
  let prevented = false;
  canvas.onwheel({
    clientX: 25, clientY: 40, deltaY: -100,
    preventDefault: () => { prevented = true; },
  });
  assert.equal(prevented, true);
  assert.deepEqual(zooms[0].slice(1), [20, 30]);
  assert.ok(zooms[0][0] > 1);
});
