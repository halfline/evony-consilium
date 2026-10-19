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

test("daily charts choose the final value per statistic rather than the final record", () => {
  const progress = {
    a: record(
      "a",
      { "buffs.city.ground.attack": 100 },
      "2026-10-17T10:00:00.000Z",
    ),
    b: record("b", { "buffs.city.ground.hp": 0 }, "2026-10-17T11:00:00.000Z"),
    c: record(
      "c",
      { "buffs.city.ground.attack": 150 },
      "2026-10-17T12:00:00.000Z",
    ),
    d: record("d", { "buffs.city.ground.attack": null }, at),
  };
  const keys = ["buffs.city.ground.attack", "buffs.city.ground.hp"];
  assert.deepEqual(
    progressSeries(progress, keys)[0].points.map((point) => point.value),
    [150],
  );
  assert.deepEqual(
    progressSeries(progress, keys)[1].points.map((point) => point.value),
    [0],
  );
  assert.equal(
    progressSeries(progress, keys, { daily: false })[0].points.length,
    2,
  );
  assert.equal(
    progressSeries(progress, keys, { since: at })[0].points.length,
    1,
  );
  progress.c.deletedAt = at;
  assert.deepEqual(
    progressSeries(progress, keys)[0].points.map((point) => point.value),
    [100],
  );
});

test("date windows retain the last observation, its real date, zero, and skip blank records", () => {
  const progress = {
    initial: record(
      "initial",
      { level: 43, "buffs.city.ground.hp": 0, rallyCapacity: 1000 },
      "2026-08-01T12:00:00.000Z",
    ),
    unknown: record(
      "unknown",
      { rallyCapacity: null },
      "2026-08-02T12:00:00.000Z",
    ),
    change: record("change", { level: 44 }, "2026-10-01T12:00:00.000Z"),
  };
  const since = "2026-09-01T00:00:00.000Z";
  const [level, hp, rally] = progressSeries(
    progress,
    ["level", "buffs.city.ground.hp", "rallyCapacity"],
    { since },
  );
  assert.deepEqual(
    level.points.map((point) => point.value),
    [43, 44],
  );
  assert.equal(level.points[0].at, since);
  assert.equal(level.points[0].observedAt, progress.initial.observedAt);
  assert.equal(level.points[0].carried, true);
  assert.deepEqual(
    hp.points.map((point) => point.value),
    [0],
  );
  assert.deepEqual(
    rally.points.map((point) => point.value),
    [1000],
  );
  progress.unknown.deletedAt = at;
  assert.deepEqual(
    progressSeries(progress, ["rallyCapacity"], { since })[0].points.map(
      (point) => point.value,
    ),
    [1000],
  );
});
