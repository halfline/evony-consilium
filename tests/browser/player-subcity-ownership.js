import assert from "node:assert/strict";

export async function playerSubcityOwnership({ page, driveFiles }) {
  await page.locator('[data-screen="players"]').click();
  await page.locator("#players .player-card").first().click();
  await page.locator('[data-player-tab="subcities"]').click();
  assert.equal(await page.locator('[data-player-panel="subcities"]').isVisible(), true);
  assert.equal(await page.locator("#player-profile-actions").isVisible(), false);
  await page.locator("#player-add-subcity").click();
  await page.locator("#assign-subcity-dialog").waitFor({ state: "visible" });
  await page.locator("#assign-subcity-list .subcity-card").first().click();
  await page.locator("#assign-subcity-dialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#player-subcities .subcity-card").count(), 1);
  const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
  const playerId = team.data.plan.keeps[0].id;
  await page.locator("#drive-save").click();
  for (let attempt = 0; attempt < 40; attempt++) {
    if (team.data.plan.subcities[0].ownerId === playerId) break;
    await page.waitForTimeout(50);
  }
  assert.equal(team.data.plan.subcities[0].ownerId, playerId);
  await page.locator("#player-subcities .subcity-tile").hover();
  await page.locator("#player-subcities .subcity-remove").click();
  assert.equal(await page.locator("#player-subcities .subcity-card").count(), 0);
  await page.locator("#drive-save").click();
  for (let attempt = 0; attempt < 40; attempt++) {
    if (team.data.plan.subcities[0].ownerId === null) break;
    await page.waitForTimeout(50);
  }
  assert.equal(team.data.plan.subcities[0].ownerId, null);
}
