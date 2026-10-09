import assert from "node:assert/strict";

export async function mapSwitch({ page }) {
  const rows = page.locator("#maps-list .map-row");
  assert.equal(await rows.first().isEnabled(), true);
  await rows.first().click();
  assert.match(await page.locator("#maps-list .map-row.selected").textContent(), /First hive/);
  assert.equal(await page.locator("#drive-save").isDisabled(), true);
  await rows.last().click();
  assert.match(await page.locator("#maps-list .map-row.selected").textContent(), /Battle map/);
  assert.equal(await page.locator("#drive-save").isDisabled(), true);
}
