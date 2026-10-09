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
