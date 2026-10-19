import test from "node:test";
import assert from "node:assert/strict";
import { PlayerFiles } from "../web/src/services/player-files.js";
import { groupActivityEntries } from "../web/src/domain/activity.js";
import {
  linkedPlayer,
  playerProfile,
  validateProfile,
} from "../web/src/domain/player-document.js";
import { createDemoPlan } from "../web/src/domain/plan.js";
import { catalog } from "./fixtures/catalog.js";
const folder = { id: "central", capabilities: { canAddChildren: true } };
function fixture({ writable = true } = {}) {
  const player = createDemoPlan(catalog).keeps[0];
  let profile = validateProfile(player);
  let activityLog = [];
  const file = {
    id: "source",
    parents: [folder.id],
    version: "1",
    capabilities: { canEdit: writable },
  };
  const calls = [],
    remembered = [],
    drafts = new Map();
  const drive = {
    metadata: async () => structuredClone(file),
    createPlayer: async (data, location, activity) => {
      calls.push(["create", location]);
      profile = structuredClone(data);
      activityLog = structuredClone(activity);
      return structuredClone(file);
    },
    loadPlayer: async () => {
      calls.push(["load"]);
      return {
        file: structuredClone(file),
        profile: structuredClone(profile),
        activityLog: structuredClone(activityLog),
      };
    },
    savePlayer: async (expected, data, activity) => {
      calls.push(["save"]);
      if (!file.capabilities.canEdit)
        throw Object.assign(new Error("Read only"), { status: 403 });
      if (expected.version !== file.version)
        throw Object.assign(new Error("Changed"), { status: 409 });
      profile = structuredClone(data);
      activityLog = structuredClone(activity);
      file.version = String(Number(file.version) + 1);
      return structuredClone(file);
    },
  };
  const options = {
    drive,
    picker: { player: async () => [{ id: file.id }] },
    remember: (id) => remembered.push(id),
    readDraft: async (id) => drafts.get(id),
    writeDraft: async (id, data) => drafts.set(id, structuredClone(data)),
    actor: () => ({ email: "editor@example.test" }),
    activitySession: () => "session-one",
  };
  return {
    player,
    file,
    calls,
    remembered,
    drafts,
    options,
    files: new PlayerFiles(options),
    linked: () => linkedPlayer(player, profile, file),
    remote: () => profile,
    activity: () => activityLog,
    editRemote: (change) => {
      change(profile);
      file.version = String(Number(file.version) + 1);
    },
  };
}
test("creation requires central storage and retries reuse the created file", async () => {
  const f = fixture();
  await assert.rejects(f.files.create(f.player), /central team folder/);
  const linked = await f.files.create(f.player, folder);
  await f.files.create(f.player, folder);
  assert.equal(f.calls.filter(([kind]) => kind === "create").length, 1);
  assert.equal(f.calls[0][1].id, "central");
  assert.equal(linked.playerSource.fileId, "source");
});
test("one user's Open player never grants another workspace access", async () => {
  const f = fixture();
  assert.equal(f.files.state(f.linked()).connected, false);
  assert.deepEqual(f.calls, []);
  await f.files.open(f.linked());
  assert.equal(f.files.state(f.linked()).canEdit, true);
  assert.deepEqual(f.remembered, ["source"]);
  const another = new PlayerFiles(f.options);
  assert.equal(another.state(f.linked()).connected, false);
  f.files.reset();
  assert.equal(f.files.state(f.linked()).connected, false);
});
test("opening for the roster rejects files outside the central folder", async () => {
  const f = fixture();
  f.file.parents = ["elsewhere"];
  await assert.rejects(f.files.open(null, folder), /central team folder/);
  assert.equal(f.files.state(f.linked()).connected, false);
});
test("read-only sources can refresh the cached team profile without any upload", async () => {
  const f = fixture({ writable: false });
  const cached = f.linked();
  await f.files.open(cached);
  f.editRemote((profile) => {
    profile.name = "Player updated";
  });
  const result = await f.files.refreshCache(cached);
  assert.equal(result.name, "Player updated");
  assert.equal(result.id, cached.id);
  assert.equal(result.x, cached.x);
  const again = await f.files.refreshCache(result);
  assert.equal(again, result);
  const stale = await f.files.refreshCache({
    ...result,
    name: "Stale team value",
  });
  assert.equal(stale.name, "Player updated");
  assert.equal(
    f.calls.some(([kind]) => kind === "save"),
    false,
  );
});
test("cache refresh always follows the source and validates before applying", async () => {
  const f = fixture();
  const cached = f.linked();
  await f.files.open(cached);
  f.editRemote((profile) => {
    profile.name = "Source edit";
  });
  await assert.rejects(
    f.files.refreshCache(cached, () => {
      throw new Error("Invalid team snapshot");
    }),
    /Invalid team snapshot/,
  );
  const result = await f.files.refreshCache({ ...cached, name: "Stale cache" });
  assert.equal(result.name, "Source edit");
  assert.equal(f.remote().name, "Source edit");
  assert.equal(
    f.calls.some(([kind]) => kind === "save"),
    false,
  );
});
test("personal editing saves only the player file and retains a recoverable draft on failure", async () => {
  const f = fixture();
  const cached = f.linked();
  await f.files.open(cached);
  f.options.drive.savePlayer = async () => {
    throw new Error("Offline");
  };
  await assert.rejects(
    f.files.saveOwn({ ...cached, name: "My draft" }),
    /Offline/,
  );
  assert.equal(f.drafts.get("source").profile.name, "My draft");
  assert.equal(cached.name, f.player.name);
  f.files.reset();
  await f.files.open(cached);
  assert.equal(f.files.profile(cached).name, "My draft");
});
test("personal edits merge concurrent independent changes without updating the team cache", async () => {
  const f = fixture();
  const cached = f.linked();
  await f.files.open(cached);
  f.editRemote((profile) => {
    profile.accountId = "00123";
  });
  await f.files.saveOwn({ ...cached, name: "My change" }, () =>
    assert.fail("No conflict"),
  );
  assert.equal(f.remote().name, "My change");
  assert.equal(f.remote().accountId, "00123");
  assert.equal(cached.name, f.player.name);
  assert.equal(f.drafts.get("source"), null);
});

