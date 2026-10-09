import test from "node:test";
import assert from "node:assert/strict";
import { loadTeamFiles } from "../web/src/services/team-files.js";
import {
  ProjectAccessError,
  DriveError,
} from "../web/src/services/google/drive.js";

function fixture() {
  const folder = {
    id: "team",
    name: "Old",
    resourceKey: "original-key",
    logo: "shortcut-logo",
  };
  const project = { folder: { ...folder }, file: { id: "formation" } };
  const loaded = {
    plan: { title: "Team name", projectLogo: "document-logo" },
    file: { id: "formation", version: "3" },
  };
  const calls = [];
  return {
    folder,
    project,
    loaded,
    calls,
    drive: {
      project: async (...args) => {
        calls.push(["project", ...args]);
        return project;
      },
      load: async (file) => {
        calls.push(["load", file]);
        return loaded;
      },
    },
    picker: {
      folder: async (original) => {
        calls.push(["folder", original]);
        return { id: "team" };
      },
      files: async (original) => {
        calls.push(["files", original]);
        return [{ id: "formation" }];
      },
    },
    authorizeFiles: () => calls.push(["authorize"]),
  };
}

test("team loading uses document metadata without asking for existing grants", async () => {
  const f = fixture();
  const result = await loadTeamFiles(f);
  assert.equal(result.plan.projectLogo, "document-logo");
  assert.equal(result.project.folder.logo, "document-logo");
  assert.equal(result.project.folder.name, "Team name");
  assert.equal(result.file.resourceKey, "");
  assert.equal(result.project.folder.teamFileId, "formation");
  assert.deepEqual(
    f.calls.map((call) => call[0]),
    ["project", "load"],
  );
});

test("an explicitly removed logo and a file resource key survive team loading", async () => {
  const f = fixture();
  f.loaded.plan.projectLogo = "";
  f.loaded.file.resourceKey = "file-key";
  const result = await loadTeamFiles(f);
  assert.equal(result.project.folder.logo, "");
  assert.equal(result.file.resourceKey, "file-key");
});

for (const status of [403, 404]) {
  test(`team loading recovers ${status} with only file authorization`, async () => {
    const f = fixture();
    let attempts = 0;
    f.drive.project = async (folder, files) => {
      f.calls.push(["project", folder, files]);
      if (!attempts++) throw new DriveError("Denied", status);
      assert.equal(folder.resourceKey, "original-key");
      assert.deepEqual(files, [{ id: "formation" }]);
      return f.project;
    };
    await loadTeamFiles(f);
    assert.deepEqual(
      f.calls.map((call) => call[0]),
      ["project", "authorize", "files", "project", "load"],
    );
  });
}

test("missing file grants request files without reauthorizing the folder", async () => {
  const f = fixture();
  let attempts = 0;
  f.drive.project = async () => {
    if (!attempts++) throw new ProjectAccessError();
    return f.project;
  };
  await loadTeamFiles(f);
  assert.deepEqual(
    f.calls.map((call) => call[0]),
    ["authorize", "files", "load"],
  );
});

test("unexpected errors and picker cancellation propagate without loading a document", async () => {
  for (const error of [
    new DriveError("Offline", 503),
    new Error("Cancelled"),
  ]) {
    const f = fixture();
    if (error.status)
      f.drive.project = async () => {
        throw error;
      };
    else {
      f.drive.project = async () => {
        throw new DriveError("Denied", 403);
      };
      f.picker.files = async () => {
        throw error;
      };
    }
    await assert.rejects(loadTeamFiles(f), (e) => e === error);
    assert.equal(
      f.calls.some((call) => call[0] === "load"),
      false,
    );
  }
});
