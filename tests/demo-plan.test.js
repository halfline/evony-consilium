import test from "node:test";
import assert from "node:assert/strict";
import { createDemoPlan, createEmptyPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";
import { catalog } from "./fixtures/catalog.js";

test("sample formation validates and ranks twelve placed keeps", () => {
  const sample = createDemoPlan(catalog);
  assert.equal(sample.keeps.length, 12);
  assert.equal(sample.keeps.every(({ x, y }) => Number.isInteger(x) && Number.isInteger(y)), true);
  assert.equal(sample.rallyId, sample.keeps[0].id);
  const validated = validatePlan(sample, catalog);
  assert.equal(validated.maps.length, 1);
  assert.equal(validated.maps[0].layout.positions.length, 12);
});

test("new plans leave optional team metadata absent until edited", () => {
  const plan = createEmptyPlan();
  assert.equal(Object.hasOwn(plan, "projectLogo"), false);
  assert.equal(Object.hasOwn(plan, "discordUrl"), false);
  const checked = validatePlan(JSON.parse(JSON.stringify(plan)), catalog);
  assert.equal(Object.hasOwn(checked, "projectLogo"), false);
  assert.equal(Object.hasOwn(checked, "discordUrl"), false);
});
