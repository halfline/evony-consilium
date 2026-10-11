import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { linkProject, scriptId } from "../scripts/upload-apps-script.js";

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "consilium-upload-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const projectPath = join(directory, ".clasp.json");
  await linkProject("script-project", { projectPath });
  return { directory, projectPath, stagingParent: directory };
}

test("script linking accepts IDs and Google editor URLs, rejecting other targets", () => {
  for (const value of [
    "script-project",
    " https://script.google.com/home/projects/script-project/edit ",
    "https://script.google.com/u/1/home/projects/script-project/edit",
    "https://script.google.com/d/script-project/edit?usp=sharing",
  ]) {
    assert.equal(scriptId(value), "script-project");
  }
  for (const value of [
    undefined,
    "",
    "../another-file",
    "https://drive.google.com/file/d/team-id/view",
    "https://script.google.com.evil.example/d/script-project/edit",
    "http://script.google.com/d/script-project/edit",
    "https://script.google.com/home",
  ]) {
    assert.throws(() => scriptId(value));
  }
});

test("linking is local and requires an explicit replacement to switch projects", async (t) => {
  const { projectPath } = await fixture(t);
  await linkProject("script-project", { projectPath });
  await assert.rejects(
    linkProject("another-script", { projectPath }),
    /--replace/,
  );
  assert.equal(
    JSON.parse(await readFile(projectPath)).scriptId,
    "script-project",
  );
  await linkProject("another-script", { projectPath, replace: true });
  assert.equal(
    JSON.parse(await readFile(projectPath)).scriptId,
    "another-script",
  );
});
