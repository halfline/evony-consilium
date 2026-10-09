import test from "node:test";
import assert from "node:assert/strict";
import { createDemoPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";
import { catalog } from "./fixtures/catalog.js";

test("import checks placement in inactive maps too", () => {
  const plan = validatePlan(createDemoPlan(catalog), catalog);
  const inactive = structuredClone(plan.maps[0]);
  inactive.id = "inactive";
  plan.maps.push(inactive);
  assert.equal(validatePlan(plan, catalog).maps.length, 2);
  inactive.layout.positions[1].x = inactive.layout.positions[0].x;
  inactive.layout.positions[1].y = inactive.layout.positions[0].y;
  assert.throws(() => validatePlan(plan, catalog), /Overlapping/);
});
