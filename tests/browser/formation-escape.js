import assert from "node:assert/strict";

export async function formationEscape({ page }) {
  const row = page.locator("#formation-players .players-row").first();
  await row.click();
  assert.match(await page.locator("#map-guide").textContent(), /Click a free map tile/);
  await page.locator("#map").press("Escape");
  assert.match(await page.locator("#map-guide").textContent(), /Drag to move/);
  const box = await page.locator("#map").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  assert.match(await row.textContent(), /Unplaced/);
}
