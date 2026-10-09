import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";
import { catalog } from "./fixtures/catalog.js";

const player = () => ({
  id: "one",
  name: "Player",
  accountId: "123",
  allianceTag: "ALLY",
  level: 42,
  skin: "map-evony3-castle_lv8",
  w: 2,
  h: 2,
  x: null,
  y: null,
  locked: false,
});

test("player validation preserves profile extensions while rejecting invalid files", () => {
  const plan = createEmptyPlan();
  plan.keeps = [{ ...player(), details: { notes: "Shared" } }];
  const checked = validatePlan(plan, catalog);
  assert.equal(checked.keeps[0].details.notes, "Shared");
  assert.equal(plan.keeps[0].name, "Player");
  assert.throws(
    () => validatePlan({ ...plan, keeps: [player(), player()] }, catalog),
    /Duplicate player ID/,
  );
  assert.throws(
    () => validatePlan({ ...plan, keeps: [{ ...player(), skin: "missing" }] }, catalog),
    /Missing castle sprite/,
  );
  assert.throws(
    () => validatePlan({ ...plan, keeps: [{ ...player(), accountId: "abc" }] }, catalog),
    /Account IDs/,
  );
});
