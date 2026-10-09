import assert from "node:assert/strict";

export async function formationHelp({ page }) {
  await page.locator("#help").click();
  await page.locator("#help-dialog").waitFor({ state: "visible" });
  assert.match(await page.locator("#help-dialog").textContent(), /Arrange formation/);
  assert.equal(await page.locator('#help-dialog a[href="privacy.html"]').count(), 1);
  assert.equal(await page.locator('#help-dialog a[href="terms.html"]').count(), 1);
  assert.equal(await page.locator('#help-dialog a[href="https://ew.evony.com/"]').count(), 1);
  await page.locator('[data-close="help-dialog"]').click();
  assert.equal(await page.locator("#help-dialog").isHidden(), true);
}
