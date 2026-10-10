import test from "node:test";
import assert from "node:assert/strict";
import { TeamWorkspace } from "../web/src/services/team-workspace.js";
import { createEmptyPlan } from "../web/src/domain/plan.js";

function fixture({ canEdit = true, cached = null } = {}) {
  let plan = createEmptyPlan();
  const writes = [],
    events = [],
    remembered = new Map();
  const folder = { id: "folder", name: "Shared" };
  const file = { id: "file", version: "3", capabilities: { canEdit } };
  const shared = { ...createEmptyPlan(), title: "Shared" };
  const session = {
    token: () => "token",
    clear() {},
    signIn: async () => ({ sub: "account" }),
  };
  const repository = {
    read: async () => cached,
    write: async (data, key) => writes.push({ data, key }),
    remember: (account, resource) =>
      remembered.set(account, structuredClone(resource)),
    list: (account) =>
      [...remembered]
        .filter(([key]) => key === account)
        .map(([, value]) => value),
    forget: (account) => remembered.delete(account),
  };
  const drive = {
    children: async () => [],
    project: async () => ({ folder: { ...folder }, file: { ...file } }),
    load: async () => ({ file: { ...file }, plan: structuredClone(shared) }),
    createFolder: async (name) => ({ ...folder, name }),
    initializeProject: async (folder, data) => Object.assign(shared, data),
  };
  const workspace = new TeamWorkspace({
    session,
    drive,
    picker: {},
    repository,
    getPlan: () => plan,
    openPlan: (data) => {
      plan = data;
      events.push("open");
    },
    setReadOnly: (value) => events.push(value ? "view" : "edit"),
    status: () => {},
    changed: () => {},
    expired: () => {},
    canCheck: () => true,
  });
  return {
    workspace,
    writes,
    events,
    drive,
    shared,
    file,
    getPlan: () => plan,
  };
}

test("team access keeps authorization, draft recovery, and remembering independent of the DOM", async () => {
  const f = fixture();
  await f.workspace.signIn();
  await f.workspace.open({ id: "folder" });
  assert.equal(f.getPlan().title, "Shared");
  assert.equal(f.workspace.list()[0].teamFileId, "file");
  assert.deepEqual(f.events, ["open", "edit", "edit"]);
  f.workspace.forget("folder");
  assert.equal(f.workspace.list().length, 0);
});

test("viewers read shared content without destroying an editor's unsaved local draft", async () => {
  const cached = {
    plan: { ...createEmptyPlan(), title: "Local edits" },
    baseVersion: "2",
    dirty: true,
  };
  const f = fixture({ canEdit: false, cached });
  await f.workspace.signIn();
  const draft = await f.workspace.open({ id: "folder" });
  assert.equal(draft.restored, false);
  assert.equal(f.getPlan().title, "Shared");
  assert.equal(f.writes.length, 0);
  assert.equal(cached.plan.title, "Local edits");
  assert.equal(f.workspace.sync.state().disabled, true);
});

test("navigation flushes the outgoing team's latest edits under its original key", async () => {
  const f = fixture();
  await f.workspace.signIn();
  await f.workspace.open({ id: "folder" });
  f.getPlan().title = "Outgoing draft";
  f.workspace.persist();
  const originalKey = f.workspace.key();
  f.drive.project = async () => ({
    folder: { id: "second-folder" },
    file: { ...f.file, id: "second-file" },
  });
  f.drive.load = async () => ({
    file: { ...f.file, id: "second-file" },
    plan: { ...createEmptyPlan(), title: "Incoming" },
  });
  await f.workspace.open({ id: "second-folder" });
  assert.equal(f.writes[0].key, originalKey);
  assert.equal(f.writes[0].data.plan.title, "Outgoing draft");
  assert.notEqual(f.workspace.key(), originalKey);
  assert.equal(f.getPlan().title, "Incoming");
});

test("creation puts team name and logo in the authoritative document", async () => {
  const f = fixture();
  await f.workspace.signIn();
  await f.workspace.create(" Team ", "data:image/webp;base64,AAAA");
  assert.equal(f.getPlan().title, "Team");
  assert.equal(f.getPlan().projectLogo, "data:image/webp;base64,AAAA");
});

test("sign-out cancels a download before it can open or remember a team", async () => {
  const f = fixture();
  await f.workspace.signIn();
  let release;
  let downloading;
  const started = new Promise((resolve) => {
    downloading = resolve;
  });
  f.drive.load = async () => {
    downloading();
    await new Promise((resolve) => {
      release = resolve;
    });
    return { file: f.file, plan: f.shared };
  };
  const opening = f.workspace.open({ id: "folder" });
  await started;
  f.workspace.clear();
  release();
  await assert.rejects(opening, {
    name: "Error",
    message: "Operation cancelled.",
  });
  assert.equal(f.workspace.account, null);
  assert.equal(f.workspace.project, null);
  assert.equal(f.events.length, 0);
});

