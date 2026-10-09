import { parseDriveLink } from "../web/src/domain/drive-links.js";
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
    ["team.consilium.json"],
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
test("expired sessions never send a request", async () => {
  const drive = new Drive(
    () => "",
    () => {
      throw new Error("should not fetch");
    },
  );
  await assert.rejects(drive.metadata({ id: "f" }), (e) => e.status === 401);
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
  assert.equal(created[0].name, "team.consilium.json");
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

test("saving writes the team document to its existing file", async () => {
  let upload;
  const drive = new Drive(
    () => "token",
    async (url, options) => {
      if (options.method === "PATCH")
        upload = { url, data: JSON.parse(options.body) };
      return json({
        id: "team",
        version: "1",
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

