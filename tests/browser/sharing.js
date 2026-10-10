import assert from "node:assert/strict";

export async function sharingAndRecovery({ page, driveFiles }) {
  // A stale Drive revision must retain the local draft and reject the upload.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#plan-title").fill("Unsaved team draft");
  await page.locator("#plan-title").dispatchEvent("change");
  const sharedFormation = [...driveFiles.values()].find(
    (r) => r.data?.format === "evony-consilium-team",
  );
  const remoteTitle = "Teammate updated the shared project";
  sharedFormation.data.plan.title = remoteTitle;
  sharedFormation.file.version = String(
    Number(sharedFormation.file.version) + 1,
  );
  await page.locator("#drive-save").click();
  await page.locator("#team-conflict-dialog").waitFor({ state: "visible" });
  await page.locator('[data-team-resolution="cancel"]').click();
  await page.waitForFunction(
    () => document.getElementById("project-reload").hidden === false,
  );
  assert.equal(sharedFormation.data.plan.title, remoteTitle);
  await page.locator("#project-back").click();
  await page.locator("#project-list .project-row button").first().click();
  await page.locator("#planner").waitFor({ state: "visible" });
  assert.equal(
    await page.locator("#plan-title").inputValue(),
    "Unsaved team draft",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#project-reload").click();
  await page.waitForFunction(
    (title) => document.getElementById("plan-title").value === title,
    remoteTitle,
  );
  sharedFormation.file.capabilities.canEdit = false;
  await page.locator("#project-back").click();
  await page.locator("#project-list .project-row button").first().click();
  await page.locator("#planner").waitFor({ state: "visible" });
  assert.equal(await page.locator("#drive-save").isDisabled(), true);
  assert.equal(
    await page.locator("#edit-project-name").getAttribute("readonly"),
    "",
  );
  assert.equal(await page.locator("#undo").isVisible(), false);
  await page.locator('[data-screen="players"]').click();
  assert.equal(await page.locator("#add-player").isVisible(), false);
  assert.equal(await page.locator(".player-remove").first().isVisible(), false);
  await page.locator("#players .player-card").first().click();
  assert.equal(await page.locator("#player-name").getAttribute("readonly"), "");
  assert.equal(await page.locator("#player-remove").isVisible(), false);
  assert.equal(await page.locator("#player-castle").isDisabled(), true);
  assert.equal(await page.locator("#player-avatar").isDisabled(), true);
  await page.locator('[data-screen="maps"]').click();
  assert.equal(await page.locator("#add-map").isVisible(), false);
  assert.equal(await page.locator(".map-forget").first().isVisible(), false);
  await page.locator('[data-screen="project"]').click();

  assert.equal(await page.locator("#project-copy").count(), 0);
  assert.equal(await page.locator("#save-plan").count(), 0);
  // A pasted folder link opens directly, including the first-time file grants.
  const sharedFolder = [...driveFiles.values()].find(
    (record) => record.file.id === sharedFormation.file.parents[0],
  ).file;
  await page.locator("#project-back").click();
  await page.locator("#project-tab-open").click();
  const beforeOpen = driveFiles.size;
  driveFiles.hideParentMetadata = true;
  for (const record of driveFiles.values())
    if (record.file.parents?.includes(sharedFolder.id))
      driveFiles.grants.delete(record.file.id);
  await page
    .locator("#project-url")
    .fill(`https://drive.google.com/drive/folders/${sharedFolder.id}`);
  await page.locator("[form=project-join]").click();
  await page.locator("#planner").waitFor({ state: "visible" });
  driveFiles.hideParentMetadata = false;
  assert.equal(await page.locator("#project-screen").isVisible(), true);
  assert.equal(await page.locator("#folder-result").count(), 0);
  assert.equal(driveFiles.size, beforeOpen);
  assert.equal(await page.locator("#plan-title").inputValue(), remoteTitle);
  const pickerCalls = await page.evaluate(() => window.__pickerCalls);
  assert.ok(pickerCalls.some((call) => call.parent === sharedFolder.id));
  // A direct file link needs only that file's grant, even without folder access.
  await page.locator("#project-back").click();
  await page.locator("#project-tab-open").click();
  driveFiles.grants.delete(sharedFolder.id);
  driveFiles.grants.delete(sharedFormation.file.id);
  await page
    .locator("#project-url")
    .fill(`https://drive.google.com/file/d/${sharedFormation.file.id}/view`);
  await page.locator("[form=project-join]").click();
  await page.locator("#planner").waitFor({ state: "visible" });
  assert.equal(await page.locator("#plan-title").inputValue(), remoteTitle);
  assert.equal(driveFiles.grants.has(sharedFolder.id), false);
  assert.equal(driveFiles.size, beforeOpen);
  await page.locator("#project-back").click();
  await page.locator("#account-menu summary").click();
  assert.equal(await page.locator("#switch-account").isVisible(), true);
  await page.locator("#sign-out").click();
  await page.locator("#login-screen").waitFor({ state: "visible" });
  await page.screenshot({ path: "test-results/login.png" });
}
