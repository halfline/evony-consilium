import test from "node:test";
import assert from "node:assert/strict";
import { TeamStore } from "../web/src/application/team-store.js";
import { createDemoPlan } from "../web/src/domain/plan.js";
import {
  createMapPlan,
  projectFingerprint,
} from "../web/src/domain/map-plans.js";

import { catalog } from "./fixtures/catalog.js";
function fixture(options) {
  const store = new TeamStore(catalog, options);
  store.replace(createDemoPlan(catalog));
  return store;
}
test("opening a team resets undo and does not count as an edit", () => {
  const store = fixture();
  const changes = [];
  store.subscribe((event) => changes.push(event.kind));
  store.mutate((plan) => {
    plan.title = "Changed";
  });
  assert.equal(store.canUndo, true);
  store.replace(createDemoPlan(catalog));
  assert.equal(store.canUndo, false);
  assert.deepEqual(changes, ["edit", "replace"]);
});
test("commits own their snapshots and undo restores shared metadata and layouts together", () => {
  const store = fixture();
  const original = structuredClone(store.plan);
  const next = structuredClone(store.plan);
  next.title = "Changed";
  next.keeps[0].name = "Renamed player";
  next.keeps[0].x = 100;
  store.commit(next);
  next.keeps[0].name = "Unexpected outside mutation";
  assert.equal(store.plan.keeps[0].name, "Renamed player");
  assert.equal(store.plan.maps[0].layout.positions[0].x, 100);
  assert.equal(store.undo(), true);
  assert.deepEqual(store.plan, original);
});
test("map navigation neither adds undo steps nor creates a content edit", () => {
  const store = fixture();
  const first = store.plan.activeMapId;
  store.commit(createMapPlan(store.plan, "bog", "Second map"));
  const fingerprint = projectFingerprint(store.plan);
  const changes = [];
  store.subscribe((event) => changes.push(event.kind));
  store.openMap(first);
  assert.equal(projectFingerprint(store.plan), fingerprint);
  assert.deepEqual(changes, ["navigate"]);
  store.undo();
  assert.equal(store.canUndo, false);
  assert.equal(store.plan.maps.length, 1);
});
test("no-op edits do not enable Undo or schedule an edit notification", () => {
  const store = fixture();
  const changes = [];
  store.subscribe((event) => changes.push(event.kind));
  assert.equal(
    store.mutate((plan) => {
      plan.title = plan.title;
    }),
    false,
  );
  assert.equal(store.canUndo, false);
  assert.deepEqual(changes, []);
});
test("undo is bounded and listeners can be removed", () => {
  const store = fixture({ historyLimit: 2 });
  let changes = 0;
  const unsubscribe = store.subscribe(() => {
    changes++;
  });
  for (const title of ["First", "Second", "Third"])
    store.mutate((plan) => {
      plan.title = title;
    });
  unsubscribe();
  store.undo();
  store.undo();
  assert.equal(store.plan.title, "First");
  assert.equal(store.undo(), false);
  assert.equal(changes, 3);
});
test("failed transactions leave plan and undo history untouched", () => {
  const store = fixture();
  const original = structuredClone(store.plan);
  assert.throws(
    () =>
      store.mutate((plan) => {
        plan.title = "Partial";
        throw Error("Failed edit");
      }),
    /Failed edit/,
  );
  assert.deepEqual(store.plan, original);
  assert.equal(store.canUndo, false);
});
test("castle appearances derive from the current profile level and revert with Undo", () => {
  const store = fixture();
  const player = store.plan.keeps.find(
    (item) => store.assets.get(item.skin).family === "culture-europe",
  );
  const original = player.skin;
  store.mutate((plan) => {
    plan.keeps.find((item) => item.id === player.id).level = 5;
  });
  assert.match(
    store.plan.keeps.find((item) => item.id === player.id).skin,
    /castle_lv1$/,
  );
  store.undo();
  assert.equal(
    store.plan.keeps.find((item) => item.id === player.id).skin,
    original,
  );
});

test("readers cannot change player data or layouts outside an edit transaction", () => {
  const store = fixture();
  assert.throws(() => {
    store.plan.title = "Outside edit";
  }, TypeError);
  assert.throws(() => {
    store.plan.keeps[0].name = "Outside edit";
  }, TypeError);
  assert.throws(() => {
    store.plan.maps[0].layout.positions[0].x = 1;
  }, TypeError);
  assert.throws(() => {
    store.plan.keeps.push({});
  }, TypeError);
  store.mutate((plan) => {
    plan.title = "Inside edit";
  });
  assert.equal(store.plan.title, "Inside edit");
  store.undo();
  assert.throws(() => {
    store.plan.title = "After undo";
  }, TypeError);
});

test("view-only stores block mutations, undo, and imports but allow map navigation", () => {
  const store = fixture();
  store.commit(createMapPlan(store.plan, "blank", "Viewable"));
  const snapshot = projectFingerprint(store.plan);
  store.readOnly = true;
  assert.equal(
    store.mutate((plan) => {
      plan.title = "Forbidden";
    }),
    false,
  );
  assert.equal(
    store.commit({ ...structuredClone(store.plan), title: "Forbidden" }),
    false,
  );
  assert.equal(store.undo(), false);
  assert.equal(store.replace(createDemoPlan(catalog)), false);
  store.openMap(store.plan.maps[0].id);
  assert.equal(projectFingerprint(store.plan), snapshot);
  store.readOnly = false;
  assert.equal(
    store.mutate((plan) => {
      plan.title = "Editable";
    }),
    true,
  );
});
