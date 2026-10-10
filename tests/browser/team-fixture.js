import { readFile } from "node:fs/promises";
import { TeamStore } from "../../web/src/application/team-store.js";
import assert from "node:assert/strict";
import { assetFile } from "./asset-file.js";

// Change the shared document through the mocked transport, then use real reload controls.
export async function loadTeamFixture(page, driveFiles, plan) {
  const record = [...driveFiles.values()].find(
    (entry) => entry.data?.format === "evony-consilium-team",
  );
  assert.ok(record, "The scenario needs an open shared team");
  const catalog = JSON.parse(await readFile(assetFile("catalog.json"), "utf8"));
  const store = new TeamStore(catalog);
  const title = `${plan.title} (fixture ${record.file.version})`;
  store.replace({ ...plan, title });
  record.data.plan = structuredClone(store.plan);
  record.file.version = String(Number(record.file.version) + 1);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForFunction(
    (title) =>
      document.getElementById("plan-title").value === title ||
      !document.getElementById("project-reload").hidden,
    title,
  );
  if (await page.locator("#project-reload").isVisible()) {
    const accept = (dialog) => dialog.accept();
    page.once("dialog", accept);
    await page.locator("#project-reload").click();
    page.off("dialog", accept);
  }
  await page.waitForFunction(
    (title) =>
      document.getElementById("plan-title").value === title &&
      document.getElementById("drive-save").disabled,
    title,
  );
}
