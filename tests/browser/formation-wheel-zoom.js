import assert from "node:assert/strict";

export async function formationWheelZoom({ page }) {
  const before = await page.locator("#zoom-level").textContent();
  const box = await page.locator("#map").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -1000);
  await page.waitForFunction((previous) =>
    document.querySelector("#zoom-level")?.textContent !== previous, before);
  assert.notEqual(await page.locator("#zoom-level").textContent(), before);
}
