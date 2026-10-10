import test from "node:test";
import assert from "node:assert/strict";
import { PlayerProfiles } from "../web/src/services/player-profiles.js";
import { PlayerCacheSync } from "../web/src/services/player-cache-sync.js";
import { createDemoPlan } from "../web/src/domain/plan.js";
import { playerProfile } from "../web/src/domain/player-document.js";
import { removePlayer } from "../web/src/domain/players.js";
import { validatePlan } from "../web/src/domain/validation.js";
import { catalog } from "./fixtures/catalog.js";

function fixture() {
  let plan = validatePlan(createDemoPlan(catalog), catalog);
  const profile = { ...playerProfile(plan.keeps[0]), name: "Fearless ice" };
  const file = {
    id: "standalone",
    version: "1",
    capabilities: { canEdit: false },
  };
  const calls = [],
    saves = [];
  const workspace = {
    authorize() {},
    status() {},
    project: { folder: { id: "central" } },
    sync: {
      file: { id: "team", capabilities: { canEdit: true } },
      canCheck: () => true,
    },
    players: {
      captureContext: () => () => {},
      open: async (player, folder) => {
        calls.push({ player, folder });
        return { file, profile };
      },
      probe: async () => {},
      state: () => ({ connected: false }),
    },
  };
  const profiles = new PlayerProfiles({
    workspace,
    getPlan: () => plan,
    commitPlan: (next) => {
      plan = next;
    },
    validatePlan: (next) => validatePlan(next, catalog),
    isEditing: () => false,
  });
  const cache = new PlayerCacheSync({
    profiles,
    players: workspace.players,
    sync: workspace.sync,
    getPlan: () => plan,
    isEditing: () => false,
    save: async () => saves.push(plan),
    status: () => {},
  });
  return {
    workspace,
    profiles,
    cache,
    calls,
    saves,
    profile,
    plan: () => plan,
    edit: (next) => {
      plan = next;
    },
  };
}
test("existing profiles enter the roster only through an explicit import and team save", async () => {
  const f = fixture(),
    count = f.plan().keeps.length;
  await f.cache.refresh();
  assert.equal(f.plan().keeps.length, count);
  assert.deepEqual(f.calls, []);
  const player = await f.profiles.import();
  assert.equal(player.name, f.profile.name);
  assert.equal(player.playerSource.fileId, "standalone");
  assert.equal(player.x, null);
  assert.equal(player.ownerId, undefined);
  assert.equal(f.calls[0].folder.id, "central");
  assert.deepEqual(f.saves, []);
  await assert.rejects(f.profiles.import(), /already on the team/);
});
test("Undoing an import or removing membership cannot be reversed by polling", async () => {
  const f = fixture(),
    before = f.plan();
  const player = await f.profiles.import();
  f.edit(before);
  await f.cache.refresh();
  assert.equal(f.plan(), before);
  await f.profiles.import();
  f.edit(removePlayer(f.plan(), f.plan().keeps.at(-1).id));
  await f.cache.refresh();
  assert.ok(
    !f
      .plan()
      .keeps.some(
        (item) => item.playerSource?.fileId === player.playerSource.fileId,
      ),
  );
  // A deliberate reimport is allowed, and clears the old schema's exclusion.
  await f.profiles.import();
  assert.deepEqual(f.plan().excludedPlayerFileIds, []);
});
test("read-only team members cannot import or open the picker for roster administration", async () => {
  const f = fixture();
  f.workspace.sync.file.capabilities.canEdit = false;
  await assert.rejects(f.profiles.import(), /Editor access/);
  assert.deepEqual(f.calls, []);
});
