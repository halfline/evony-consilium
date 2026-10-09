import { entryWorkflow } from "./browser/entry.js";
import { playerRoster } from "./browser/player-roster.js";
import { playerProfileEarly } from "./browser/player-profile-early.js";
import { playerAvatarChange } from "./browser/player-avatar-change.js";
import { playerRemove } from "./browser/player-remove.js";
import { playerBuffs } from "./browser/player-buffs.js";
import { playerMarchSize } from "./browser/player-march-size.js";
import { playerRallyCapacity } from "./browser/player-rally-capacity.js";
import { playerMarchList } from "./browser/player-march-list.js";
import { playerMarchManual } from "./browser/player-march-manual.js";
import { playerMarchSettings } from "./browser/player-march-settings.js";
import { playerMarchReset } from "./browser/player-march-reset.js";
import { playerMarchType } from "./browser/player-march-type.js";
import { playerMarchShares } from "./browser/player-march-shares.js";
import { playerBaseLayers } from "./browser/player-base-layers.js";
import { playerMarchTiers } from "./browser/player-march-tiers.js";
import { playerFileUnlock } from "./browser/player-file-unlock.js";
import { playerFileResolution } from "./browser/player-file-resolution.js";
import { playerProfileUnlock } from "./browser/player-profile-unlock.js";
import { playerFileConflicts } from "./browser/player-file-conflicts.js";
import { subcityRegistry } from "./browser/subcity-registry.js";
import { subcityEdit } from "./browser/subcity-edit.js";
import { subcityRemove } from "./browser/subcity-remove.js";
import { subcityCategory } from "./browser/subcity-category.js";
import { subcityColor } from "./browser/subcity-color.js";
import { subcityOwner } from "./browser/subcity-owner.js";
import { playerSubcityOwnership } from "./browser/player-subcity-ownership.js";
import { playerSubcityCreate } from "./browser/player-subcity-create.js";
import { subcityOwnerSearch } from "./browser/subcity-owner-search.js";
import { mapList } from "./browser/map-list.js";
import { mapSwitch } from "./browser/map-switch.js";
import { mapRemove } from "./browser/map-remove.js";
import { mapZoom } from "./browser/map-zoom.js";
import { subcityLocate } from "./browser/subcity-locate.js";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mockGoogleDrive } from "./drive-mock.js";
const server = spawn(process.execPath, ["scripts/serve.js"], {
  env: { ...process.env, PORT: "4174" },
  stdio: "ignore",
});
let browser, debugPage;
try {
  await new Promise((r) => setTimeout(r, 500));
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  await context.addInitScript(() =>
    performance.setResourceTimingBufferSize(5000),
  );
  const driveFiles = await mockGoogleDrive(context);
  const page = await context.newPage(),
    errors = [],
    badResponses = [];
  debugPage = page;
  const playersScreen = () => page.locator('[data-screen="players"]').click();
  const formationScreen = async () => {
    if (await page.locator("#formation-screen").isVisible()) return;
    await page.locator('[data-screen="maps"]').click();
    if (await page.locator("#add-map-dialog").isVisible())
      await page.locator('#add-map-form button[type="submit"]').click();
    else await page.locator("#maps-list .map-row").first().click();
  };
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (res) => {
    if (res.url().startsWith("http://127.0.0.1") && res.status() >= 400)
      badResponses.push(res.url());
  });
  const { projectLogo } = await entryWorkflow({ page, context });
  await playerRoster({ page, driveFiles });
  await playerProfileEarly({ page, driveFiles });
  await playerAvatarChange({ page, driveFiles });
  await playerRemove({ page, driveFiles });
  await playerBuffs({ page, driveFiles });
  await playerMarchSize({ page, driveFiles });
  await playerRallyCapacity({ page, driveFiles });
  await playerMarchList({ page, driveFiles });
  await playerMarchManual({ page, driveFiles });
  await playerMarchSettings({ page, driveFiles });
  await playerMarchReset({ page, driveFiles });
  await playerMarchType({ page, driveFiles });
  await playerMarchShares({ page, driveFiles });
  await playerBaseLayers({ page, driveFiles });
  await playerMarchTiers({ page, driveFiles });
  await playerFileUnlock({ page });
  await playerFileResolution({ page });
  await playerProfileUnlock({ page, driveFiles });
  await playerFileConflicts({ page, driveFiles });
  await subcityRegistry({ page, driveFiles });
  await subcityEdit({ page, driveFiles });
  await subcityRemove({ page, driveFiles });
  await subcityCategory({ page });
  await subcityColor({ page });
  await subcityOwner({ page, driveFiles });
  await playerSubcityOwnership({ page, driveFiles });
  await playerSubcityCreate({ page, driveFiles });
  await subcityOwnerSearch({ page, driveFiles });
  await mapList({ page, driveFiles });
  await mapSwitch({ page });
  await mapZoom({ page });
  await mapRemove({ page, driveFiles });
  await subcityLocate({ page });
  assert.deepEqual(errors, []);
  assert.deepEqual(badResponses, []);
  console.log(
    "Browser checks passed: team entry, linked players, subcities, map creation and switching, and subcity location.",
  );
} catch (error) {
  console.error(
    await debugPage?.evaluate(() => ({
      loading: document.getElementById("loading")?.textContent,
      toast: document.getElementById("toast")?.textContent,
      saveDisabled: document.getElementById("drive-save")?.disabled,
      entry: document.getElementById("entry-error")?.textContent,
      zoom: document.getElementById("zoom-level")?.textContent,
      x: document.getElementById("entity-x")?.value,
      y: document.getElementById("entity-y")?.value,
      resources: performance
        .getEntriesByType("resource")
        .filter((r) => r.name.includes("knighthall"))
        .map((r) => r.name),
    })),
  );
  throw error;
} finally {
  await browser?.close();
  server.kill();
}
