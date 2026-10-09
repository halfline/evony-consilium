import assert from "node:assert/strict";

export async function subcityCategory({ page }) {
  await page.locator("#subcities-search").fill("");
  await page.locator("#add-subcity").click();
  await page.locator("#subcity-dialog").waitFor({ state: "visible" });
  await page.locator("#subcity-name").fill("Filtered city");
  await page.locator("#subcity-save").click();
  await page.locator("#subcity-dialog").waitFor({ state: "hidden" });
  await page.locator("#subcities-type").selectOption("historic");
  assert.equal(await page.locator("#subcities .subcity-card").count(), 0);
  await page.locator("#subcities-type").selectOption("culture");
  assert.equal(await page.locator("#subcities .subcity-card").count(), 1);
}
