import test from "node:test";
import assert from "node:assert/strict";
import {
  teamDraftKey,
  resolveTeamDraft,
} from "../web/src/persistence/team-draft.js";

test("draft keys distinguish accounts, folders, and documents using the existing storage format", () => {
  assert.equal(teamDraftKey("alice", "team", "file"), "alice:team:file");
  const keys = [
    teamDraftKey("alice", "team", "file"),
    teamDraftKey("bob", "team", "file"),
    teamDraftKey("alice", "other", "file"),
    teamDraftKey("alice", "team", "other"),
  ];
  assert.equal(new Set(keys).size, 4);
});
test("dirty drafts retain their original version instead of overwriting a newer shared plan", () => {
  const sharedPlan = { title: "Remote" },
    file = { id: "file", version: "3" },
    cached = { plan: { title: "Local" }, baseVersion: "2", dirty: true };
  const selected = resolveTeamDraft({ sharedPlan, file, cached });
  assert.equal(selected.restored, true);
  assert.equal(selected.stale, true);
  assert.equal(selected.plan, cached.plan);
  assert.equal(selected.file.version, "2");
  assert.equal(file.version, "3");
});
test("clean drafts and explicit reloads always use shared data", () => {
  const sharedPlan = { title: "Remote" },
    file = { id: "file", version: "3" };
  for (const options of [
    { cached: { dirty: false, plan: { title: "Old" } } },
    {
      cached: { dirty: true, baseVersion: "2", plan: { title: "Local" } },
      discardDraft: true,
    },
    {},
  ]) {
    const selected = resolveTeamDraft({ sharedPlan, file, ...options });
    assert.equal(selected.plan, sharedPlan);
    assert.equal(selected.file.version, "3");
    assert.equal(selected.restored, false);
    assert.equal(selected.stale, false);
  }
});
