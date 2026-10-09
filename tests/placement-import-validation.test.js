import test from "node:test";
import assert from "node:assert/strict";
import { createDemoPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";
import { catalog } from "./fixtures/catalog.js";

test("import rejects overlapping placements and a missing rally setter", () => {
  const plan = createDemoPlan(catalog);
  assert.equal(validatePlan(plan, catalog).keeps.length, 12);
  const overlapping = structuredClone(plan);
  overlapping.keeps[1].x = overlapping.keeps[0].x;
  overlapping.keeps[1].y = overlapping.keeps[0].y;
  assert.throws(() => validatePlan(overlapping, catalog), /Overlapping/);
  const missingRally = structuredClone(plan);
  missingRally.rallyId = "missing";
  assert.throws(() => validatePlan(missingRally, catalog), /rally setter/);
});
