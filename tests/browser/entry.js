import assert from "node:assert/strict";

export async function entryWorkflow({ page, context }) {
  await page.goto("http://127.0.0.1:4174", { waitUntil: "domcontentloaded" });
  await page.locator("#loading").waitFor({ state: "hidden" });
  assert.equal(await page.title(), "Evony Consilium · Alliance war room");
  // A stylesheet can return HTTP 200 while containing the wrong document.
  assert.equal(
    await page
      .locator("#entry")
      .evaluate((element) => getComputedStyle(element).display),
    "flex",
  );
  assert.equal(
    await page
      .locator("#google-login img")
      .evaluate((element) => element.getBoundingClientRect().width),
    24,
  );
  assert.match(
    await page.locator("#entry .brand").textContent(),
    /EVONY\s*CONSILIUM/,
  );
  await page.locator("#google-login:not([disabled])").waitFor();
  assert.equal(await page.locator("#planner").isVisible(), false);
  await page.locator("#google-login").click();
  await page.locator("#projects-screen").waitFor({ state: "visible" });
  assert.equal(await page.locator("#project-panel-open").isVisible(), true);
  assert.equal(await page.locator("#project-panel-create").isVisible(), false);
  assert.equal(await page.locator("#project-list").isVisible(), false);
  await page.locator("#project-tab-open").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page.locator("#project-tab-create").getAttribute("aria-selected"),
    "true",
  );
  assert.equal(await page.locator("#project-panel-open").isVisible(), false);
  await page.locator("#project-name").fill("Team Hive");
  await page
    .locator('#project-logo [data-logo="file"]')
    .setInputFiles("web/assets/branding/consilium.png");
  await page
    .locator('#project-logo [data-logo="preview"]')
    .waitFor({ state: "visible" });
  let projectLogo = await page
    .locator('#project-logo [data-logo="preview"]')
    .getAttribute("src");
  assert.match(projectLogo, /^data:image\/webp;base64,/);
  await page
    .locator('#project-logo [data-logo="preview"]')
    .evaluate((image) => image.decode());
  assert.deepEqual(
    await page
      .locator('#project-logo [data-logo="preview"]')
      .evaluate((image) => [image.naturalWidth, image.naturalHeight]),
    [128, 128],
  );
  let releaseCreation;
  const creationBlocked = new Promise((resolve) => {
    releaseCreation = resolve;
  });
  const holdCreation = async (route) => {
    if (route.request().method() === "POST") await creationBlocked;
    await route.fallback();
  };
  await context.route("https://www.googleapis.com/**", holdCreation);
  await page.locator("[form=project-create]").click();
  await page.locator("#entry-progress").waitFor({ state: "visible" });
  assert.equal(await page.locator("[form=project-create]").isDisabled(), true);
  assert.equal(await page.locator("#project-name").isDisabled(), true);
  assert.equal(await page.locator("#project-tab-open").isDisabled(), true);
  assert.equal(
    await page.locator("#entry-progress-text").textContent(),
    "Creating team…",
  );
  releaseCreation();

  await page.locator("#planner").waitFor({ state: "visible" });
  await context.unroute("https://www.googleapis.com/**", holdCreation);
  assert.equal(await page.locator("#project-screen").isVisible(), true);
  assert.equal(await page.locator("#formation-screen").isVisible(), false);
  assert.equal(await page.locator("#auto-place").isVisible(), false);
  assert.equal(await page.locator("#entry-progress").isVisible(), false);
  assert.equal(await page.locator("[form=project-create]").isDisabled(), false);
  assert.equal(await page.locator("#project-reload").isVisible(), false);
  assert.equal(
    await page.locator("#drive-save").getAttribute("aria-label"),
    "Save",
  );
  assert.equal(await page.locator("#drive-save").isDisabled(), true);
  assert.equal(await page.locator("#players .player-card").count(), 0);
  assert.equal(await page.locator("#project-screen").isVisible(), true);
  assert.equal(await page.locator("#add-player-dialog").isVisible(), false);
  assert.equal(await page.locator('[data-screen="players"]').isVisible(), true);
  for (const screen of ["subcities", "maps"])
    assert.equal(
      await page.locator(`[data-screen="${screen}"]`).isVisible(),
      false,
    );
  assert.equal(await page.locator("#team-players").isVisible(), true);
  for (const id of ["team-subcities", "team-maps"])
    assert.equal(await page.locator(`#${id}`).isVisible(), false);
  await page.locator("#edit-project-name").fill("Renamed Hive");
  await page.locator("#edit-project-name").dispatchEvent("change");
  assert.equal(await page.locator("#drive-save").isDisabled(), false);
  await page.locator("#drive-save").click();
  await page.locator("#drive-save[disabled]").waitFor();
  assert.equal(
    await page.locator("#edit-project-name").inputValue(),
    "Renamed Hive",
  );
  return { projectLogo };
}
