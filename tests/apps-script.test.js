import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createContext, runInContext } from "node:vm";
import { syncTeam, validateConfig } from "../apps-script/sync.js";
import { ScriptDrive } from "../apps-script/drive.js";
import { createRuntime } from "../apps-script/runtime.js";
import {
  appsScriptBundle,
  buildAppsScript,
} from "../scripts/build-apps-script.js";
import { linkedPlayer } from "../web/src/domain/player-document.js";
import { validatePlan } from "../web/src/domain/validation.js";
import { createDemoPlan } from "../web/src/domain/plan.js";
import {
  mergeTeamPlans,
  teamFingerprint,
} from "../web/src/domain/team-collaboration.js";
import { catalog } from "./fixtures/catalog.js";

const stamp = "2026-10-10T12:00:00.000Z";
const config = {
  teamFileId: "team",
  folderId: "folder",
  teamResourceKey: "team-key",
  folderResourceKey: "folder-key",
};
function fixture() {
  const plan = validatePlan(createDemoPlan(catalog), catalog);
  plan.keeps = plan.keeps.slice(0, 2);
  plan.keeps[0].id = "main";
  plan.keeps[1].id = "alt";
  for (const player of plan.keeps) {
    player.x = player.y = null;
    Object.assign(
      player,
      linkedPlayer(player, player, {
        id: `profile-${player.id}`,
        version: "1",
        resourceKey: "source-key",
      }),
    );
    player.playerSource.activityVersion = "1";
  }
  plan.keeps[1].ownerId = "main";
  plan.rallyId = "main";
  plan.maps = [];
  plan.activeMapId = null;
  const note = {
    id: "note-identity",
    subject: "player:profile-alt",
    title: "Alt growth",
    body: "Saved team note",
    scope: "team",
    teamFileId: "team",
    author: "alice@example.test",
    createdAt: stamp,
    updatedAt: stamp,
  };
  plan.teamNotes = [
    {
      id: "note-file",
      playerId: "alt",
      resourceKey: "note-key",
      noteCache: { note: structuredClone(note), version: "1", syncedAt: stamp },
    },
  ];
  const files = new Map();
  const add = (id, document, version = "2", parents = ["folder"]) =>
    files.set(id, {
      file: {
        id,
        version,
        parents,
        etag: `"${id}-${version}"`,
        resourceKey: `${id}-key`,
        capabilities: { canEdit: true },
      },
      document,
    });
  add(
    "team",
    {
      format: "evony-consilium-team",
      schema: 1,
      plan,
      extension: { preserved: true },
    },
    "1",
  );
  for (const player of plan.keeps)
    add(player.playerSource.fileId, {
      format: "evony-consilium-player",
      schema: 1,
      profile: {
        ...structuredClone(player.playerSource.baseline),
        name: `Updated ${player.id}`,
      },
    });
  add("note-file", {
    format: "evony-consilium-note",
    schema: 1,
    note: { ...note, body: "Updated alt note" },
  });
  add(
    "private-note",
    {
      format: "evony-consilium-note",
      schema: 1,
      note: {
        ...note,
        scope: "personal",
        teamFileId: undefined,
        body: "Private content",
      },
    },
    "2",
    ["personal-folder"],
  );
  add("unpublished-note", {
    format: "evony-consilium-note",
    schema: 1,
    note: { ...note, id: "unpublished", body: "Not reviewed" },
  });
  const loads = [],
    writes = [];
  const drive = {
    metadata: () => ({
      id: "folder",
      mimeType: "application/vnd.google-apps.folder",
    }),
    children: () => [...files.values()].map((row) => structuredClone(row.file)),
    load: (resource) => {
      loads.push(resource.id);
      const row = files.get(resource.id);
      if (!row) throw Object.assign(new Error("Missing"), { status: 404 });
      return structuredClone(row);
    },
    save: (file, document) => {
      assert.equal(file.version, files.get("team").file.version);
      writes.push(structuredClone(document));
      files.get("team").document = structuredClone(document);
      files.get("team").file.version = String(BigInt(file.version) + 1n);
    },
  };
  return {
    drive,
    files,
    loads,
    writes,
    plan,
    run: (options = {}) =>
      syncTeam({ drive, config, now: () => Date.parse(stamp), ...options }),
  };
}

