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

