import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { MAPS, MAP_ICONS } from "../web/src/domain/maps.js";
import { createLayout } from "../web/src/domain/layout.js";
import { syncMapLayouts, defaultFormationName, createMapPlan, selectMapPlan, removeMapPlan } from "../web/src/domain/map-plans.js";

test("new teams expose verified named map choices and a blank canvas", () => {
  const plan = createEmptyPlan();
  assert.deepEqual(plan.maps, []);
  assert.equal(plan.activeMapId, null);
  assert.deepEqual(plan.mapPresets.map(({ id }) => id), MAPS.map(({ id }) => id));
  assert.equal(plan.mapPresets.find(({ id }) => id === "blank").verified, false);
  assert.equal(plan.mapPresets.find(({ id }) => id === "server").verified, true);
  assert.ok(MAP_ICONS.server.endsWith("server.webp"));
});

test("removing an active map selects a remaining map or clears placement", () => {
  const plan = createEmptyPlan();
  plan.keeps = [{ id: "one", x: 20, y: 30, w: 2, h: 2, locked: true }];
  let next = createMapPlan(plan, "server", "Hive");
  const first = next.activeMapId;
  next.keeps[0].x = 20;
  next.keeps[0].y = 30;
  next.keeps[0].locked = true;
  next = createMapPlan(next, "boc", "Battle");
  next = removeMapPlan(next, next.activeMapId);
  assert.equal(next.activeMapId, first);
  assert.equal(next.keeps[0].x, 20);
  next = removeMapPlan(next, first);
  assert.deepEqual(next.maps, []);
  assert.equal(next.activeMapId, null);
  assert.equal(next.keeps[0].x, null);
  assert.equal(next.keeps[0].locked, false);
});

test("switching maps restores positions while sharing player profiles", () => {
  const plan = createEmptyPlan();
  plan.keeps = [{ id: "one", name: "Original", x: null, y: null, w: 2, h: 2, locked: false }];
  let next = createMapPlan(plan, "server", "Hive");
  const first = next.activeMapId;
  next.keeps[0].x = 50;
  next.keeps[0].y = 60;
  next = createMapPlan(next, "boc", "Battle");
  const second = next.activeMapId;
  next.keeps[0].name = "Shared profile";
  assert.equal(next.keeps[0].x, null);
  next = selectMapPlan(next, first);
  assert.equal(next.keeps[0].x, 50);
  assert.equal(next.keeps[0].name, "Shared profile");
  next = selectMapPlan(next, second);
  assert.equal(next.keeps[0].x, null);
  assert.throws(() => selectMapPlan(next, "missing"), /Map not found/);
});

test("creating a map opens an independent layout and checks type and name", () => {
  const plan = createEmptyPlan();
  const next = createMapPlan(plan, "server", "  First hive  ");
  assert.equal(next.maps[0].name, "First hive");
  assert.equal(next.maps[0].type, "server");
  assert.equal(next.activeMapId, next.maps[0].id);
  assert.equal(next.map, "server");
  assert.deepEqual(plan.maps, []);
  assert.throws(() => createMapPlan(plan, "unknown", "Map"), /map type/);
  assert.throws(() => createMapPlan(plan, "server", " "), /formation name/);
});

test("map synchronization records active placements and drops removed players", () => {
  const plan = createEmptyPlan();
  plan.keeps = [{ id: "present", x: 10, y: 20, w: 2, h: 2, locked: false }];
  plan.maps = [{ id: "map-1", type: "server", layout: createLayout("server") }];
  plan.activeMapId = "map-1";
  plan.maps[0].layout.positions = [{ id: "removed", x: 1, y: 2 }];
  plan.maps[0].layout.rallyId = "removed";
  assert.equal(syncMapLayouts(plan), plan);
  assert.deepEqual(plan.maps[0].layout.positions.map(({ id }) => id), ["present"]);
  assert.equal(plan.maps[0].layout.rallyId, null);
  assert.equal(defaultFormationName("server"), "Hive");
});
