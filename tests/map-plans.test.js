import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { MAPS, MAP_ICONS } from "../web/src/domain/maps.js";

test("new teams expose verified named map choices and a blank canvas", () => {
  const plan = createEmptyPlan();
  assert.deepEqual(plan.maps, []);
  assert.equal(plan.activeMapId, null);
  assert.deepEqual(plan.mapPresets.map(({ id }) => id), MAPS.map(({ id }) => id));
  assert.equal(plan.mapPresets.find(({ id }) => id === "blank").verified, false);
  assert.equal(plan.mapPresets.find(({ id }) => id === "server").verified, true);
  assert.ok(MAP_ICONS.server.endsWith("server.webp"));
});
