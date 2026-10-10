import {
  parseDriveLink,
  parseTeamLink,
} from "../web/src/domain/drive-links.js";
import {
  rememberProject,
  rememberedProjects,
} from "../web/src/persistence/remembered-projects.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Drive } from "../web/src/services/google/drive.js";
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
test("copied Consilium team links can be pasted into Open team, preserving the file key", () => {
  assert.deepEqual(
    parseTeamLink(
      "https://example.test/consilium/index.html#team=team_123&resourceKey=key&screen=project",
      "https://example.test/consilium/",
    ),
    { id: "team_123", resourceKey: "key", kind: "file" },
  );
  assert.throws(() =>
    parseTeamLink(
      "https://elsewhere.test/consilium/#team=team_123",
      "https://example.test/consilium/",
    ),
  );
  assert.throws(() =>
    parseTeamLink(
      "https://example.test/another-app/#team=team_123",
      "https://example.test/consilium/",
    ),
  );
});
test("Drive folder links reject unrelated hosts and preserve resource keys", () => {
  assert.deepEqual(
    parseDriveLink(
      "https://drive.google.com/drive/u/0/folders/team_123?resourcekey=key",
    ),
    { id: "team_123", resourceKey: "key" },
  );
  assert.throws(() =>
    parseDriveLink("https://drive.google.com.evil.test/drive/folders/team"),
  );
  assert.throws(() => parseDriveLink("javascript:alert(1)"));
});
test("remembered folders stay account scoped and deduplicate", () => {
  const items = new Map();
  const storage = {
    getItem: (k) => items.get(k),
    setItem: (k, v) => items.set(k, v),
  };
  rememberProject(storage, "alice", { id: "team", name: "Alliance" });
  rememberProject(storage, "alice", { id: "team", name: "Alliance updated" });
  assert.equal(rememberedProjects(storage, "alice").length, 1);
  assert.equal(
    rememberedProjects(storage, "alice")[0].name,
    "Alliance updated",
  );
  assert.deepEqual(rememberedProjects(storage, "bob"), []);
});
test("Drive save refuses stale versions and view-only access without uploading", async () => {
  const calls = [];
  let meta = { id: "f", version: "2", capabilities: { canEdit: true } };
  const drive = new Drive(
    () => "token",
    async (url, options) => {
      calls.push(options.method);
      return json(meta);
    },
  );
  await assert.rejects(
    drive.save({ id: "f", version: "1" }, {}),
    (e) => e.status === 409,
  );
  meta.capabilities.canEdit = false;
  await assert.rejects(
    drive.save({ id: "f", version: "2" }, {}),
    (e) => e.status === 403,
  );
  assert.deepEqual(calls, ["GET", "GET"]);
});
test("Drive project initializes one complete team document", async () => {
  const uploaded = [];
  const drive = new Drive(
    () => "token",
    async (url, options) => {
      if (options.method === "GET") return json({ files: [] });
      const blocks = options.body.split("\r\n");
      const objects = blocks
        .filter((s) => s.startsWith("{"))
        .map((s) => JSON.parse(s));
      uploaded.push(objects);
      return json({ id: "file" + uploaded.length });
    },
  );
  await drive.initializeProject(
    { id: "folder", name: "Hive", capabilities: { canAddChildren: true } },
    { keeps: [] },
  );
  assert.deepEqual(
    uploaded.map((r) => r[0].name),
    ["Team - Untitled.team.consilium.json"],
  );
  assert.equal(uploaded[0][1].format, "evony-consilium-team");
  assert.deepEqual(uploaded[0][1].plan.keeps, []);
});
test("an existing project is never reinitialized", async () => {
  const drive = new Drive(
    () => "token",
    async () => json({ files: [{ name: "team.consilium.json" }] }),
  );
  await assert.rejects(
    drive.initializeProject({ id: "folder" }, {}),
    /already has/,
  );
});
test("opening a project restricts formation references to its folder", async () => {
  const drive = new Drive(
    () => "token",
    async (url) => {
      if (url.includes("alt=media"))
        return json({
          format: "evony-alliance-project",
          schema: 1,
          formations: [{ id: "outside" }],
          defaultFormationId: "outside",
          playersFileId: "players",
        });
      if (url.includes("/files?"))
        return json({
          files: [
            { id: "manifest", name: "project.json" },
            { id: "players", name: "players.json" },
          ],
        });
      return json({
        id: "folder",
        mimeType: "application/vnd.google-apps.folder",
      });
    },
  );
  await assert.rejects(drive.project({ id: "folder" }), /Choose the team file/);
});
test("expired sessions never send a request", async () => {
  const drive = new Drive(
    () => "",
    () => {
      throw new Error("should not fetch");
    },
  );
  await assert.rejects(drive.metadata({ id: "f" }), (e) => e.status === 401);
});

