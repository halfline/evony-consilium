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

test("dragging a selected keep previews and commits one valid position", () => {
  let plan = createEmptyPlan();
  plan.keeps.push({ id: "keep", x: 10, y: 10, w: 2, h: 2, locked: false });
  const captures = new Set(), selected = [];
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  };
  const renderer = {
    hit: () => "keep", world: (x, y) => ({ x, y }), draw() {},
    preview: null,
  };
  bindMapInteraction({
    canvas, renderer, getPlan: () => plan, getPending: () => null,
    select: (id) => selected.push(id), commit: (next) => { plan = next; },
  });
  canvas.onpointerdown({ button: 0, pointerId: 7, clientX: 10, clientY: 10 });
  canvas.onpointermove({ pointerId: 7, clientX: 14, clientY: 10 });
  assert.equal(renderer.preview.valid, true);
  assert.equal(renderer.preview.x, 14);
  canvas.onpointerup({ pointerId: 7 });
  assert.deepEqual([plan.keeps[0].x, plan.keeps[0].y], [14, 10]);
  assert.equal(renderer.preview, null);
  assert.equal(captures.size, 0);
  assert.deepEqual(selected, ["keep"]);
});

test("clicking a mapped subcity opens its details without beginning a drag", () => {
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  const opened = [];
  bindMapInteraction({
    canvas, renderer: { hitSubcity: () => "city" },
    getPending: () => null, openSubcity: (id) => opened.push(id),
  });
  canvas.onpointerdown({ button: 0, clientX: 20, clientY: 30 });
  assert.deepEqual(opened, ["city"]);
});

test("double-clicking a placed keep opens its player profile", () => {
  const plan = createEmptyPlan();
  plan.keeps.push({ id: "keep", x: 10, y: 10, w: 2, h: 2 });
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  const opened = [];
  bindMapInteraction({
    canvas, renderer: { hit: () => "keep" }, getPlan: () => plan,
    getPending: () => null, resetPending() {},
    openPlayer: (id) => opened.push(id),
  });
  canvas.ondblclick({ clientX: 20, clientY: 30, shiftKey: true });
  assert.deepEqual(opened, []);
  canvas.ondblclick({ clientX: 20, clientY: 30 });
  assert.deepEqual(opened, ["keep"]);
});

test("Delete unplaces selected keep while preserving the player", () => {
  let plan = createEmptyPlan();
  plan.keeps.push({ id: "keep", name: "Player", x: 10, y: 10, w: 2, h: 2, locked: false });
  const canvas = {};
  let selected = "keep", prevented = false;
  bindMapInteraction({
    canvas, getPlan: () => plan, getSelection: () => selected,
    commit: (next) => { plan = next; }, select: (id) => { selected = id; },
  });
  canvas.onkeydown({ key: "Delete", preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(selected, null);
  assert.equal(plan.keeps[0].name, "Player");
  assert.equal(plan.keeps[0].x, null);
});

test("dragging a keep outside the canvas removes only its placement", () => {
  let plan = createEmptyPlan();
  plan.keeps.push({ id: "keep", name: "Player", x: 10, y: 10, w: 2, h: 2, locked: false });
  const captures = new Set();
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100 }),
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  };
  const renderer = { hit: () => "keep", world: (x, y) => ({ x, y }), draw() {} };
  bindMapInteraction({
    canvas, renderer, getPlan: () => plan, getPending: () => null,
    commit: (next) => { plan = next; },
  });
  canvas.onpointerdown({ button: 0, pointerId: 2, clientX: 10, clientY: 10 });
  canvas.onpointermove({ pointerId: 2, clientX: -20, clientY: 10 });
  canvas.onpointerup({ pointerId: 2, clientX: -20, clientY: 10 });
  assert.equal(plan.keeps.length, 1);
  assert.equal(plan.keeps[0].name, "Player");
  assert.equal(plan.keeps[0].x, null);
  assert.equal(captures.size, 0);
});

