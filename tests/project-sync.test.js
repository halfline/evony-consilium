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
test("remote-only changes use Reload without uploading, including view-only projects", async () => {
  const { sync, drive } = fixture();
  drive.metadata = async (file) => ({
    ...file,
    version: "2",
    capabilities: { canEdit: false },
  });
  drive.save = async () => {
    assert.fail("Reload must not upload");
  };
  let reloads = 0;
  sync.reload = async () => {
    reloads++;
    sync.remoteChanged = false;
  };
  await sync.checkRemote();
  assert.equal(sync.state().label, "Review updates");
  assert.equal(sync.state().disabled, false);
  await sync.save();
  assert.equal(reloads, 1);
  assert.equal(sync.state().label, "Save team");
  assert.equal(sync.state().disabled, true);
});
test("edits arriving during a save remain dirty against the new shared version", async () => {
  const { sync, drive, edit, writes } = fixture();
  edit({ title: "First edit" });
  drive.save = async (file) => {
    edit({ title: "Second edit" });
    return { ...file, version: "2" };
  };
  await sync.save();
  assert.equal(sync.state().disabled, false);
  assert.deepEqual(writes[0], {
    key: "alice/team",
    draft: {
      plan: { title: "Second edit" },
      baseVersion: "2",
      basePlan: { title: "First edit" },
      dirty: true,
    },
  });
});
test("a version conflict retains edits, offers conflict recovery and re-enables Save", async () => {
  const { sync, drive, edit } = fixture();
  edit({ title: "My edits" });
  const conflict = Object.assign(new Error("Changed remotely"), {
    status: 409,
  });
  drive.save = async () => {
    throw conflict;
  };
  await assert.rejects(sync.save(), { status: 409 });
  assert.equal(sync.state().conflict, true);
  assert.equal(sync.state().label, "Save team");
  assert.equal(sync.state().disabled, false);
  assert.equal(sync.saving, false);
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

test("a later Drive revision of our saved content is not a teammate edit", async () => {
  const { sync, drive, edit, writes } = fixture();
  edit({ title: "My saved project" });
  await sync.save();
  drive.metadata = async (file) => ({ ...file, version: "3" });
  drive.load = async (file) => ({
    file: { ...file, version: "3" },
    plan: { title: "My saved project" },
  });
  await sync.checkRemote();
  assert.equal(sync.file.version, "3");
  assert.equal(sync.remoteChanged, false);
  assert.equal(sync.state().label, "Save team");
  assert.equal(sync.state().disabled, true);
  assert.equal(writes.at(-1).draft.baseVersion, "3");
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

test("Save retries a revision-only conflict after checking shared content", async () => {
  const { sync, drive, edit } = fixture();
  edit({ title: "My next edit" });
  let uploads = 0;
  drive.save = async (file) => {
    uploads++;
    if (uploads === 1)
      throw Object.assign(new Error("Revision changed"), { status: 409 });
    assert.equal(file.version, "2");
    return { ...file, version: "3" };
  };
  drive.load = async (file) => ({
    file: { ...file, version: "2" },
    plan: { title: "Team" },
  });
  await sync.save();
  assert.equal(uploads, 2);
  assert.equal(sync.file.version, "3");
  assert.equal(sync.state().disabled, true);
  assert.equal(sync.remoteChanged, false);
});

test("a save finishing after a team switch cannot replace the new team or its draft", async () => {
  const { sync, drive, edit, writes } = fixture();
  edit({ title: "Old team edit" });
  let release;
  drive.save = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const saving = sync.save();
  await Promise.resolve();
  sync.opened(
    { id: "other", version: "9", capabilities: { canEdit: true } },
    { title: "Other team" },
  );
  const state = { ...sync.state() };
  release({ id: "formation", version: "2", capabilities: { canEdit: true } });
  await saving;
  assert.equal(sync.file.id, "other");
  assert.equal(sync.file.version, "9");
  assert.deepEqual(sync.state(), state);
  assert.deepEqual(writes, []);
});
test("signing out during an upload does not resurrect the old team", async () => {
  const { sync, drive, edit, writes } = fixture();
  edit({ title: "Old edit" });
  let release;
  drive.save = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const saving = sync.save();
  await Promise.resolve();
  sync.reset();
  release({ id: "formation", version: "2", capabilities: { canEdit: true } });
  await saving;
  assert.equal(sync.file, null);
  assert.equal(sync.saving, false);
  assert.deepEqual(writes, []);
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
test("reload opening a new snapshot clears Saving even though the operation context changes", async () => {
  const { sync, drive } = fixture();
  drive.metadata = async (file) => ({ ...file, version: "2" });
  await sync.checkRemote();
  sync.reload = async () =>
    sync.opened(
      { id: "formation", version: "2", capabilities: { canEdit: true } },
      { title: "Team" },
    );
  await sync.save();
  assert.equal(sync.saving, false);
  assert.equal(sync.state().label, "Save team");
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
