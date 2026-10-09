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
