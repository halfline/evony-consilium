import test from "node:test";
import assert from "node:assert/strict";
import {
  playerStatistics,
  progressRecord,
  recordPlayerProgress,
  progressSeries,
  validateProgress,
  orderedProgress,
} from "../web/src/domain/player-progress.js";
import {
  mergePlayerProfiles,
  playerDocument,
  readPlayerDocument,
} from "../web/src/domain/player-document.js";
import { createDemoPlan } from "../web/src/domain/plan.js";
import { catalog } from "./fixtures/catalog.js";

const at = "2026-10-18T14:00:00.000Z";
const event = (id = "save", time = at) => ({
  id,
  at: time,
  account: "editor@example.test",
});
const player = () => ({
  ...createDemoPlan(catalog).keeps[0],
  details: {
    buffs: { city: { ground: { attack: 1000, hp: 0 } } },
    debuffs: { siege: { attack: -500 } },
  },
});
const record = (id, values, observedAt = at) =>
  progressRecord(values, {
    id,
    at,
    observedAt,
    account: "editor@example.test",
  });

test("tracking starts with known values and records only changed measurements", () => {
  const original = player();
  const baseline = recordPlayerProgress(null, original, event());
  assert.equal(original.details.progress, undefined);
  assert.deepEqual(baseline.details.progress["baseline-save"].values, {
    level: original.level,
    "buffs.city.ground.attack": 1000,
    "buffs.city.ground.hp": 0,
    "debuffs.siege.attack": -500,
  });
  assert.deepEqual(
    recordPlayerProgress(
      baseline,
      { ...baseline, name: "Changed" },
      event("name"),
    ).details.progress,
    baseline.details.progress,
  );
  const changed = structuredClone(baseline);
  changed.details.buffs.city.ground.attack = 1200;
  changed.details.buffs.city.ground.hp = null;
  const saved = recordPlayerProgress(baseline, changed, event("stats"));
  assert.deepEqual(saved.details.progress["auto-stats"].values, {
    "buffs.city.ground.attack": 1200,
  });
  assert.deepEqual(
    recordPlayerProgress(saved, saved, event("retry")).details.progress,
    saved.details.progress,
  );
  assert.deepEqual(
    readPlayerDocument(playerDocument(saved)).details.progress,
    saved.details.progress,
  );
});

test("existing profiles acquire a baseline before their first changed value", () => {
  const before = player(),
    after = structuredClone(before);
  after.details.buffs.city.ground.attack = 2000;
  const saved = recordPlayerProgress(before, after, event());
  assert.deepEqual(
    orderedProgress(saved.details.progress).map((entry) => entry.kind),
    ["baseline", "automatic"],
  );
  assert.equal(
    saved.details.progress["baseline-save"].values["buffs.city.ground.attack"],
    1000,
  );
  assert.equal(
    saved.details.progress["auto-save"].values["buffs.city.ground.attack"],
    2000,
  );
});

test("partial backdated entries stay independent of current statistics", () => {
  const before = recordPlayerProgress(null, player(), event());
  const manual = record(
    "old",
    { "buffs.city.ground.attack": 500 },
    "2025-05-01T12:00:00.000Z",
  );
  const after = structuredClone(before);
  after.details.progress.old = manual;
  const saved = recordPlayerProgress(before, after, event("manual"));
  assert.deepEqual(playerStatistics(saved), playerStatistics(before));
  assert.equal(orderedProgress(saved.details.progress)[0].id, "old");
  assert.equal(Object.keys(saved.details.progress).length, 2);
});

test("correcting current stats can amend an observation without recording false growth", () => {
  const before = recordPlayerProgress(null, player(), event());
  const after = structuredClone(before),
    entry = after.details.progress["baseline-save"];
  entry.values["buffs.city.ground.attack"] = 900;
  entry.revision++;
  entry.applyToCurrent = true;
  after.details.buffs.city.ground.attack = 900;
  const saved = recordPlayerProgress(before, after, event("correction"));
  assert.equal(Object.keys(saved.details.progress).length, 1);
  assert.equal(
    saved.details.progress["baseline-save"].editedBy,
    "editor@example.test",
  );
  after.details.rallyCapacity = 100;
  assert.deepEqual(
    recordPlayerProgress(before, after, event("other")).details.progress[
      "auto-other"
    ].values,
    { rallyCapacity: 100 },
  );
});

test("progress validation rejects malformed measurements and dates", () => {
  const good = record("entry", {
    level: 42,
    "debuffs.ground.attack": -1200,
    "marchSizes.ranged": 0,
  });
  assert.doesNotThrow(() => validateProgress({ entry: good }));
  for (const changes of [
    { values: {} },
    { values: { power: 100 } },
    { values: { "debuffs.ground.attack": 10 } },
    { values: { level: 0 } },
    { values: { rallyCapacity: 1.5 } },
    { values: { level: NaN } },
    { observedAt: "yesterday" },
    { deletedAt: "invalid" },
    { revision: 0 },
    { id: "other" },
    { currentCorrections: ["power"] },
    { currentCorrections: ["rallyCapacity"] },
    { values: null, currentCorrections: ["level"] },
  ])
    assert.throws(() => validateProgress({ entry: { ...good, ...changes } }));
  for (const invalid of [null, [], [good], "bad"])
    assert.throws(() => validateProgress(invalid));
});

test("current corrections suppress only explicitly corrected measurements", () => {
  const before = recordPlayerProgress(null, player(), event());
  const after = structuredClone(before),
    entry = after.details.progress["baseline-save"];
  entry.values["buffs.city.ground.attack"] = 900;
  entry.values["buffs.city.ground.hp"] = 100;
  entry.revision++;
  entry.currentCorrections = ["buffs.city.ground.attack"];
  after.details.buffs.city.ground.attack = 900;
  after.details.buffs.city.ground.hp = 100;
  const saved = recordPlayerProgress(before, after, event("correction"));
  assert.deepEqual(saved.details.progress["auto-correction"].values, {
    "buffs.city.ground.hp": 100,
  });
});
