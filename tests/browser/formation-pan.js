import assert from "node:assert/strict";

export async function formationPan({ page }) {
  const canvas = page.locator("#map");
  const before = await canvas.screenshot();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 110, box.y + 90, { steps: 5 });
  await page.mouse.up();
  const after = await canvas.screenshot();
  assert.notDeepEqual(after, before);
}
