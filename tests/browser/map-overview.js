import assert from "node:assert/strict";

export async function mapOverview({ page }) {
  const before = parseInt(await page.locator("#zoom-level").textContent(), 10);
  await page.locator("#overview-map").click();
  const after = parseInt(await page.locator("#zoom-level").textContent(), 10);
  assert.ok(after > 0 && after < before);
}
