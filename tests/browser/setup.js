import assert from "node:assert/strict";

export async function unconfiguredDeployment({ browser }) {
  const unconfigured = await browser.newContext();
  await unconfigured.route("**/google-config.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'export const googleConfig={clientId:"",apiKey:"",appId:""};',
    }),
  );
  const setupPage = await unconfigured.newPage();
  await setupPage.goto("http://127.0.0.1:4174");
  await setupPage
    .locator("#login-detail")
    .filter({ hasText: /not configured/ })
    .waitFor();
  assert.equal(await setupPage.locator("#google-login").isDisabled(), true);
  assert.match(
    await setupPage.locator("#login-detail").textContent(),
    /not configured/,
  );
  assert.equal(await setupPage.locator("#planner").isVisible(), false);
  await unconfigured.close();
}

export async function unavailableResources({ browser }) {
  for (const [url, message] of [
    ["**/assets/catalog.json", /graphics catalog/],
    ["**/assets/terrain/manifest.json", /terrain/],
  ]) {
    const context = await browser.newContext();
    await context.route(url, (route) =>
      route.fulfill({ status: 503, body: "Unavailable" }),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:4174");
    await page.locator("#login-detail").filter({ hasText: message }).waitFor();
    assert.match(await page.locator("#login-detail").textContent(), message);
    assert.equal(await page.locator("#google-login").isDisabled(), true);
    assert.equal(await page.locator("#planner").isVisible(), false);
    assert.deepEqual(errors, []);
    await context.close();
  }
}
