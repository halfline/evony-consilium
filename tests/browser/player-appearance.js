import { loadTeamFixture } from "./team-fixture.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDemoPlan } from "../../web/src/domain/plan.js";
import { assetFile } from "./asset-file.js";

export async function playerAppearance({
  page,
  playersScreen,
  formationScreen,
  projectLogo,
  driveFiles,
}) {
  const demoCatalog = JSON.parse(
    await readFile(assetFile("catalog.json"), "utf8"),
  );
  await loadTeamFixture(page, driveFiles, {
    ...createDemoPlan(demoCatalog),
    map: "blank",
    projectLogo,
  });
  assert.equal(await page.locator("#players .player-card").count(), 12);
  await playersScreen();
  await page.locator("#players .player-card").first().click();
  await page.locator("#player-unlock").click();
  await page.waitForFunction(
    () => !document.getElementById("player-name").readOnly,
  );
  await page.locator("#player-name").fill("Queen, 北 <script>");
  await page.locator("#player-account").fill("001234567890123456789");
  await page.locator("#player-form [type=submit]").click();
  await page.waitForFunction(
    () =>
      document.getElementById("player-screen").getAttribute("aria-busy") !==
      "true",
  );
  assert.equal(
    await page.locator("#player-title").textContent(),
    "Queen, 北 <script>",
  );
  await page.locator("#player-castle").click();
  assert.ok((await page.locator("#catalog-grid .castle-card").count()) > 90);
  assert.deepEqual(
    await page.locator("#catalog-category option").allTextContents(),
    [
      "All castles",
      "Culture",
      "Activity",
      "Collection",
      "Excellent",
      "Champion",
    ],
  );
  await page.locator("#catalog-category").selectOption("excellent");
  assert.equal(
    await page.locator('#catalog-grid [data-family="keep-verona"]').count(),
    2,
  );
  assert.equal(
    await page
      .locator('#catalog-grid [data-family="keep-silver-wonder"]')
      .count(),
    2,
  );
  assert.equal(
    await page
      .locator('#catalog-grid [data-family="keep-golden-castle"]')
      .count(),
    0,
  );
  await page.locator("#catalog-search").fill("Verona");
  assert.deepEqual(
    await page.locator("#catalog-grid strong").allTextContents(),
    ["Verona – Dawn", "Verona – Night"],
  );
  assert.equal(await page.locator("#catalog-grid small").count(), 0);
  await page
    .locator('#catalog-grid [data-family="keep-verona"]')
    .first()
    .click();
  await page.waitForFunction(
    () =>
      document.getElementById("player-screen").getAttribute("aria-busy") !==
      "true",
  );
  assert.equal(await page.locator("#variant-dialog").isVisible(), false);
  await page.locator("#player-castle").click();
  await page.locator("#catalog-category").selectOption("champion");
  assert.equal(
    await page
      .locator('#catalog-grid [data-family="keep-arcanum-athenaeum"]')
      .count(),
    2,
  );
  assert.equal(
    await page
      .locator('#catalog-grid [data-family="keep-shushan-peak"]')
      .count(),
    2,
  );
  assert.equal(
    await page.locator('#catalog-grid [data-family="keep-verona"]').count(),
    0,
  );
  await page.locator("#catalog-category").selectOption("activity");
  assert.equal(
    await page
      .locator('#catalog-grid [data-family="keep-golden-castle"]')
      .count(),
    1,
  );
  assert.equal(
    await page.locator('#catalog-grid [data-family^="culture-"]').count(),
    0,
  );
  for (const category of ["collection", "excellent", "champion"]) {
    await page.locator("#catalog-category").selectOption(category);
    assert.equal(
      await page.locator('#catalog-grid [data-family^="culture-"]').count(),
      0,
    );
  }
  await page.locator("#catalog-category").selectOption("culture");
  assert.equal(
    await page.locator('#catalog-grid [data-family^="culture-"]').count(),
    7,
  );
  await page.locator('[data-family="culture-europe"]').click();
  await page.waitForFunction(
    () =>
      document.getElementById("player-screen").getAttribute("aria-busy") !==
      "true",
  );
  assert.equal(await page.locator("#variant-dialog").isVisible(), false);
  await page.locator("#player-level").fill("5");
  await page.locator("#player-form [type=submit]").click();
  await page.waitForFunction(
    () =>
      document.getElementById("player-screen").getAttribute("aria-busy") !==
      "true",
  );
  await page.locator("#player-castle").click();
  await page.locator("#catalog-search").fill("Europe");
  assert.match(
    await page
      .locator('#catalog-grid [data-family="culture-europe"]')
      .getAttribute("data-asset"),
    /castle_lv1$/,
  );
  await page.locator('#catalog-grid [data-family="culture-europe"]').click();
  await page.waitForFunction(
    () =>
      document.getElementById("player-screen").getAttribute("aria-busy") !==
      "true",
  );
  await page.locator("#player-level").fill("40");
  await page.locator("#player-form [type=submit]").click();
  await page.waitForFunction(
    () =>
      document.getElementById("player-screen").getAttribute("aria-busy") !==
      "true",
  );
  await page.locator("#player-castle").click();
  await page.locator("#catalog-search").fill("Europe");
  assert.match(
    await page
      .locator('#catalog-grid [data-family="culture-europe"]')
      .getAttribute("data-asset"),
    /castle_lv8$/,
  );
  await page.locator('#catalog-grid [data-family="culture-europe"]').click();
  await page.waitForFunction(
    () =>
      document.getElementById("player-screen").getAttribute("aria-busy") !==
      "true",
  );
  await page.locator("#player-castle").click();
  await page.locator("#catalog-category").selectOption("collection");
  assert.ok((await page.locator(".castle-card").count()) > 10);
  await page.locator("#catalog-search").fill("Thebes");
  assert.equal(await page.locator("#catalog-grid .castle-card").count(), 1);
  await page.locator("#catalog-grid .castle-card").click();
  assert.equal(await page.locator("#variant-grid .castle-card").count(), 3);
  await page.locator("#variant-grid .castle-card").last().click();
  await page.locator("#player-save").click();
  await page.waitForFunction(
    () =>
      document.getElementById("player-screen").getAttribute("aria-busy") !==
      "true",
  );
  await formationScreen();
  assert.equal(await page.locator("#players-screen").isVisible(), false);
  assert.equal(await page.locator("#add-player").isVisible(), false);
  assert.equal(await page.locator("#player-account").isVisible(), false);
  await page.locator("#entity-x").fill("400");
  await page.locator("#entity-y").fill("401");
  await page.locator("#entity-locked").check();
  await page.locator("#entity-form [type=submit]").click();
  await formationScreen();
  await page.locator("#auto-place").click();
  assert.equal(await page.locator("#entity-x").inputValue(), "400");
  // IndexedDB survives a reload, including string IDs and the selected sprite.
  await page.waitForTimeout(600);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#loading").waitFor({ state: "hidden" });
  await page.locator("#google-login:not([disabled])").waitFor();
  assert.equal(await page.locator("#projects-screen").isVisible(), false);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("evony-last-account")),
    null,
  );
  await page.locator("#google-login").click();
  await page.locator("#planner").waitFor({ state: "visible" });
  await playersScreen();
  await page.locator("#players .player-card").first().click();
  assert.equal(
    await page.locator("#player-account").inputValue(),
    "001234567890123456789",
  );
  assert.equal(await page.locator("#entity-x").inputValue(), "400");
}
