import assert from "node:assert/strict";

export async function formationRally({ page, driveFiles }) {
  const choice = page.locator("#formation-players .rally-star:not(.active)");
  assert.equal(await choice.count(), 1);
  await page.mouse.move(0, 0);
  assert.equal(await choice.evaluate((button) => getComputedStyle(button).opacity), "0");
  await choice.locator("xpath=..").hover();
  assert.equal(await choice.evaluate((button) => getComputedStyle(button).opacity), "1");
  const tile = choice.locator("xpath=..");
  await tile.locator(".players-row").dispatchEvent("pointerdown", {
    pointerType: "touch", clientX: 20, clientY: 20,
  });
  await page.waitForTimeout(600);
  assert.equal(await tile.evaluate((element) => element.classList.contains("rally-actions-open")), true);
  const name = (await choice.getAttribute("aria-label")).replace(/^Make | rally setter$/g, "");
  await choice.click();
  assert.equal(await page.locator("#formation-players .rally-star.active").count(), 1);
  await page.locator("#drive-save").click();
  let plan;
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    plan = team?.data.plan;
    if (plan?.rallyManual && plan.keeps.find(({ id }) => id === plan.rallyId)?.name === name)
      break;
    await page.waitForTimeout(50);
  }
  assert.equal(plan.rallyManual, true);
  assert.equal(plan.keeps.find(({ id }) => id === plan.rallyId)?.name, name);
  const map = plan.maps.find(({ id }) => id === plan.activeMapId);
  assert.equal(map.layout.rallyId, plan.rallyId);
}
