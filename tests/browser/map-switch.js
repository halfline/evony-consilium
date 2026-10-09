import assert from "node:assert/strict";

export async function mapSwitch({ page }) {
  const rows = page.locator("#maps-list .map-row");
  assert.equal(await rows.first().isEnabled(), true);
  await rows.first().click();
  assert.equal(await page.locator("#formation-screen").isVisible(), true);
  assert.equal(await page.locator("#map-name").textContent(), "First hive");
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#map");
    return canvas.width > 0 && canvas.height > 0;
  });
  assert.equal(await page.locator("#map").evaluate((canvas) =>
    canvas.getContext("2d").getImageData(0, 0, 1, 1).data[3]), 255);
  assert.equal(await page.locator("#drive-save").isDisabled(), true);
  await page.locator('[data-screen="maps"]').click();
  await rows.last().click();
  assert.equal(await page.locator("#map-name").textContent(), "Battle map");
  assert.equal(await page.locator("#drive-save").isDisabled(), true);
  await page.locator('[data-screen="maps"]').click();
}
