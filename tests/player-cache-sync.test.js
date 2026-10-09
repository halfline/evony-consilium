import test from "node:test";
import assert from "node:assert/strict";
import { PlayerCacheSync } from "../web/src/services/player-cache-sync.js";
function fixture() {
  let plan = {
    keeps: Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      name: `Player ${i}`,
      playerSource: { fileId: `file-${i}` },
    })),
  };
  const sync = {
    dirty: false,
    remoteChanged: false,
    saving: false,
    file: { capabilities: { canEdit: true } },
    canCheck: () => true,
  };
  const events = [],
    errors = [];
  const profiles = {
    commitPlan() {},
    collectCache: async (player) => ({ ...player, name: "Updated" }),
    commitCaches: (before, updates) => {
      assert.equal(plan, before);
      events.push(updates.length);
      plan = { keeps: updates };
      sync.dirty = true;
      return true;
    },
  };
  const cache = new PlayerCacheSync({
    players: { probe: async () => {}, state: () => ({ connected: true }) },
    profiles,
    sync,
    getPlan: () => plan,
    isEditing: () => false,
    save: async () => {
      events.push("save");
      sync.dirty = false;
    },
    status: (message) => errors.push(message),
  });
  return {
    cache,
    profiles,
    sync,
    events,
    errors,
    edit: () => {
      plan = { ...plan };
    },
  };
}
test("100 profile refreshes produce one commit and one team save", async () => {
  const f = fixture();
  await f.cache.refresh();
  assert.deepEqual(f.events, [100, "save"]);
});
test("an unavailable profile does not prevent other player updates", async () => {
  const f = fixture();
  const collect = f.profiles.collectCache;
  f.profiles.collectCache = async (player) => {
    if (player.id === "20") throw new Error("Unavailable");
    return collect(player);
  };
  await f.cache.refresh();
  assert.deepEqual(f.events, [99, "save"]);
  assert.equal(f.errors.length, 1);
});
test("local edits arriving during refresh prevent cache commits or saves", async () => {
  const f = fixture();
  f.profiles.collectCache = async (player) => {
    f.edit();
    return player;
  };
  await f.cache.refresh();
  assert.deepEqual(f.events, []);
});
test("workspace resets and remote changes cancel an in-flight cache batch", async () => {
  for (const change of [
    (f) => f.cache.reset(),
    (f) => (f.sync.remoteChanged = true),
  ]) {
    const f = fixture();
    f.profiles.collectCache = async (player) => {
      change(f);
      return player;
    };
    await f.cache.refresh();
    assert.deepEqual(f.events, []);
  }
});
