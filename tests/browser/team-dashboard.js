import assert from "node:assert/strict";

export async function teamDashboard({ page, driveFiles, projectLogo }) {
  const watchedFormation = [...driveFiles.values()].find(
    (r) => r.file.name === "team.consilium.json",
  );
  // A revision-only change after our upload must leave Save disabled.
  watchedFormation.file.version = String(
    Number(watchedFormation.file.version) + 1,
  );
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("alt=media")),
    page.evaluate(() => window.dispatchEvent(new Event("focus"))),
  ]);
  await page.waitForTimeout(100);
  assert.equal(
    await page.locator("#drive-save").getAttribute("aria-label"),
    "Save",
  );
  assert.equal(await page.locator("#drive-save").isDisabled(), true);
  const remoteVersion = String(Number(watchedFormation.file.version) + 1);
  watchedFormation.data.plan.title = "Teammate formation";
  watchedFormation.file.version = remoteVersion;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForFunction(
    () => !document.getElementById("drive-save").disabled,
  );
  assert.equal(
    await page.locator("#drive-save").getAttribute("aria-label"),
    "Reload",
  );
  assert.equal(await page.locator("#project-reload").isVisible(), true);
  await page.locator("#drive-save").click();
  await page.waitForFunction(
    () =>
      document.getElementById("drive-save").disabled &&
      document.getElementById("drive-save").getAttribute("aria-label") ===
        "Save",
  );
  assert.equal(watchedFormation.file.version, remoteVersion);
  assert.equal(await page.locator("#project-reload").isVisible(), false);
  await page.locator('[data-screen="project"]').click();
  assert.equal(await page.locator("#project-screen").isVisible(), true);
  assert.equal(
    await page.locator("#team-player-count").textContent(),
    String(await page.locator("#players .player-card").count()),
  );
  assert.equal(
    await page.locator("#team-map-count").textContent(),
    String(await page.locator("#maps-list .map-row").count()),
  );
  await page.locator("#team-discord-url").fill("javascript:alert(1)");
  await page.locator("#team-discord-url").dispatchEvent("change");
  assert.equal(
    await page.locator("#team-discord-url").getAttribute("aria-invalid"),
    "true",
  );
  assert.equal(await page.locator("#team-discord-open").isVisible(), false);
  await page.locator("#team-discord-url").fill("discord.gg/consilium");
  await page.locator("#team-discord-url").dispatchEvent("change");
  assert.equal(
    await page.locator("#team-discord-open").getAttribute("href"),
    "https://discord.gg/consilium",
  );
  assert.equal(await page.locator("#team-discord-url").isVisible(), false);
  await page.locator("#team-discord-open").hover();
  await page.locator("#team-discord-remove").click();
  assert.equal(await page.locator("#team-discord-url").isVisible(), true);
  assert.equal(await page.locator("#team-discord-open").isVisible(), false);
  await page.locator("#undo").click();
  assert.equal(
    await page.locator("#team-discord-open").getAttribute("href"),
    "https://discord.gg/consilium",
  );

  await page
    .locator('#edit-project-logo [data-logo="preview"]')
    .evaluate((image) => image.decode());
  await page.screenshot({ path: "test-results/project-screen.png" });
  assert.equal(await page.locator("#formation-screen").isVisible(), false);
  await page.locator("#edit-project-name").fill("Renamed team");
  await page.locator("#edit-project-name").dispatchEvent("change");
  assert.equal(await page.locator("#plan-title").inputValue(), "Renamed team");
  await page.mouse.move(0, 0);
  assert.equal(
    await page
      .locator('#edit-project-logo [data-logo="remove"]')
      .evaluate((el) => getComputedStyle(el).opacity),
    "0",
  );
  await page
    .locator('#edit-project-logo [data-logo="upload"]')
    .dispatchEvent("pointerdown", { pointerType: "touch" });
  await page.waitForTimeout(650);
  await page
    .locator('#edit-project-logo [data-logo="upload"]')
    .dispatchEvent("pointerup", { pointerType: "touch" });
  await page
    .locator('#edit-project-logo [data-logo="upload"]')
    .dispatchEvent("click");
  assert.equal(await page.locator(".logo-actions-open").count(), 1);
  await page.mouse.click(0, 0);
  await page.locator('#edit-project-logo [data-logo="upload"]').hover();
  await page.locator('#edit-project-logo [data-logo="remove"]').click();
  assert.equal(
    await page.locator('#edit-project-logo [data-logo="preview"]').isVisible(),
    false,
  );
  await page
    .locator('#edit-project-logo [data-logo="file"]')
    .setInputFiles("web/assets/terrain/worldmap1-75.webp");
  await page
    .locator('#edit-project-logo [data-logo="preview"]')
    .waitFor({ state: "visible" });
  projectLogo = await page
    .locator('#edit-project-logo [data-logo="preview"]')
    .getAttribute("src");
  await page.locator("#drive-save").click();
  await page.waitForFunction(
    () =>
      document.getElementById("drive-save").disabled &&
      document.getElementById("drive-save").getAttribute("aria-label") ===
        "Save",
  );
  await page.locator("#project-back").click();
  assert.equal(
    watchedFormation.data.plan.discordUrl,
    "https://discord.gg/consilium",
  );
  assert.equal(
    await page.locator("#project-tab-teams").getAttribute("aria-selected"),
    "true",
  );
  assert.match(
    await page.locator("#project-list .project-row").first().textContent(),
    /Renamed team/,
  );
  await page
    .locator("#project-list .project-logo")
    .waitFor({ state: "visible" });
  assert.equal(
    await page
      .locator("#project-list .project-logo")
      .first()
      .getAttribute("src"),
    projectLogo,
  );
  await page.mouse.click(0, 0);
  assert.equal(await page.locator(".team-forget").first().textContent(), "×");
  assert.equal(
    await page
      .locator(".team-forget")
      .first()
      .evaluate((el) => getComputedStyle(el).opacity),
    "0",
  );
  const teamTile = page.locator("#project-list .project-row button").first();
  await teamTile.dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: 10,
    clientY: 10,
  });
  await page.waitForTimeout(700);
  await teamTile.dispatchEvent("pointerup", { pointerType: "touch" });
  await teamTile.dispatchEvent("click");
  assert.equal(await page.locator(".team-actions-open").count(), 1);
  assert.equal(await page.locator("#projects-screen").isVisible(), true);
  await page.mouse.click(0, 0);
  await page.locator("#project-list .team-portrait").first().hover();
  await page.waitForTimeout(200);
  assert.equal(
    await page
      .locator(".team-forget")
      .first()
      .evaluate((el) => getComputedStyle(el).opacity),
    "1",
  );
  const folder = [...driveFiles.values()].find(
    (r) => r.file.mimeType === "application/vnd.google-apps.folder",
  ).file;
  await page.locator("#project-tab-open").click();
  await page
    .locator("#project-url")
    .fill(`https://drive.google.com/drive/folders/${folder.id}`);
  for (const entry of driveFiles.values())
    if (entry.file.parents?.includes(folder.id))
      driveFiles.grants.delete(entry.file.id);
  await page.evaluate(() => (window.__pickerCancelNext = true));
  await page.locator("[form=project-join]").click();
  await page.waitForFunction(
    () => !document.getElementById("entry").hasAttribute("aria-busy"),
  );
  assert.equal(await page.locator("#projects-screen").isVisible(), true);
  assert.equal(await page.locator("#entry-error").textContent(), "");
  const cloudFileCount = driveFiles.size;
  // A teammate's folder grant does not reveal its previously created files.
  for (const entry of driveFiles.values())
    if (entry.file.parents?.includes(folder.id))
      driveFiles.grants.delete(entry.file.id);
  await page.locator("[form=project-join]").click();
  await page.locator("#planner").waitFor({ state: "visible" });
  assert.ok(
    await page.evaluate(() => window.__pickerCalls.some((call) => call.parent)),
  );
  assert.equal(driveFiles.size, cloudFileCount);
  assert.equal(
    await page.evaluate(() => window.__oauthOptions.include_granted_scopes),
    false,
  );
}
