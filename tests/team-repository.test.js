import test from "node:test";
import assert from "node:assert/strict";
import { TeamRepository } from "../web/src/persistence/team-repository.js";
import { teamDraftKey } from "../web/src/persistence/team-draft.js";

test("forgetting a team removes its draft and leaves other drafts alone", async () => {
  const storage = new Map();
  const drafts = new Map();
  const repository = new TeamRepository(
    {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    {
      read: async (key) => drafts.get(key),
      write: async (value, key) => drafts.set(key, value),
      remove: async (key) => drafts.delete(key),
    },
  );
  const first = teamDraftKey("account", "first-folder", "first-file");
  const second = teamDraftKey("account", "second-folder", "second-file");
  drafts.set(first, { dirty: true });
  drafts.set(second, { dirty: true });
  repository.remember("account", {
    id: "first-folder",
    name: "First",
    teamFileId: "first-file",
  });
  repository.remember("account", {
    id: "second-folder",
    name: "Second",
    teamFileId: "second-file",
  });

  await repository.forget("account", "first-folder");

  assert.equal(drafts.has(first), false);
  assert.equal(drafts.has(second), true);
  assert.deepEqual(
    repository.list("account").map(({ id }) => id),
    ["second-folder"],
  );
});
