import assert from "node:assert/strict";

export async function formationGroupClick({ page }) {
  await page.locator('[data-screen="players"]').click();
  await page.locator("#add-player").click();
  await page.locator("#new-player-name").fill("Group player");
  await page.locator('#new-player-form [type="submit"]').click();
  await page.locator("#add-player-dialog").waitFor({ state: "hidden" });
  await page.locator('[data-screen="maps"]').click();
  await page.locator("#maps-list .map-row").filter({ hasText: "Player formation" }).click();
  const rows = page.locator("#formation-players .players-row");
  assert.equal(await rows.count(), 2);
  await rows.last().click();
  let box = await page.locator("#map").boundingBox();
  await page.mouse.click(box.x + box.width / 2 + 260, box.y + box.height / 2 + 100);
  assert.doesNotMatch(await rows.last().textContent(), /Unplaced/);

  for (const row of [rows.last(), rows.first()]) {
    await row.click();
    box = await page.locator("#map").boundingBox();
    await page.keyboard.down("Control");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.up("Control");
  }
  assert.equal(await page.locator("#formation-players .players-row.selected").count(), 2);
}
