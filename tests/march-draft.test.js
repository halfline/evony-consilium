import test from "node:test";
import assert from "node:assert/strict";
import { MarchDraft } from "../web/src/application/march-draft.js";
import { marchTotals } from "../web/src/domain/attack-marches.js";

test("draft loads level-based presets and regenerates when march sizes change", () => {
  let sizes = { ground: 8000000, ranged: 8000000 };
  const draft = new MarchDraft(() => sizes);
  draft.load({}, 45);
  assert.equal(draft.marches.length, 4);
  assert.equal(draft.maxTier, 16);
  const ranged = draft.marches.find((march) => march.troopType === "ranged");
  assert.equal(marchTotals(ranged).total, 8000000);
  sizes = { ground: 9000000, ranged: 9000000 };
  draft.syncSizes();
  assert.equal(marchTotals(draft.marches.find((march) => march.id === ranged.id)).total, 9000000);
});

test("manual troop and base edits survive later size synchronization", () => {
  let sizes = { ground: 8000000, ranged: 8000000 };
  const draft = new MarchDraft(() => sizes);
  draft.load({}, 45);
  const ground = draft.marches.findIndex((march) => march.troopType === "ground");
  draft.currentIndex = ground;
  draft.count(16, "ground", 1234567);
  draft.base("mounted", 6789);
  const edited = structuredClone(draft.current);
  sizes = { ground: 9000000, ranged: 9000000 };
  draft.syncSizes();
  assert.deepEqual(draft.current.layers, edited.layers);
  assert.deepEqual(draft.current.bases, edited.bases);
  assert.equal(draft.current.generation.manual, true);
  assert.equal(draft.explicit.has(draft.current.id), true);
});

test("draft exports keep support troops and return independent snapshots", () => {
  const draft = new MarchDraft(() => ({ ground: 8000000 }));
  draft.load({}, 42);
  draft.currentIndex = draft.marches.findIndex((march) => march.troopType === "ground");
  draft.count(15, "ground", 12345);
  const saved = draft.read().find((march) => march.id === draft.current.id);
  assert.equal(saved.layers.find((row) => row.tier === 15).ranged, 5000);
  draft.count(15, "ground", 54321);
  assert.equal(saved.layers.find((row) => row.tier === 15).ground, 12345);
});

test("adding and removing a draft march preserves loaded details", () => {
  const draft = new MarchDraft(() => ({}));
  draft.load({}, 50);
  assert.equal(draft.read().length, 0);
  assert.equal(draft.current.generation.highestTier, 17);
  assert.equal(draft.add(), true);
  const details = { marches: draft.read() };
  draft.load(details, 50);
  draft.currentIndex = draft.marches.findIndex((march) => march.id === details.marches[0].id);
  draft.remove();
  assert.equal(details.marches.length, 1);
  assert.ok(!draft.read().some((march) => march.id === details.marches[0].id));
});

test("a saved march with no rows accepts a manual troop count", () => {
  const draft = new MarchDraft(() => ({}));
  draft.load({ marches: [{ id: "empty", name: "General one", troopType: "ground" }] }, 45);
  assert.equal(draft.current.id, "empty");
  assert.deepEqual(draft.current.layers, []);
  draft.count(16, "ground", 100);
  assert.equal(draft.current.generation.manual, true);
  assert.equal(draft.read()[0].layers[0].ground, 100);
});
