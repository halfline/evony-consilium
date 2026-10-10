import test from "node:test";
import assert from "node:assert/strict";
import { PlayerProfiles } from "../web/src/services/player-profiles.js";
import { PlayerCacheSync } from "../web/src/services/player-cache-sync.js";
import { createDemoPlan } from "../web/src/domain/plan.js";
import {
  playerProfile,
  linkedPlayer,
} from "../web/src/domain/player-document.js";
import { removePlayer } from "../web/src/domain/players.js";
import { validatePlan } from "../web/src/domain/validation.js";
import { catalog } from "./fixtures/catalog.js";

function fixture() {
  let plan = validatePlan(createDemoPlan(catalog), catalog);
  const profile = { ...playerProfile(plan.keeps[0]), name: "Fearless ice" };
  const source = {
    id: "standalone",
    name: "Fearless ice.player.consilium.json",
    version: "1",
    capabilities: { canEdit: false },
  };
  const sync = {
    file: { id: "team", capabilities: { canEdit: true } },
    canCheck: () => true,
    dirty: false,
  };
  const reads = [],
    errors = [],
    saves = [];
  const workspace = {
    sync,
    project: { folder: { id: "central", resourceKey: "folder-key" } },
    drive: {
      children: async (folder) => {
        assert.equal(folder.id, "central");
        assert.equal(folder.resourceKey, "folder-key");
        return [source, { id: "team", name: "team.consilium.json" }];
      },
      loadPlayer: async (file) => {
        reads.push(file.id);
        return { file, profile };
      },
    },
    status: (message) => errors.push(message),
  };
  const profiles = new PlayerProfiles({
    workspace,
    getPlan: () => plan,
    commitPlan: (next) => {
      plan = validatePlan(next, catalog);
      sync.dirty = true;
    },
    validatePlan: (next) => validatePlan(next, catalog),
    isEditing: () => false,
  });
  const cache = new PlayerCacheSync({
    profiles,
    sync,
    getPlan: () => plan,
    players: { probe: async () => {}, state: () => ({ connected: false }) },
    isEditing: () => false,
    discover: (before, current) => profiles.collectFolder(before, current),
    save: async () => {
      saves.push(plan);
      sync.dirty = false;
    },
    status: workspace.status,
  });
  return {
    workspace,
    cache,
    profiles,
    sync,
    profile,
    source,
    reads,
    errors,
    saves,
    plan: () => plan,
    edit: (next) => {
      plan = next;
    },
  };
}

test("folder refresh adds an unlinked player with its complete profile and saves once", async () => {
  const f = fixture();
  const before = f.plan();
  await f.cache.refresh();
  const discovered = f.plan().keeps.at(-1);
  assert.deepEqual(playerProfile(discovered), f.profile);
  assert.equal(discovered.playerSource.fileId, f.source.id);
  assert.equal(discovered.x, null);
  assert.equal(discovered.y, null);
  assert.equal(discovered.ownerId, undefined);
  assert.deepEqual(f.plan().keeps.slice(0, -1), before.keeps);
  assert.equal(f.saves.length, 1);
  await f.cache.refresh();
  assert.equal(f.saves.length, 1);
  assert.deepEqual(f.reads, ["standalone"]);
});

test("removing a discovered player prevents rediscovery without deleting the source", async () => {
  const f = fixture();
  await f.cache.refresh();
  const id = f.plan().keeps.at(-1).id;
  const removed = removePlayer(f.plan(), id);
  assert.deepEqual(removed.excludedPlayerFileIds, [f.source.id]);
  f.edit(removed);
  await f.cache.refresh();
  assert.ok(!f.plan().keeps.some((player) => player.id === id));
  assert.deepEqual(f.reads, ["standalone"]);
});

test("existing linked alts retain ownership and identity without duplicate discovery", async () => {
  const f = fixture();
  const before = f.plan();
  const alt = linkedPlayer(before.keeps[0], f.profile, f.source);
  alt.ownerId = before.keeps[1].id;
  before.keeps[0] = alt;
  f.edit(before);
  await f.cache.refresh();
  assert.equal(f.plan().keeps[0], alt);
  assert.equal(f.saves.length, 0);
  assert.deepEqual(f.reads, []);
});

test("unavailable or invalid player files do not block another valid player", async () => {
  const f = fixture();
  f.workspace.drive.children = async () => [
    { id: "denied", name: "Denied.player.consilium.json" },
    { id: "invalid", name: "Invalid.player.consilium.json" },
    f.source,
  ];
  const load = f.workspace.drive.loadPlayer;
  f.workspace.drive.loadPlayer = async (file) => {
    if (file.id === "denied")
      throw Object.assign(new Error("Unavailable"), { status: 404 });
    if (file.id === "invalid")
      return { file, profile: { ...f.profile, skin: "unknown" } };
    return load(file);
  };
  await f.cache.refresh();
  assert.equal(f.errors.length, 2);
  assert.equal(f.plan().keeps.at(-1).name, "Fearless ice");
  assert.equal(f.saves.length, 1);
});

test("missing folder grants, read-only teams and unsaved edits keep cached rosters usable", async () => {
  for (const state of ["folder-denied", "viewer", "dirty"]) {
    const f = fixture();
    const before = f.plan();
    if (state === "folder-denied")
      f.workspace.drive.children = async () => {
        throw Object.assign(new Error("Unavailable"), { status: 404 });
      };
    if (state === "viewer") f.sync.file.capabilities.canEdit = false;
    if (state === "dirty") f.sync.dirty = true;
    await f.cache.refresh();
    assert.equal(f.plan(), before);
    assert.equal(f.errors.length, 0);
    assert.equal(f.saves.length, 0);
  }
});

test("local edits or a workspace reset during discovery cancel the pending roster update", async () => {
  for (const state of ["edit", "reset"]) {
    const f = fixture();
    f.workspace.drive.loadPlayer = async (file) => {
      if (state === "edit") f.edit({ ...f.plan(), title: "Local edit" });
      else f.cache.reset();
      return { file, profile: f.profile };
    };
    await f.cache.refresh();
    assert.equal(
      f
        .plan()
        .keeps.some((player) => player.playerSource?.fileId === f.source.id),
      false,
    );
    assert.equal(f.saves.length, 0);
  }
});
