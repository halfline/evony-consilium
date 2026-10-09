import test from "node:test";
import assert from "node:assert/strict";
import { TeamStore } from "../web/src/application/team-store.js";
import { createEmptyPlan } from "../web/src/domain/plan.js";

test("team store validates and freezes opened documents", () => {
  const store = new TeamStore();
  const plan = { ...createEmptyPlan(), title: "Shared" };
  store.replace(plan);
  plan.title = "Mutated outside";
  assert.equal(store.plan.title, "Shared");
  assert.equal(Object.isFrozen(store.plan), true);
  assert.throws(() => store.replace({ ...plan, keeps: {} }), /player list/);
  assert.equal(store.plan.title, "Shared");
});

test("view-only team cannot replace its document without explicit force", () => {
  const store = new TeamStore();
  store.readOnly = true;
  assert.equal(
    store.replace({ ...createEmptyPlan(), title: "Blocked" }),
    false,
  );
  assert.equal(store.plan.title, "Alliance formation");
  store.replace({ ...createEmptyPlan(), title: "Downloaded" }, { force: true });
  assert.equal(store.plan.title, "Downloaded");
});