test("unattended sync refreshes regular players, alts, and published notes without changing team edits", () => {
  const f = fixture(),
    before = structuredClone(f.plan);
  const report = f.run();
  assert.equal(report.players, 2);
  assert.equal(report.notes, 1);
  assert.equal(report.written, true);
  assert.equal(f.writes.length, 1);
  const saved = f.writes[0];
  validatePlan(saved.plan, catalog);
  assert.equal(saved.plan.keeps[0].name, "Updated main");
  assert.equal(saved.plan.keeps[1].ownerId, "main");
  assert.equal(saved.plan.keeps[0].playerSource.baseline.name, "Updated main");
  assert.equal(saved.plan.keeps[0].playerSource.syncedAt, stamp);
  assert.equal(saved.plan.teamNotes[0].noteCache.note.body, "Updated alt note");
  assert.deepEqual(saved.extension, { preserved: true });
  assert.equal(teamFingerprint(before), teamFingerprint(saved.plan));
  assert.deepEqual(f.loads, [
    "team",
    "profile-main",
    "profile-alt",
    "note-file",
  ]);
  assert.doesNotMatch(
    JSON.stringify(saved),
    /Private content|Not reviewed|private-note|unpublished-note/,
  );
  assert.equal(f.run().written, false);
  assert.equal(f.writes.length, 1);
  // Existing browser merge semantics accept the script's caches alongside a draft.
  const draft = structuredClone(before);
  draft.title = "Unfinished formation";
  const merged = mergeTeamPlans(before, draft, saved.plan);
  assert.deepEqual(merged.conflicts, []);
  assert.equal(merged.plan.title, draft.title);
  assert.equal(merged.plan.keeps[1].name, "Updated alt");
});

test("unchanged revisions need no source downloads, timestamps, or uploads", () => {
  const f = fixture();
  for (const row of f.files.values()) row.file.version = "1";
  const report = f.run();
  assert.equal(report.inspected, 3);
  assert.equal(report.written, false);
  assert.deepEqual(f.loads, ["team"]);
  assert.deepEqual(f.writes, []);
});

test("unattended sync mirrors player history and backfills an already-current cache", () => {
  const f = fixture();
  const entry = {
    id: "audit-main",
    sessionId: "session-main",
    revision: 1,
    at: stamp,
    account: "member@example.test",
    changes: ["Updated profile details"],
  };
  const source = f.files.get("profile-main");
  source.document.activityLog = [entry];
  f.plan.keeps[0].playerSource.version = source.file.version;
  delete f.plan.keeps[0].playerSource.activityVersion;
  const report = f.run();
  assert.equal(report.activity, 1);
  assert.equal(report.written, true);
  const saved = f.writes[0].plan;
  assert.equal(saved.activityLog[0].account, "member@example.test");
  assert.equal(saved.activityLog[0].source.fileId, "profile-main");
  assert.equal(saved.activityLog[0].source.version, source.file.version);
  assert.equal(
    saved.keeps[0].playerSource.activityVersion,
    source.file.version,
  );
  assert.equal(f.run().written, false);
});

test("dry runs inspect changed sources but never publish them", () => {
  const f = fixture();
  const report = f.run({ dryRun: true });
  assert.equal(report.players, 2);
  assert.equal(report.notes, 1);
  assert.equal(report.written, false);
  assert.deepEqual(f.writes, []);
});

