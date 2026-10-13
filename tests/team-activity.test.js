import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import {
  appendTeamActivity,
  teamCreationActivity,
  teamChanges,
  mirrorPlayerActivity,
  teamLoginActivity,
} from "../web/src/domain/team-activity.js";
import {
  mergeTeamPlans,
  teamFingerprint,
} from "../web/src/domain/team-collaboration.js";
import { ProjectSync } from "../web/src/services/project-sync.js";
import { groupActivityEntries } from "../web/src/domain/activity.js";

test("team creation records the signed-in account", () => {
  const entry = teamCreationActivity({ email: "founder@example.com" });
  assert.equal(entry.account, "founder@example.com");
  assert.deepEqual(entry.changes, ["Created team"]);
});

test("team saves extend the login entry until another session adds an entry", () => {
  const alice = { email: "alice@example.test" },
    bob = { email: "bob@example.test" };
  const base = {
    ...createEmptyPlan(),
    activityLog: [teamLoginActivity(alice, "alice-session")],
  };
  const first = appendTeamActivity(
    base,
    { ...base, title: "First edit" },
    alice,
    { sessionId: "alice-session" },
  );
  const second = appendTeamActivity(
    first,
    { ...first, title: "Second edit" },
    alice,
    { sessionId: "alice-session" },
  );
  const grouped = groupActivityEntries(second.activityLog);
  assert.equal(grouped.length, 1);
  assert.deepEqual(grouped[0].changes, ["Logged in", "Renamed team"]);
  const other = appendTeamActivity(
    second,
    { ...second, discordUrl: "https://discord.gg/example" },
    bob,
    { sessionId: "bob-session" },
  );
  const resumed = appendTeamActivity(
    other,
    { ...other, title: "Third edit" },
    alice,
    { sessionId: "alice-session" },
  );
  assert.deepEqual(
    groupActivityEntries(resumed.activityLog).map((entry) => entry.account),
    [alice.email, bob.email, alice.email],
  );
  assert.notEqual(
    groupActivityEntries(resumed.activityLog)[2].id,
    base.activityLog[0].id,
  );
});

test("audit merges prefer source revisions over timestamps in either direction", () => {
  const base = createEmptyPlan();
  const first = {
    id: "audit",
    revision: 1,
    at: "2026-01-01T12:00:00.000Z",
    account: "member@example.test",
    changes: ["Updated name"],
    source: { kind: "player", fileId: "file", name: "Matti", version: "2" },
  };
  const latest = {
    ...first,
    revision: 2,
    at: "2026-01-01T11:00:00.000Z",
    changes: ["Updated name", "Updated castle"],
    source: { ...first.source, version: "3" },
  };
  for (const [local, remote] of [
    [first, latest],
    [latest, first],
  ]) {
    const result = mergeTeamPlans(
      base,
      { ...base, activityLog: [local] },
      { ...base, activityLog: [remote] },
    );
    assert.deepEqual(result.plan.activityLog, [latest]);
    assert.deepEqual(result.conflicts, []);
  }
});

test("global grouping preserves a barrier from a different player file", () => {
  const event = (id, time, account, sessionId, changes) => ({
    id,
    at: `2026-01-01T12:00:0${time}.000Z`,
    account,
    sessionId,
    changes,
  });
  const plan = {
    ...createEmptyPlan(),
    keeps: [
      {
        id: "one",
        name: "First player",
        playerSource: { fileId: "one-file", version: "3" },
      },
      {
        id: "two",
        name: "Second player",
        playerSource: { fileId: "two-file", version: "2" },
      },
    ],
    activityLog: [event("login", 0, "alice", "a", ["Logged in"])],
  };
  const snapshots = [
    {
      fileId: "one-file",
      version: "3",
      activityLog: [
        event("first", 1, "alice", "a", ["Updated name"]),
        event("resumed", 3, "alice", "a", ["Updated keep level"]),
      ],
    },
    {
      fileId: "two-file",
      version: "2",
      activityLog: [event("barrier", 2, "bob", "b", ["Updated castle"])],
    },
  ];
  const synced = mirrorPlayerActivity(plan, snapshots);
  const grouped = groupActivityEntries(synced.activityLog);
  assert.deepEqual(
    grouped.map((entry) => entry.account),
    ["alice", "bob", "alice"],
  );
  assert.deepEqual(grouped[0].changes, [
    "Logged in",
    "First player: Updated name",
  ]);
  assert.deepEqual(grouped[2].changes, ["First player: Updated keep level"]);
  assert.deepEqual(
    groupActivityEntries(mirrorPlayerActivity(synced, snapshots).activityLog),
    grouped,
  );
});

