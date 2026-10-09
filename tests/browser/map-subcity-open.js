import assert from "node:assert/strict";

export async function mapSubcityOpen({ page }) {
  await page.locator('[data-screen="subcities"]').click();
  await page.locator("#subcities-search").fill("Filtered city");
  await page.locator("#subcities .subcity-card").first().click();
  await page.locator("#subcity-locate").click();
  await page.locator("#formation-screen").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#map");
    const pixel = canvas.getContext("2d").getImageData(
      Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    return pixel[0] === 203 && pixel[1] === 180 && pixel[2] === 119;
  });
  const box = await page.locator("#map").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.locator("#subcity-dialog").waitFor({ state: "visible" });
  assert.equal(await page.locator("#subcity-name").inputValue(), "Filtered city");
  await page.locator('#subcity-dialog [data-close="subcity-dialog"]').click();
}