test("concurrent roster removal, source relinking, and note detachment win over collected caches", () => {
  const f = fixture(),
    save = f.drive.save;
  let calls = 0;
  f.drive.save = (file, document) => {
    if (!calls++) {
      const latest = f.files.get("team");
      latest.document.plan.keeps = latest.document.plan.keeps.filter(
        (row) => row.id !== "alt",
      );
      latest.document.plan.keeps[0].playerSource.fileId = "replacement-profile";
      latest.document.plan.teamNotes = [];
      latest.document.plan.title = "Teammate's new title";
      latest.file.version = "2";
      throw Object.assign(new Error("Precondition failed"), { status: 412 });
    }
    save(file, document);
  };
  assert.equal(f.run().written, false);
  assert.deepEqual(f.writes, []);
  assert.equal(f.files.get("team").document.plan.title, "Teammate's new title");
});

test("conditional-save retries preserve a teammate's maps, placements, roster, and newer caches", () => {
  const f = fixture(),
    save = f.drive.save;
  let calls = 0;
  f.drive.save = (file, document) => {
    if (!calls++) {
      const latest = f.files.get("team");
      latest.document.plan.title = "Concurrent title";
      latest.document.plan.keeps[0].x = 20;
      latest.document.plan.keeps[0].y = 25;
      latest.document.plan.keeps[0] = linkedPlayer(
        latest.document.plan.keeps[0],
        { ...latest.document.plan.keeps[0], name: "Newest main" },
        { id: "profile-main", version: "9" },
      );
      latest.document.plan.maps = [
        { id: "concurrent-map", extension: "preserve" },
      ];
      latest.file.version = "2";
      throw Object.assign(new Error("Changed"), { status: 409 });
    }
    save(file, document);
  };
  assert.equal(f.run().written, true);
  const saved = f.writes[0].plan;
  assert.equal(saved.title, "Concurrent title");
  assert.equal(saved.keeps[0].name, "Newest main");
  assert.equal(saved.keeps[0].x, 20);
  assert.equal(saved.keeps[0].y, 25);
  assert.equal(saved.keeps[1].name, "Updated alt");
  assert.deepEqual(saved.maps, [
    { id: "concurrent-map", extension: "preserve" },
  ]);
});

test("moved, revoked, malformed, and private sources retain caches without blocking healthy sources", () => {
  for (const change of [
    (f) => {
      f.files.get("note-file").file.parents = ["personal-folder"];
    },
    (f) => {
      f.files.get("note-file").file.trashed = true;
    },
    (f) => {
      const load = f.drive.load;
      f.drive.load = (resource) => {
        if (resource.id === "note-file")
          throw Object.assign(new Error("Forbidden"), { status: 403 });
        return load(resource);
      };
    },
    (f) => {
      const note = f.files.get("note-file").document.note;
      note.scope = "personal";
      delete note.teamFileId;
      note.body = "Do not publish";
    },
    (f) => {
      f.files.get("note-file").document.note.subject = "player:other-player";
    },
    (f) => {
      f.files.get("note-file").document.note.teamFileId = "other-team";
    },
    (f) => {
      f.files.get("note-file").document.note.id = "replacement-note";
    },
    (f) => {
      f.files.get("note-file").document.schema = 2;
    },
  ]) {
    const f = fixture();
    change(f);
    const report = f.run();
    assert.equal(report.players, 2);
    assert.equal(report.notes, 0);
    assert.equal(report.warnings.length, 1);
    assert.equal(
      f.writes[0].plan.teamNotes[0].noteCache.note.body,
      "Saved team note",
    );
    assert.doesNotMatch(JSON.stringify(f.writes), /Do not publish/);
    assert.doesNotMatch(
      JSON.stringify(report),
      /Do not publish|Saved team note/,
    );
  }
});

test("source moves during download and invalid profiles cannot enter the shared cache", () => {
  const f = fixture(),
    load = f.drive.load;
  f.drive.load = (resource) => {
    const current = load(resource);
    if (resource.id === "profile-main") current.document.profile.level = 500;
    if (resource.id === "note-file") current.file.parents = ["elsewhere"];
    return current;
  };
  const report = f.run();
  assert.equal(report.players, 1);
  assert.equal(report.notes, 0);
  assert.equal(report.warnings.length, 2);
  assert.equal(f.writes[0].plan.keeps[0].name, f.plan.keeps[0].name);
});

