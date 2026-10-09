import assert from "node:assert/strict";

export async function subcityColor({ page }) {
  await page.locator("#subcities-color").selectOption("red");
  assert.equal(await page.locator("#subcities .subcity-card").count(), 0);
  await page.locator("#subcities-color").selectOption("gold");
  assert.equal(await page.locator("#subcities .subcity-card").count(), 1);
  await page.locator("#subcities-color").selectOption("");
  await page.locator("#subcities-type").selectOption("");
}
