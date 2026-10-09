import test from "node:test";
import assert from "node:assert/strict";
import { editPlayerDetails } from "../web/src/domain/player-details.js";
import { createEmptyPlan } from "../web/src/domain/plan.js";

test("player detail edits preserve unknown metadata and never write placement fields", () => {
  const plan = createEmptyPlan();
  plan.keeps = [{ id: "one", name: "Player", x: 10, y: 20, details: { notes: "Keep me" } }];
  const next = editPlayerDetails(plan, "one", { marchSize: 100, x: 999, marchSizes: { ground: 1000 } });
  assert.equal(next.keeps[0].x, 10);
  assert.equal(next.keeps[0].details.notes, "Keep me");
  assert.equal(next.keeps[0].details.marchSize, 100);
  assert.equal(next.keeps[0].details.marchBoost, 200);
  assert.equal(plan.keeps[0].details.marchSize, undefined);
});

test("personal subcity edits preserve other details and reject duplicate IDs", () => {
  const plan = createEmptyPlan();
  plan.keeps = [{ id: "one", name: "Player", x: 10, y: 20, details: { notes: "Keep me" } }];
  const subcities = [{ id: "city-1", name: "Gold City", x: 0, y: 1199 }];
  const next = editPlayerDetails(plan, "one", { subcities });
  assert.deepEqual(next.keeps[0].details.subcities, subcities);
  assert.equal(next.keeps[0].details.notes, "Keep me");
  assert.equal(plan.keeps[0].details.subcities, undefined);
  assert.throws(
    () => editPlayerDetails(plan, "one", { subcities: [subcities[0], subcities[0]] }),
    /duplicate subcity ID/,
  );
});
