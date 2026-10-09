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
  await setupPage.locator("#loading").waitFor({ state: "hidden" });
  assert.equal(await setupPage.locator("#google-login").isDisabled(), true);
  assert.match(
    await setupPage.locator("#login-detail").textContent(),
    /not configured/,
  );
  assert.equal(await setupPage.locator("#planner").isVisible(), false);
  await unconfigured.close();
}
