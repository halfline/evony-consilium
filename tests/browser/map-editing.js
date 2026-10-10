import { loadTeamFixture } from "./team-fixture.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDemoPlan } from "../../web/src/domain/plan.js";
import { assetFile } from "./asset-file.js";

export async function mapEditing({
  page,
  playersScreen,
  formationScreen,
  driveFiles,
  projectLogo,
}) {
  const c = JSON.parse(await readFile(assetFile("catalog.json"), "utf8"));
  const sample = createDemoPlan(c);
  sample.map = "blank";
  sample.projectLogo = projectLogo;
  sample.keeps = sample.keeps.slice(0, 2);
  sample.keeps[0].x = 600;
  sample.keeps[0].y = 600;
  sample.keeps[1].x = 608;
  sample.keeps[1].y = 608;
  await loadTeamFixture(page, driveFiles, sample);
  assert.equal(await page.locator("#players .player-card").count(), 2);
  await playersScreen();
  await page.locator("#players .player-card").first().click();
  // A direct coordinate collision must leave the committed position intact.
  await formationScreen();
  await page.locator("#entity-x").fill("608");
  await page.locator("#entity-y").fill("608");
  await page.locator("#entity-form [type=submit]").click();
  assert.match(await page.locator("#toast").textContent(), /overlaps/);
  await playersScreen();
  await page.locator("#players .player-card").first().click();
  assert.equal(await page.locator("#entity-x").inputValue(), "600");
  await formationScreen();
  await page.locator("#reset-view").click();
  const doubleClickBox = await page.locator("#map").boundingBox();
  await page.mouse.dblclick(
    doubleClickBox.x + doubleClickBox.width / 2,
    doubleClickBox.y + doubleClickBox.height / 2 - 50,
  );
  assert.equal(await page.locator("#player-screen").isVisible(), true);
  assert.equal(
    await page.locator("#player-name").inputValue(),
    sample.keeps[0].name,
  );
  assert.equal(await page.locator("#formation-screen").isVisible(), false);
  await formationScreen();
  // Drag an isolated castle four tiles along the X coordinate axis.
  await formationScreen();
  await page.locator("#reset-view").click();
  await playersScreen();
  await page.locator("#players .player-card").first().click();
  await page.waitForTimeout(200);
  await formationScreen();
  const mapBox = await page.locator("#map").boundingBox();
  await page.mouse.move(
    mapBox.x + mapBox.width / 2,
    mapBox.y + mapBox.height / 2 - 50,
  );
  await page.mouse.down();
  await page.mouse.move(
    mapBox.x + mapBox.width / 2 + 192,
    mapBox.y + mapBox.height / 2 + 46,
    { steps: 8 },
  );
  await page.mouse.up();
  assert.equal(await page.locator("#entity-x").inputValue(), "604");
  assert.equal(await page.locator("#entity-y").inputValue(), "600");
  await page.locator("#undo").click();
  assert.equal(await page.locator("#entity-x").inputValue(), "600");
  // Leaving a map cancels a gesture instead of applying it to a later screen.
  await page.locator("#reset-view").click();
  const interruptedBox = await page.locator("#map").boundingBox();
  await page.mouse.move(
    interruptedBox.x + interruptedBox.width / 2,
    interruptedBox.y + interruptedBox.height / 2 - 50,
  );
  await page.mouse.down();
  await page.mouse.move(
    interruptedBox.x + interruptedBox.width / 2 + 192,
    interruptedBox.y + interruptedBox.height / 2 + 46,
    { steps: 8 },
  );
  await page
    .locator('[data-screen="players"]')
    .evaluate((button) => button.click());
  await page.mouse.up();
  await formationScreen();
  assert.equal(await page.locator("#entity-x").inputValue(), "600");
  assert.equal(await page.locator("#entity-y").inputValue(), "600");
  const playersSize = await page.locator("#players .player-card").count();
  assert.equal(await page.locator("#player-remove").isVisible(), false);
  await page.locator("#reset-view").click();
  const removalBox = await page.locator("#map").boundingBox();
  await page.mouse.move(
    removalBox.x + removalBox.width / 2,
    removalBox.y + removalBox.height / 2 - 50,
  );
  await page.mouse.down();
  await page.mouse.move(
    removalBox.x - 20,
    removalBox.y + removalBox.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  assert.equal(await page.locator("#inspector").isVisible(), false);
  assert.match(
    await page.locator("#formation-players button").first().textContent(),
    /Unplaced/,
  );
  assert.equal(
    await page.locator("#players .player-card").count(),
    playersSize,
  );
  await page.locator("#undo").click();
  await page.locator("#formation-players button").first().click();
  assert.equal(await page.locator("#entity-x").inputValue(), "600");
  await playersScreen();
  await page.locator("#players .player-card").first().click();
  assert.equal(await page.locator("#entity-x").isVisible(), false);
  assert.equal(await page.locator("#player-account").isVisible(), true);
  assert.equal(await page.locator("#player-castle").isVisible(), true);
  await page.screenshot({ path: "test-results/players-screen.png" });
  await formationScreen();
  assert.equal(await page.locator("#new-plan").count(), 0);
  assert.equal(await page.locator("#load-plan").count(), 0);
  await page.locator("#fit-map").click();
  const selectionBox = await page.locator("#map").boundingBox();
  await page.keyboard.down("Shift");
  await page.mouse.move(selectionBox.x + 2, selectionBox.y + 2);
  await page.mouse.down();
  await page.mouse.move(
    selectionBox.x + selectionBox.width - 2,
    selectionBox.y + selectionBox.height - 2,
    { steps: 8 },
  );
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await page.locator("#map").press("Delete");
  assert.equal(
    await page
      .locator("#formation-players button")
      .filter({ hasText: "Unplaced" })
      .count(),
    playersSize,
  );
  assert.equal(
    await page.locator("#players .player-card").count(),
    playersSize,
  );
  await page.locator("#formation-players button").first().click();
  assert.equal(await page.locator("#entity-x").inputValue(), "");
  await page.locator("#undo").click();
  assert.equal(await page.locator("#entity-x").inputValue(), "600");
  await formationScreen();
  if (await page.locator("#close-inspector").isVisible())
    await page.locator("#close-inspector").click();
  await formationScreen();
  await page.locator("#fit-map").click();
  // Seed zero coordinates and Unicode names through the test fixture.
  assert.equal(await page.locator("#import-csv").count(), 0);
  const zeroPlan = structuredClone(sample);
  zeroPlan.keeps.push(
    {
      ...sample.keeps[0],
      id: "zero",
      name: "Zero, 北",
      accountId: "0001",
      x: 0,
      y: 0,
    },
    {
      ...sample.keeps[0],
      id: "new",
      name: "New",
      accountId: "",
      level: 36,
      x: null,
      y: null,
    },
  );
  await loadTeamFixture(page, driveFiles, zeroPlan);
  assert.equal(await page.locator("#players .player-card").count(), 4);
  await playersScreen();
  await page.locator("#players .player-card").nth(2).click();
  assert.equal(await page.locator("#entity-x").inputValue(), "0");
  assert.equal(await page.locator("#player-account").inputValue(), "0001");
  await formationScreen();
  await page.locator("#entity-x").fill("610");
  await page.locator("#entity-y").fill("600");
  await page.locator("#entity-form [type=submit]").click();
  await page.locator("#close-inspector").click();
  await playersScreen();
  await page.locator("#players .player-card").last().click();
  await formationScreen();
  const rect = await page.locator("#map").boundingBox();
  await page.mouse.click(
    rect.x + rect.width / 2 + 180,
    rect.y + rect.height / 2 + 150,
  );
  assert.notEqual(await page.locator("#entity-x").inputValue(), "");
  // Building browsing, placement, and editable footprints.
  await formationScreen();
  await page.locator("[data-tab=hive]").click();
  await page.locator("[data-building=alliance]").click();
  await page.locator("#catalog-search").fill("Chalons Alliance Glory Castle");
  assert.ok((await page.locator("#catalog-grid .castle-card").count()) >= 7);
  await page.locator("#catalog-search").fill("Camelot");
  await page.locator("#catalog-grid .castle-card").click();
  await formationScreen();
  await page.locator("#entity-x").fill("620");
  await page.locator("#entity-y").fill("620");
  await page.locator("#entity-form [type=submit]").click();
  assert.equal(await page.locator("#structure-list button").count(), 1);
  await page.locator("[data-building=warehouse]").click();
  await page.locator(".castle-card").first().click();
  await formationScreen();
  await page.locator("#entity-x").fill("626");
  await page.locator("#entity-y").fill("620");
  await page.locator("#entity-form [type=submit]").click();
  await page.locator("[data-building=resource]").click();
  await page.locator("#catalog-search").fill("food");
  await page.locator(".castle-card").first().click();
  await formationScreen();
  await page.locator("#entity-x").fill("630");
  await page.locator("#entity-y").fill("620");
  await page.locator("#entity-form [type=submit]").click();
  assert.equal(await page.locator("#structure-list button").count(), 3);
  await page.locator("[data-building=objective]").click();
  await page.locator("#catalog-search").fill("Knight");
  assert.equal(await page.locator("#catalog-grid .castle-card").count(), 1);
  assert.equal(
    await page.locator("#catalog-grid .castle-card img").getAttribute("src"),
    "assets/previews/map-battlefield-knighthall.webp",
  );
  await page
    .locator('#catalog-grid [data-asset="map-battlefield-knighthall"]')
    .click();
  assert.equal(await page.locator("#entity-w").inputValue(), "3");
  assert.equal(await page.locator("#entity-h").inputValue(), "3");
  await formationScreen();
  await page.locator("#entity-x").fill("640");
  await page.locator("#entity-y").fill("620");
  assert.equal(await page.locator("#entity-w").getAttribute("readonly"), "");
  assert.equal(await page.locator("#entity-h").getAttribute("readonly"), "");
  await page.locator("#entity-form [type=submit]").click();
  await formationScreen();
  await page.locator("#reset-view").click();
  await page.waitForFunction(() =>
    performance
      .getEntriesByType("resource")
      .some((r) => r.name.endsWith("/assets/map-battlefield-knighthall.webp")),
  );

  assert.equal(await page.locator("#entity-w").inputValue(), "3");
  assert.equal(await page.locator("#entity-h").inputValue(), "3");
  await page.locator("#drive-save").click();
  await page.waitForFunction(
    () =>
      document.getElementById("drive-save").disabled &&
      document.getElementById("drive-save").getAttribute("aria-label") ===
        "Save team",
  );
  assert.equal(
    [...driveFiles.values()]
      .find((r) => r.data?.format === "evony-consilium-team")
      .data.plan.structures.some(
        (r) =>
          r.asset === "map-battlefield-knighthall" ||
          r.skin === "map-battlefield-knighthall",
      ),
    true,
  );
}
