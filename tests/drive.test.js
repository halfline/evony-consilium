import { parseDriveLink } from "../web/src/domain/drive-links.js";
import {
  rememberProject,
  rememberedProjects,
} from "../web/src/persistence/remembered-projects.js";
import { test } from "node:test";
import assert from "node:assert/strict";
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
