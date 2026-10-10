import test from "node:test";
import assert from "node:assert/strict";
import { PlayerFiles } from "../web/src/services/player-files.js";
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
    createPlayer: async (data, location) => {
      calls.push(["create", location]);
      profile = structuredClone(data);
      return structuredClone(file);
    },
    loadPlayer: async () => {
      calls.push(["load"]);
      return { file: structuredClone(file), profile: structuredClone(profile) };
    },
    savePlayer: async (expected, data) => {
      calls.push(["save"]);
      if (!file.capabilities.canEdit)
        throw Object.assign(new Error("Read only"), { status: 403 });
      if (expected.version !== file.version)
        throw Object.assign(new Error("Changed"), { status: 409 });
      profile = structuredClone(data);
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
