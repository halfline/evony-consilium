import assert from "node:assert/strict";

export async function formationSelect({ page }) {
  const row = page.locator("#formation-players .players-row").first();
  await row.click();
  assert.equal(await row.evaluate((button) => button.classList.contains("selected")), true);
  const box = await page.locator("#map").boundingBox();
  await page.mouse.click(box.x + 30, box.y + 30);
  assert.equal(await row.evaluate((button) => button.classList.contains("selected")), false);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  assert.equal(await row.evaluate((button) => button.classList.contains("selected")), true);
}