test("bounded passes rotate across players and notes instead of starving later sources", () => {
  const f = fixture();
  let cursor = 0;
  for (let i = 0; i < 3; i++) {
    const report = f.run({
      config: { ...config, maxSourcesPerRun: 1 },
      cursor,
    });
    assert.equal(report.inspected, 1);
    assert.equal(report.deferred, true);
    cursor = report.nextCursor;
  }
  assert.equal(cursor, 0);
  assert.equal(
    f.files.get("team").document.plan.teamNotes[0].noteCache.version,
    "2",
  );
  const g = fixture();
  let time = 0;
  const load = g.drive.load;
  g.drive.load = (resource) => {
    const result = load(resource);
    if (resource.id !== "team") time = 100;
    return result;
  };
  const report = g.run({ now: () => time, deadline: 50 });
  assert.equal(report.written, false);
  assert.equal(report.nextCursor, 0);
  assert.equal(report.deferred, true);
  assert.deepEqual(g.writes, []);
});

test("slow teams publish a partial batch within the reserved save window", () => {
  const f = fixture(),
    load = f.drive.load;
  let time = 0;
  f.drive.load = (resource) => {
    const result = load(resource);
    if (resource.id !== "team") time += 40;
    return result;
  };
  const report = f.run({ now: () => time, deadline: 100 });
  assert.equal(report.inspected, 2);
  assert.equal(report.players, 2);
  assert.equal(report.notes, 0);
  assert.equal(report.written, true);
  assert.equal(report.deferred, true);
  assert.equal(report.nextCursor, 2);
  assert.equal(f.run({ cursor: report.nextCursor }).notes, 1);
});

test("authorization, throttling, and server failures abort with bounded retries", () => {
  for (const error of [
    { status: 401 },
    { status: 429 },
    { status: 503 },
    { status: 403, reason: "userRateLimitExceeded" },
  ]) {
    const f = fixture(),
      load = f.drive.load;
    f.drive.load = (resource) => {
      if (resource.id === "profile-main")
        throw Object.assign(new Error("Paused"), error);
      return load(resource);
    };
    assert.throws(() => f.run(), /Paused/);
    assert.deepEqual(f.writes, []);
  }
  const f = fixture();
  let saves = 0;
  f.drive.save = () => {
    saves++;
    throw Object.assign(new Error("Contended"), { status: 412 });
  };
  assert.throws(() => f.run(), /Contended/);
  assert.equal(saves, 3);
});

test("configuration and team folder boundaries fail before any upload", () => {
  for (const change of [
    { folderId: "team" },
    { teamFileId: "bad/id" },
    { intervalMinutes: 2 },
    { maxSourcesPerRun: 0 },
    { teamResourceKey: "bad\r\nkey" },
  ])
    assert.throws(() => validateConfig({ ...config, ...change }));
  for (const change of [
    (f) => {
      f.files.get("team").file.capabilities.canEdit = false;
    },
    (f) => {
      f.files.get("team").file.parents = ["other-folder"];
    },
    (f) => {
      f.files.get("team").document.schema = 2;
    },
    (f) => {
      f.files.get("team").file.version = "not-a-revision";
    },
  ]) {
    const f = fixture();
    change(f);
    assert.throws(() => f.run());
    assert.deepEqual(f.writes, []);
  }
});

