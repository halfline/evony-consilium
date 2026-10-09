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
