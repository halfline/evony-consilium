import test from "node:test";
import assert from "node:assert/strict";
import { bindMapInteraction } from "../web/src/ui/map-interaction.js";

function setup(kind = "keeps", locked = false) {
  let plan = {
    map: "blank",
    extent: 1000,
    keeps: [],
    structures: [],
    obstacles: [],
  };
  plan[kind].push({ id: "object", x: 100, y: 100, w: 2, h: 2, locked });
  let changes = 0;
  let keydown;
  globalThis.document = {
    getElementById: () => ({}),
    removeEventListener: (type, fn) => {
      if (type === "keydown" && keydown === fn) keydown = null;
    },
    addEventListener: (type, fn) => {
      if (type === "keydown") keydown = fn;
    },
  };
  const canvas = {
    style: {},
    focus() {},
    setPointerCapture() {},
    hasPointerCapture: () => false,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  };
  const renderer = {
    camera: { x: 0, y: 0, zoom: 1 },
    hit: () => "object",
    screen: (x, y) => ({ x: x - 90, y: y - 90 }),
    world: (x, y) => ({ x: x + 90, y: y + 90 }),
    draw() {},
  };
  const group = new Set();
  const interaction = bindMapInteraction({
    group,
    canvas,
    renderer,
    getPlan: () => plan,
    getPending: () => null,
    entities: () => [...plan.keeps, ...plan.structures, ...plan.obstacles],
    selected: () => null,
    select() {},
    resetPending() {},
    toast() {},
    undo() {},
    commit(next) {
      plan = next;
      changes++;
    },
    mutate(fn) {
      const next = structuredClone(plan);
      fn(next);
      plan = next;
      changes++;
    },
  });
  const event = (x) => ({ button: 0, pointerId: 1, clientX: x, clientY: 10 });
  return {
    canvas,
    renderer,
    group,
    interaction,
    plan: () => plan,
    changes: () => changes,
    event,
    keydown: (ev) => keydown?.(ev),
  };
}

for (const key of ["Delete", "Backspace"]) {
  test(`document-routed ${key} unplaces the focused canvas selection`, () => {
    const s = setup();
    s.group.add("object");
    let prevented = false;
    s.keydown({
      target: s.canvas,
      key,
      preventDefault() { prevented = true; },
    });
    assert.equal(prevented, true);
    assert.equal(s.changes(), 1);
    assert.equal(s.plan().keeps[0].x, null);
    assert.equal(s.plan().keeps.length, 1);
  });
}

for (const kind of ["keeps", "structures", "obstacles"]) {
  test(`dragging ${kind} outside the viewport removes only its map placement`, () => {
    const s = setup(kind);
    s.canvas.onpointerdown(s.event(10));
    s.canvas.onpointermove(s.event(120));
    s.canvas.onpointerup(s.event(120));
    assert.equal(s.changes(), 1);
    if (kind === "keeps") assert.equal(s.plan().keeps[0].x, null);
    else assert.equal(s.plan()[kind].length, 0);
  });
}
test("locked objects and canceled drags stay placed", () => {
  for (const locked of [true, false]) {
    const s = setup("keeps", locked);
    s.canvas.onpointerdown(s.event(10));
    s.canvas.onpointermove(s.event(120));
    if (locked) s.canvas.onpointerup(s.event(120));
    else s.canvas.onpointercancel();
    assert.equal(s.changes(), 0);
    assert.equal(s.plan().keeps[0].x, 100);
  }
});

test("rubber band selects multiple objects and Delete removes them together", () => {
  const s = setup();
  s.plan().keeps.push({
    id: "second",
    x: 120,
    y: 120,
    w: 2,
    h: 2,
    locked: false,
  });
  s.plan().keeps.push({
    id: "locked",
    x: 110,
    y: 110,
    w: 2,
    h: 2,
    locked: true,
  });
  s.canvas.onpointerdown({ ...s.event(0), clientY: 0, shiftKey: true });
  s.canvas.onpointermove({ ...s.event(50), clientY: 50 });
  s.canvas.onpointerup({ ...s.event(50), clientY: 50 });
  s.canvas.onkeydown({ key: "Delete", preventDefault() {} });
  assert.equal(s.changes(), 1);
  assert.equal(s.plan().keeps[0].x, null);
  assert.equal(s.plan().keeps[1].x, null);
  assert.equal(s.plan().keeps[2].x, 110);
});