test("a slower earlier navigation cannot replace the team opened afterward", async () => {
  const f = fixture();
  await f.workspace.signIn();
  let release;
  let loading;
  const started = new Promise((resolve) => {
    loading = resolve;
  });
  let calls = 0;
  f.drive.load = async () => {
    if (++calls === 1) {
      loading();
      await new Promise((resolve) => {
        release = resolve;
      });
      return { file: f.file, plan: { ...f.shared, title: "Late result" } };
    }
    return { file: f.file, plan: { ...f.shared, title: "Current team" } };
  };
  const first = f.workspace.open({ id: "folder" });
  await started;
  await f.workspace.open({ id: "folder" });
  release();
  await assert.rejects(first, { message: "Operation cancelled." });
  assert.equal(f.getPlan().title, "Current team");
  assert.equal(f.workspace.list()[0].name, "Current team");
});

test("a rejected document leaves the current team's access state and identity intact", async () => {
  const f = fixture({ canEdit: false });
  await f.workspace.signIn();
  await f.workspace.open({ id: "folder" });
  const previous = f.workspace.project;
  const key = f.workspace.key();
  f.events.length = 0;
  f.drive.load = async () => ({
    file: { ...f.file, capabilities: { canEdit: true } },
    plan: f.shared,
  });
  f.workspace.openPlan = () => {
    throw new Error("Invalid team document");
  };
  await assert.rejects(
    f.workspace.open({ id: "other" }),
    /Invalid team document/,
  );
  assert.deepEqual(f.events, []);
  assert.equal(f.workspace.project, previous);
  assert.equal(f.workspace.key(), key);
  assert.equal(f.workspace.sync.file.capabilities.canEdit, false);
});

test("unlocking a team rechecks Drive access without unlocking any player files", async () => {
  const f = fixture({ canEdit: false });
  await f.workspace.signIn();
  await f.workspace.open({ id: "folder" });
  f.workspace.picker.files = async () => [{ id: "file" }];
  f.drive.metadata = async () => structuredClone(f.file);
  await assert.rejects(f.workspace.unlockTeam(), /still read-only/);
  f.file.capabilities.canEdit = true;
  await f.workspace.unlockTeam();
  assert.equal(f.workspace.sync.file.capabilities.canEdit, true);
  assert.equal(
    f.workspace.players.state({ playerSource: { fileId: "source" } }).connected,
    false,
  );
});

test("central folder authorization never falls back to personal Drive storage", async () => {
  const f = fixture();
  await f.workspace.signIn();
  await f.workspace.open({ id: "folder" });
  f.drive.metadata = async (resource) =>
    resource.id === "file"
      ? { ...f.file, parents: ["central"] }
      : (() => {
          throw Object.assign(new Error("Grant needed"), { status: 404 });
        })();
  f.workspace.picker.folder = async () => ({ id: "elsewhere" });
  await assert.rejects(f.workspace.playerFolder(), /central team folder/);
});

test("automatic player refresh visits the roster and saves its cache once", async () => {
  const f = fixture();
  await f.workspace.signIn();
  await f.workspace.open({ id: "folder" });
  f.getPlan().keeps = [
    { id: "a", playerSource: { fileId: "source-a" } },
    { id: "b", playerSource: { fileId: "source-b" } },
  ];
  const visited = [],
    saved = [];
  f.workspace.players.probe = async () => {};
  f.workspace.players.state = () => ({ connected: true, busy: false });
  f.workspace.profiles.commitPlan = () => {};
  f.workspace.profiles.collectCache = async (player) => {
    visited.push(player.id);
    return { ...player, name: "Updated" };
  };
  f.workspace.profiles.commitCaches = (_before, updates) => {
    assert.equal(updates.length, 2);
    f.workspace.sync.dirty = true;
    return true;
  };
  f.workspace.save = async () => {
    saved.push(visited.at(-1));
    f.workspace.sync.dirty = false;
  };
  await f.workspace.refreshPlayers();
  assert.deepEqual(visited, ["a", "b"]);
  assert.deepEqual(saved, ["b"]);
  f.workspace.sync.dirty = true;
  await f.workspace.refreshPlayers();
  assert.equal(visited.length, 2);
  f.workspace.sync.dirty = false;
  f.workspace.sync.file.capabilities.canEdit = false;
  await f.workspace.refreshPlayers();
  assert.equal(visited.length, 2);
});
