import assert from "node:assert/strict";

export async function subcityLocate({ page }) {
  await page.locator('[data-screen="maps"]').click();
  if (!(await page.locator("#add-map-dialog").isVisible()))
    await page.locator("#add-map").click();
  await page.locator("#new-formation-type").selectOption("server");
  await page.locator("#new-formation-name").fill("Subcity server");
  await page.locator('#add-map-form button[type="submit"]').click();
  await page.locator("#add-map-dialog").waitFor({ state: "hidden" });

  await page.locator('[data-screen="subcities"]').click();
  await page.locator("#subcities-search").fill("Filtered city");
  await page.locator("#subcities .subcity-card").first().click();
  await page.locator("#subcity-dialog").waitFor({ state: "visible" });
  assert.equal(await page.locator("#subcity-locate").isVisible(), false);
  await page.locator("#subcity-x").fill("600");
  await page.locator("#subcity-y").fill("600");
  await page.locator("#subcity-save").click();
  await page.locator("#subcity-dialog").waitFor({ state: "hidden" });
  await page.locator("#subcities .subcity-card").first().click();
  await page.locator("#subcity-locate").click();
  await page.locator("#formation-screen").waitFor({ state: "visible" });
  assert.equal(await page.locator("#map-name").textContent(), "Server map");
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#map");
    const center = canvas.getContext("2d").getImageData(
      Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1,
    ).data;
    return center[0] === 203 && center[1] === 180 && center[2] === 119;
  });
}
