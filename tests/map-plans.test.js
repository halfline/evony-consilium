import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { MAPS, MAP_ICONS } from "../web/src/domain/maps.js";
import { createLayout } from "../web/src/domain/layout.js";
import { syncMapLayouts, defaultFormationName } from "../web/src/domain/map-plans.js";

test("new teams expose verified named map choices and a blank canvas", () => {
  const plan = createEmptyPlan();
  assert.deepEqual(plan.maps, []);
  assert.equal(plan.activeMapId, null);
  assert.deepEqual(plan.mapPresets.map(({ id }) => id), MAPS.map(({ id }) => id));
  assert.equal(plan.mapPresets.find(({ id }) => id === "blank").verified, false);
  assert.equal(plan.mapPresets.find(({ id }) => id === "server").verified, true);
  assert.ok(MAP_ICONS.server.endsWith("server.webp"));
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
