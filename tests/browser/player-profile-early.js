import assert from "node:assert/strict";

export async function playerProfileEarly({ page, driveFiles }) {
  await page.locator("#players .player-card").first().click();
  assert.equal(await page.locator("#player-screen").isVisible(), true);
  assert.equal(await page.locator("#players-screen").isVisible(), false);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.locator(".player-detail-tabs").evaluate((tabs) => getComputedStyle(tabs).overflowX),
    "auto",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(await page.locator("#player-name").inputValue(), "First player");
  assert.equal(await page.locator("#player-unlock").isVisible(), false);
  assert.equal(await page.locator("#player-castle").isVisible(), true);
  assert.match(await page.locator("#player-castle").getAttribute("aria-label"), /Japan/);
  await page.locator("#player-name").fill("Unsaved preview");
  await page.evaluate(() => window.dispatchEvent(new PopStateEvent("popstate")));
  assert.equal(await page.locator("#player-name").inputValue(), "Unsaved preview");
  await page.locator("#player-name").fill("Renamed player");
  await page.locator("#player-form [type=submit]").click();
  await page.waitForFunction(() =>
    document.getElementById("player-title")?.textContent === "Renamed player",
  );
  const playerFile = [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-player",
  );
  assert.equal(playerFile.data.profile.name, "Renamed player");
  assert.equal(playerFile.data.profile.details, undefined);
  await page.locator('[data-screen="players"]').click();
  await page.locator("#players-search").fill("");
  assert.match(await page.locator("#players").textContent(), /Renamed player/);
  await page.locator("#drive-save").click();
  let team;
  for (let attempt = 0; attempt < 40; attempt++) {
    team = [...driveFiles.values()].find(
      ({ data }) => data?.format === "evony-consilium-team",
    );
    if (team?.data?.plan?.keeps?.[0]?.name === "Renamed player") break;
    await page.waitForTimeout(50);
  }
  assert.equal(team.data.plan.keeps[0].name, "Renamed player");
  assert.equal(team.data.plan.keeps[0].playerSource.fileId, playerFile.file.id);
}
