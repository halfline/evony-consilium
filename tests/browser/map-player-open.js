import assert from "node:assert/strict";

export async function mapPlayerOpen({ page }) {
  await page.locator('[data-screen="maps"]').click();
  await page.locator("#maps-list .map-row").filter({ hasText: "Player formation" }).click();
  const row = page.locator("#formation-players .players-row").first();
  const name = (await row.textContent()).split(" · ")[0];
  await row.click();
  const box = await page.locator("#map").boundingBox();
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await page.locator("#player-screen").waitFor({ state: "visible" });
  assert.equal(await page.locator("#player-name").inputValue(), name);
  await page.locator('[data-screen="players"]').click();
  const selected = page.locator("#players .player-card.selected");
  assert.equal(await selected.count(), 1);
  assert.match(await selected.textContent(), new RegExp(name));
}