test("Ctrl/Command-click toggles individual objects in a rubber-band selection", () => {
  const s = setup();
  s.plan().keeps.push({
    id: "second",
    x: 120,
    y: 120,
    w: 2,
    h: 2,
    locked: false,
  });
  s.canvas.onpointerdown({ ...s.event(0), clientY: 0, shiftKey: true });
  s.canvas.onpointermove({ ...s.event(50), clientY: 50 });
  s.canvas.onpointerup({ ...s.event(50), clientY: 50 });
  assert.equal(s.group.size, 2);
  s.canvas.onpointerdown({ ...s.event(10), ctrlKey: true });
  assert.deepEqual([...s.group], ["second"]);
  s.canvas.onpointerdown({ ...s.event(10), metaKey: true });
  assert.equal(s.group.size, 2);
  s.canvas.onkeydown({ key: "Delete", preventDefault() {} });
  assert.equal(s.changes(), 1);
  assert.ok(s.plan().keeps.every((keep) => keep.x === null));
});

for (const blocked of [false, true]) {
  test(`group drag ${blocked ? "rejects the entire move if one member is blocked" : "preserves spacing and allows moving through members’ old positions"}`, () => {
    const s = setup();
    s.plan().keeps.push({
      id: "second",
      x: 120,
      y: 100,
      w: 2,
      h: 2,
      locked: false,
    });
    if (blocked)
      s.plan().obstacles.push({
        id: "block",
        x: 140,
        y: 100,
        w: 2,
        h: 2,
        locked: false,
      });
    s.group.add("object");
    s.group.add("second");
    s.canvas.onpointerdown(s.event(10));
    s.canvas.onpointermove(s.event(30));
    assert.equal(s.renderer.previews.length, 2);
    s.canvas.onpointerup(s.event(30));
    assert.equal(s.changes(), blocked ? 0 : 1);
    assert.deepEqual(
      s.plan().keeps.map((e) => e.x),
      blocked ? [100, 120] : [120, 140],
    );
    assert.equal(s.group.size, 2);
    assert.equal(s.renderer.previews, null);
  });
}
test("canceling a group drag leaves every member in place", () => {
  const s = setup();
  s.plan().keeps.push({
    id: "second",
    x: 120,
    y: 100,
    w: 2,
    h: 2,
    locked: false,
  });
  s.group.add("object");
  s.group.add("second");
  s.canvas.onpointerdown(s.event(10));
  s.canvas.onpointermove(s.event(30));
  s.canvas.onpointercancel();
  assert.equal(s.changes(), 0);
  assert.deepEqual(
    s.plan().keeps.map((e) => e.x),
    [100, 120],
  );
});

test("canceling navigation clears the drag preview without committing movement", () => {
  const s = setup();
  s.canvas.onpointerdown(s.event(10));
  s.canvas.onpointermove(s.event(30));
  assert.ok(s.renderer.preview);
  s.interaction.cancel();
  s.canvas.onpointerup(s.event(30));
  assert.equal(s.renderer.preview, null);
  assert.equal(s.renderer.previews, null);
  assert.equal(s.renderer.selectionBox, null);
  assert.equal(s.changes(), 0);
  assert.equal(s.plan().keeps[0].x, 100);
});

test("disposed map interaction removes pointer and keyboard handlers", () => {
  const s = setup();
  s.canvas.closest = () => null;
  s.interaction.dispose();
  assert.equal(s.canvas.onpointerdown, null);
  assert.equal(s.canvas.onpointerup, null);
  s.group.add("object");
  s.keydown({ target: s.canvas, key: "Delete", preventDefault() {} });
  assert.equal(s.changes(), 0);
});