test("folder-only authorization requests file selection rather than claiming the project is absent", async () => {
  const drive = new Drive(
    () => "token",
    async (url) =>
      url.includes("/files?")
        ? json({ files: [] })
        : json({
            id: "folder",
            mimeType: "application/vnd.google-apps.folder",
          }),
  );
  await assert.rejects(drive.project({ id: "folder" }), /Choose the team file/);
});
test("Picker selections cannot authorize outside-folder references as project files", async () => {
  const drive = new Drive(
    () => "token",
    async (url) =>
      url.includes("/files?")
        ? json({ files: [] })
        : json({
            id: "outside",
            mimeType: "application/vnd.google-apps.folder",
            parents: ["different_folder"],
          }),
  );
  await assert.rejects(
    drive.project({ id: "folder" }, [{ id: "outside" }]),
    /only files directly inside/,
  );
});

test("optional project logos are shared in metadata and remembered with folders", async () => {
  const logo = "data:image/webp;base64,AAAA";
  const drive = new Drive(() => "token");
  drive.children = async () => [];
  const created = [];
  drive.createJSON = async (name, data) => {
    created.push({ name, data });
    return { id: name };
  };
  await drive.initializeProject(
    { id: "team", name: "Alliance", capabilities: { canAddChildren: true } },
    { title: "Alliance" },
    { logo },
  );
  assert.equal(created.length, 1);
  assert.equal(created[0].name, "Team - Alliance.team.consilium.json");
  assert.equal(created[0].data.plan.projectLogo, logo);
  const items = new Map();
  const storage = {
    getItem: (key) => items.get(key),
    setItem: (key, value) => items.set(key, value),
  };
  rememberProject(storage, "alice", { id: "team", name: "Alliance", logo });
  assert.equal(rememberedProjects(storage, "alice")[0].logo, logo);
  rememberProject(storage, "alice", {
    id: "bad",
    name: "Other",
    logo: "https://example.com/image.png",
  });
  assert.equal(rememberedProjects(storage, "alice")[0].logo, undefined);
});

for (const format of ["evony-consilium-team"]) {
  test(`loads ${format} without metadata or player-file grants`, async () => {
    const plan = {
      title: "Team",
      keeps: [{ id: "player", details: { marchSizes: { ground: 8000000 } } }],
      maps: [{ id: "map" }],
    };
    const requests = [];
    const drive = new Drive(
      () => "token",
      async (url) => {
        requests.push(url);
        return json(
          url.includes("alt=media")
            ? { format, schema: 1, plan }
            : {
                id: "data",
                version: "1",
                parents: ["folder"],
                mimeType: "application/json",
              },
        );
      },
    );
    const project = await drive.project({ id: "data", kind: "file" });
    const loaded = await drive.load(project.file);
    assert.deepEqual(loaded.plan, plan);
    assert.equal(project.folder.id, "folder");
    assert.ok(requests.every((url) => url.includes("/files/data?")));
  });
}
test("saving writes the team document to its existing file", async () => {
  let upload;
  const drive = new Drive(
    () => "token",
    async (url, options) => {
      if (options.method === "PUT")
        upload = {
          url,
          headers: options.headers,
          data: JSON.parse(
            options.body
              .split("\r\n")
              .filter((line) => line.startsWith("{"))[1],
          ),
        };
      return json({
        id: "team",
        version: "1",
        etag: '"revision-1"',
        capabilities: { canEdit: true },
      });
    },
  );
  const plan = {
    title: "Preserved",
    keeps: [{ id: "p" }],
    maps: [{ id: "m" }],
  };
  await drive.save({ id: "team", version: "1" }, plan);
  assert.match(upload.url, /files\/team\?/);
  assert.equal(upload.headers["If-Match"], '"revision-1"');
  assert.deepEqual(upload.data, {
    format: "evony-consilium-team",
    schema: 1,
    plan,
  });
});

test("obsolete formation envelopes are rejected", async () => {
  const drive = new Drive(
    () => "token",
    async (url) =>
      json(
        url.includes("alt=media")
          ? {
              format: "evony-formation-project",
              schema: 1,
              plan: { title: "Old" },
            }
          : { id: "old", version: "1" },
      ),
  );
  await assert.rejects(
    drive.load({ id: "old" }),
    /not an Evony Consilium team/,
  );
});

