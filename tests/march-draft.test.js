import test from "node:test";
import assert from "node:assert/strict";
import { MarchDraft } from "../web/src/application/march-draft.js";
import { marchTotals } from "../web/src/domain/attack-marches.js";

test("march edits survive navigation and capacity changes without reading a form", () => {
  let sizes = { ground: 8000000, ranged: 8000000 };
  const draft = new MarchDraft(() => sizes);
  draft.load({}, 45);
  const ground = draft.marches.findIndex(
    (march) => march.troopType === "ground",
  );
  draft.currentIndex = ground;
  draft.count(16, "ground", 1234567);
  draft.base("mounted", 6789);
  const edited = structuredClone(draft.current);
  draft.currentIndex = 1;
  sizes = { ground: 9000000, ranged: 9000000 };
  draft.syncSizes();
  draft.currentIndex = ground;
  assert.deepEqual(draft.current.layers, edited.layers);
  assert.deepEqual(draft.current.bases, edited.bases);
  assert.equal(draft.current.generation.manual, true);
  const automatic = draft.marches.find((march) => march.troopType === "ranged");
  assert.equal(marchTotals(automatic).total, 9000000);
});

test("draft exports preserve invisible support types and are independent snapshots", () => {
  const draft = new MarchDraft(() => ({ ground: 8000000 }));
  draft.load({}, 42);
  draft.currentIndex = draft.marches.findIndex(
    (march) => march.troopType === "ground",
  );
  draft.count(15, "ground", 12345);
  const saved = draft.read().find((march) => march.id === draft.current.id);
  assert.equal(saved.layers.find((row) => row.tier === 15).ranged, 5000);
  draft.count(15, "ground", 54321);
  assert.equal(saved.layers.find((row) => row.tier === 15).ground, 12345);
});

test("blank presets remain transient and deleting a march does not mutate loaded details", () => {
  const draft = new MarchDraft(() => ({}));
  draft.load({}, 50);
  assert.equal(draft.read().length, 0);
  assert.equal(draft.current.generation.highestTier, 17);
  draft.add();
  const details = { marches: draft.read() };
  draft.load(details, 50);
  draft.currentIndex = draft.marches.findIndex(
    (march) => march.id === details.marches[0].id,
  );
  draft.remove();
  assert.equal(details.marches.length, 1);
  assert.ok(!draft.read().some((march) => march.id === details.marches[0].id));
});

test("an empty saved march can be edited without relying on rendered layer rows", () => {
  const draft = new MarchDraft(() => ({}));
  draft.load(
    { marches: [{ id: "empty", name: "General one", troopType: "ground" }] },
    45,
  );
  assert.equal(draft.current.id, "empty");
  assert.deepEqual(draft.current.layers, []);
  draft.count(16, "ground", 100);
  assert.equal(draft.current.generation.manual, true);
  assert.equal(draft.read()[0].layers[0].ground, 100);
});
