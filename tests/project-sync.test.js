import { test } from "node:test";
import assert from "node:assert/strict";
import { ProjectSync } from "../web/src/services/project-sync.js";
function fixture() {
  let plan = { title: "Team" };
  const states = [],
    writes = [];
  const drive = {
    metadata: async (file) => ({ ...file }),
    save: async (file) => ({ ...file, version: "2" }),
    load: async (file) => ({
      file: { ...file, version: "2" },
      plan: { title: "Remote edit" },
    }),
  };
  const sync = new ProjectSync({
    drive,
    getPlan: () => plan,
    flush: async () => {},
    writeDraft: async (draft, key) => writes.push({ draft, key }),
    key: () => "alice/team",
    reload: async () => {},
    saved: () => {},
    changed: (state) => states.push(state),
    status: () => {},
    expired: () => {},
    canCheck: () => true,
  });
  sync.opened(
    { id: "formation", version: "1", capabilities: { canEdit: true } },
    plan,
  );
  return {
    sync,
    drive,
    states,
    writes,
    edit: (value) => {
      plan = value;
      sync.changed();
    },
  };
}
test("Save is disabled when clean and again after undo returns to the saved plan", () => {
  const { sync, edit } = fixture();
  assert.equal(sync.state().disabled, true);
  edit({ title: "Changed" });
  assert.equal(sync.state().disabled, false);
  edit({ title: "Team" });
  assert.equal(sync.state().disabled, true);
  assert.equal(sync.draft({ title: "Team" }).dirty, false);
});
test("a remote check finishing after project navigation cannot update the new project", async () => {
  const { sync, drive } = fixture();
  let release;
  drive.metadata = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const checking = sync.checkRemote();
  sync.opened(
    { id: "other", version: "9", capabilities: { canEdit: true } },
    { title: "Team" },
  );
  release({ version: "2", capabilities: { canEdit: false } });
  await checking;
  assert.equal(sync.file.id, "other");
  assert.equal(sync.file.capabilities.canEdit, true);
  assert.equal(sync.remoteChanged, false);
});

test("identical remote content advances the base while preserving local edits", async () => {
  const { sync, drive, edit } = fixture();
  edit({ title: "Unsaved edit" });
  drive.metadata = async (file) => ({ ...file, version: "2" });
  drive.load = async (file) => ({
    file: { ...file, version: "2" },
    plan: { title: "Team" },
  });
  await sync.checkRemote();
  assert.equal(sync.file.version, "2");
  assert.equal(sync.dirty, true);
  assert.equal(sync.remoteChanged, false);
  assert.equal(sync.state().disabled, false);
});

test("a stale remote check does not prevent checks for the newly opened team", async () => {
  const { sync, drive } = fixture();
  let release;
  drive.metadata = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const oldCheck = sync.checkRemote();
  sync.opened(
    { id: "other", version: "9", capabilities: { canEdit: true } },
    { title: "Team" },
  );
  let checks = 0;
  drive.metadata = async (file) => {
    checks++;
    return { ...file };
  };
  await sync.checkRemote();
  assert.equal(checks, 1);
  release({ version: "2", capabilities: { canEdit: false } });
  await oldCheck;
  assert.equal(sync.file.id, "other");
  assert.equal(sync.checking, null);
});
test("an immediate remote check preserves a recovered draft's known conflict", async () => {
  const { sync, drive, edit } = fixture();
  edit({ title: "Recovered local edit" });
  const shared = { title: "New shared version" };
  sync.opened(
    { id: "formation", version: "1", capabilities: { canEdit: true } },
    shared,
    "2",
  );
  drive.metadata = async (file) => ({ ...file, version: "2" });
  drive.load = async (file) => ({
    file: { ...file, version: "2" },
    plan: shared,
  });
  await sync.checkRemote();
  assert.equal(sync.remoteChanged, true);
  assert.equal(sync.dirty, true);
  assert.equal(sync.file.version, "1");
});
