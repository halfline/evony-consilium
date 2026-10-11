import test from "node:test";
import assert from "node:assert/strict";
import { PlayerNotes } from "../web/src/services/player-notes.js";
import { ProjectSync } from "../web/src/services/project-sync.js";
import { AccountNotes } from "../web/src/services/account-notes.js";
import {
  noteDocument,
  readNoteDocument,
  noteSubject,
  mergeNote,
  applyNoteCaches,
  validateTeamNotes,
  noteFilename,
} from "../web/src/domain/note-document.js";
import {
  teamFingerprint,
  mergeTeamPlans,
} from "../web/src/domain/team-collaboration.js";
import { createDemoPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";
import { assignPlayerOwner, removePlayer } from "../web/src/domain/players.js";
import { catalog } from "./fixtures/catalog.js";
const copy = (value) => structuredClone(value);
const error = (status) =>
  Object.assign(new Error("Access or revision changed"), { status });
function fixture() {
  let local = validatePlan(createDemoPlan(catalog), catalog),
    remote = copy(local),
    count = 0;
  const files = new Map(),
    drafts = new Map(),
    grants = new Set(["team", "central"]),
    statuses = [];
  files.set("team", {
    file: {
      id: "team",
      parents: ["central"],
      version: "1",
      capabilities: { canEdit: true },
    },
  });
  files.set("central", {
    file: {
      id: "central",
      mimeType: "application/vnd.google-apps.folder",
      version: "1",
      capabilities: { canAddChildren: true },
    },
  });
  const w = {
    account: { sub: "alice", email: "alice@example.test" },
    getPlan: () => local,
    project: { folder: { id: "central" } },
    authorize: () => {},
    healthy: () => true,
    repository: {
      read: async (key) => copy(drafts.get(key) || null),
      write: async (value, key) => drafts.set(key, copy(value)),
    },
    status: (...args) => statuses.push(args),
  };
  const createFile = (data, folder = null) => {
    const file = {
      id: `note${++count}`,
      version: "1",
      parents: folder ? [folder.id] : [],
      capabilities: { canEdit: true, canAddChildren: true, canShare: true },
    };
    files.set(file.id, {
      file,
      data: copy(data),
      owner: w.account.sub,
      permissions: [{ role: "owner", emailAddress: w.account.email }],
    });
    grants.add(file.id);
    return copy(file);
  };
  const entry = (file) => {
    if (!grants.has(file.id) || !files.has(file.id)) throw error(404);
    return files.get(file.id);
  };
  const save = async (file, data) => {
    const row = entry(file);
    if (row.file.version !== file.version) throw error(412);
    if (!row.file.capabilities.canEdit) throw error(403);
    row.data = copy(data);
    row.file.version = String(Number(row.file.version) + 1);
    return copy(row.file);
  };
  const drive = {
    metadata: async (file) => copy(entry(file).file),
    noteIndexes: async () =>
      [...files.values()]
        .filter(
          (row) =>
            row.owner === w.account.sub &&
            row.data?.format === "evony-consilium-notes-index",
        )
        .map((row) => copy(row.file)),
    loadNoteIndex: async (file) => ({
      file: copy(entry(file).file),
      data: copy(entry(file).data),
    }),
    createNoteIndex: async (data) => createFile(data, data.folder),
    saveNoteIndex: save,
    createFolder: async () => createFile(null),
    createNote: async (note, folder) => createFile(noteDocument(note), folder),
    loadNote: async (file) => ({
      file: copy(entry(file).file),
      note: readNoteDocument(entry(file).data),
    }),
    saveNote: async (file, note) => save(file, noteDocument(note)),
    notePermissions: async (file) => ({
      permissions: copy(entry(file).permissions || [{ role: "owner" }]),
    }),
    shareNote: async (file, emailAddress, role) => {
      entry(file).permissions.push({ emailAddress, role });
    },
    load: async (file) => ({
      file: copy(entry(file).file),
      plan: copy(remote),
    }),
    save: async (file, plan) => {
      const next = await save(file, plan);
      remote = copy(plan);
      return next;
    },
  };
  w.drive = drive;
  let selected;
  w.picker = {
    note: async (file) => [{ id: file?.id || selected, resourceKey: "" }],
    folder: async (file) => file,
  };
  w.sync = new ProjectSync({
    drive,
    getPlan: () => local,
    flush: async () => {},
    key: () => "team",
    writeDraft: async () => {},
    reload: async () => {},
    saved: () => {},
    changed: () => {},
    status: w.status,
    expired: () => {},
    canCheck: () => true,
    fingerprint: teamFingerprint,
    merge: mergeTeamPlans,
    validate: (plan) => validatePlan(plan, catalog),
    applyPlan: (plan) => {
      local = plan;
    },
  });
  w.sync.opened(copy(files.get("team").file), remote);
  w.notes = new PlayerNotes(w);
  return {
    w,
    files,
    drafts,
    grants,
    drive,
    statuses,
    player: () => local.keeps[0],
    local: () => local,
    remote: () => remote,
    editLocal: (change) => {
      change(local);
      w.sync.changed();
    },
    select: (id) => {
      selected = id;
    },
    editNote: (id, change) => {
      const row = files.get(id);
      change(row.data.note);
      row.file.version = String(Number(row.file.version) + 1);
    },
  };
}
test("personal note bodies and metadata never enter a team save or export", async () => {
  const f = fixture();
  const id = await f.w.notes.create(f.player(), {
    title: "Private assessment",
    body: "Secret plan",
  });
  assert.equal(f.files.get(id).file.parents.length, 1);
  assert.notEqual(f.files.get(id).file.parents[0], "central");
  const index = [...f.files.values()].find(
    (row) => row.data?.format === "evony-consilium-notes-index",
  );
  assert.deepEqual(index.file.parents, f.files.get(id).file.parents);
  assert.deepEqual(index.file.parents, [index.data.folder.id]);
  assert.deepEqual(f.files.get(id).data.note.context, {
    teamName: f.local().title,
    playerName: f.player().name,
  });
  await f.w.notes.share(id, "bob@example.test", "reader");
  await f.w.notes.refresh();
  assert.equal(f.w.notes.list(f.player())[0].audience, "Specific people");
  assert.doesNotMatch(
    JSON.stringify(f.remote()),
    /Secret plan|Private assessment|bob@example/,
  );
  await assert.rejects(f.w.notes.publish(f.player(), id), /Only a team note/);
  assert.doesNotMatch(
    JSON.stringify(f.local()),
    /Secret plan|Private assessment/,
  );
});
test("a non-editor's team note stays pending until an editor explicitly connects and publishes it", async () => {
  const f = fixture();
  f.w.sync.file.capabilities.canEdit = false;
  const id = await f.w.notes.create(
    f.player(),
    { title: "Growth", body: "Improve siege buffs" },
    "team",
  );
  assert.equal(f.files.get(id).file.parents[0], "central");
  const index = [...f.files.values()].find(
    (row) => row.data?.format === "evony-consilium-notes-index",
  );
  assert.deepEqual(index.file.parents, [index.data.folder.id]);
  assert.notEqual(index.data.folder.id, "central");
  assert.equal(f.w.notes.list(f.player())[0].published, undefined);
  assert.equal(f.remote().teamNotes, undefined);
  await assert.rejects(f.w.notes.publish(f.player(), id), /team editor/);
  f.w.account = { sub: "editor", email: "editor@example.test" };
  f.w.notes.reset();
  f.w.sync.file.capabilities.canEdit = true;
  await f.w.notes.connect(f.player(), { id });
  await f.w.notes.publish(f.player(), id);
  assert.equal(
    f.remote().teamNotes[0].noteCache.note.body,
    "Improve siege buffs",
  );
  f.editNote(id, (note) => {
    note.body = "Updated by author";
  });
  f.w.notes.reset();
  await f.w.notes.initialize();
  assert.equal(
    f.remote().teamNotes[0].noteCache.note.body,
    "Updated by author",
  );
});
test("note publication preserves unrelated unsaved team changes", async () => {
  const f = fixture(),
    title = f.remote().title;
  f.editLocal((plan) => {
    plan.title = "Unfinished planning draft";
  });
  const id = await f.w.notes.create(
    f.player(),
    { title: "Team plan", body: "Shared content" },
    "team",
  );
  assert.equal(f.remote().title, title);
  assert.equal(f.local().title, "Unfinished planning draft");
  assert.equal(f.w.sync.dirty, true);
  assert.equal(f.remote().teamNotes[0].id, id);
});
test("unconnected editors can read a published snapshot but cannot refresh its source", async () => {
  const f = fixture(),
    id = await f.w.notes.create(
      f.player(),
      { title: "Team plan", body: "Published text" },
      "team",
    );
  f.w.account = { sub: "bob", email: "bob@example.test" };
  f.w.notes.reset();
  f.grants.delete(id);
  f.editNote(id, (note) => {
    note.body = "New source text";
  });
  await f.w.notes.initialize();
  assert.equal(f.w.notes.list(f.player())[0].note.body, "Published text");
  assert.equal(f.w.notes.list(f.player())[0].connected, false);
  assert.equal(f.remote().teamNotes[0].noteCache.note.body, "Published text");
});
test("account changes clear private contents and reject an in-flight private read", async () => {
  const f = fixture(),
    id = await f.w.notes.create(f.player(), {
      title: "Private",
      body: "Alice only",
    });
  let finish;
  const original = f.drive.loadNote;
  f.drive.loadNote = async (file) => {
    const loaded = await original(file);
    await new Promise((resolve) => {
      finish = resolve;
    });
    return loaded;
  };
  const read = f.w.notes.load({ id });
  await new Promise((resolve) => setImmediate(resolve));
  f.w.account = { sub: "bob", email: "bob@example.test" };
  f.w.notes.reset();
  finish();
  await assert.rejects(read, /cancel/i);
  assert.deepEqual(f.w.notes.list(f.player()), []);
});
test("competing body edits require review and preserve the local draft", async () => {
  const f = fixture(),
    id = await f.w.notes.create(f.player(), {
      title: "Plan",
      body: "Original",
    });
  f.w.notes.updateDraft(id, { title: "Plan", body: "My changes" });
  f.editNote(id, (note) => {
    note.body = "Their changes";
  });
  await assert.rejects(f.w.notes.save(f.player(), id), (error) => error.review);
  assert.equal(f.w.notes.entries.get(id).draft.body, "My changes");
  assert.equal(f.files.get(id).data.note.body, "Their changes");
  await f.w.notes.save(f.player(), id, "local");
  assert.equal(f.files.get(id).data.note.body, "My changes");
  assert.equal(f.w.notes.entries.get(id).draft, null);
});
test("conflict approval cannot overwrite a newer, unreviewed revision", async () => {
  const f = fixture(),
    id = await f.w.notes.create(f.player(), {
      title: "Plan",
      body: "Original",
    });
  f.w.notes.updateDraft(id, { title: "Plan", body: "Mine" });
  f.editNote(id, (note) => {
    note.body = "Theirs";
  });
  await assert.rejects(f.w.notes.save(f.player(), id), (error) => error.review);
  f.editNote(id, (note) => {
    note.body = "Changed again";
  });
  await assert.rejects(
    f.w.notes.save(f.player(), id, "local"),
    (error) => error.review,
  );
  assert.equal(f.files.get(id).data.note.body, "Changed again");
});
test("independent title and body edits merge without conflict", () => {
  const base = { title: "Plan", body: "Original" };
  assert.deepEqual(
    mergeNote(
      base,
      { ...base, title: "New title" },
      { ...base, body: "New body" },
    ),
    { note: { title: "New title", body: "New body" }, conflicts: [] },
  );
});
test("draft input arriving during upload is retained against the saved baseline", async () => {
  const f = fixture(),
    id = await f.w.notes.create(f.player(), {
      title: "Plan",
      body: "Original",
    });
  const original = f.drive.saveNote;
  let finish;
  f.drive.saveNote = async (...args) => {
    await new Promise((resolve) => {
      finish = resolve;
    });
    return original(...args);
  };
  f.w.notes.updateDraft(id, { title: "Plan", body: "First edit" });
  const saving = f.w.notes.save(f.player(), id);
  await new Promise((resolve) => setImmediate(resolve));
  f.w.notes.updateDraft(id, { title: "Plan", body: "Newer typing" });
  finish();
  await saving;
  assert.equal(f.files.get(id).data.note.body, "First edit");
  assert.equal(f.w.notes.entries.get(id).draft.body, "Newer typing");
  assert.equal(f.w.notes.entries.get(id).draft.baseline.body, "First edit");
});
test("private drafts restore for the same account and remain outside player drafts", async () => {
  const f = fixture(),
    id = await f.w.notes.create(f.player(), {
      title: "Plan",
      body: "Original",
    });
  f.w.notes.updateDraft(id, { title: "Draft", body: "Unfinished" });
  await new Promise((resolve) => setImmediate(resolve));
  f.w.notes.reset();
  await f.w.notes.ready(f.player());
  assert.equal(f.w.notes.list(f.player())[0].draft.body, "Unfinished");
  assert.ok(
    [...f.drafts.keys()].every((key) =>
      key.startsWith("consilium-note:alice:"),
    ),
  );
});
test("notes on embedded profiles remain available after a central player file is created", async () => {
  const f = fixture(),
    privateId = await f.w.notes.create(f.player(), {
      title: "Private",
      body: "History",
    }),
    teamId = await f.w.notes.create(
      f.player(),
      { title: "Team", body: "Shared history" },
      "team",
    );
  f.editLocal((plan) => {
    plan.keeps[0].playerSource = { fileId: "new-central-profile" };
  });
  f.w.notes.reset();
  await f.w.notes.ready(f.player());
  assert.deepEqual(
    new Set(f.w.notes.list(f.player()).map((row) => row.id)),
    new Set([privateId, teamId]),
  );
  f.w.notes.updateDraft(privateId, {
    title: "Private",
    body: "History retained",
  });
  await f.w.notes.save(f.player(), privateId);
  assert.equal(f.files.get(privateId).data.note.body, "History retained");
  const published = await f.w.notes.publication(f.player(), teamId);
  assert.equal(
    published.noteCache.note.subject,
    `team:team:player:${f.player().id}`,
  );
});
test("source access loss hides private contents and retains the previously published team copy", async () => {
  const f = fixture(),
    privateId = await f.w.notes.create(f.player(), {
      title: "Private",
      body: "Private text",
    });
  const teamId = await f.w.notes.create(
    f.player(),
    { title: "Team", body: "Published text" },
    "team",
  );
  f.w.notes.updateDraft(privateId, {
    title: "Private draft",
    body: "Unsaved secret",
  });
  f.w.notes.entries.get(privateId).conflict = {
    note: { body: "Another private version" },
  };
  f.grants.delete(privateId);
  f.grants.delete(teamId);
  await f.w.notes.refresh();
  assert.equal(
    f.w.notes.list(f.player()).find((row) => row.id === privateId).note,
    undefined,
  );
  const hidden = f.w.notes.list(f.player()).find((row) => row.id === privateId);
  assert.equal(hidden.draft, null);
  assert.equal(hidden.entry.conflict, undefined);
  assert.equal(
    f.w.notes.list(f.player()).find((row) => row.id === teamId).note.body,
    "Published text",
  );
});
test("moving a team note to personal storage stops further cache publication", async () => {
  const f = fixture(),
    id = await f.w.notes.create(
      f.player(),
      { title: "Team", body: "Published" },
      "team",
    );
  f.files.get(id).file.parents = ["elsewhere"];
  f.editNote(id, (note) => {
    note.body = "No longer team folder content";
  });
  await f.w.notes.refresh();
  assert.equal(f.remote().teamNotes[0].noteCache.note.body, "Published");
  assert.equal(f.w.notes.list(f.player())[0].note.body, "Published");
  assert.equal(f.w.notes.list(f.player())[0].connected, false);
});
test("a recovered private draft cannot save into a source with a changed audience", async () => {
  const f = fixture(),
    id = await f.w.notes.create(f.player(), {
      title: "Private",
      body: "Original",
    });
  f.w.notes.updateDraft(id, { title: "Private", body: "Secret draft" });
  f.editNote(id, (note) => {
    note.scope = "team";
    note.teamFileId = "team";
    note.body = "Team version";
  });
  await f.w.notes.refresh();
  await assert.rejects(f.w.notes.save(f.player(), id), /audience changed/);
  assert.equal(f.files.get(id).data.note.body, "Team version");
  assert.equal(f.w.notes.entries.get(id).draft.body, "Secret draft");
  assert.equal(f.remote().teamNotes, undefined);
});
test("unchanged note refreshes preserve publication timestamps and avoid team uploads", async () => {
  const f = fixture(),
    id = await f.w.notes.create(
      f.player(),
      { title: "Team", body: "Current" },
      "team",
    ),
    timestamp = f.remote().teamNotes[0].noteCache.syncedAt,
    revision = f.files.get("team").file.version;
  await f.w.notes.refresh();
  assert.equal(f.files.get("team").file.version, revision);
  assert.equal(f.remote().teamNotes[0].noteCache.syncedAt, timestamp);
  const changed = copy(f.local());
  changed.teamNotes[0].noteCache.version = "100000000000000000001";
  changed.teamNotes[0].noteCache.note.body = "Newer revision";
  assert.equal(teamFingerprint(changed), teamFingerprint(f.local()));
  const merged = mergeTeamPlans(f.local(), changed, f.local());
  assert.equal(merged.conflicts.length, 0);
  assert.equal(merged.plan.teamNotes[0].noteCache.note.body, "Newer revision");
  assert.equal(merged.plan.teamNotes[0].id, id);
});
test("shared note validation strips extra source data and refuses personal snapshots", async () => {
  const f = fixture();
  await f.w.notes.create(f.player(), { title: "Team", body: "Shared" }, "team");
  const plan = copy(f.local());
  plan.teamNotes[0].noteCache.note.privateExtra = "Restricted content";
  plan.teamNotes[0].noteCache.unexpected = "Restricted metadata";
  plan.teamNotes[0].recipient = "private@example.test";
  assert.doesNotMatch(
    JSON.stringify(validatePlan(plan, catalog)),
    /Restricted|private@example/,
  );
  plan.teamNotes[0].noteCache.note.scope = "personal";
  delete plan.teamNotes[0].noteCache.note.teamFileId;
  assert.throws(() => validatePlan(plan, catalog), /Only team notes/);
});
test("a shared personal folder is rejected when creating an Only me note", async () => {
  const f = fixture(),
    folder = await f.w.notes.account.personalFolder();
  f.files
    .get(folder.id)
    .permissions.push({ role: "reader", emailAddress: "bob@example.test" });
  await assert.rejects(
    f.w.notes.create(f.player(), { title: "Private", body: "Secret" }),
    /folder is shared/,
  );
  assert.ok(
    ![...f.files.values()].some(
      (row) => row.data?.format === "evony-consilium-note",
    ),
  );
});
test("wrong-player attachments and personal team-cache records are rejected", async () => {
  const f = fixture(),
    id = await f.w.notes.create(f.player(), {
      title: "Private",
      body: "Secret",
    });
  await assert.rejects(
    f.w.notes.connect(f.local().keeps[1], { id }),
    /different player/,
  );
  const item = {
    id,
    playerId: f.player().id,
    resourceKey: "",
    noteCache: {
      note: f.files.get(id).data.note,
      version: "1",
      syncedAt: new Date().toISOString(),
    },
  };
  assert.throws(() => validateTeamNotes([item]), /Only team notes/);
});
test("alt reassignment preserves identity while roster removal detaches caches without deleting files", async () => {
  const f = fixture();
  const id = await f.w.notes.create(
    f.player(),
    { title: "Team", body: "Alt history" },
    "team",
  );
  const subject = noteSubject(f.player(), "team");
  const reassigned = assignPlayerOwner(
    f.local(),
    f.player().id,
    f.local().keeps[1].id,
  );
  assert.equal(noteSubject(reassigned.keeps[0], "team"), subject);
  const removed = removePlayer(reassigned, f.player().id);
  assert.equal(removed.teamNotes.length, 0);
  assert.ok(f.files.has(id));
});
test("late cache refreshes cannot resurrect detached notes or removed roster entries", async () => {
  const f = fixture(),
    id = await f.w.notes.create(
      f.player(),
      { title: "Team", body: "Old" },
      "team",
    );
  const base = copy(f.local()),
    update = copy(base.teamNotes[0]);
  update.noteCache.version = "2";
  update.noteCache.note.body = "New";
  const detached = { ...copy(base), teamNotes: [] };
  assert.equal(applyNoteCaches(detached, [update]).teamNotes.length, 0);
  const refreshed = applyNoteCaches(base, [update]);
  assert.equal(
    mergeTeamPlans(base, detached, refreshed).plan.teamNotes.length,
    0,
  );
  await f.w.notes.detach(f.player(), id, true);
  await f.w.notes.refresh();
  assert.equal(f.remote().teamNotes.length, 0);
  assert.ok(f.files.has(id));
});
test("account index updates reload the latest index before adding an attachment", async () => {
  const f = fixture(),
    a = new AccountNotes(f.drive),
    b = new AccountNotes(f.drive);
  await a.load();
  await b.load();
  await a.remember({ id: "first" }, "player:profile");
  await a.remember({ id: "second" }, "player:profile");
  await b.remember({ id: "third" }, "player:profile");
  assert.deepEqual(
    b.index.links.map((row) => row.id),
    ["first", "second", "third"],
  );
  assert.equal((await f.drive.noteIndexes()).length, 1);
  const row = f.files.get(b.file.id);
  assert.deepEqual(row.file.parents, [b.index.folder.id]);
});

test("opening notes does not provision storage, and concurrent folder requests create one folder", async () => {
  const f = fixture(),
    account = new AccountNotes(f.drive);
  await account.load();
  assert.equal(f.files.size, 2);
  const [a, b] = await Promise.all([
    account.personalFolder(),
    account.personalFolder(),
  ]);
  assert.equal(a.id, b.id);
  assert.equal(f.files.size, 4);
  assert.deepEqual(f.files.get(account.file.id).file.parents, [a.id]);
});

test("attachment-only users store their own index in a personal folder", async () => {
  const f = fixture(),
    account = new AccountNotes(f.drive);
  await account.remember({ id: "shared-note" }, "player:profile");
  assert.deepEqual(
    account.index.links.map((row) => row.id),
    ["shared-note"],
  );
  assert.deepEqual(f.files.get(account.file.id).file.parents, [
    account.index.folder.id,
  ]);
  assert.notEqual(account.index.folder.id, "central");
});

test("an index is not created in a folder whose sharing cannot be verified as private", async () => {
  for (const access of [
    { permissions: [{ role: "owner" }, { role: "reader" }] },
    { permissions: [{ role: "owner" }], nextPageToken: "more" },
  ]) {
    const f = fixture(),
      account = new AccountNotes(f.drive);
    f.drive.notePermissions = async () => access;
    await assert.rejects(
      account.remember({ id: "private-link" }, "player:profile"),
      /folder is shared/,
    );
    assert.equal((await f.drive.noteIndexes()).length, 0);
  }
});

test("Drive note names distinguish matching titles by team, player, and note identity", () => {
  const base = {
    id: "01234567-note-one",
    title: "Growth",
    context: { teamName: "Avalon", playerName: "Ice" },
  };
  const filename = noteFilename(base);
  assert.equal(
    filename,
    "Note - Avalon - Ice - Growth [01234567].note.consilium.json",
  );
  for (const variant of [
    { ...base, context: { ...base.context, teamName: "Another team" } },
    { ...base, context: { ...base.context, playerName: "Another player" } },
    { ...base, id: "89abcdef-note-two" },
  ])
    assert.notEqual(noteFilename(variant), filename);
  assert.equal(
    noteFilename({ ...base, title: " " }).includes("Untitled"),
    true,
  );
  assert.doesNotMatch(
    noteFilename({
      ...base,
      title: "Folder/Name\\Title\n",
      context: { teamName: "Team/Name", playerName: "Player\\Name" },
    }),
    /[/\\\n]/,
  );
});
test("note documents validate free-form text and omit unknown fields from cacheable data", async () => {
  const f = fixture(),
    id = await f.w.notes.create(f.player(), {
      title: "",
      body: "Paragraph\n\n• Item\n<script>literal text</script>",
    });
  const document = copy(f.files.get(id).data);
  document.note.privateExtra = "Must not propagate";
  assert.equal(readNoteDocument(document).privateExtra, undefined);
  document.note.body = "x".repeat(50001);
  assert.throws(() => readNoteDocument(document), /note text/);
});
