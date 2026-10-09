import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";

test("import validates structures and obstacles across entity collections", () => {
  const plan = createEmptyPlan();
  plan.customAssets = [
    {
      id: "castle",
      name: "Castle",
      src: "data:image/png;base64,AA==",
      width: 1,
      height: 1,
      tier: 1,
      family: "custom",
      kind: "alliance",
    },
  ];
  plan.structures = [
    { id: "building", name: "Castle", skin: "castle", w: 2, h: 2,
      x: null, y: null, locked: false },
  ];
  assert.equal(validatePlan(plan).structures.length, 1);
  for (const edit of [
    (p) => (p.obstacles = [{ id: "building", name: "Blocked", w: 1,
      h: 1, x: null, y: null, locked: false }]),
    (p) => (p.structures[0].x = 10),
    (p) => (p.structures[0].skin = "missing"),
  ]) {
    const invalid = structuredClone(plan);
    edit(invalid);
    assert.throws(() => validatePlan(invalid));
  }
});
