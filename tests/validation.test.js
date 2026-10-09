import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "./fixtures/catalog.js";
import { createDemoPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";
const clone = structuredClone;
test("import preserves account IDs as strings including leading zeros", () => {
  const p = createDemoPlan(catalog);
  p.keeps[0].accountId = "001234567890123456789";
  const r = validatePlan(JSON.parse(JSON.stringify(p)), catalog);
  assert.equal(r.keeps[0].accountId, p.keeps[0].accountId);
});
test("plan imports reject malformed data, overlapping tiles and external image URLs", () => {
  const p = createDemoPlan(catalog);
  assert.equal(validatePlan(p, catalog).keeps.length, 12);
  for (const edit of [
    (p) => (p.keeps[0].level = NaN),
    (p) => (p.keeps[0].x = -1),
    (p) => (p.keeps[0].skin = "missing"),
    (p) => (p.keeps[1].id = p.keeps[0].id),
    (p) => {
      p.keeps[1].x = p.keeps[0].x;
      p.keeps[1].y = p.keeps[0].y;
    },
    (p) => (p.grid = { ax: 1, ay: 1, bx: 2, by: 2 }),
    (p) =>
      (p.customAssets = [
        { id: "evil", name: "Evil", src: "https://example.org/tracker.png" },
      ]),
  ]) {
    const r = clone(p);
    edit(r);
    assert.throws(() => validatePlan(r, catalog));
  }
});
