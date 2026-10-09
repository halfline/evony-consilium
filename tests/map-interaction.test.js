import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { bindMapInteraction } from "../web/src/ui/map-interaction.js";

test("cancel releases a captured drag without committing its preview", () => {
  let plan = createEmptyPlan(), commits = 0;
  plan.keeps.push({ id: "a", x: 10, y: 10, w: 2, h: 2, locked: false });
  const captures = new Set(), canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100 }),
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  };
  const renderer = { hit: () => "a", world: (x, y) => ({ x, y }), draw() {} };
  const interaction = bindMapInteraction({
    canvas, renderer, getPlan: () => plan, getPending: () => null,
    commit: (next) => { plan = next; commits++; },
  });
  canvas.onpointerdown({ button: 0, pointerId: 4, clientX: 10, clientY: 10 });
  canvas.onpointermove({ pointerId: 4, clientX: 14, clientY: 10 });
  interaction.cancel();
  canvas.onpointerup({ pointerId: 4, clientX: 14, clientY: 10 });
  assert.equal(captures.size, 0);
  assert.equal(renderer.preview, null);
  assert.equal(commits, 0);
  assert.equal(plan.keeps[0].x, 10);
});

test("pointer cancellation clears the selected group and releases capture", () => {
  const plan = createEmptyPlan();
  plan.keeps.push({ id: "a", x: 10, y: 10, w: 2, h: 2, locked: false });
  const group = new Set(["a"]), captures = new Set();
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100 }),
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  };
  const renderer = { hit: () => "a", world: (x, y) => ({ x, y }), draw() {} };
  let changes = 0;
  bindMapInteraction({ canvas, renderer, group, getPlan: () => plan,
    getPending: () => null, groupChanged: () => changes++ });
  canvas.onpointerdown({ button: 0, pointerId: 4, clientX: 10, clientY: 10 });
  canvas.onpointermove({ pointerId: 4, clientX: 14, clientY: 10 });
  assert.equal(renderer.preview.x, 14);
  canvas.onpointercancel({ pointerId: 4 });
  assert.equal(group.size, 0);
  assert.equal(changes, 1);
  assert.equal(captures.size, 0);
  assert.equal(renderer.preview, null);
  assert.equal(plan.keeps[0].x, 10);
});

test("dispose releases capture and removes every map listener", () => {
  const captures = new Set();
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  };
  const renderer = { hit: () => null, camera: { x: 0, y: 0, zoom: 1 }, draw() {} };
  const interaction = bindMapInteraction({
    canvas, renderer, getPending: () => null,
  });
  canvas.onpointerdown({ button: 0, pointerId: 7, clientX: 10, clientY: 10 });
  assert.deepEqual([...captures], [7]);
  interaction.dispose();
  assert.equal(captures.size, 0);
  assert.equal(renderer.preview, null);
  for (const name of ["ondblclick", "onpointerdown", "onpointermove", "onpointerup",
    "onpointercancel", "onwheel", "onkeydown"])
    assert.equal(canvas[name], null, name);
});

