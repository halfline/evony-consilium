import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { migratePlan } from "../web/src/domain/document-migrations.js";
test("legacy plan migration is immutable, idempotent, and rejects unknown versions", () => {
  const old = createEmptyPlan();
  delete old.subcities;
  const migrated = migratePlan(old);
  assert.deepEqual(migrated.subcities, []);
  assert.equal(old.subcities, undefined);
  assert.deepEqual(migratePlan(migrated), migrated);
  assert.throws(() => migratePlan({ version: 2 }), /supported/);
});
