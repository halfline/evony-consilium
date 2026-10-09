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
    style: {},
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
  assert.equal(canvas.style.cursor, "grabbing");
  assert.equal(draws, 1);
  canvas.onpointerup({ pointerId: 1 });
  assert.equal(captures.size, 0);
  assert.equal(canvas.style.cursor, "default");
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

test("canvas cursor distinguishes pending placement, entity hover, and empty map", () => {
  const canvas = { style: {}, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  const plan = createEmptyPlan();
  plan.keeps.push({ id: "keep", x: null, y: null, w: 2, h: 2 });
  let pending = null;
  bindMapInteraction({ canvas,
    renderer: { hit: (x) => x < 50 ? "keep" : null,
      world: () => ({ x: 10, y: 10 }), draw() {} },
    getPlan: () => plan, getPending: () => pending });
  canvas.onpointermove({ clientX: 20, clientY: 10 });
  assert.equal(canvas.style.cursor, "grab");
  canvas.onpointermove({ clientX: 80, clientY: 10 });
  assert.equal(canvas.style.cursor, "default");
  pending = "keep";
  canvas.onpointermove({ clientX: 80, clientY: 10 });
  assert.equal(canvas.style.cursor, "crosshair");
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
  canvas.onpointermove({ pointerId: 7, clientX: 16, clientY: 10 });
  assert.equal(renderer.preview.valid, true);
  assert.equal(renderer.preview.x, 16);
  canvas.onpointerup({ pointerId: 7 });
  assert.deepEqual([plan.keeps[0].x, plan.keeps[0].y], [16, 10]);
  assert.equal(renderer.preview, null);
  assert.equal(captures.size, 0);
  assert.deepEqual(selected, ["keep"]);
});

test("a slight pointer movement does not commit a keep drag", () => {
  let plan = createEmptyPlan(), commits = 0;
  plan.keeps.push({ id: "keep", x: 10, y: 10, w: 2, h: 2, locked: false });
  const captures = new Set();
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100 }),
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  };
  const renderer = { hit: () => "keep", world: (x, y) => ({ x, y }), draw() {} };
  bindMapInteraction({ canvas, renderer, getPlan: () => plan, getPending: () => null,
    commit: (next) => { plan = next; commits++; } });
  canvas.onpointerdown({ button: 0, pointerId: 5, clientX: 10, clientY: 10 });
  canvas.onpointermove({ pointerId: 5, clientX: 13, clientY: 10 });
  assert.equal(renderer.preview.x, 13);
  canvas.onpointerup({ pointerId: 5, clientX: 13, clientY: 10 });
  assert.equal(commits, 0);
  assert.equal(plan.keeps[0].x, 10);
  assert.equal(captures.size, 0);
});