function transport(f) {
  const calls = [];
  const fetch = (url, options) => {
    calls.push({ url, options });
    const parsed = new URL(url),
      id = parsed.pathname.split("/").at(-1);
    const response = (value, status = 200) => ({
      getResponseCode: () => status,
      getContentText: () => JSON.stringify(value),
    });
    if (id === "folder")
      return response({ id, mimeType: "application/vnd.google-apps.folder" });
    if (id === "files")
      return response({ files: [...f.files.values()].map((row) => row.file) });
    const row = f.files.get(id);
    if (!row) return response({ error: { message: "Missing" } }, 404);
    if (options.method === "put") {
      if (options.headers["If-Match"] !== row.file.etag)
        return response({ error: { message: "Race" } }, 412);
      const blocks = options.payload
        .split("\r\n")
        .filter((line) => line.startsWith("{"))
        .map(JSON.parse);
      row.document = blocks[1];
      row.file.version = String(BigInt(row.file.version) + 1n);
      row.file.etag = `"${id}-${row.file.version}"`;
      f.writes.push(structuredClone(row.document));
      return response({ id, version: row.file.version });
    }
    if (parsed.searchParams.get("alt") === "media")
      return response(row.document);
    if (parsed.pathname.includes("/v2/"))
      return response({
        ...row.file,
        title: row.file.name,
        parents: row.file.parents.map((id) => ({ id })),
      });
    return response(row.file);
  };
  return { fetch, calls };
}

test("Apps Script transport pairs stable content/revisions and refuses weak or absent write preconditions", () => {
  const f = fixture(),
    t = transport(f),
    drive = new ScriptDrive({
      fetch: t.fetch,
      token: () => "token",
      uuid: () => "boundary",
    });
  const loaded = drive.load({ id: "team", resourceKey: "team-key" });
  drive.save(loaded.file, loaded.document);
  const upload = t.calls.find((call) => call.options.method === "put");
  assert.equal(upload.options.headers["If-Match"], '"team-1"');
  assert.equal(upload.options.headers.Authorization, "Bearer token");
  assert.equal(upload.options.followRedirects, false);
  assert.equal(
    upload.options.headers["X-Goog-Drive-Resource-Keys"],
    "team/team-key",
  );
  assert.match(upload.url, /upload\/drive\/v2/);
  for (const etag of [undefined, 'W/"weak"', "guess", '"bad\r\nheader"']) {
    const g = fixture(),
      tr = transport(g);
    g.files.get("team").file.etag = etag;
    const d = new ScriptDrive({
      fetch: tr.fetch,
      token: () => "token",
      uuid: () => "boundary",
    });
    assert.throws(
      () => d.save(g.files.get("team").file, g.files.get("team").document),
      /strong ETag/,
    );
    assert.equal(
      tr.calls.some((call) => call.options.method === "put"),
      false,
    );
  }
});

test("folder pagination includes Shared drives and rejects incomplete listings", () => {
  const calls = [];
  const drive = new ScriptDrive({
    token: () => "token",
    uuid: () => "uuid",
    fetch: (url, options) => {
      calls.push({ url, options });
      return {
        getResponseCode: () => 200,
        getContentText: () =>
          JSON.stringify({
            files: [{ id: String(calls.length) }],
            ...(calls.length === 1 ? { nextPageToken: "page two" } : {}),
          }),
      };
    },
  });
  assert.deepEqual(
    drive
      .children({ id: "folder", resourceKey: "folder-key" })
      .map((file) => file.id),
    ["1", "2"],
  );
  const url = new URL(calls[1].url);
  assert.equal(url.searchParams.get("pageToken"), "page two");
  assert.equal(url.searchParams.get("includeItemsFromAllDrives"), "true");
  assert.equal(
    calls[0].options.headers["X-Goog-Drive-Resource-Keys"],
    "folder/folder-key",
  );
  drive.fetch = () => ({
    getResponseCode: () => 200,
    getContentText: () => '{"files":[],"incompleteSearch":true}',
  });
  assert.throws(() => drive.children({ id: "folder" }), /completely list/);
});