test("player history groups saves into one entry per sign-in session", async () => {
  const f = fixture();
  const linked = await f.files.create(f.player, folder);
  assert.deepEqual(f.activity()[0].changes, ["Created player file"]);
  await f.files.saveOwn({ ...linked, name: "New name" });
  await f.files.saveOwn({
    ...linked,
    name: "New name",
    level: linked.level + 1,
  });
  const grouped = groupActivityEntries(f.activity());
  assert.equal(grouped.length, 1);
  assert.deepEqual(grouped[0].changes, [
    "Created player file",
    "Updated name",
    "Updated keep level",
  ]);
  assert.equal(f.activity()[0].account, "editor@example.test");
  assert.deepEqual(f.files.activitySnapshots()[0].activityLog, f.activity());
  await f.files.refreshCache(f.linked());
  assert.deepEqual(f.files.activitySnapshots()[0].activityLog, f.activity());
  f.options.activitySession = () => "session-two";
  f.files = new PlayerFiles(f.options);
  await f.files.open(linked);
  await f.files.saveOwn({ ...linked, name: "Another name" });
  assert.equal(groupActivityEntries(f.activity()).length, 2);
});

test("another user's player edit starts a new history segment", async () => {
  const f = fixture();
  const linked = await f.files.create(f.player, folder);
  await f.files.saveOwn({ ...linked, name: "First edit" });
  f.activity().push({
    id: "other-entry",
    sessionId: "other-session",
    at: new Date().toISOString(),
    account: "other@example.test",
    changes: ["Updated castle"],
  });
  f.file.version = String(Number(f.file.version) + 1);
  await f.files.saveOwn({ ...linked, name: "Second edit" });
  assert.deepEqual(
    groupActivityEntries(f.activity()).map((entry) => entry.account),
    ["editor@example.test", "other@example.test", "editor@example.test"],
  );
  assert.notEqual(f.activity()[0].id, f.activity()[2].id);
});

