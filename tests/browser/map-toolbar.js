import assert from "node:assert/strict";

export async function mapToolbar({ page }) {
  await page.locator("#maps-list .map-row").first().click();
  const toolbar = page.locator(".map-toolbar");
  assert.equal(await toolbar.isVisible(), true);
  assert.equal(await page.locator("#maps-return-arrow").isVisible(), true);
  assert.equal(await page.locator('[data-screen="maps"]').getAttribute("aria-label"), "Back to maps");
  assert.equal(await toolbar.locator("#formation-name").textContent(), "First hive");
  for (const id of ["show-grid", "show-labels", "auto-place", "fit-map", "overview-map"])
    assert.equal(await toolbar.locator("#" + id).isVisible(), true);
  await page.locator('[data-screen="maps"]').click();
  assert.equal(await toolbar.isVisible(), false);
  assert.equal(await page.locator("#maps-return-arrow").isVisible(), false);
  assert.equal(await page.locator('[data-screen="maps"]').getAttribute("aria-label"), "Maps");
}
