import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  linkProject,
  scriptId,
  uploadProject,
  setupConfig,
  setupProject,
} from "../scripts/upload-apps-script.js";

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

test("first-time setup validates Drive links and resumes an interrupted upload", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "consilium-setup-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const options = {
    directory: join(directory, "setup"),
    projectPath: join(directory, ".clasp.json"),
  };
  const team =
    "https://drive.google.com/file/d/team-file/view?resourcekey=team-key";
  const folder =
    "https://drive.google.com/drive/folders/team-folder?resourcekey=folder-key";
  assert.deepEqual(setupConfig(team, folder), {
    teamFileId: "team-file",
    folderId: "team-folder",
    teamResourceKey: "team-key",
    folderResourceKey: "folder-key",
    intervalMinutes: 5,
    maxSourcesPerRun: 100,
  });
  assert.throws(() => setupConfig(folder, team), /team file URL/);
  const calls = [];
  let failPush = true;
  const run = async (args, { cwd }) => {
    calls.push(args[0]);
    if (args[0] === "create")
      await writeFile(join(cwd, ".clasp.json"), '{"scriptId":"new-script"}');
    else {
      const config = await readFile(join(cwd, "Config.gs"), "utf8");
      assert.match(config, /team-file/);
      assert.match(config, /folder-key/);
      assert.match(
        await readFile(join(cwd, "Code.gs"), "utf8"),
        /setupConsiliumSync/,
      );
      if (failPush) throw new Error("Push failed");
    }
  };
  await assert.rejects(
    setupProject(team, folder, { ...options, run }),
    /Push failed/,
  );
  assert.equal(
    JSON.parse(await readFile(options.projectPath)).scriptId,
    "new-script",
  );
  assert.equal(
    JSON.parse(await readFile(join(options.directory, "setup.json")))
      .teamFileId,
    "team-file",
  );
  failPush = false;
  assert.equal(
    await setupProject(team, folder, { ...options, run }),
    "new-script",
  );
  assert.deepEqual(calls, ["create", "push", "push"]);
  await assert.rejects(
    setupProject(team.replace("team-file", "other-file"), folder, {
      ...options,
      run,
    }),
    /another team/,
  );
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

test("upload rebuilds code while preserving downloaded Config and extra project files", async (t) => {
  const options = await fixture(t);
  const remoteManifest =
    (await readFile("apps-script/appsscript.json", "utf8")) + "\n";
  const remoteConfig =
    'function consiliumConfig_() { return { teamFileId: "live-team", folderId: "live-folder" }; }\n';
  const calls = [];
  const run = async (args, { cwd }) => {
    calls.push(args.at(-1));
    const config = JSON.parse(await readFile(args[1], "utf8"));
    assert.equal(config.scriptId, "script-project");
    assert.equal(config.rootDir, ".");
    assert.deepEqual(config.scriptExtensions, [".gs"]);
    assert.equal(join(cwd, ".clasp.json"), args[1]);
    assert.match(await readFile(args[3], "utf8"), /\.clasp\.json/);
    if (args.at(-1) === "pull") {
      await Promise.all([
        writeFile(join(cwd, "Config.gs"), remoteConfig),
        writeFile(join(cwd, "Code.gs"), "old sync code"),
        writeFile(join(cwd, "Custom.gs"), "function custom() {}"),
        writeFile(join(cwd, "Template.html"), "<p>Extra project file</p>"),
        writeFile(join(cwd, "appsscript.json"), remoteManifest),
      ]);
    } else {
      assert.equal(args.includes("--force"), false);
      assert.equal(
        await readFile(join(cwd, "Config.gs"), "utf8"),
        remoteConfig,
      );
      assert.equal(
        await readFile(join(cwd, "Custom.gs"), "utf8"),
        "function custom() {}",
      );
      assert.equal(
        await readFile(join(cwd, "Template.html"), "utf8"),
        "<p>Extra project file</p>",
      );
      assert.match(
        await readFile(join(cwd, "Code.gs"), "utf8"),
        /function syncConsiliumTeam\(\)/,
      );
      const manifest = JSON.parse(
        await readFile(join(cwd, "appsscript.json"), "utf8"),
      );
      assert.equal(
        await readFile(join(cwd, "appsscript.json"), "utf8"),
        remoteManifest,
      );
      assert.ok(
        manifest.oauthScopes.includes("https://www.googleapis.com/auth/drive"),
      );
      assert.deepEqual((await readdir(cwd)).sort(), [
        ".clasp.json",
        ".claspignore",
        "Code.gs",
        "Config.gs",
        "Custom.gs",
        "Template.html",
        "appsscript.json",
      ]);
    }
  };
  assert.equal(await uploadProject({ ...options, run }), "script-project");
  assert.deepEqual(calls, ["pull", "push"]);
  assert.deepEqual(await readdir(options.directory), [".clasp.json"]);
});

