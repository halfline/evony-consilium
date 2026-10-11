import assert from "node:assert/strict";
import { mockGoogleDrive } from "../drive-mock.js";

export async function signInFeedback({
  browser,
  base = "http://127.0.0.1:4174",
}) {
  const context = await browser.newContext();
  const errors = [];
  try {
    await mockGoogleDrive(context);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    await page.locator("#google-login:not([disabled])").waitFor();
    const nextResponse = (response) =>
      page.evaluate((response) => {
        const oauth = window.google.accounts.oauth2;
        const original = oauth.initTokenClient;
        oauth.initTokenClient = (options) => ({
          requestAccessToken() {
            oauth.initTokenClient = original;
            if (response.type) options.error_callback(response);
            else options.callback(response);
          },
        });
      }, response);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await nextResponse({ type: "popup_closed" });
      await page.locator("#google-login").click();
      await page.locator("#entry-progress").waitFor({ state: "hidden" });
      assert.equal(await page.locator("#login-screen").isVisible(), true);
      assert.equal(await page.locator("#entry-error").textContent(), "");
      assert.equal(await page.locator("#toast").isVisible(), false);
      assert.equal(await page.locator("#google-login").isEnabled(), true);
    }
    await nextResponse({
      access_token: "test-token",
      expires_in: 3600,
      scope: "openid email profile",
    });
    await page.locator("#google-login").click();
    await page.locator("#google-grant-access").waitFor({ state: "visible" });
    assert.match(
      await page.locator("#entry-error").textContent(),
      /Team access wasn’t granted/,
    );
    assert.equal(await page.locator("#toast").isVisible(), false);
    await page.locator("#google-grant-access").click();
    await page.locator("#projects-screen").waitFor({ state: "visible" });
    assert.equal(await page.locator("#entry-error").textContent(), "");

    // Cancelling an account switch keeps the current account and team open.
    await page.locator("#project-tab-create").click();
    await page.locator("#project-name").fill("Keep this team open");
    await page.locator("[form=project-create]").click();
    await page.locator("#planner").waitFor({ state: "visible" });
    const team = new URL(page.url()).hash;
    const identity = await page.locator("#account-email").textContent();
    await page.locator("#account-menu summary").click();
    await nextResponse({ type: "popup_closed" });
    await page.locator("#switch-account").click();
    await page.locator("#entry-progress").waitFor({ state: "hidden" });
    assert.equal(await page.locator("#planner").isVisible(), true);
    assert.equal(new URL(page.url()).hash, team);
    assert.equal(await page.locator("#account-email").textContent(), identity);
    assert.equal(await page.locator("#toast").isVisible(), false);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}

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
    "Save team",
  );
  assert.equal(await page.locator("#drive-save").isDisabled(), true);
  assert.equal(await page.locator("#players .player-card").count(), 0);
  assert.equal(await page.locator("#project-screen").isVisible(), true);
  assert.equal(await page.locator("#add-player-dialog").isVisible(), false);
  await page.locator('[data-screen="players"]').click();
  return { projectLogo };
}
