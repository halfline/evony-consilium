import test from "node:test";
import assert from "node:assert/strict";
import { PlayerProfiles } from "../web/src/services/player-profiles.js";
import { PlayerFiles } from "../web/src/services/player-files.js";
import {
  linkedPlayer,
  validateProfile,
} from "../web/src/domain/player-document.js";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";
import { catalog } from "./fixtures/catalog.js";

async function fixture(canEdit = true) {
  let plan = createEmptyPlan();
  plan.keeps = ["Player", "Another player"].map((name, index) => ({
    id: `player-${index}`, name, accountId: "", allianceTag: "", level: 42,
    skin: "map-evony3-castle_lv8", w: 2, h: 2, x: null, y: null, locked: false,
  }));
  plan = validatePlan(plan, catalog);
  let sourceProfile = validateProfile(plan.keeps[0]);
  let file = { id: "source", version: "1", capabilities: { canEdit: true } };
  plan.keeps[0] = linkedPlayer(plan.keeps[0], sourceProfile, file);
  const uploads = [];
  const drive = {
    loadPlayer: async () => ({
      file: structuredClone(file),
      profile: structuredClone(sourceProfile),
    }),
    savePlayer: async (expected, profile) => {
      assert.equal(expected.version, file.version);
      sourceProfile = structuredClone(profile);
      uploads.push(profile);
      file = { ...file, version: String(Number(file.version) + 1) };
      return file;
    },
  };
  const players = new PlayerFiles({
    drive,
    picker: { player: async () => [file] },
  });
  await players.open(plan.keeps[0]);
  const workspace = { players, sync: { file: { capabilities: { canEdit } } } };
  const profiles = new PlayerProfiles({
    workspace,
    getPlan: () => plan,
    commitPlan: (next) => {
      plan = next;
    },
    validatePlan: (next) => validatePlan(next, catalog),
    isEditing: () => false,
  });
  return {
    profiles,
    workspace,
    drive,
    uploads,
    plan: () => plan,
    remote: () => sourceProfile,
    editRemote: (name) => {
      sourceProfile.name = name;
      file.version = String(Number(file.version) + 1);
    },
  };
}
test("team editors save the authoritative source and update only cached profile fields", async () => {
  const f = await fixture();
  const before = f.plan().keeps[0];
  await f.profiles.save({ ...before, name: "Shared profile" });
  const cached = f.plan().keeps[0];
  assert.equal(f.remote().name, "Shared profile");
  assert.equal(cached.name, "Shared profile");
  assert.equal(cached.id, before.id);
  assert.equal(cached.x, before.x);
  assert.equal(cached.y, before.y);
  assert.equal(cached.playerSource.version, "2");
  assert.equal(f.uploads.length, 1);
});
test("a read-only team's editor overlay and saves do not mutate its shared snapshot", async () => {
  const f = await fixture(false);
  const before = f.plan();
  await f.profiles.save({ ...before.keeps[0], name: "Player-only save" });
  const view = f.profiles.editingPlan(before.keeps[0].id);
  assert.equal(f.plan(), before);
  assert.notEqual(before.keeps[0].name, "Player-only save");
  assert.equal(view.keeps[0].name, "Player-only save");
  assert.equal(view.keeps[1], before.keeps[1]);
});
test("cache refresh pulls the source without uploading stale cached values", async () => {
  const f = await fixture();
  f.editRemote("Remote profile");
  let before = f.plan();
  f.profiles.commitCaches(before, [
    await f.profiles.collectCache(before.keeps[0]),
  ]);
  assert.equal(f.plan().keeps[0].name, "Remote profile");
  assert.equal(f.uploads.length, 0);
  const unchanged = f.plan();
  before = f.plan();
  f.profiles.commitCaches(before, [
    await f.profiles.collectCache(before.keeps[0]),
  ]);
  assert.equal(f.plan(), unchanged);
});
test("a source save finishing after a workspace reset cannot update another team's cache", async () => {
  const f = await fixture();
  const before = f.plan();
  let release;
  const saving = new Promise((resolve) => {
    release = resolve;
  });
  f.drive.savePlayer = async () => {
    await saving;
    return { id: "source", version: "2", capabilities: { canEdit: true } };
  };
  const result = f.profiles.save({ ...before.keeps[0], name: "Old workspace" });
  await new Promise((resolve) => setImmediate(resolve));
  f.workspace.players.reset();
  release();
  await assert.rejects(result, /cancel/i);
  assert.equal(f.plan(), before);
});
