import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";

test("import accepts bounded embedded backgrounds and rejects remote URLs", () => {
  const plan = createEmptyPlan();
  plan.backgrounds.blank = {
    src: "data:image/png;base64,AA==",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    opacity: 0.5,
  };
  assert.equal(validatePlan(plan).backgrounds.blank.opacity, 0.5);
  for (const edit of [
    (p) => (p.backgrounds.blank.src = "https://example.org/image.png"),
    (p) => (p.backgrounds.blank.opacity = 2),
    (p) => (p.backgrounds = []),
  ]) {
    const invalid = structuredClone(plan);
    edit(invalid);
    assert.throws(() => validatePlan(invalid));
  }
});