test("a new project receives a Config template during its first upload", async (t) => {
  const options = await fixture(t);
  await uploadProject({
    ...options,
    run: async (args, { cwd }) => {
      if (args.at(-1) === "pull") {
        await writeFile(
          join(cwd, "appsscript.json"),
          await readFile("apps-script/appsscript.json", "utf8"),
        );
      } else {
        assert.match(
          await readFile(join(cwd, "Config.gs"), "utf8"),
          /PASTE_TEAM_FILE_ID/,
        );
      }
    },
  });
});

test("a real manifest change stops before a noninteractive push", async (t) => {
  const options = await fixture(t);
  const calls = [];
  await assert.rejects(
    uploadProject({
      ...options,
      run: async (args, { cwd }) => {
        calls.push(args.at(-1));
        if (args.at(-1) === "pull")
          await writeFile(join(cwd, "appsscript.json"), "{}");
      },
    }),
    /manifest changed/,
  );
  assert.deepEqual(calls, ["pull"]);
});

test("failed download never builds or uploads and removes staging files", async (t) => {
  const options = await fixture(t);
  let calls = 0;
  await assert.rejects(
    uploadProject({
      ...options,
      build: () => assert.fail("Must not build after a failed pull"),
      run: async () => {
        calls++;
        throw new Error("Download failed");
      },
    }),
    /Download failed/,
  );
  assert.equal(calls, 1);
  assert.deepEqual(await readdir(options.directory), [".clasp.json"]);
});

test("incomplete download never replaces the remote project", async (t) => {
  const options = await fixture(t);
  let calls = 0;
  await assert.rejects(
    uploadProject({
      ...options,
      build: () => assert.fail("Must not build without a downloaded manifest"),
      run: async () => {
        calls++;
      },
    }),
    { code: "ENOENT" },
  );
  assert.equal(calls, 1);
  assert.deepEqual(await readdir(options.directory), [".clasp.json"]);
});

test("failed build never uploads and failed upload also removes staging files", async (t) => {
  const options = await fixture(t);
  for (const failure of ["build", "push"]) {
    const calls = [];
    await assert.rejects(
      uploadProject({
        ...options,
        build: async () => {
          if (failure === "build") throw new Error("Build failed");
        },
        run: async (args, { cwd }) => {
          calls.push(args.at(-1));
          if (args.at(-1) === "pull")
            await writeFile(join(cwd, "appsscript.json"), "{}");
          else throw new Error("Push failed");
        },
      }),
      new RegExp(`${failure === "build" ? "Build" : "Push"} failed`),
    );
    assert.deepEqual(calls, failure === "build" ? ["pull"] : ["pull", "push"]);
    assert.deepEqual(await readdir(options.directory), [".clasp.json"]);
  }
});

test("missing or invalid linked project fails before invoking clasp", async (t) => {
  const options = await fixture(t);
  await rm(options.projectPath);
  const run = () =>
    assert.fail("Must not invoke clasp without a valid project");
  await assert.rejects(uploadProject({ ...options, run }), /apps-script:link/);
  await writeFile(options.projectPath, '{"scriptId":"../../somewhere"}');
  await assert.rejects(uploadProject({ ...options, run }), /Script ID/);
  assert.deepEqual(await readdir(options.directory), [".clasp.json"]);
});