test("unstable source reads retry the entire content and metadata pair", () => {
  let reads = 0,
    downloads = 0;
  const drive = new ScriptDrive({
    token: () => "token",
    uuid: () => "uuid",
    fetch: (url) => ({
      getResponseCode: () => 200,
      getContentText: () =>
        JSON.stringify(
          url.includes("alt=media")
            ? { snapshot: ++downloads === 1 ? "settling" : "stable" }
            : {
                id: "source",
                version: ++reads === 1 ? "1" : "2",
                etag: `"${reads === 1 ? "1" : "2"}"`,
                parents: [{ id: "folder" }],
              },
        ),
    }),
  });
  const loaded = drive.load({ id: "source", resourceKey: "source-key" });
  assert.equal(downloads, 2);
  assert.equal(loaded.document.snapshot, "stable");
  assert.equal(loaded.file.version, "2");
  assert.equal(loaded.file.resourceKey, "source-key");
  assert.deepEqual(loaded.file.parents, ["folder"]);
  drive.fetch = () => ({
    getResponseCode: () => 200,
    getContentText: () =>
      JSON.stringify({
        id: "source",
        version: String(++reads),
        etag: `"${reads}"`,
      }),
  });
  assert.throws(() => drive.load({ id: "source" }), { status: 409 });
});

test("transport failures never echo malformed document text, tokens, or Google response bodies", () => {
  const drive = new ScriptDrive({
    token: () => "secret-token",
    uuid: () => "uuid",
    fetch: () => ({
      getResponseCode: () => 200,
      getContentText: () => "Private note text that is invalid JSON",
    }),
  });
  assert.throws(() => drive.metadata({ id: "source" }), {
    message: "Google Drive returned invalid JSON.",
  });
  drive.fetch = () => ({
    getResponseCode: () => 403,
    getContentText: () =>
      JSON.stringify({
        error: {
          message: "Private content secret-token",
          errors: [{ reason: "insufficientFilePermissions" }],
        },
      }),
  });
  assert.throws(() => drive.metadata({ id: "source" }), {
    message: "Google Drive request failed (403).",
    reason: "insufficientFilePermissions",
  });
  drive.fetch = () => {
    throw new Error("Fetch failed with payload secret-token Private content");
  };
  assert.throws(
    () => drive.metadata({ id: "source" }),
    (error) =>
      error.status === 503 &&
      !/secret-token|Private content/.test(error.message),
  );
});

function environment() {
  const f = fixture(),
    t = transport(f),
    state = new Map(),
    scheduled = [],
    logs = [];
  let locked = false,
    unavailable = false,
    clock = Date.parse(stamp);
  const properties = {
    getProperty: (key) => state.get(key) || null,
    setProperty: (key, value) => state.set(key, value),
    deleteProperty: (key) => state.delete(key),
  };
  const lock = {
    tryLock: () => {
      if (locked || unavailable) return false;
      locked = true;
      return true;
    },
    releaseLock: () => {
      locked = false;
    },
  };
  const triggers = {
    list: () => [...scheduled],
    remove: (trigger) => scheduled.splice(scheduled.indexOf(trigger), 1),
    create: (handler, minutes) => {
      scheduled.push({ getHandlerFunction: () => handler, minutes });
    },
  };
  const services = {
    properties,
    lock,
    triggers,
    fetch: t.fetch,
    token: () => "token",
    uuid: () => "uuid",
    now: () => clock,
    log: (value) => logs.push(value),
  };
  return {
    ...f,
    ...t,
    properties,
    lock,
    triggers,
    state,
    scheduled,
    logs,
    services,
    runtime: createRuntime(services),
    locked: () => locked,
    block: () => {
      unavailable = true;
    },
    nextDay: () => {
      clock += 86400000;
    },
  };
}

