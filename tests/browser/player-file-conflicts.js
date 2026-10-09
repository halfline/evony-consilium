import assert from "node:assert/strict";

export async function playerFileConflicts({ page, driveFiles }) {
  const playerFile = [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-player",
  );
  await page.locator('[data-player-tab="overview"]').click();
  playerFile.data.profile.name = "Remote player name";
  await page.locator("#player-name").fill("Local player name");
  await page.locator("#player-form [type=submit]").click();
  const dialog = page.locator("#player-sync-dialog");
  await dialog.waitFor({ state: "visible" });
  assert.equal(
    await page.locator("#player-screen").getAttribute("aria-busy"),
    "true",
  );
  assert.match(await page.locator("#player-sync-conflicts").textContent(), /name/);
  await dialog.locator('[data-resolution="team"]').click();
  for (let attempt = 0; attempt < 40; attempt++) {
    if (playerFile.data.profile.name === "Local player name") break;
    await page.waitForTimeout(50);
  }
  assert.equal(playerFile.data.profile.name, "Local player name");
  assert.equal(await dialog.isVisible(), false);
  await page.waitForFunction(
    () => document.getElementById("player-screen").getAttribute("aria-busy") === "false",
  );

  playerFile.data.profile.name = "Remote second name";
  await page.locator("#player-name").fill("Local second name");
  await page.locator("#player-form [type=submit]").click();
  await dialog.waitFor({ state: "visible" });
  await dialog.locator('[data-resolution="player"]').click();
  for (let attempt = 0; attempt < 40; attempt++) {
    if (playerFile.data.profile.name === "Remote second name") break;
    await page.waitForTimeout(50);
  }
  assert.equal(playerFile.data.profile.name, "Remote second name");
  assert.equal(await dialog.isVisible(), false);
}