test("clicking a mapped subcity opens its details without beginning a drag", () => {
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  const opened = [];
  bindMapInteraction({
    canvas, renderer: { hitSubcity: () => "city", hit: () => null },
    getPlan: createEmptyPlan, getPending: () => null,
    openSubcity: (id) => opened.push(id),
  });
  canvas.onpointerdown({ button: 0, clientX: 20, clientY: 30 });
  assert.deepEqual(opened, ["city"]);
  canvas.onpointerdown({ button: 0, ctrlKey: true, clientX: 20, clientY: 30 });
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

test("Backspace unplaces selected keep without deleting its player", () => {
  let plan = createEmptyPlan();
  plan.keeps.push({ id: "keep", name: "Player", x: 10, y: 10, w: 2, h: 2, locked: false });
  const canvas = {};
  bindMapInteraction({ canvas, getPlan: () => plan, getSelection: () => "keep",
    commit: (next) => { plan = next; } });
  let prevented = false;
  canvas.onkeydown({ key: "Backspace", preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(plan.keeps[0].name, "Player");
  assert.equal(plan.keeps[0].x, null);
});

test("removing a selection also clears pending placement", () => {
  let plan = createEmptyPlan();
  plan.keeps.push({ id: "keep", x: 10, y: 10, w: 2, h: 2, locked: false });
  let pending = "obstacle";
  const canvas = {};
  bindMapInteraction({ canvas, getPlan: () => plan, getSelection: () => "keep",
    resetPending: () => { pending = null; },
    commit: (next) => { plan = next; } });
  canvas.onkeydown({ key: "Delete", preventDefault() {} });
  assert.equal(plan.keeps[0].x, null);
  assert.equal(pending, null);
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

test("a drag beyond world bounds unplaces the keep even inside the canvas", () => {
  let plan = createEmptyPlan();
  plan.keeps.push({ id: "keep", name: "Player", x: 10, y: 10, w: 2, h: 2, locked: false });
  const captures = new Set();
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100 }),
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  };
  const renderer = { hit: () => "keep", world: (x, y) => ({ x: x * 20, y }), draw() {} };
  bindMapInteraction({
    canvas, renderer, getPlan: () => plan, getPending: () => null,
    commit: (next) => { plan = next; },
  });
  canvas.onpointerdown({ button: 0, pointerId: 2, clientX: 10, clientY: 10 });
  canvas.onpointermove({ pointerId: 2, clientX: 80, clientY: 10 });
  assert.ok(renderer.preview.x > plan.extent);
  canvas.onpointerup({ pointerId: 2, clientX: 80, clientY: 10 });
  assert.equal(plan.keeps[0].x, null);
  assert.equal(captures.size, 0);
});

test("an occupied destination keeps the placement and explains the rejection", () => {
  let plan = createEmptyPlan();
  plan.keeps.push(
    { id: "a", x: 10, y: 10, w: 2, h: 2, locked: false },
    { id: "b", x: 16, y: 10, w: 2, h: 2, locked: false },
  );
  const captures = new Set();
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100 }),
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  };
  const renderer = { hit: () => "a", world: (x, y) => ({ x, y }), draw() {} };
  let message = "";
  bindMapInteraction({ canvas, renderer, getPlan: () => plan, getPending: () => null,
    commit: (next) => { plan = next; }, toast: (text) => { message = text; } });
  canvas.onpointerdown({ button: 0, pointerId: 2, clientX: 10, clientY: 10 });
  canvas.onpointermove({ pointerId: 2, clientX: 16, clientY: 10 });
  assert.equal(renderer.preview.valid, false);
  canvas.onpointerup({ pointerId: 2, clientX: 16, clientY: 10 });
  assert.deepEqual(plan.keeps.map(({ x, y }) => [x, y]), [[10, 10], [16, 10]]);
  assert.match(message, /Position blocked/);
  assert.equal(captures.size, 0);
});

test("dragging a locked position explains the lock without moving it", () => {
  const plan = createEmptyPlan();
  plan.keeps.push({ id: "keep", x: 10, y: 10, w: 2, h: 2, locked: true });
  const captures = new Set();
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100 }),
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  };
  let message = "";
  bindMapInteraction({ canvas, renderer: { hit: () => "keep" },
    getPlan: () => plan, getPending: () => null,
    toast: (text) => { message = text; } });
  canvas.onpointerdown({ button: 0, pointerId: 3, clientX: 10, clientY: 10 });
  canvas.onpointermove({ pointerId: 3, clientX: 20, clientY: 10 });
  canvas.onpointerup({ pointerId: 3, clientX: 20, clientY: 10 });
  assert.match(message, /Unlock this position/);
  assert.deepEqual([plan.keeps[0].x, plan.keeps[0].y], [10, 10]);
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

test("document shortcuts work outside canvas and are disposed", () => {
  const original = globalThis.document;
  let keydown = null, removed = null;
  globalThis.document = {
    addEventListener: (_type, handler) => { keydown = handler; },
    removeEventListener: (_type, handler) => { removed = handler; },
  };
  try {
    const group = new Set(["keep"]), canvas = {};
    const renderer = { preview: { id: "keep" }, draw() {} };
    let pending = "keep", undos = 0, prevented = false;
    const interaction = bindMapInteraction({ canvas, renderer, group,
      canEdit: () => true, undo: () => undos++,
      resetPending: () => { pending = null; } });
    const target = { closest: () => null };
    keydown({ key: "z", ctrlKey: true, target,
      preventDefault: () => { prevented = true; } });
    assert.equal(undos, 1);
    assert.equal(prevented, true);
    keydown({ key: "Escape", target });
    assert.equal(pending, null);
    assert.equal(group.size, 0);
    assert.equal(renderer.preview, null);
    keydown({ key: "z", ctrlKey: true, target: { closest: () => ({}) },
      preventDefault() {} });
    assert.equal(undos, 1);
    interaction.dispose();
    assert.equal(removed, keydown);
  } finally {
    globalThis.document = original;
  }
});

