import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPlan, createDemoPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";
import {
  createMapPlan,
  selectMapPlan,
  syncMapLayouts,
  projectFingerprint,
  defaultFormationName,
  removeMapPlan,
} from "../web/src/domain/map-plans.js";
import { catalog } from "./fixtures/catalog.js";
test("maps keep independent placements and share player profiles", () => {
  let plan = validatePlan(createDemoPlan(catalog), catalog);
  const first = plan.activeMapId;
  const original = structuredClone(plan.keeps[0]);
  plan = createMapPlan(plan, "boc", "Temple taking");
  const second = plan.activeMapId;
  assert.equal(plan.maps.length, 2);
  assert.equal(plan.keeps[0].x, null);
  plan.keeps[0].x = 50;
  plan.keeps[0].y = 60;
  plan.keeps[0].name = "Shared player";
  syncMapLayouts(plan);
  const fingerprint = projectFingerprint(plan);
  plan = selectMapPlan(plan, first);
  assert.equal(plan.keeps[0].x, original.x);
  assert.equal(plan.keeps[0].name, "Shared player");
  assert.equal(projectFingerprint(plan), fingerprint);
  plan = selectMapPlan(plan, second);
  assert.equal(plan.keeps[0].x, 50);
  assert.equal(plan.keeps[0].y, 60);
  assert.doesNotThrow(() => validatePlan(plan, catalog));
});
test("hive size belongs to each map and older layouts gain the standard size", () => {
  let plan = validatePlan(createDemoPlan(catalog), catalog);
  const first = plan.activeMapId;
  plan.hiveSize = 20;
  plan = createMapPlan(plan, "server", "Second hive");
  assert.equal(plan.hiveSize, 18);
  plan = selectMapPlan(plan, first);
  assert.equal(plan.hiveSize, 20);
  delete plan.hiveSize;
  delete plan.maps[0].layout.hiveSize;
  plan = validatePlan(plan, catalog);
  assert.equal(plan.hiveSize, 18);
  assert.equal(plan.maps[0].layout.hiveSize, 18);
  plan.maps[0].layout.hiveSize = 19;
  assert.throws(() => validatePlan(plan, catalog), /even number/);
});
test("new projects have no maps and defaults fit the selected type", () => {
  const plan = createEmptyPlan(catalog);
  assert.deepEqual(plan.maps, []);
  assert.equal(defaultFormationName("server"), "Hive");
  assert.equal(defaultFormationName("allstars"), "Rally");
  const next = createMapPlan(plan, "server", "Throne guarding");
  assert.equal(next.maps[0].name, "Throne guarding");
  assert.equal(removeMapPlan(next, next.activeMapId).maps.length, 0);
});
test("legacy formations become one named map and invalid map references are rejected", () => {
  const plan = validatePlan(createDemoPlan(catalog), catalog);
  assert.equal(plan.maps.length, 1);
  assert.equal(plan.maps[0].name, "Hive");
  plan.maps[0].layout.positions.push({ id: "unknown", x: 1, y: 1 });
  assert.throws(() => validatePlan(plan, catalog));
});
test("removing players prunes all map placements", () => {
  let plan = validatePlan(createDemoPlan(catalog), catalog);
  plan = createMapPlan(plan, "bog", "Rally");
  const id = plan.keeps[0].id;
  plan.keeps = plan.keeps.filter((player) => player.id !== id);
  syncMapLayouts(plan);
  assert.ok(
    plan.maps.every((map) =>
      map.layout.positions.every((position) => position.id !== id),
    ),
  );
});

test("project settings remain shared when switching maps", () => {
  let plan = createMapPlan(createEmptyPlan(), "server", "Hive");
  const first = plan.activeMapId;
  plan = createMapPlan(plan, "bog", "Rally");
  plan.title = "Renamed alliance";
  plan.projectLogo = "data:image/webp;base64,AAAA";
  plan = selectMapPlan(plan, first);
  assert.equal(plan.title, "Renamed alliance");
  assert.equal(plan.projectLogo, "data:image/webp;base64,AAAA");
});

test("reordered JSON properties do not create a false shared-content change", () => {
  const plan = validatePlan(createDemoPlan(catalog), catalog);
  function reorder(value) {
    if (Array.isArray(value)) return value.map(reorder);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([key, item]) => [key, reorder(item)]),
    );
  }
  assert.equal(projectFingerprint(plan), projectFingerprint(reorder(plan)));
  const edited = reorder(plan);
  edited.keeps[0].name = "A real edit";
  assert.notEqual(projectFingerprint(plan), projectFingerprint(edited));
});
