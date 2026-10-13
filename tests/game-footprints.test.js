import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "./fixtures/catalog.js";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";
import { captureLayout } from "../web/src/domain/layout.js";
import { createMapPlan, selectMapPlan } from "../web/src/domain/map-plans.js";
import { TeamStore } from "../web/src/application/team-store.js";

const assets = {
  ...catalog,
  assets: [
    ...catalog.assets,
    { id: "glory", name: "Glory castle", kind: "alliance", footprint: 4 },
    { id: "hall", name: "Knight's Hall", kind: "objective", footprint: 3 },
  ],
};
const entity = (id, skin, x, y, w = 2, h = w) => ({
  id,
  name: id,
  skin,
  x,
  y,
  w,
  h,
  locked: false,
});
function player(id, x, y, w = 2, h = w) {
  return {
    ...entity(id, catalog.assets[0].id, x, y, w, h),
    level: 1,
    accountId: "",
    allianceTag: "",
  };
}

test("imports derive castle and building dimensions from the catalog and retain adjustable blockers", () => {
  const plan = createEmptyPlan();
  plan.keeps = [player("Player", 20, 20, 8, 5)];
  plan.structures = [
    entity("Castle", "glory", 30, 30),
    entity("Hall", "hall", null, null),
  ];
  plan.obstacles = [
    {
      id: "blocked",
      name: "Blocked area",
      x: 40,
      y: 40,
      w: 7,
      h: 1,
      locked: false,
    },
  ];
  const original = structuredClone(plan);
  const corrected = validatePlan(plan, assets);
  assert.deepEqual([corrected.keeps[0].w, corrected.keeps[0].h], [2, 2]);
  assert.deepEqual(
    [corrected.structures[0].w, corrected.structures[0].h],
    [4, 4],
  );
  assert.deepEqual(
    [corrected.structures[1].w, corrected.structures[1].h],
    [3, 3],
  );
  assert.equal(corrected.keeps[0].x, 20);
  assert.equal(corrected.structures[0].x, 30);
  assert.deepEqual(corrected.obstacles, plan.obstacles);
  assert.deepEqual(plan, original);
});

test("a corrected legacy footprint that overlaps is unplaced while its neighbor stays put", () => {
  const plan = createEmptyPlan();
  plan.keeps = [player("Neighbor", 3, 0)];
  plan.structures = [{ ...entity("Castle", "glory", 0, 0), locked: true }];
  const repairs = [];
  const corrected = validatePlan(plan, assets, true, repairs);
  assert.equal(corrected.structures[0].w, 4);
  assert.deepEqual(
    [corrected.structures[0].x, corrected.structures[0].y],
    [null, null],
  );
  assert.equal(corrected.structures[0].locked, false);
  assert.equal(corrected.keeps[0].x, 3);
  assert.deepEqual(
    repairs.map(({ id }) => id),
    ["Castle"],
  );
  // Current-size overlapping imports still fail validation.
  plan.structures[0].w = plan.structures[0].h = 4;
  assert.throws(() => validatePlan(plan, assets), /Overlapping tiles/);
});

test("map-edge repairs keep the object and shrinking an oversized footprint keeps its position", () => {
  const plan = createEmptyPlan();
  plan.structures = [
    entity("Castle", "glory", 1198, 0),
    entity("Hall", "hall", 1197, 10, 8),
  ];
  const corrected = validatePlan(plan, assets);
  assert.equal(corrected.structures[0].x, null);
  assert.equal(corrected.structures[1].x, 1197);
  assert.equal(corrected.structures[1].w, 3);
});

test("inactive map footprints are corrected and remain corrected when maps are switched", () => {
  let plan = createEmptyPlan();
  plan.keeps = [player("Player", 10, 10)];
  plan.structures = [entity("Castle", "glory", 20, 20)];
  plan.maps = [
    {
      id: "first",
      name: "Old hive",
      type: "server",
      layout: captureLayout(plan),
    },
  ];
  plan.activeMapId = "first";
  plan = createMapPlan(plan, "blank", "Second map");
  plan.keeps[0].w = 9;
  plan.keeps[0].h = 7;
  plan.maps[0].layout.positions[0].w = 8;
  const corrected = validatePlan(plan, assets);
  assert.equal(corrected.maps[0].layout.positions[0].w, 2);
  assert.equal(corrected.maps[0].layout.structures[0].w, 4);
  const first = selectMapPlan(corrected, "first");
  assert.equal(first.keeps[0].w, 2);
  assert.equal(first.structures[0].w, 4);
  assert.equal(first.structures[0].x, 20);
});

test("refreshes and undo retain game footprints after a player's source appearance changes", () => {
  const sized = {
    ...assets,
    assets: [
      ...assets.assets,
      { id: "large-keep", kind: "keep", footprint: 3 },
    ],
  };
  const store = new TeamStore(sized);
  const plan = createEmptyPlan();
  plan.keeps = [player("Player", 10, 10)];
  plan.maps = [
    { id: "first", name: "Hive", type: "server", layout: captureLayout(plan) },
  ];
  plan.activeMapId = "first";
  store.replace(plan);
  store.mutate((draft) => {
    draft.title = "Edited";
  });
  function update(draft) {
    const next = structuredClone(draft);
    next.keeps[0].skin = "large-keep";
    return next;
  }
  store.refresh(update(store.plan), update);
  assert.equal(store.plan.keeps[0].w, 3);
  assert.equal(store.plan.maps[0].layout.positions[0].w, 3);
  store.undo();
  assert.equal(store.plan.keeps[0].w, 3);
  assert.equal(store.plan.maps[0].layout.positions[0].w, 3);
});

test("store replacements report legacy objects that must be placed again", () => {
  const store = new TeamStore(assets);
  const plan = createEmptyPlan();
  plan.keeps = [player("Neighbor", 3, 0)];
  plan.structures = [entity("Castle", "glory", 0, 0)];
  let report;
  store.subscribe((event) => {
    report = event;
  });
  store.replace(plan);
  assert.equal(report.kind, "replace");
  assert.equal(report.footprintRepairs[0].name, "Castle");
});
