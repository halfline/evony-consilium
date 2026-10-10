import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

export async function terrainAndMobile({ page, formationScreen }) {
  // Every requested map mode is selectable; geography status stays honest.
  assert.equal(await page.locator('[data-tab="map"]').count(), 0);
  assert.equal(await page.locator("#panel-map").count(), 0);
  for (const id of [
    "boc",
    "bog",
    "chalons",
    "allstars",
    "civilization",
    "toulon",
    "server",
  ]) {
    await page.locator('[data-screen="maps"]').click();
    await page.locator("#add-map").click();
    await page.locator("#new-formation-type").selectOption(id);
    await page.locator('#add-map-form button[type="submit"]').click();
    assert.equal(await page.locator("#map-status").count(), 0);
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: "test-results/server-terrain.png" });
  await page.locator('[data-screen="maps"]').click();
  await page.locator("#add-map").click();
  await page.locator("#new-formation-type").selectOption("blank");
  assert.equal(
    await page.locator("#new-formation-name").inputValue(),
    "Formation",
  );
  await page.locator('#add-map-form button[type="submit"]').click();
  await formationScreen();
  await page.locator("[data-tab=hive]").click();
  await page.locator('[data-building="objective"]').click();
  await page.locator("#catalog-search").fill("throne castle");
  assert.equal(await page.locator("#catalog-grid .castle-card").count(), 1);
  await page.locator('#catalog-grid [data-asset="map-kingdom"]').click();
  assert.equal(await page.locator("#entity-w").inputValue(), "5");
  assert.equal(await page.locator("#entity-h").inputValue(), "5");
  await formationScreen();
  await page.locator("#entity-x").fill("700");
  await page.locator("#entity-y").fill("700");
  await page.locator("#entity-form [type=submit]").click();
  await formationScreen();
  await page.locator("#reset-view").click();
  await page.waitForFunction(() =>
    performance
      .getEntriesByType("resource")
      .some((r) => r.name.endsWith("/assets/map-kingdom.webp")),
  );
  await formationScreen();
  await page.locator("#fit-map").click();
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  const mobileMap = await page.locator(".map-section").boundingBox();
  const mobileRoster = await page.locator("#formation-sidebar").boundingBox();
  assert.equal(mobileMap.y < mobileRoster.y, true);
  assert.equal(mobileMap.y < 844, true);
  assert.equal(await page.locator(".mobile-roster-link").isVisible(), true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
}
