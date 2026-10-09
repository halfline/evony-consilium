import { readFile } from "node:fs/promises";
import { TeamStore } from "../../web/src/application/team-store.js";
import assert from "node:assert/strict";
import { assetFile } from "./asset-file.js";

// Change the shared document through the mocked transport, then use real reload controls.
export async function loadTeamFixture(page, driveFiles, plan) {
  const record = [...driveFiles.values()].find(
    (entry) => entry.file.name === "team.consilium.json",
  );
  assert.ok(record, "The scenario needs an open shared team");
  const catalog = JSON.parse(await readFile(assetFile("catalog.json"), "utf8"));
  const store = new TeamStore(catalog);
  store.replace(plan);
  record.data.plan = structuredClone(store.plan);
  record.file.version = String(Number(record.file.version) + 1);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.locator("#project-reload").waitFor({ state: "visible" });
  await page.locator("#project-reload").click();
  await page.waitForFunction(
    (title) =>
      document.getElementById("plan-title").value === title &&
      document.getElementById("drive-save").disabled,
    plan.title,
  );
}