test("player history syncs into the team log without duplicate entries", () => {
  const plan = {
    ...createEmptyPlan(),
    keeps: [{ id: "player", name: "Matti", playerSource: { fileId: "file" } }],
  };
  const first = {
    id: "edit-one",
    at: "2026-01-01T12:00:00.000Z",
    account: "member@example.test",
    changes: ["Updated name"],
  };
  const synced = mirrorPlayerActivity(plan, [
    { fileId: "file", activityLog: [first] },
  ]);
  const updated = mirrorPlayerActivity(synced, [
    {
      fileId: "file",
      activityLog: [
        {
          ...first,
          at: "2026-01-01T12:01:00.000Z",
          changes: ["Updated name", "Updated castle"],
        },
      ],
    },
  ]);
  assert.equal(updated.activityLog.length, 1);
  assert.deepEqual(updated.activityLog[0].changes, [
    "Updated name",
    "Updated castle",
  ]);
  assert.deepEqual(updated.activityLog[0].source, {
    kind: "player",
    fileId: "file",
    name: "Matti",
  });
  const stale = mirrorPlayerActivity(updated, [
    { fileId: "file", activityLog: [first] },
  ]);
  assert.deepEqual(
    stale.activityLog[0].changes,
    updated.activityLog[0].changes,
  );
});

test("profile cache refreshes do not report unchanged players", () => {
  const base = createEmptyPlan();
  const source = (fileId, version) => ({
    fileId,
    version,
    syncedAt: "2026-01-01T00:00:00.000Z",
    baseline: { name: fileId },
  });
  const before = {
    ...base,
    keeps: [
      { id: "one", name: "One", playerSource: source("one-file", "1") },
      { id: "two", name: "Two", playerSource: source("two-file", "1") },
    ],
  };
  const cacheOnly = {
    ...before,
    keeps: [
      { ...before.keeps[0], playerSource: source("one-file", "2") },
      { ...before.keeps[1], playerSource: source("two-file", "2") },
    ],
  };
  const after = {
    ...cacheOnly,
    keeps: [{ ...cacheOnly.keeps[0], name: "One edited" }, cacheOnly.keeps[1]],
  };
  assert.deepEqual(teamChanges(before, cacheOnly), []);
  assert.deepEqual(teamChanges(before, after), ["Updated player One edited"]);
});

test("an activity entry records the saving account and survives team merge", () => {
  const base = createEmptyPlan();
  const local = appendTeamActivity(
    base,
    { ...base, discordUrl: "https://discord.gg/example" },
    { email: "alice@example.com" },
  );
  const remote = appendTeamActivity(
    base,
    {
      ...base,
      title: "Renamed team",
    },
    { email: "editor@example.com" },
  );
  const result = mergeTeamPlans(base, local, remote);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.plan.activityLog.length, 2);
  const byAccount = new Map(
    result.plan.activityLog.map((entry) => [entry.account, entry]),
  );
  assert.deepEqual(byAccount.get("alice@example.com").changes, [
    "Updated team Discord link",
  ]);
  assert.deepEqual(byAccount.get("editor@example.com").changes, [
    "Renamed team to Renamed team",
  ]);
  assert.equal(
    teamFingerprint(remote),
    teamFingerprint({ ...remote, activityLog: [] }),
  );
});

test("save writes activity to the team document", async () => {
  const base = createEmptyPlan();
  let plan = { ...base, title: "Updated team" };
  let saved;
  const sync = new ProjectSync({
    drive: {
      save: async (file, candidate) => {
        saved = candidate;
        return { ...file, version: "2" };
      },
    },
    getPlan: () => plan,
    flush: async () => {},
    writeDraft: async () => {},
    key: () => "team",
    reload: async () => {},
    saved: () => {},
    changed: () => {},
    status: () => {},
    expired: () => {},
    canCheck: () => true,
    fingerprint: teamFingerprint,
    merge: mergeTeamPlans,
    applyPlan: (next) => (plan = next),
    activityActor: () => ({ email: "editor@example.com" }),
  });
  sync.opened(
    { id: "team", version: "1", capabilities: { canEdit: true } },
    base,
  );
  sync.changed();
  await sync.save();
  assert.equal(saved.activityLog.length, 1);
  assert.equal(saved.activityLog[0].account, "editor@example.com");
  assert.deepEqual(saved.activityLog[0].changes, [
    "Renamed team to Updated team",
  ]);
  assert.equal(plan.activityLog.length, 1);
});
