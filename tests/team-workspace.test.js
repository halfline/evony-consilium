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
