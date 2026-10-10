import assert from "node:assert/strict";
import { mockGoogleDrive } from "../drive-mock.js";

export async function autosave({ browser }) {
  const context = await browser.newContext();
  try {
    // Invoke the actual interval callback without waiting 30 seconds per case.
    await context.addInitScript(() => {
      const original = window.setInterval;
      window.setInterval = (callback, delay, ...args) => {
        if (delay === 30000) {
          window.__autosaveInterval = delay;
          window.__autosaveTick = () => callback(...args);
          return original(() => {}, 86400000);
        }
        return original(callback, delay, ...args);
      };
    });
    const files = await mockGoogleDrive(context),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:4174");
    await page.locator("#google-login:not([disabled])").click();
    await page.locator("#project-tab-create").click();
    await page.locator("#project-name").fill("Autosave team");
    await page.locator("[form=project-create]").click();
    await page.locator("#planner").waitFor({ state: "visible" });
    for (const name of ["Alice", "Bob"]) {
      await page.locator('[data-screen="players"]').click();
      await page.locator("#add-player").click();
      await page.locator("#new-player-name").fill(name);
      await page.locator("#new-player-form [type=submit]").click();
      await page.locator("#add-player-dialog").waitFor({ state: "hidden" });
    }
    const tick = () => page.evaluate(() => window.__autosaveTick());
    assert.equal(await page.evaluate(() => window.__autosaveInterval), 30000);
    await tick();
    const team = [...files.values()].find(
      (entry) => entry.data?.format === "evony-consilium-team",
    );
    assert.equal(team.data.plan.keeps.length, 2);
    const sources = team.data.plan.keeps.map((player) =>
      files.get(player.playerSource.fileId),
    );
    const open = async (index) => {
      await page.locator('[data-screen="players"]').click();
      await page.locator("#players .player-card").nth(index).click();
      await page.waitForFunction(
        () => !document.getElementById("player-name").readOnly,
      );
    };
    await open(0);
    await page.locator("#player-name").fill("Alice edited");
    await open(1);
    await page.locator("#player-name").fill("Bob edited");
    await page.locator('[data-screen="project"]').click();
    await page.locator("#plan-title").fill("Automatically saved team");
    await tick();
    assert.equal(sources[0].data.profile.name, "Alice edited");
    assert.equal(sources[1].data.profile.name, "Bob edited");
    assert.equal(team.data.plan.title, "Automatically saved team");
    assert.equal(
      await page.locator("#team-save-status").textContent(),
      "Team saved",
    );

    // Typing continues during an upload. Only newer input remains a draft,
    // and an independent remote field is not reverted by the following tick.
    await open(0);
    await page.locator("#player-name").fill("Before upload");
    sources[0].data.profile.allianceTag = "REMOTE";
    sources[0].file.version = String(Number(sources[0].file.version) + 1);
    let release, reached;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const uploading = new Promise((resolve) => {
      reached = resolve;
    });
    const uploadUrl = `https://www.googleapis.com/upload/drive/v2/files/${sources[0].file.id}?*`;
    const delayedUpload = async (route) => {
      reached();
      await gate;
      await route.fallback();
    };
    await context.route(uploadUrl, delayedUpload);
    const saving = tick();
    await uploading;
    assert.equal(
      await page.locator("#player-name").getAttribute("readonly"),
      null,
    );
    await page.locator("#player-name").fill("During upload");
    release();
    await saving;
    await context.unroute(uploadUrl, delayedUpload);
    assert.equal(sources[0].data.profile.name, "Before upload");
    assert.equal(
      await page.locator("#player-name").inputValue(),
      "During upload",
    );
    assert.equal(await page.locator("#player-tag").inputValue(), "REMOTE");
    await tick();
    assert.equal(sources[0].data.profile.name, "During upload");
    assert.equal(sources[0].data.profile.allianceTag, "REMOTE");

    // Upload failures keep the draft and retry on the next interval.
    await page.locator("#player-name").fill("Retry this player");
    const offline = (route) =>
      route.fulfill({ status: 503, json: { error: { message: "Offline" } } });
    await context.route(uploadUrl, offline);
    await tick();
    assert.equal(sources[0].data.profile.name, "During upload");
    assert.equal(
      await page.locator("#player-name").inputValue(),
      "Retry this player",
    );
    await context.unroute(uploadUrl, offline);
    await tick();
    assert.equal(sources[0].data.profile.name, "Retry this player");

    // Invalid input is retained locally rather than uploaded or discarded.
    await page.locator("#player-name").fill("");
    await tick();
    assert.equal(sources[0].data.profile.name, "Retry this player");
    assert.equal(await page.locator("#player-name").inputValue(), "");
    await page.locator("#player-name").fill("My player edit");
    sources[0].data.profile.name = "Other player edit";
    sources[0].file.version = String(Number(sources[0].file.version) + 1);
    await page.locator("#plan-title").fill("My team edit");
    await page.locator("#plan-title").dispatchEvent("change");
    team.data.plan.title = "Other team edit";
    team.file.version = String(Number(team.file.version) + 1);
    await tick();
    assert.equal(await page.locator("#player-sync-dialog").isVisible(), false);
    assert.equal(
      await page.locator("#team-conflict-dialog").isVisible(),
      false,
    );
    assert.equal(sources[0].data.profile.name, "Other player edit");
    assert.equal(team.data.plan.title, "Other team edit");
    assert.equal(
      await page.locator("#player-name").inputValue(),
      "My player edit",
    );
    assert.match(
      await page.locator("#player-save-status").textContent(),
      /need review/,
    );
    assert.match(
      await page.locator("#team-save-status").textContent(),
      /need review/,
    );
    const conflictedVersion = sources[0].file.version;
    await tick();
    assert.equal(sources[0].file.version, conflictedVersion);
    await page.locator("#player-save").click();
    await page.locator("#player-sync-dialog").waitFor({ state: "visible" });
    await page.locator('[data-resolution="team"]').click();
    await page.waitForFunction(
      () =>
        document.getElementById("player-save").disabled &&
        document.getElementById("player-screen").getAttribute("aria-busy") ===
          "false",
    );
    await page.locator("#drive-save").click();
    await page.locator("#team-conflict-dialog").waitFor({ state: "visible" });
    await page.locator('[data-team-resolution="local"]').click();
    await page.waitForFunction(
      () =>
        document.getElementById("drive-save").disabled &&
        document.getElementById("drive-save").getAttribute("aria-busy") ===
          "false",
    );

    // A team viewer can autosave their own source without uploading the team.
    team.file.capabilities.canEdit = false;
    await tick();
    const viewerVersion = team.file.version;
    await page.locator("#player-account").fill("555");
    await tick();
    assert.equal(sources[0].data.profile.accountId, "555");
    assert.equal(team.file.version, viewerVersion);
    sources[0].file.capabilities.canEdit = false;
    await tick();
    assert.equal(
      await page.locator("#player-name").getAttribute("readonly"),
      "",
    );
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}
