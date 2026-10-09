import assert from "node:assert/strict";

export async function mapCoordinates({ page }) {
  const box = await page.locator("#map").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const first = await page.locator("#map-coordinates").textContent();
  assert.match(first, /^X: \d+ · Y: \d+$/);
  await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2 + 100);
  const second = await page.locator("#map-coordinates").textContent();
  assert.match(second, /^X: \d+ · Y: \d+$/);
  assert.notEqual(second, first);
}