test("plus and minus keys zoom the focused map canvas", () => {
  const canvas = {};
  const factors = [];
  bindMapInteraction({ canvas, renderer: { zoom: (factor) => factors.push(factor) } });
  let prevented = 0;
  for (const key of ["+", "=", "-"])
    canvas.onkeydown({ key, preventDefault: () => prevented++ });
  assert.deepEqual(factors, [1.2, 1.2, 1 / 1.2]);
  assert.equal(prevented, 3);
});

test("read-only maps ignore editing keyboard shortcuts", () => {
  let plan = createEmptyPlan();
  plan.keeps.push({ id: "keep", x: 10, y: 10, w: 2, h: 2 });
  const canvas = {};
  const actions = [];
  bindMapInteraction({ canvas, canEdit: () => false,
    renderer: { zoom: () => actions.push("zoom") },
    getPlan: () => plan, getSelection: () => "keep",
    commit: (next) => { plan = next; actions.push("commit"); },
    undo: () => actions.push("undo") });
  for (const key of ["Delete", "+", "z"])
    canvas.onkeydown({ key, ctrlKey: key === "z", preventDefault() {} });
  assert.deepEqual(actions, []);
  assert.equal(plan.keeps[0].x, 10);
});

test("read-only viewers can pan when starting on a keep", () => {
  const plan = createEmptyPlan();
  plan.keeps.push({ id: "keep", x: 10, y: 10, w: 2, h: 2 });
  const captures = new Set();
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  };
  const renderer = { hit: () => "keep", camera: { x: 10, y: 20, zoom: 2 }, draw() {} };
  bindMapInteraction({ canvas, renderer, getPlan: () => plan,
    getPending: () => null, canEdit: () => false });
  canvas.onpointerdown({ button: 0, pointerId: 1, clientX: 10, clientY: 20 });
  canvas.onpointermove({ pointerId: 1, clientX: 30, clientY: 40 });
  assert.deepEqual([renderer.camera.x, renderer.camera.y], [0, 10]);
  canvas.onpointerup({ pointerId: 1 });
  assert.equal(captures.size, 0);
  assert.deepEqual([plan.keeps[0].x, plan.keeps[0].y], [10, 10]);
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

test("dragging a group off canvas unplaces all members", () => {
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
  canvas.onpointermove({ pointerId: 9, clientX: 110, clientY: 10 });
  canvas.onpointerup({ pointerId: 9, clientX: 110, clientY: 10 });
  assert.deepEqual(plan.keeps.map(({ x, y }) => [x, y]), [[null, null], [null, null]]);
  assert.equal(group.size, 0);
  assert.equal(captures.size, 0);
});

test("pending obstacle is placed with the same validity check as a keep", () => {
  const plan = createEmptyPlan();
  plan.obstacles.push({ id: "blocked", name: "Blocked tile", w: 1, h: 1,
    x: null, y: null, locked: false });
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  const renderer = { world: (x, y) => ({ x, y }) };
  let pending = "blocked";
  bindMapInteraction({
    canvas, renderer, getPlan: () => plan, getPending: () => pending,
    resetPending: () => { pending = null; },
    mutate: (change) => change(plan),
  });
  canvas.onpointerdown({ button: 0, clientX: 10, clientY: 20 });
  assert.deepEqual([plan.obstacles[0].x, plan.obstacles[0].y], [10, 20]);
  assert.equal(pending, null);
});

test("pending placement previews valid and invalid map tiles", () => {
  const plan = createEmptyPlan();
  plan.obstacles.push({ id: "blocked", name: "Blocked tile", w: 1, h: 1,
    x: null, y: null, locked: false });
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  let draws = 0;
  const renderer = { world: (x, y) => ({ x, y }), draw: () => { draws++; } };
  bindMapInteraction({ canvas, renderer, getPlan: () => plan,
    getPending: () => "blocked" });
  canvas.onpointermove({ clientX: 10, clientY: 20 });
  assert.deepEqual([renderer.preview.x, renderer.preview.y, renderer.preview.valid],
    [10, 20, true]);
  canvas.onpointermove({ clientX: -1, clientY: 20 });
  assert.equal(renderer.preview.valid, false);
  assert.equal(draws, 2);
});
