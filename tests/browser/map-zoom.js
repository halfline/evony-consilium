import assert from "node:assert/strict";

export async function mapZoom({ page }) {
  await page.locator("#maps-list .map-row").first().click();
  assert.equal(await page.locator("#map-zoom-controls").isVisible(), true);
  const before = await page.locator("#zoom-level").textContent();
  for (let i = 0; i < 8; i++) await page.locator("#zoom-in").click();
  const after = await page.locator("#zoom-level").textContent();
  assert.notEqual(after, before);
  for (let i = 0; i < 8; i++) await page.locator("#zoom-out").click();
  assert.equal(await page.locator("#zoom-level").textContent(), before);
  await page.locator('[data-screen="maps"]').click();
}
