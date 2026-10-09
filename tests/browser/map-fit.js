import assert from "node:assert/strict";

export async function mapFit({ page }) {
  assert.equal(await page.locator("#zoom-level").textContent(), "100%");
  await page.locator("#fit-map").click();
  const zoom = await page.locator("#zoom-level").textContent();
  assert.match(zoom, /^\d+%$/);
  assert.notEqual(zoom, "100%");
}