test("opening retries a settling revision and returns the reread content", async () => {
  let metadataReads = 0,
    downloads = 0;
  const drive = new Drive(
    () => "token",
    async (url, options) => {
      assert.equal(options.cache, "no-store");
      if (url.includes("alt=media"))
        return json({
          format: "evony-consilium-team",
          schema: 1,
          plan: { title: ++downloads === 1 ? "First read" : "Stable team" },
        });
      return json({
        id: "team",
        version: String(++metadataReads === 1 ? 1 : 2),
      });
    },
  );
  const loaded = await drive.load({ id: "team" });
  assert.equal(loaded.plan.title, "Stable team");
  assert.equal(loaded.file.version, "2");
  assert.equal(downloads, 2);
});

test("opening refuses continuously changing content after bounded retries", async () => {
  let revision = 0,
    downloads = 0;
  const drive = new Drive(
    () => "token",
    async (url) => {
      if (url.includes("alt=media")) {
        downloads++;
        return json({
          format: "evony-consilium-team",
          schema: 1,
          plan: { title: "Team" },
        });
      }
      return json({ id: "team", version: String(++revision) });
    },
  );
  await assert.rejects(
    drive.load({ id: "team" }),
    (error) => error.status === 409,
  );
  assert.equal(downloads, 3);
});

for (const parents of [undefined, []]) {
  test(`selected link-shared team opens with ${parents === undefined ? "omitted" : "empty"} parent metadata`, async () => {
    const plan = { title: "Shared team", keeps: [], maps: [] };
    const drive = new Drive(
      () => "token",
      async (url) =>
        json(
          url.includes("/files?")
            ? { files: [{ id: "shared-file" }] }
            : url.includes("alt=media")
              ? { format: "evony-consilium-team", schema: 1, plan }
              : {
                  id: "shared-file",
                  name: "team.consilium.json",
                  version: "1",
                  parents,
                },
        ),
    );
    const project = await drive.project({ id: "shared-folder" }, [
      { id: "shared-file", resourceKey: "file-key" },
    ]);
    const loaded = await drive.load(project.file);
    assert.deepEqual(loaded.plan, plan);
    assert.equal(project.folder.id, "shared-folder");
    assert.equal(project.file.resourceKey, "file-key");
  });
}

test("missing parent metadata cannot bypass linked-folder verification", async () => {
  const drive = new Drive(
    () => "token",
    async (url, options) => {
      if (url.includes("/files?")) {
        assert.match(
          new URL(url).searchParams.get("q"),
          /^'linked-folder' in parents/,
        );
        assert.equal(
          options.headers["X-Goog-Drive-Resource-Keys"],
          "linked-folder/folder-key",
        );
        return json({ files: [] });
      }
      return json({ id: "outside", name: "team.consilium.json", version: "1" });
    },
  );
  await assert.rejects(
    drive.project({ id: "linked-folder", resourceKey: "folder-key" }, [
      { id: "outside" },
    ]),
    /Could not verify/,
  );
});

test("player files require central storage and use a distinct document format", async () => {
  const { newPlayer } = await import("../web/src/domain/players.js");
  const { catalog } = await import("./fixtures/catalog.js");
  const player = {
    ...newPlayer(new Map(catalog.assets.map((asset) => [asset.id, asset]))),
    name: "Main account",
  };
  const uploads = [];
  const drive = new Drive(
    () => "token",
    async (_, options) => {
      uploads.push(
        options.body
          .split("\r\n")
          .filter((line) => line.startsWith("{"))
          .map(JSON.parse),
      );
      return json({ id: "player-file", version: "1" });
    },
  );
  assert.throws(() => drive.createPlayer(player), /central team folder/);
  await drive.createPlayer(player, {
    id: "team-folder",
    capabilities: { canAddChildren: true },
  });
  assert.deepEqual(uploads[0][0].parents, ["team-folder"]);
  assert.equal(uploads[0][1].format, "evony-consilium-player");
  assert.equal(Object.hasOwn(uploads[0][1].profile, "x"), false);
});

test("player writes reject permission loss or stale revisions before uploading", async () => {
  let metadata = {
    id: "player-file",
    version: "2",
    capabilities: { canEdit: true },
  };
  const methods = [];
  const drive = new Drive(
    () => "token",
    async (_, options) => {
      methods.push(options.method);
      return json(metadata);
    },
  );
  await assert.rejects(
    drive.savePlayer({ id: metadata.id, version: "1" }, {}),
    (error) => error.status === 409,
  );
  metadata.capabilities.canEdit = false;
  await assert.rejects(
    drive.savePlayer(metadata, {}),
    (error) => error.status === 403,
  );
  assert.deepEqual(methods, ["GET", "GET"]);
});
