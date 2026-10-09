import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "./fixtures/catalog.js";
import { createDemoPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";
import { createMapPlan, selectMapPlan } from "../web/src/domain/map-plans.js";
test("avatar choices survive validation and switching between maps", () => {
  let plan = validatePlan(createDemoPlan(catalog), catalog);
  const first = plan.activeMapId;
  plan.keeps[0].avatarId = "avatar-1001";
  plan = createMapPlan(plan, "boc", "Rally");
  plan.keeps[0].avatarId = "avatar-1002";
  plan = validatePlan(selectMapPlan(plan, first), catalog);
  assert.equal(plan.keeps[0].avatarId, "avatar-1002");
  plan.keeps[0].avatarId = {};
  assert.throws(() => validatePlan(plan, catalog), /avatar ID/);
});
