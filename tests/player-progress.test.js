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

test("independent history additions merge even when neither client has a history baseline", () => {
  const base = player(),
    local = structuredClone(base),
    remote = structuredClone(base);
  local.details.progress = { a: record("a", { level: 40 }) };
  remote.details.progress = { b: record("b", { level: 41 }) };
  const merged = mergePlayerProfiles(base, local, remote);
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(Object.keys(merged.profile.details.progress).sort(), [
    "a",
    "b",
  ]);
});

test("removals beat concurrent edits and contradictory corrections require review", () => {
  const base = player();
  base.details.progress = { a: record("a", { level: 40 }) };
  const local = structuredClone(base),
    remote = structuredClone(base);
  local.details.progress.a = {
    ...local.details.progress.a,
    revision: 2,
    values: { level: 41 },
  };
  remote.details.progress.a = {
    ...remote.details.progress.a,
    revision: 2,
    values: { level: 39 },
  };
  assert.deepEqual(mergePlayerProfiles(base, local, remote).conflicts, [
    "details.progress.a",
  ]);
  assert.equal(
    mergePlayerProfiles(base, local, remote, "player").profile.details.progress
      .a.values.level,
    39,
  );
  remote.details.progress.a.deletedAt = at;
  const merged = mergePlayerProfiles(base, local, remote);
  assert.deepEqual(merged.conflicts, []);
  assert.equal(orderedProgress(merged.profile.details.progress).length, 0);
  const restored = structuredClone(remote);
  delete restored.details.progress.a.deletedAt;
  restored.details.progress.a.revision++;
  assert.equal(
    orderedProgress(
      mergePlayerProfiles(remote, restored, remote).profile.details.progress,
    ).length,
    1,
  );
});

test("historical snapshots carry sparse values, skip blank measurements and omit future or removed records", async () => {
  const { progressStatisticsAt, historicalChanges } = await import(
    "../web/src/domain/player-progress.js"
  );
  const progress = {
    a: record(
      "a",
      { level: 40, "buffs.city.ground.attack": 700, "buffs.city.ground.hp": 0 },
      "2025-04-01T10:00:00.000Z",
    ),
    b: record(
      "b",
      { "buffs.city.ground.attack": 900 },
      "2025-06-01T10:00:00.000Z",
    ),
    c: record(
      "c",
      { "buffs.city.ground.hp": null },
      "2025-07-01T10:00:00.000Z",
    ),
    d: {
      ...record("d", { level: 44 }, "2025-07-02T10:00:00.000Z"),
      deletedAt: at,
    },
    e: record("e", { level: 50 }, "2026-01-01T10:00:00.000Z"),
  };
  const snapshot = progressStatisticsAt(progress, "2025-08-01");
  assert.equal(snapshot.level, 40);
  assert.equal(snapshot["buffs.city.ground.attack"], 900);
  assert.equal(snapshot["buffs.city.ground.hp"], 0);
  assert.equal(snapshot["marchSizes.ground"], null);
  assert.equal(
    progressStatisticsAt(progress, "2025-05-01")["buffs.city.ground.hp"],
    0,
  );
  assert.equal(progressStatisticsAt(progress, "2024-01-01").level, null);
  assert.deepEqual(historicalChanges(snapshot, { ...snapshot, level: 41 }), {
    level: 41,
  });
  assert.deepEqual(
    historicalChanges(snapshot, { ...snapshot, level: null }),
    {},
  );
  assert.deepEqual(historicalChanges(snapshot, snapshot), {});
  assert.deepEqual(historicalChanges(snapshot, snapshot, progress.b), {
    "buffs.city.ground.attack": 900,
  });
});

test("editing an observation excludes subsequent changes on the same day", async () => {
  const { progressStatisticsAt } = await import(
    "../web/src/domain/player-progress.js"
  );
  const early = record("early", { level: 40 }, "2025-04-01T10:00:00.000Z");
  const late = record("late", { level: 41 }, "2025-04-01T11:00:00.000Z");
  assert.equal(progressStatisticsAt({ early, late }, "2025-04-01").level, 41);
  assert.equal(
    progressStatisticsAt({ early, late }, "2025-04-01", early).level,
    40,
  );
});

test("editing legacy blank metrics never promotes inherited values to observations", async () => {
  const { progressStatisticsAt, historicalChanges } = await import(
    "../web/src/domain/player-progress.js"
  );
  const initial = record(
    "initial",
    { level: 40, "buffs.city.ground.hp": 0 },
    "2025-01-01T10:00:00.000Z",
  );
  const legacy = record(
    "legacy",
    { level: 41, "buffs.city.ground.hp": null },
    "2025-02-01T10:00:00.000Z",
  );
  const baseline = progressStatisticsAt(
    { initial, legacy },
    "2025-02-01",
    legacy,
  );
  assert.equal(baseline["buffs.city.ground.hp"], 0);
  assert.deepEqual(historicalChanges(baseline, baseline, legacy), {
    level: 41,
  });
  assert.deepEqual(
    historicalChanges(
      baseline,
      { ...baseline, "buffs.city.ground.hp": 10 },
      legacy,
    ),
    { level: 41, "buffs.city.ground.hp": 10 },
  );
});

test("time labels distinguish only multiple real changes in the selected stats", async () => {
  const { progressRecordsWithTime } = await import(
    "../web/src/domain/player-progress.js"
  );
  const automatic = (id, values, time) => ({
    ...record(id, values, time),
    kind: "automatic",
  });
  const progress = {
    first: automatic("first", { level: 40 }, "2025-04-01T10:00:00.000Z"),
    duplicate: automatic(
      "duplicate",
      { level: 40 },
      "2025-04-01T11:00:00.000Z",
    ),
    second: automatic("second", { level: 41 }, "2025-04-01T12:00:00.000Z"),
    buff: automatic(
      "buff",
      { "buffs.city.ground.hp": 0 },
      "2025-04-01T13:00:00.000Z",
    ),
    manual: record("manual", { level: 42 }, "2025-04-01T14:00:00.000Z"),
    next: automatic("next", { level: 43 }, "2025-04-02T10:00:00.000Z"),
    removed: {
      ...automatic("removed", { level: 44 }, "2025-04-02T11:00:00.000Z"),
      deletedAt: at,
    },
  };
  assert.deepEqual(
    [...progressRecordsWithTime(progress, ["level"])],
    ["first", "second"],
  );
  assert.deepEqual(
    [...progressRecordsWithTime(progress, ["buffs.city.ground.hp"])],
    [],
  );
  const points = progressSeries(progress, ["level"], { daily: false })[0]
    .points;
  assert.equal(points.find((point) => point.id === "manual").showTime, false);
  assert.equal(points.find((point) => point.id === "first").showTime, true);
  assert.equal(points.find((point) => point.id === "next").showTime, false);
  progress.second.dateOnly = true;
  assert.deepEqual(
    [...progressRecordsWithTime(progress, ["level"])],
    ["first"],
  );
});
