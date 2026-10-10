import assert from "node:assert/strict";
import { mockGoogleDrive } from "../drive-mock.js";

export async function playerDiscovery({ browser }) {
  const context = await browser.newContext();
  try {
    const files = await mockGoogleDrive(context);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:4174");
    await page.locator("#google-login:not([disabled])").click();
    await page.locator("#project-tab-create").click();
    await page.locator("#project-name").fill("Discovery test");
    await page.locator("[form=project-create]").click();
    await page.locator("#planner").waitFor({ state: "visible" });
    const team = [...files.values()].find(
      (entry) => entry.data?.format === "evony-consilium-team",
    );
    const folderId = team.file.parents[0];
    const profile = await page.evaluate(async () => {
      const { newPlayer } = await import("/src/domain/players.js");
      const { playerProfile } = await import("/src/domain/player-document.js");
      const catalog = await fetch("/assets/catalog.json").then((response) =>
        response.json(),
      );
      const player = newPlayer(
        new Map(catalog.assets.map((asset) => [asset.id, asset])),
      );
      player.name = "Fearless ice";
      return playerProfile(player);
    });
    files.set("existing-player", {
      file: {
        id: "existing-player",
        name: "Fearless ice.player.consilium.json",
        mimeType: "application/json",
        parents: [folderId],
        version: "1",
        capabilities: { canEdit: false },
      },
      data: { format: "evony-consilium-player", schema: 1, profile },
    });
    files.grants.add("existing-player");
    files.grants.delete(folderId);
    const pickerCount = await page.evaluate(
      () => (window.__pickerCalls || []).length,
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.waitForFunction(
      () => document.getElementById("team-player-count").textContent === "1",
    );
    await page.waitForFunction(
      () => document.getElementById("drive-save").disabled,
    );
    assert.equal(team.data.plan.keeps[0].name, "Fearless ice");
    assert.equal(files.grants.has(folderId), false);
    assert.equal(
      await page.evaluate(() => (window.__pickerCalls || []).length),
      pickerCount,
    );
    await page.locator('[data-screen="players"]').click();
    assert.equal(await page.locator("#players .player-card").count(), 1);
    await page.locator("#players .player-card").click();
    assert.equal(
      await page.locator("#player-name").inputValue(),
      "Fearless ice",
    );
    assert.equal(
      await page.locator("#player-name").getAttribute("readonly"),
      "",
    );
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}
