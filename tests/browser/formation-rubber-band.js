import assert from "node:assert/strict";

export async function formationRubberBand({ page }) {
  const box = await page.locator("#map").boundingBox();
  await page.mouse.click(box.x + 30, box.y + 30);
  assert.equal(await page.locator("#formation-players .players-row.selected").count(), 0);
  await page.keyboard.down("Shift");
  await page.mouse.move(box.x + 2, box.y + 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height - 2,
    { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  assert.equal(await page.locator("#formation-players .players-row.selected").count(), 2);
}
