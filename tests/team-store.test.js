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

test("team edits use immutable transactions and ignore no-op changes", () => {
  const store = new TeamStore();
  const events = [];
  store.subscribe(({ kind }) => events.push(kind));
  assert.equal(
    store.mutate((plan) => {
      plan.title = "Alliance Alpha";
    }),
    true,
  );
  assert.equal(store.plan.title, "Alliance Alpha");
  assert.equal(
    store.mutate((plan) => {
      plan.title = "Alliance Alpha";
    }),
    false,
  );
  assert.deepEqual(events, ["edit"]);
  store.readOnly = true;
  assert.equal(
    store.mutate((plan) => {
      plan.title = "Blocked";
    }),
    false,
  );
  assert.equal(store.plan.title, "Alliance Alpha");
});

test("Undo restores the previous team edit and respects read-only access", () => {
  const store = new TeamStore();
  assert.equal(store.canUndo, false);
  store.mutate((plan) => {
    plan.title = "First";
  });
  store.mutate((plan) => {
    plan.title = "Second";
  });
  store.readOnly = true;
  assert.equal(store.canUndo, false);
  assert.equal(store.undo(), false);
  store.readOnly = false;
  assert.equal(store.undo(), true);
  assert.equal(store.plan.title, "First");
  assert.equal(store.undo(), true);
  assert.equal(store.plan.title, "Alliance formation");
  assert.equal(store.undo(), false);
});
