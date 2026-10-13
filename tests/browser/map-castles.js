import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mockGoogleDrive } from "../drive-mock.js";
import { createDemoPlan } from "../../web/src/domain/plan.js";
import { captureLayout } from "../../web/src/domain/layout.js";
import { assetFile } from "./asset-file.js";
import { loadTeamFixture } from "./team-fixture.js";

export async function mapCastles({ browser, base = "http://127.0.0.1:4174" }) {
  const context = await browser.newContext();
  const errors = [];
  try {
    const files = await mockGoogleDrive(context);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    await page.locator("#google-login:not([disabled])").click();
    await page.locator("#project-tab-create").click();
    await page.locator("#project-name").fill("Castle tactics");
    await page.locator("[form=project-create]").click();
    await page.locator("#planner").waitFor({ state: "visible" });
    const catalog = JSON.parse(
      await readFile(assetFile("catalog.json"), "utf8"),
    );
    const plan = createDemoPlan(catalog);
    plan.map = "blank";
    plan.keeps = plan.keeps.slice(0, 1);
    const playerId = plan.keeps[0].id;
    plan.keeps[0].x = plan.keeps[0].y = 100;
    plan.maps = [
      {
        id: "first",
        name: "Large castle tactic",
        type: "blank",
        layout: captureLayout(plan),
      },
    ];
    plan.activeMapId = "first";
    await loadTeamFixture(page, files, plan);
    const team = [...files.values()].find(
      (entry) => entry.data?.format === "evony-consilium-team",
    );
    const profileSkin = team.data.plan.keeps[0].skin;
    const large = catalog.assets.find(
      (asset) => asset.id === "map-castle_model-town_magicacademy2026",
    );
    assert.equal(large.footprint, 3);
    async function openMap(name) {
      await page.locator('[data-screen="maps"]').click();
      await page
        .locator("#maps-list .map-row")
        .filter({ hasText: name })
        .click();
      await page
        .locator(`#formation-players [data-entity="${playerId}"]`)
        .click();
    }
    async function save() {
      await page.locator("#drive-save").click();
      await page.waitForFunction(
        () =>
          document.getElementById("drive-save").disabled &&
          document.getElementById("drive-save").getAttribute("aria-busy") ===
            "false",
      );
    }
    await openMap("Large castle tactic");
    await page.locator("#choose-building-skin").click();
    await page.locator("#catalog-search").fill(large.name);
    const choice = page.locator(`#catalog-grid [data-asset="${large.id}"]`);
    assert.match(await choice.textContent(), /3 × 3 tiles/);
    await choice.click();
    assert.equal(await page.locator("#entity-w").inputValue(), "3");
    assert.equal(await page.locator("#entity-h").inputValue(), "3");
    assert.match(
      await page.locator("#map-castle-note").textContent(),
      /only on this map/,
    );
    await page.waitForFunction(
      (src) =>
        performance
          .getEntriesByType("resource")
          .some((entry) => entry.name.endsWith(src)),
      large.src,
    );
    await save();
    assert.equal(team.data.plan.keeps[0].skin, profileSkin);
    assert.equal(
      team.data.plan.maps[0].layout.positions[0].castleOverride,
      large.id,
    );
    await page.locator('[data-screen="maps"]').click();
    await page.locator("#add-map").click();
    await page.locator("#new-formation-type").selectOption("blank");
    await page.locator("#new-formation-name").fill("Small castle tactic");
    await page.locator('#add-map-form button[type="submit"]').click();
    await page
      .locator(`#formation-players [data-entity="${playerId}"]`)
      .click();
    assert.equal(await page.locator("#entity-w").inputValue(), "2");
    assert.equal(await page.locator("#use-player-castle").isVisible(), false);
    await save();
    await openMap("Large castle tactic");
    assert.equal(await page.locator("#entity-w").inputValue(), "3");
    await page.screenshot({ path: "test-results/map-castle-override.png" });
    await page.locator('[data-screen="players"]').click();
    await page.locator("#players .player-card").first().click();
    const profileAsset = catalog.assets.find(
      (asset) => asset.id === profileSkin,
    );
    assert.equal(
      await page.locator("#player-castle img").getAttribute("src"),
      profileAsset.previewSrc || profileAsset.src,
    );
    await page.reload();
    await page.locator("#google-login:not([disabled])").click();
    await page.locator("#planner").waitFor({ state: "visible" });
    await openMap("Small castle tactic");
    assert.equal(await page.locator("#entity-w").inputValue(), "2");
    await openMap("Large castle tactic");
    assert.equal(await page.locator("#entity-w").inputValue(), "3");
    await page.locator("#use-player-castle").click();
    assert.equal(await page.locator("#entity-w").inputValue(), "2");
    assert.equal(await page.locator("#use-player-castle").isVisible(), false);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}