test("Escape clears pending placement and selection without editing plan", () => {
  const plan = createEmptyPlan();
  const canvas = {};
  let pending = "keep", selected = "keep", prevented = false;
  const renderer = { preview: { id: "keep" }, draw() {} };
  bindMapInteraction({
    canvas, renderer, getPlan: () => plan, getPending: () => pending,
    resetPending: () => { pending = null; },
    select: (id) => { selected = id; },
  });
  canvas.onkeydown({ key: "Escape", preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(pending, null);
  assert.equal(selected, null);
  assert.equal(renderer.preview, null);
  assert.deepEqual(plan.keeps, []);
});

test("Control-Z delegates to map undo and prevents browser undo", () => {
  const canvas = {};
  let undos = 0, prevented = false;
  bindMapInteraction({ canvas, undo: () => { undos++; } });
  canvas.onkeydown({
    key: "z", ctrlKey: true,
    preventDefault: () => { prevented = true; },
  });
  assert.equal(undos, 1);
  assert.equal(prevented, true);
});

test("arrow keys nudge selected keep by one tile", () => {
  let plan = createEmptyPlan();
  plan.keeps.push({ id: "keep", x: 10, y: 10, w: 2, h: 2, locked: false });
  const canvas = {};
  let prevented = false;
  bindMapInteraction({
    canvas, getPlan: () => plan, getSelection: () => "keep",
    commit: (next) => { plan = next; },
  });
  canvas.onkeydown({ key: "ArrowRight", preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual([plan.keeps[0].x, plan.keeps[0].y], [11, 10]);
});

test("modifier clicks toggle multiple placed entities", () => {
  const plan = createEmptyPlan();
  plan.keeps.push(
    { id: "a", x: 10, y: 10, w: 2, h: 2 },
    { id: "b", x: 20, y: 20, w: 2, h: 2 },
  );
  const group = new Set(), canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
  let selected = "a";
  bindMapInteraction({
    canvas, group, getPlan: () => plan, getPending: () => null,
    getSelection: () => selected, select: (id) => { selected = id; },
    renderer: { hit: (x) => x < 50 ? "a" : "b", draw() {} },
  });
  canvas.onpointerdown({ button: 0, ctrlKey: true, clientX: 80, clientY: 0 });
  assert.deepEqual([...group], ["a", "b"]);
  assert.equal(selected, null);
  canvas.onpointerdown({ button: 0, ctrlKey: true, clientX: 10, clientY: 0 });
  assert.deepEqual([...group], ["b"]);
});

test("Shift rubber band selects unlocked entities inside the box", () => {
  const plan = createEmptyPlan();
  plan.keeps.push(
    { id: "a", x: 10, y: 10, w: 2, h: 2 },
    { id: "b", x: 20, y: 20, w: 2, h: 2 },
    { id: "locked", x: 15, y: 15, w: 2, h: 2, locked: true },
  );
  const captures = new Set(), group = new Set(), canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  };
  const renderer = { screen: (x, y) => ({ x, y }), draw() {} };
  let changes = 0;
  bindMapInteraction({
    canvas, renderer, group, getPlan: () => plan, getPending: () => null,
    groupChanged: () => { changes++; },
  });
  canvas.onpointerdown({ button: 0, shiftKey: true, pointerId: 3, clientX: 0, clientY: 0 });
  canvas.onpointermove({ pointerId: 3, clientX: 30, clientY: 30 });
  assert.deepEqual([...group], ["a", "b"]);
  assert.ok(renderer.selectionBox);
  canvas.onpointerup({ pointerId: 3 });
  assert.equal(renderer.selectionBox, null);
  assert.equal(captures.size, 0);
  assert.equal(changes, 1);
});

test("group drag moves both keeps with unchanged relative spacing", () => {
  let plan = createEmptyPlan();
  plan.keeps.push(
    { id: "a", x: 10, y: 10, w: 2, h: 2, locked: false },
    { id: "b", x: 20, y: 20, w: 2, h: 2, locked: false },
  );
  const captures = new Set(), group = new Set(["a", "b"]);
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100 }),
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  };
  const renderer = { hit: () => "a", world: (x, y) => ({ x, y }), draw() {} };
  bindMapInteraction({
    canvas, renderer, group, getPlan: () => plan, getPending: () => null,
    commit: (next) => { plan = next; },
  });
  canvas.onpointerdown({ button: 0, pointerId: 9, clientX: 10, clientY: 10 });
  canvas.onpointermove({ pointerId: 9, clientX: 13, clientY: 14 });
  assert.equal(renderer.previews.length, 2);
  assert.equal(renderer.previews.every(({ valid }) => valid), true);
  canvas.onpointerup({ pointerId: 9, clientX: 13, clientY: 14 });
  assert.deepEqual(plan.keeps.map(({ x, y }) => [x, y]), [[13, 14], [23, 24]]);
  assert.equal(captures.size, 0);
});

test("Delete unplaces every group member and keeps both players", () => {
  let plan = createEmptyPlan();
  plan.keeps.push(
    { id: "a", x: 10, y: 10, w: 2, h: 2, locked: false },
    { id: "b", x: 20, y: 20, w: 2, h: 2, locked: false },
  );
  const group = new Set(["a", "b"]), canvas = {};
  bindMapInteraction({
    canvas, group, getPlan: () => plan, getSelection: () => null,
    commit: (next) => { plan = next; },
  });
  canvas.onkeydown({ key: "Delete", preventDefault() {} });
  assert.equal(plan.keeps.length, 2);
  assert.deepEqual(plan.keeps.map(({ x }) => x), [null, null]);
  assert.equal(group.size, 0);
});

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
