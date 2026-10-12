import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import {
  appendTeamActivity,
  teamCreationActivity,
  teamChanges,
} from "../web/src/domain/team-activity.js";
import {
  mergeTeamPlans,
  teamFingerprint,
} from "../web/src/domain/team-collaboration.js";
import { ProjectSync } from "../web/src/services/project-sync.js";

test("team creation records the signed-in account", () => {
  const entry = teamCreationActivity({ email: "founder@example.com" });
  assert.equal(entry.account, "founder@example.com");
  assert.deepEqual(entry.changes, ["Created team"]);
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
