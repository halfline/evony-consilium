import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";

test("plan import accepts bounded embedded image assets", () => {
  const plan = createEmptyPlan();
  plan.customAssets = [
    {
      id: "custom-keep",
      name: "Custom keep",
      src: "data:image/png;base64,AA==",
      width: 1,
      height: 1,
      tier: 1,
      family: "custom",
      kind: "keep",
    },
  ];
  assert.equal(validatePlan(plan).customAssets.length, 1);
  for (const edit of [
    (asset) => (asset.src = "https://example.org/tracker.png"),
    (asset) => (asset.width = 0),
    (asset) => (asset.kind = "script"),
  ]) {
    const invalid = structuredClone(plan);
    edit(invalid.customAssets[0]);
    assert.throws(() => validatePlan(invalid));
  }
});