test("a conflicting player write preserves the intervening user's audit entry", async () => {
  const f = fixture();
  const linked = await f.files.create(f.player, folder);
  const save = f.options.drive.savePlayer;
  let attempts = 0;
  f.options.drive.savePlayer = async (...args) => {
    if (!attempts++) {
      f.editRemote((profile) => {
        profile.accountId = "00123";
      });
      f.activity().push({
        id: "other-entry",
        sessionId: "other-session",
        revision: 1,
        at: new Date().toISOString(),
        account: "other@example.test",
        changes: ["Updated account ID"],
      });
      throw Object.assign(new Error("Changed"), { status: 412 });
    }
    return save(...args);
  };
  await f.files.saveOwn({ ...linked, name: "Local edit" });
  assert.equal(f.remote().accountId, "00123");
  assert.deepEqual(
    f.activity().map((entry) => entry.account),
    ["editor@example.test", "other@example.test", "editor@example.test"],
  );
  assert.equal(f.activity().length, 3);
});

test("native Drive access can enable editing without Picker or a remembered grant", async () => {
  const f = fixture();
  f.options.drive.metadata = async () => structuredClone(f.file);
  f.options.picker.player = () =>
    assert.fail("Picker should not open automatically");
  const player = f.linked();
  await f.files.probe(player);
  assert.equal(f.files.state(player).canEdit, true);
  assert.deepEqual(f.remembered, ["source"]);
  f.file.capabilities.canEdit = false;
  await f.files.probe(player, true);
  assert.equal(f.files.state(player).canEdit, false);
  const loads = f.calls.filter(([kind]) => kind === "load").length;
  f.file.capabilities.canEdit = true;
  await f.files.probe(player, true);
  assert.equal(f.files.state(player).canEdit, true);
  assert.equal(f.calls.filter(([kind]) => kind === "load").length, loads);
});

test("automatic probes leave denied files locked and load accessible read-only profiles", async () => {
  const f = fixture({ writable: false });
  f.options.drive.metadata = async () => {
    throw Object.assign(new Error("Not app-authorized"), { status: 404 });
  };
  await f.files.probe(f.linked());
  assert.equal(f.files.state(f.linked()).canEdit, false);
  assert.deepEqual(f.calls, []);
  f.options.drive.metadata = async () => structuredClone(f.file);
  await f.files.probe(f.linked(), true);
  assert.equal(f.files.state(f.linked()).canEdit, false);
  assert.deepEqual(f.calls, [["load"]]);
});

test("a profile save waits for a background refresh of the same source", async () => {
  const f = fixture();
  const cached = f.linked();
  await f.files.open(cached);
  const load = f.options.drive.loadPlayer;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let first = true;
  f.options.drive.loadPlayer = async () => {
    if (first) {
      first = false;
      await gate;
    }
    return load();
  };
  const refresh = f.files.refreshCache(cached);
  const save = f.files.saveOwn({ ...cached, name: "Saved after refresh" });
  assert.equal(
    f.calls.some(([kind]) => kind === "save"),
    false,
  );
  release();
  await Promise.all([refresh, save]);
  assert.equal(f.remote().name, "Saved after refresh");
  assert.equal(f.files.state(cached).busy, false);
});

test("saved stat changes record once after a concurrent write and refreshes add no samples", async () => {
  const f = fixture();
  const linked = await f.files.create(f.player, folder);
  const save = f.options.drive.savePlayer;
  let attempts = 0;
  f.options.drive.savePlayer = async (...args) => {
    if (!attempts++) {
      f.editRemote((profile) => {
        profile.accountId = "0055";
      });
      throw Object.assign(new Error("Changed"), { status: 412 });
    }
    return save(...args);
  };
  await f.files.saveOwn({ ...linked, level: 43 });
  const records = Object.values(f.remote().details.progress);
  assert.equal(records.length, 2);
  assert.deepEqual(records.find((entry) => entry.kind === "automatic").values, {
    level: 43,
  });
  assert.equal(f.remote().accountId, "0055");
  const cached = await f.files.refreshCache(linked);
  await f.files.refreshCache(cached);
  assert.equal(Object.keys(f.remote().details.progress).length, 2);
});

