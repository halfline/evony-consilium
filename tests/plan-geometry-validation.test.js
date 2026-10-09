import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";

test("import accepts the new team's map geometry", () => {
  assert.equal(validatePlan(createEmptyPlan()).extent, 1200);
});

test("import rejects unusable map geometry", () => {
  for (const edit of [
    (plan) => (plan.extent = 9),
    (plan) => (plan.spacing = 11),
    (plan) => (plan.center.x = -1),
    (plan) => (plan.grid = { ax: 1, ay: 1, bx: 2, by: 2 }),
    (plan) => (plan.formation = "other"),
  ]) {
    const plan = createEmptyPlan();
    edit(plan);
    assert.throws(() => validatePlan(plan));
  }
});
