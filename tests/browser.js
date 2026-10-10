import { playerImport } from "./browser/player-import.js";
import { autosave } from "./browser/autosave.js";
import { teamCollaboration } from "./browser/team-collaboration.js";
import { altOwnership } from "./browser/alts.js";
import { teamImprovements } from "./browser/team-improvements.js";
import { subcityOwnership } from "./browser/subcity-ownership.js";
import { subcities } from "./browser/subcities.js";
import { playerSharing } from "./browser/player-sharing.js";
import { playerDetails } from "./browser/player-details.js";
import { entryWorkflow } from "./browser/entry.js";
import { playerCreation } from "./browser/players.js";
import { mapSelection } from "./browser/maps.js";
import { playerAppearance } from "./browser/player-appearance.js";
import { mapEditing } from "./browser/map-editing.js";
import { teamDashboard } from "./browser/team-dashboard.js";
import { teamSharing } from "./browser/team-sharing.js";
import { terrainAndMobile } from "./browser/terrain.js";
import { sharingAndRecovery } from "./browser/sharing.js";
import {
  unconfiguredDeployment,
  unavailableResources,
} from "./browser/setup.js";
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
  await teamSharing({ browser });
  await playerCreation({ page, playersScreen });
  await altOwnership({ page, playersScreen });
  await playerDetails({ page, playersScreen, driveFiles });
  await mapSelection({ page, playersScreen, driveFiles });
  await playerAppearance({
    page,
    playersScreen,
    formationScreen,
    projectLogo,
    driveFiles,
  });
  await mapEditing({
    page,
    playersScreen,
    formationScreen,
    driveFiles,
    projectLogo,
  });
  await teamDashboard({ page, driveFiles, projectLogo });
  await terrainAndMobile({ page, formationScreen });
  await sharingAndRecovery({ page, driveFiles });
  await playerSharing({ browser });
  await playerImport({ browser });
  await autosave({ browser });
  await teamCollaboration({ browser });
  await subcities({ browser });
  await subcityOwnership({ browser });
  await teamImprovements({ browser });
  await unconfiguredDeployment({ browser });
  await unavailableResources({ browser });
  assert.deepEqual(errors, []);
  assert.deepEqual(badResponses, []);
  console.log(
    "Browser checks passed: Google entry flow (mocked), folder projects, Drive saves/conflicts, 30-second autosave, drafts, alt relationships, sharing, view-only access, setup state, editing, sprites, collisions, player defaults/tags, and mobile.",
  );
} catch (error) {
  console.error(
    await debugPage?.evaluate(() => ({
      loading: document.getElementById("loading").textContent,
      toast: document.getElementById("toast").textContent,
      saveDisabled: document.getElementById("drive-save").disabled,
      entry: document.getElementById("entry-error").textContent,
      zoom: document.getElementById("zoom-level").textContent,
      x: document.getElementById("entity-x").value,
      y: document.getElementById("entity-y").value,
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
