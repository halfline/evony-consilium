import assert from "node:assert/strict";

export async function formationUndo({ page }) {
  const row = page.locator("#formation-players .players-row").first();
  await row.click();
  const box = await page.locator("#map").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  assert.doesNotMatch(await row.textContent(), /Unplaced/);
  await page.locator("#map").press("Control+z");
  assert.match(await row.textContent(), /Unplaced/);
}
