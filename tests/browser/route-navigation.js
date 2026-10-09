import assert from "node:assert/strict";

export async function routeNavigation({ page }) {
  const initial = new URL(page.url());
  const team = new URLSearchParams(initial.hash.slice(1)).get("team");
  assert.ok(team);
  await page.locator('[data-screen="subcities"]').click();
  const opened = new URLSearchParams(new URL(page.url()).hash.slice(1));
  assert.equal(opened.get("team"), team);
  assert.equal(opened.get("screen"), "subcities");
  assert.equal(await page.locator("#subcities-screen").isVisible(), true);
  await page.goBack();
  await page.locator("#project-screen").waitFor({ state: "visible" });
  assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).get("screen"), "project");
  assert.equal(await page.locator("#drive-save").isDisabled(), true);
  const deep = await page.context().newPage();
  const route = new URLSearchParams(initial.hash.slice(1));
  route.set("screen", "subcities");
  await deep.goto(initial.origin + initial.pathname + "#" + route);
  await deep.locator("#loading").waitFor({ state: "hidden" });
  await deep.locator("#google-login:not([disabled])").click();
  await deep.locator("#subcities-screen").waitFor({ state: "visible" });
  assert.equal(new URLSearchParams(new URL(deep.url()).hash.slice(1)).get("team"), team);
  await deep.close();
}
