import assert from "node:assert/strict";

export async function mapTerrain({ page }) {
  await page.waitForFunction(() =>
    performance.getEntriesByType("resource").some((entry) =>
      entry.name.endsWith("/assets/terrain/server-overview.webp")));
  const changedPixels = await page.locator("#map").evaluate((canvas) => {
    const ctx = canvas.getContext("2d");
    let changed = 0;
    for (let y = 40; y < canvas.height - 40; y += 45)
      for (let x = 40; x < canvas.width - 40; x += 45) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        if (pixel[0] !== 100 || pixel[1] !== 121 || pixel[2] !== 71)
          changed++;
      }
    return changed;
  });
  assert.ok(changedPixels > 20, `expected painted terrain, got ${changedPixels} changed pixels`);
}
