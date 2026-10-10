import assert from "node:assert/strict";
import { mockGoogleDrive } from "../drive-mock.js";
export async function playerImport({ browser }) {
  const context = await browser.newContext();
  try {
    const files = await mockGoogleDrive(context),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:4174");
    await page.locator("#google-login:not([disabled])").click();
    await page.locator("#project-tab-create").click();
    await page.locator("#project-name").fill("Import test");
    await page.locator("[form=project-create]").click();
    await page.locator("#planner").waitFor({ state: "visible" });
    const team = [...files.values()].find(
        (entry) => entry.data?.format === "evony-consilium-team",
      ),
      folderId = team.file.parents[0];
    const profile = await page.evaluate(async () => {
      const { newPlayer } = await import("/src/domain/players.js"),
        { playerProfile } = await import("/src/domain/player-document.js");
      const catalog = await fetch("/assets/catalog.json").then((response) =>
        response.json(),
      );
      return {
        ...playerProfile(
          newPlayer(new Map(catalog.assets.map((asset) => [asset.id, asset]))),
        ),
        name: "Existing player",
      };
    });
    files.set("existing-player", {
      file: {
        id: "existing-player",
        name: "Existing.player.consilium.json",
        mimeType: "application/json",
        parents: [folderId],
        version: "1",
        capabilities: { canEdit: false },
      },
      data: { format: "evony-consilium-player", schema: 1, profile },
    });
    files.grants.delete(folderId);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.locator('[data-screen="players"]').click();
    assert.equal(await page.locator("#players .player-card").count(), 0);
    assert.equal(await page.locator("#add-player-dialog").isVisible(), false);
    assert.equal(
      await page.evaluate(() => (window.__pickerCalls || []).length),
      0,
    );
    assert.equal(await page.locator("#connect-player").count(), 0);
    await page.locator("#add-player").click();
    await page.locator("#add-player-dialog").waitFor({ state: "visible" });
    assert.equal(
      await page.evaluate(() => (window.__pickerCalls || []).length),
      0,
    );
    assert.equal(
      await page.locator("#import-player-file").getAttribute("aria-label"),
      "Import player file from Drive",
    );
    await page.locator("#import-player-file").click();
    await page.locator("#player-inspector").waitFor({ state: "visible" });
    assert.equal(
      await page.locator("#player-title").textContent(),
      "Existing player",
    );
    await page.waitForFunction(
      () => document.getElementById("drive-save").disabled,
    );
    assert.equal(team.data.plan.keeps.length, 1);
    assert.equal(files.grants.has(folderId), false);
    const picker = await page.evaluate(() => window.__pickerCalls[0]);
    assert.match(picker.title, /select a Player file/);
    assert.equal(
      picker.mime,
      "application/vnd.evony-consilium.player+json,application/json",
    );
    assert.equal(picker.mode, "list");
    assert.equal(picker.query, "player.consilium.json");
    assert.equal(picker.views.length, 1);
    await page.locator("#undo").click();
    await page.locator("#drive-save").click();
    await page.waitForFunction(
      () =>
        document.getElementById("drive-save").disabled &&
        document.getElementById("drive-save").getAttribute("aria-busy") ===
          "false",
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    assert.equal(await page.locator("#players .player-card").count(), 0);
    assert.equal(team.data.plan.keeps.length, 0);
    // The same primary view must also find profiles with the new Drive type.
    files.get("existing-player").file.mimeType =
      "application/vnd.evony-consilium.player+json";
    files.get("existing-player").file.name =
      "Player - Existing.player.consilium.json";
    await page.locator("#add-player").click();
    await page.locator("#import-player-file").click();
    await page.locator("#player-inspector").waitFor({ state: "visible" });
    await page.waitForFunction(
      () =>
        document.getElementById("drive-save").disabled &&
        document.getElementById("drive-save").getAttribute("aria-busy") ===
          "false",
    );
    assert.equal(team.data.plan.keeps[0].name, "Existing player");
    await page.locator('[data-screen="players"]').click();
    files.grants.delete(folderId);
    await page.locator("#add-player").click();
    await page.locator("#add-player-dialog").waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => window.__pickerCalls.length), 2);
    await page.locator("#new-player-name").fill("Created after import");
    await page.evaluate(() => {
      window.__pickerCancelNext = true;
    });
    await page.locator("#new-player-form [type=submit]").click();
    await page.waitForFunction(() => window.__pickerCalls.length === 3);
    await page.locator("#add-player-dialog").waitFor({ state: "visible" });
    assert.equal(
      await page.locator("#new-player-name").inputValue(),
      "Created after import",
    );
    assert.equal(files.grants.has(folderId), false);
    await page.locator("#new-player-form [type=submit]").click();
    await page.locator("#add-player-dialog").waitFor({ state: "hidden" });
    await page.waitForFunction(
      () =>
        document.getElementById("player-title").textContent ===
          "Created after import" &&
        document.getElementById("drive-save").disabled &&
        document.getElementById("drive-save").getAttribute("aria-busy") ===
          "false",
    );
    assert.equal(team.data.plan.keeps.length, 2);
    assert.equal(files.grants.has(folderId), true);
    const calls = await page.evaluate(() => window.__pickerCalls);
    assert.match(calls.at(-1).title, /select the Import test folder/);
    assert.deepEqual(await page.evaluate(() => window.__pickerModalStates), [
      false,
      false,
      false,
      false,
    ]);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}