test("an upload with a lost response cannot duplicate its progress record after restart", async () => {
  const f = fixture();
  const linked = await f.files.create(f.player, folder);
  const save = f.options.drive.savePlayer;
  f.options.drive.savePlayer = async (...args) => {
    await save(...args);
    throw new Error("Lost response");
  };
  await assert.rejects(
    f.files.saveOwn({ ...linked, level: 43 }),
    /Lost response/,
  );
  const operation = f.drafts.get("source").progressEvent;
  assert.ok(operation.id);
  assert.equal(Object.keys(f.remote().details.progress).length, 2);
  f.options.drive.savePlayer = save;
  f.files.reset();
  await f.files.open(linked);
  await f.files.saveOwn(f.files.profile(linked));
  assert.equal(Object.keys(f.remote().details.progress).length, 2);
  assert.ok(f.remote().details.progress[`auto-${operation.id}`]);
});

test("failed uploads retain the progress operation without changing remote history", async () => {
  const f = fixture();
  const linked = await f.files.create(f.player, folder);
  const save = f.options.drive.savePlayer;
  f.options.drive.savePlayer = async () => {
    throw new Error("Offline");
  };
  await assert.rejects(f.files.saveOwn({ ...linked, level: 43 }), /Offline/);
  const id = f.drafts.get("source").progressEvent.id;
  assert.equal(Object.keys(f.remote().details.progress).length, 1);
  f.options.drive.savePlayer = save;
  await f.files.saveOwn({ ...linked, level: 43 });
  assert.ok(f.remote().details.progress[`auto-${id}`]);
  assert.equal(Object.keys(f.remote().details.progress).length, 2);
});

test("reapplying a committed draft after a later conflicting change records a fresh observation", async () => {
  const f = fixture(),
    linked = await f.files.create(f.player, folder);
  const save = f.options.drive.savePlayer;
  f.options.drive.savePlayer = async (...args) => {
    await save(...args);
    throw new Error("Lost response");
  };
  await assert.rejects(
    f.files.saveOwn({ ...linked, level: 43 }),
    /Lost response/,
  );
  const originalId = f.drafts.get("source").progressEvent.id;
  f.editRemote((profile) => {
    profile.level = 44;
  });
  f.options.drive.savePlayer = save;
  await f.files.saveOwn({ ...linked, level: 43 }, async () => "team");
  const observations = Object.values(f.remote().details.progress).filter(
    (entry) => entry.kind === "automatic",
  );
  assert.equal(observations.length, 2);
  assert.ok(observations.some((entry) => entry.id === `auto-${originalId}`));
  assert.equal(f.remote().level, 43);
});

test("opening a legacy profile initializes saved source stats once while preserving its draft", async () => {
  const f = fixture(),
    cached = f.linked();
  f.drafts.set("source", {
    baseline: playerProfile(cached),
    profile: { ...playerProfile(cached), level: cached.level + 1 },
  });
  await f.files.open(cached);
  f.editRemote((profile) => {
    profile.name = "Authoritative name";
    profile.details = { buffs: { city: { siege: { attack: 1350 } } } };
  });
  const result = await f.files.refreshCache(cached, () => {}, {
    initializeProgress: true,
  });
  const entries = Object.values(f.remote().details.progress);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].kind, "baseline");
  assert.equal(entries[0].account, "editor@example.test");
  assert.deepEqual(entries[0].values, {
    level: cached.level,
    "buffs.city.siege.attack": 1350,
  });
  assert.equal(f.remote().name, "Authoritative name");
  assert.equal(f.files.profile(result).level, cached.level + 1);
  assert.equal(f.drafts.get("source").profile.level, cached.level + 1);
  assert.equal(
    await f.files.refreshCache(result, () => {}, { initializeProgress: true }),
    result,
  );
  assert.equal(f.calls.filter(([kind]) => kind === "save").length, 1);
});

test("baseline initialization retries against newer source statistics", async () => {
  const f = fixture(),
    cached = f.linked();
  await f.files.open(cached);
  const save = f.options.drive.savePlayer;
  let attempts = 0;
  f.options.drive.savePlayer = async (...args) => {
    if (!attempts++) {
      f.editRemote((profile) => {
        profile.level++;
      });
      throw Object.assign(new Error("Changed"), { status: 412 });
    }
    return save(...args);
  };
  await f.files.refreshCache(cached, () => {}, { initializeProgress: true });
  const entries = Object.values(f.remote().details.progress);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].values.level, cached.level + 1);
  assert.equal(attempts, 2);
});
