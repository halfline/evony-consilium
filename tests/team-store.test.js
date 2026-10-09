import test from "node:test";
import assert from "node:assert/strict";
import { TeamStore } from "../web/src/application/team-store.js";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { createMapPlan } from "../web/src/domain/map-plans.js";
import { catalog } from "./fixtures/catalog.js";

test("team store validates and freezes opened documents", () => {
  const store = new TeamStore();
  const plan = { ...createEmptyPlan(), title: "Shared" };
  store.replace(plan);
  plan.title = "Mutated outside";
  assert.equal(store.plan.title, "Shared");
  assert.equal(Object.isFrozen(store.plan), true);
  assert.throws(() => store.replace({ ...plan, keeps: {} }), /player list/);
  assert.equal(store.plan.title, "Shared");
});

test("view-only team cannot replace its document without explicit force", () => {
  const store = new TeamStore();
  store.readOnly = true;
  assert.equal(
    store.replace({ ...createEmptyPlan(), title: "Blocked" }),
    false,
  );
  assert.equal(store.plan.title, "Alliance formation");
  store.replace({ ...createEmptyPlan(), title: "Downloaded" }, { force: true });
  assert.equal(store.plan.title, "Downloaded");
});

test("team edits use immutable transactions and ignore no-op changes", () => {
  const store = new TeamStore();
  const events = [];
  store.subscribe(({ kind }) => events.push(kind));
  assert.equal(
    store.mutate((plan) => {
      plan.title = "Alliance Alpha";
    }),
    true,
  );
  assert.equal(store.plan.title, "Alliance Alpha");
  assert.equal(
    store.mutate((plan) => {
      plan.title = "Alliance Alpha";
    }),
    false,
  );
  assert.deepEqual(events, ["edit"]);
  store.readOnly = true;
  assert.equal(
    store.mutate((plan) => {
      plan.title = "Blocked";
    }),
    false,
  );
  assert.equal(store.plan.title, "Alliance Alpha");
});

test("Undo restores the previous team edit and respects read-only access", () => {
  const store = new TeamStore();
  assert.equal(store.canUndo, false);
  store.mutate((plan) => {
    plan.title = "First";
  });
  store.mutate((plan) => {
    plan.title = "Second";
  });
  store.readOnly = true;
  assert.equal(store.canUndo, false);
  assert.equal(store.undo(), false);
  store.readOnly = false;
  assert.equal(store.undo(), true);
  assert.equal(store.plan.title, "First");
  assert.equal(store.undo(), true);
  assert.equal(store.plan.title, "Alliance formation");
  assert.equal(store.undo(), false);
});

test("player transactions update castle growth and keep the asset lookup current", () => {
  const store = new TeamStore(catalog);
  const plan = createEmptyPlan();
  plan.keeps.push({
    id: "one", name: "Player", accountId: "", allianceTag: "", level: 42,
    skin: "map-evony3-castle_lv1", w: 2, h: 2, x: null, y: null, locked: false,
  });
  store.replace(plan);
  assert.equal(store.plan.keeps[0].skin, "map-evony3-castle_lv8");
  assert.equal(store.assets.get(store.plan.keeps[0].skin).minKeepLevel, 40);
  store.mutate((draft) => { draft.keeps[0].level = 1; });
  assert.equal(store.plan.keeps[0].skin, "map-evony3-castle_lv1");
  store.undo();
  assert.equal(store.plan.keeps[0].skin, "map-evony3-castle_lv8");
});

test("opening a map emits navigation without adding an Undo step", () => {
  const store = new TeamStore();
  const events = [];
  store.subscribe(({ kind }) => events.push(kind));
  store.commit(createMapPlan(store.plan, "server", "Hive"));
  const first = store.plan.activeMapId;
  store.commit(createMapPlan(store.plan, "boc", "Battle"));
  const before = events.length;
  store.openMap(first);
  assert.equal(store.plan.activeMapId, first);
  assert.deepEqual(events.slice(before), ["navigate"]);
  assert.equal(store.canUndo, true);
  assert.equal(store.undo(), true);
  assert.equal(store.plan.maps.length, 1);
});
