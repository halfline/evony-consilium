import assert from "node:assert/strict";
import { mockGoogleDrive } from "../drive-mock.js";
export async function teamCollaboration({ browser }) {
  const first = await browser.newContext(),
    second = await browser.newContext();
  try {
    const files = await mockGoogleDrive(first),
      a = await first.newPage();
    await a.goto("http://127.0.0.1:4174");
    await a.locator("#google-login:not([disabled])").click();
    await a.locator("#project-tab-create").click();
    await a.locator("#project-name").fill("Shared team");
    await a.locator("[form=project-create]").click();
    await a.locator("#planner").waitFor({ state: "visible" });
    const team = [...files.values()].find(
      (entry) => entry.data?.format === "evony-consilium-team",
    );
    assert.equal(team.file.name, "Team - Shared team.team.consilium.json");
    await mockGoogleDrive(second, { files, grants: new Set([team.file.id]) });
    const b = await second.newPage();
    await b.goto("http://127.0.0.1:4174");
    await b.locator("#google-login:not([disabled])").click();
    await b
      .locator("#project-url")
      .fill(`http://127.0.0.1:4174/#team=${team.file.id}&screen=project`);
    await b.locator("[form=project-join]").click();
    await b.locator("#planner").waitFor({ state: "visible" });
    async function title(page, value) {
      await page.locator("#edit-project-name").fill(value);
      await page.locator("#edit-project-name").dispatchEvent("change");
    }
    async function discord(page, value) {
      if (await page.locator("#team-discord-tile").isVisible()) {
        await page.locator("#team-discord-open").focus();
        await page.locator("#team-discord-remove").click();
      }
      await page.locator("#team-discord-url").fill(value);
      await page.locator("#team-discord-url").dispatchEvent("change");
    }
    async function saved(page) {
      await page.waitForFunction(
        () =>
          document.getElementById("drive-save").disabled &&
          document.getElementById("drive-save").getAttribute("aria-busy") ===
            "false",
      );
    }
    await title(a, "Alice's team name");
    await discord(b, "https://discord.gg/shared");
    await a.locator("#drive-save").click();
    await saved(a);
    await b.locator("#drive-save").click();
    await saved(b);
    assert.equal(team.data.plan.title, "Alice's team name");
    assert.equal(team.data.plan.discordUrl, "https://discord.gg/shared");
    assert.equal(await b.locator("#team-conflict-dialog").isVisible(), false);
    await a.evaluate(() => window.dispatchEvent(new Event("focus")));
    await a.waitForFunction(
      () =>
        document.getElementById("team-discord-open").getAttribute("href") ===
        "https://discord.gg/shared",
    );
    await title(a, "Alice's conflicting name");
    await title(b, "Bob's conflicting name");
    await discord(a, "https://discord.gg/alice");
    await discord(b, "https://discord.gg/bob");
    await b.locator("#drive-save").click();
    await saved(b);
    await a.setViewportSize({ width: 390, height: 844 });
    await a.locator("#drive-save").click();
    await a.locator("#team-conflict-dialog").waitFor({ state: "visible" });
    await a.screenshot({ path: "test-results/team-conflict-mobile.png" });
    const dialog = await a.locator("#team-conflict-dialog").boundingBox();
    assert.equal(dialog.x >= 0 && dialog.x + dialog.width <= 390, true);
    assert.equal(
      await a
        .locator("#team-conflict-dialog")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
      true,
    );
    const localOption = await a
      .locator('.team-conflict-row:has-text("Team name") .team-conflict-option')
      .first()
      .boundingBox();
    const remoteOption = await a
      .locator('.team-conflict-row:has-text("Team name") .team-conflict-option')
      .last()
      .boundingBox();
    assert.equal(localOption.y < remoteOption.y, true);
    assert.match(
      await a.locator("#team-conflict-values").textContent(),
      /Team name/,
    );
    await a
      .locator(
        '.team-conflict-row:has-text("Discord link") input[value="remote"]',
      )
      .check();
    await a.locator('[data-team-resolution="apply"]').click();
    await a.setViewportSize({ width: 1280, height: 720 });
    await saved(a);
    assert.equal(team.data.plan.title, "Alice's conflicting name");
    assert.equal(team.data.plan.discordUrl, "https://discord.gg/bob");
    await a.locator("#undo").click();
    assert.equal(
      await a.locator("#plan-title").inputValue(),
      "Bob's conflicting name",
    );
    assert.equal(
      await a.locator("#team-discord-open").getAttribute("href"),
      "https://discord.gg/bob",
    );
    assert.equal(
      await a.evaluate(() => (window.__pickerCalls || []).length),
      0,
    );
    assert.equal(
      await b.evaluate(() => (window.__pickerCalls || []).length),
      0,
    );
  } finally {
    await first.close();
    await second.close();
  }
}