test("installation, configuration, preview, status, and removal manage only the owner's sync trigger", () => {
  const f = environment();
  assert.throws(() => f.runtime.install(), /configure/);
  f.triggers.create("unrelatedJob", 30);
  f.runtime.configure(config);
  assert.equal(f.writes.length, 0);
  f.runtime.install();
  f.runtime.install();
  assert.deepEqual(
    f.scheduled.map((trigger) => trigger.getHandlerFunction()),
    ["unrelatedJob", "syncConsiliumTeam"],
  );
  f.runtime.run(true);
  assert.equal(f.writes.length, 0);
  const report = f.runtime.run();
  assert.equal(report.written, true);
  assert.equal(f.runtime.status().installed, true);
  assert.equal(f.runtime.status().lastRun.state, "ok");
  assert.ok(f.runtime.status().usage.calls > 0);
  f.runtime.configure({ ...config, intervalMinutes: 15 });
  assert.equal(f.runtime.status().installed, false);
  f.runtime.install();
  f.runtime.uninstall();
  assert.deepEqual(
    f.scheduled.map((trigger) => trigger.getHandlerFunction()),
    ["unrelatedJob"],
  );
  assert.equal(f.locked(), false);
  assert.doesNotMatch(
    JSON.stringify(f.logs),
    /Updated alt note|Updated main|Bearer|token/,
  );
});

test("script locks and daily budgets skip work and resume after 24 hours", () => {
  const f = environment();
  f.runtime.configure(config);
  f.state.set(
    "CONSILIUM_DAILY_USAGE",
    JSON.stringify({
      windowStartedAt: Date.parse(stamp),
      calls: 15000,
      milliseconds: 1000,
    }),
  );
  const requests = f.calls.length;
  assert.equal(f.runtime.run().state, "quota-paused");
  assert.equal(f.calls.length, requests);
  f.nextDay();
  assert.equal(f.runtime.run().written, true);
  f.block();
  assert.match(f.runtime.run().skipped, /Another sync/);
  assert.equal(f.locked(), false);
});

test("the generated bundle runs in Apps Script's globals without browser, Node, or structuredClone APIs", async () => {
  const f = environment();
  const context = createContext({
    console: { log: f.services.log },
    consiliumConfig_: () => config,
    PropertiesService: { getScriptProperties: () => f.properties },
    LockService: { getScriptLock: () => f.lock },
    UrlFetchApp: { fetch: f.fetch },
    Utilities: { getUuid: () => "uuid" },
    ScriptApp: {
      getOAuthToken: () => "token",
      getProjectTriggers: f.triggers.list,
      deleteTrigger: f.triggers.remove,
      newTrigger: (handler) => ({
        timeBased() {
          return this;
        },
        everyMinutes(minutes) {
          this.minutes = minutes;
          return this;
        },
        create() {
          f.triggers.create(handler, this.minutes);
        },
      }),
    },
  });
  runInContext(await appsScriptBundle(), context);
  runInContext("setupConsiliumSync(); syncConsiliumTeam();", context);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].plan.keeps[1].name, "Updated alt");
  assert.equal(
    f.writes[0].plan.teamNotes[0].noteCache.note.body,
    "Updated alt note",
  );
  runInContext("uninstallConsiliumSync()", context);
  assert.equal(f.scheduled.length, 0);
});

test("rebuilding deployable files preserves local configuration and includes explicit permission scopes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "consilium-script-"));
  try {
    await buildAppsScript(dir);
    await writeFile(join(dir, "Config.gs"), "// My team's configuration\n");
    await buildAppsScript(dir);
    assert.equal(
      await readFile(join(dir, "Config.gs"), "utf8"),
      "// My team's configuration\n",
    );
    const manifest = JSON.parse(
      await readFile(join(dir, "appsscript.json"), "utf8"),
    );
    assert.equal(manifest.runtimeVersion, "V8");
    assert.deepEqual(manifest.dependencies.enabledAdvancedServices, [
      { userSymbol: "Drive", serviceId: "drive", version: "v3" },
    ]);
    assert.deepEqual(manifest.oauthScopes, [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/script.external_request",
      "https://www.googleapis.com/auth/script.scriptapp",
    ]);
    assert.doesNotMatch(
      await readFile(join(dir, "Code.gs"), "utf8"),
      /^import |^export /m,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
