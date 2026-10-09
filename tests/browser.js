import { subcities } from "./browser/subcities.js";
import { playerSharing } from "./browser/player-sharing.js";
import { teamImprovements } from "./browser/team-improvements.js";
import { entryWorkflow } from "./browser/entry.js";
import { playerRoster } from "./browser/player-roster.js";
import { playerProfileEarly } from "./browser/player-profile-early.js";
import { playerAvatarChange } from "./browser/player-avatar-change.js";
import { playerCastleAppearance } from "./browser/player-castle-appearance.js";
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
import { mapToolbar } from "./browser/map-toolbar.js";
import { routeNavigation } from "./browser/route-navigation.js";
import { subcityLocate } from "./browser/subcity-locate.js";
import { mapTerrain } from "./browser/map-terrain.js";
import { formationPlace } from "./browser/formation-place.js";
import { formationPan } from "./browser/formation-pan.js";
import { formationWheelZoom } from "./browser/formation-wheel-zoom.js";
import { formationSelect } from "./browser/formation-select.js";
import { formationDrag } from "./browser/formation-drag.js";
import { mapSubcityOpen } from "./browser/map-subcity-open.js";
import { mapPlayerOpen } from "./browser/map-player-open.js";
import { formationDelete } from "./browser/formation-delete.js";
import { formationDragOff } from "./browser/formation-drag-off.js";
import { formationEscape } from "./browser/formation-escape.js";
import { formationUndo } from "./browser/formation-undo.js";
import { formationNudge } from "./browser/formation-nudge.js";
import { formationGroupClick } from "./browser/formation-group-click.js";
import { formationRubberBand } from "./browser/formation-rubber-band.js";
import { formationGroupDrag } from "./browser/formation-group-drag.js";
import { formationGroupDelete } from "./browser/formation-group-delete.js";
import { formationCancelNavigation } from "./browser/formation-cancel-navigation.js";
import { formationGroupDragOff } from "./browser/formation-group-drag-off.js";
import { formationRally } from "./browser/formation-rally.js";
import { formationInspectorRead } from "./browser/formation-inspector-read.js";
import { formationInspectorCoordinates } from "./browser/formation-inspector-coordinates.js";
import { formationInspectorLock } from "./browser/formation-inspector-lock.js";
import { formationObstacle } from "./browser/formation-obstacle.js";
import { formationObstacleSize } from "./browser/formation-obstacle-size.js";
import { formationObstacleName } from "./browser/formation-obstacle-name.js";
import { formationAllianceBuilding } from "./browser/formation-alliance-building.js";
import { formationWarehouse } from "./browser/formation-warehouse.js";
import { formationResource } from "./browser/formation-resource.js";
import { formationObjective } from "./browser/formation-objective.js";
import { formationArrange } from "./browser/formation-arrange.js";
import { formationBuildingSkin } from "./browser/formation-building-skin.js";
import { formationHelp } from "./browser/formation-help.js";
import { formationDemo } from "./browser/formation-demo.js";
import { mapCoordinates } from "./browser/map-coordinates.js";
import { mapResetView } from "./browser/map-reset-view.js";
import { mapFit } from "./browser/map-fit.js";
import { mapOverview } from "./browser/map-overview.js";
import { mapGrid } from "./browser/map-grid.js";
import { mapLabels } from "./browser/map-labels.js";
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
  await routeNavigation({ page });
  await playerRoster({ page, driveFiles });
  await playerProfileEarly({ page, driveFiles });
  await playerAvatarChange({ page, driveFiles });
  await playerCastleAppearance({ page, driveFiles });
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
  await mapToolbar({ page });
  await mapRemove({ page, driveFiles });
  await subcityLocate({ page });
  await mapTerrain({ page });
  await formationPlace({ page, driveFiles });
  await formationPan({ page });
  await formationWheelZoom({ page });
  await formationSelect({ page });
  await formationInspectorRead({ page, driveFiles });
  await formationDrag({ page, driveFiles });
  await mapSubcityOpen({ page });
  await mapPlayerOpen({ page });
  await formationDelete({ page, driveFiles });
  await formationDragOff({ page, driveFiles });
  await formationEscape({ page });
  await formationUndo({ page });
  await formationNudge({ page, driveFiles });
  await formationGroupClick({ page });
  await formationRally({ page, driveFiles });
  await formationRubberBand({ page });
  await formationGroupDrag({ page, driveFiles });
  await formationGroupDragOff({ page, driveFiles });
  await formationGroupDelete({ page, driveFiles });
  await formationCancelNavigation({ page, driveFiles });
  await formationInspectorCoordinates({ page, driveFiles });
  await formationInspectorLock({ page, driveFiles });
  await formationObstacle({ page, driveFiles });
  await formationObstacleSize({ page, driveFiles });
  await formationObstacleName({ page, driveFiles });
  await formationAllianceBuilding({ page, driveFiles });
  await formationWarehouse({ page, driveFiles });
  await formationResource({ page, driveFiles });
  await formationObjective({ page, driveFiles });
  await formationArrange({ page, driveFiles });
  await formationBuildingSkin({ page, driveFiles });
  await formationHelp({ page });
  await formationDemo({ page, driveFiles });
  await mapCoordinates({ page });
  await mapResetView({ page, driveFiles });
  await mapFit({ page });
  await mapOverview({ page });
  await mapGrid({ page, driveFiles });
  await mapLabels({ page, driveFiles });
  await teamImprovements({ browser });
  await playerSharing({ browser });
  await subcities({ browser });
  assert.deepEqual(errors, []);
  assert.deepEqual(badResponses, []);
  console.log(
    "Browser checks passed: team entry, linked players, subcities, maps, terrain, group actions, and gesture lifecycle.",
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
