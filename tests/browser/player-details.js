import assert from "node:assert/strict";

export async function playerDetails({ page, playersScreen, driveFiles }) {
  await playersScreen();
  await page.locator("#players .player-card").first().click();
  await page.waitForFunction(
    () =>
      document.getElementById("player-save-status").textContent ===
      "Player · Saved",
  );
  assert.equal(
    await page.locator("#player-save-status").textContent(),
    "Player · Saved",
  );
  assert.equal(await page.locator("#player-save").isDisabled(), true);
  await page.locator('[data-player-tab="buffs"]').click();
  const focusedBuff = () =>
    page.evaluate(() => document.activeElement?.dataset.buff);
  await page.locator('[data-buff="city.ground.attack"]').focus();
  for (const key of [
    "city.ground.defense",
    "city.ground.hp",
    "city.ranged.attack",
  ]) {
    await page.keyboard.press("Tab");
    assert.equal(await focusedBuff(), key);
  }
  await page.keyboard.press("Shift+Tab");
  assert.equal(await focusedBuff(), "city.ground.hp");
  await page.locator('[data-buff="city.ground.attack"]').fill("-1");
  await page.locator('[data-player-tab="overview"]').click();
  await page.locator("#player-save").click();
  assert.equal(
    await page
      .locator('[data-player-tab="buffs"]')
      .getAttribute("aria-selected"),
    "true",
  );
  assert.equal(
    await page
      .locator('[data-buff="city.ground.attack"]')
      .evaluate((input) => input === document.activeElement),
    true,
  );
  await page.locator('[data-buff="city.ground.attack"]').fill("");
  assert.equal(await page.locator("#player-rally-capacity").isVisible(), false);
  await page.locator('[data-player-tab="rally-capacity"]').click();
  await page.locator("#player-rally-capacity").fill("12000000");
  await page.locator('[data-player-tab="buffs"]').click();
  for (const [context, value] of [
    ["city", "3385"],
    ["rally", "4333"],
    ["solo", "3758"],
  ])
    await page.locator(`[data-buff="${context}.ground.attack"]`).fill(value);
  await page.locator('[data-buff="city.siege.hp"]').fill("0");
  assert.equal(await page.locator("#player-march-boost").count(), 0);
  await page.screenshot({ path: "test-results/player-buffs.png" });
  assert.equal(
    await page.locator("#player-buffs [data-march-size]").count(),
    0,
  );
  await page.locator('[data-player-tab="march-size"]').click();
  assert.match(
    await page.locator("#player-march-sizes").textContent(),
    /March size \(\+200%\)/,
  );
  await page.locator('[data-march-size="ground"]').fill("7936450");
  await page.screenshot({ path: "test-results/player-march-sizes.png" });
  await page.locator('[data-player-tab="troops"]').click();
  assert.deepEqual(await page.locator(".march-card strong").allTextContents(), [
    "Siege",
    "Archers",
    "Mounted",
    "Ground",
  ]);
  assert.equal(await page.locator(".march-card img").count(), 4);
  await page.screenshot({ path: "test-results/player-march-grid.png" });
  await page.locator('.march-card[aria-label="Ground"]').click();
  assert.equal(
    await page.locator('[data-count="ground"]').first().inputValue(),
    "2295435",
  );
  assert.equal(
    await page.locator(".player-march-toolbar #player-march-type").count(),
    0,
  );
  assert.equal(
    await page.locator("#player-troops thead #player-march-type").count(),
    1,
  );
  assert.equal(await page.locator("#player-march-strategy").count(), 0);
  assert.deepEqual(
    await page.locator("#player-march-type option").allTextContents(),
    ["Ground", "Archers", "Mounted", "Siege", "Siege (little)"],
  );
  assert.equal(
    await page
      .locator('[data-tier-row] input[aria-label="Troop tier"]')
      .count(),
    0,
  );
  assert.equal(
    await page.locator('[data-tier-row="15"] th').textContent(),
    "15",
  );
  assert.equal(await page.locator("[data-tier-row] button").count(), 0);
  const tierCell = await page.locator('[data-tier-row="15"] th').boundingBox();
  const countCell = await page
    .locator('[data-tier-row="15"] td')
    .last()
    .boundingBox();
  assert.ok(tierCell.width < 100);
  assert.ok(tierCell.width < countCell.width);
  // Larger numeric inputs remain compact enough for a dense march table.
  assert.ok(tierCell.height <= 56);
  await page.locator("#player-march-type").selectOption("mounted");
  assert.equal(await page.locator('[data-count="ground"]').count(), 0);
  await page.locator("#player-march-type").selectOption("ground");
  assert.equal(await page.locator('[data-count="ranged"]').count(), 0);
  assert.equal(await page.locator('[data-count="mounted"]').count(), 0);
  assert.equal(await page.locator('[data-count="siege"]').count(), 0);
  assert.equal(await page.locator("[data-base]").count(), 4);
  async function defaultSize(value) {
    await page.locator('[data-player-tab="march-size"]').click();
    await page.locator('[data-march-size="ground"]').fill(value);
    await page.locator('[data-player-tab="troops"]').click();
  }
  await page.locator("#player-march-capacity").fill("8000000");
  await page.locator("#player-march-capacity").blur();
  assert.match(
    await page.locator("#player-troop-summary").textContent(),
    /8,000,000 troops · Full/,
  );
  await defaultSize("9000000");
  assert.equal(
    await page.locator("#player-march-capacity").inputValue(),
    "8000000",
  );
  await page.locator("#player-march-capacity-reset").click();
  assert.match(
    await page.locator("#player-troop-summary").textContent(),
    /9,000,000 troops · Full/,
  );
  const beforeManual = await page
    .locator('[data-count="ground"]')
    .evaluateAll((inputs) => inputs.map((input) => input.value));
  await page.locator('[data-tier-row="15"] [data-count="ground"]').fill("123");
  const manualCounts = await page
    .locator('[data-count="ground"]')
    .evaluateAll((inputs) => inputs.map((input) => input.value));
  await defaultSize("9100000");
  assert.deepEqual(
    await page
      .locator('[data-count="ground"]')
      .evaluateAll((inputs) => inputs.map((input) => input.value)),
    manualCounts,
  );
  assert.equal(await page.locator("#player-reset-strategy").isVisible(), true);
  await page.locator("#player-reset-strategy").click();
  assert.match(
    await page.locator("#player-troop-summary").textContent(),
    /9,100,000 troops · Full/,
  );
  assert.notDeepEqual(
    await page
      .locator('[data-count="ground"]')
      .evaluateAll((inputs) => inputs.map((input) => input.value)),
    beforeManual,
  );
  await defaultSize("7936450");
  await page.locator("#player-march-highest").selectOption("14");
  assert.equal(await page.locator('[data-tier-row="15"]').count(), 0);
  assert.match(
    await page.locator("#player-troop-summary").textContent(),
    /7,936,450 troops · Full/,
  );
  await page.locator("#player-march-highest").selectOption("15");
  await page.locator('[data-share="15"]').fill("40");
  await page.locator('[data-share="15"]').blur();
  assert.match(
    await page.locator("#player-troop-summary").textContent(),
    /100%/,
  );
  await page.locator('[data-share="14"]').fill("40");
  await page.locator('[data-share="14"]').blur();
  assert.match(
    await page.locator("#player-troop-summary").textContent(),
    /7,936,450 troops · Full/,
  );
  await page.locator("#player-march-highest").selectOption("14");
  await page.locator("#player-march-highest").selectOption("15");
  await page.screenshot({ path: "test-results/player-generated-march.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator("#player-section-select").isVisible(), true);
  assert.equal(
    await page.locator("#player-section-select").inputValue(),
    "troops",
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: "test-results/player-generated-march-mobile.png",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#player-march-back").click();
  await page.locator('.march-card[aria-label="Siege"]').click();
  await page.locator("#player-march-capacity").fill("7761650");
  await page.locator("#player-march-capacity").blur();
  await page.locator("#player-march-type").selectOption("small-siege");
  assert.equal(
    await page
      .locator('[data-tier-row="11"] [data-count="siege"]')
      .inputValue(),
    "7466650",
  );
  assert.match(
    await page.locator("#player-troop-summary").textContent(),
    /7,761,650 troops · Full/,
  );
  await page.locator("#player-march-type").selectOption("siege");
  assert.equal(
    await page
      .locator('[data-tier-row="13"] [data-count="siege"]')
      .inputValue(),
    "4488990",
  );
  assert.equal(await page.locator("#player-remove-march").count(), 0);
  await page.locator("#player-march-back").click();
  await page.locator('.march-card[aria-label="Siege"]').hover();
  await page
    .getByRole("button", { name: "Remove Siege march", exact: true })
    .click();
  assert.equal(
    await page.locator('.march-card[aria-label="Siege"]').count(),
    0,
  );
  await page.locator("#player-add-march").click();
  await page.locator("#player-march-name").fill("Ground — Trajan");
  await page.locator("#player-march-capacity").fill("7000000");
  await page.locator("#player-march-capacity").blur();
  assert.match(
    await page.locator("#player-troop-summary").textContent(),
    /7,000,000 troops · Full/,
  );
  await page.locator("#player-march-back").click();
  await page.locator('.march-card[aria-label="Ground — Trajan"]').focus();
  await page
    .getByRole("button", { name: "Remove Ground — Trajan march", exact: true })
    .click();
  assert.equal(
    await page.locator('.march-card[aria-label="Ground — Trajan"]').count(),
    0,
  );
  await page.locator('.march-card[aria-label="Ground"]').click();

  await page
    .locator('[data-tier-row="15"] [data-count="ground"]')
    .fill("2295435");
  await page.locator("#player-troops details summary").click();
  for (const type of ["ground", "ranged", "mounted", "siege"])
    await page.locator(`[data-base="${type}"]`).fill("5000");
  assert.match(
    await page.locator("#player-troop-summary").textContent(),
    /7,936,450/,
  );
  assert.equal(
    await page.locator("#player-troops thead #player-add-tier").count(),
    1,
  );
  await page.locator("#player-add-tier").click();
  await page.locator("#player-add-tier").click();
  assert.equal(await page.locator('[data-tier-row="16"]').count(), 1);
  assert.equal(await page.locator('[data-tier-row="17"]').count(), 1);
  await page.locator('[data-tier-row="16"] [data-count="ground"]').fill("0");
  await page.locator("#player-march-back").click();
  await page.locator('.march-card[aria-label="Archers"]').click();
  assert.equal(await page.locator('[data-count="ground"]').count(), 0);
  await page
    .locator('[data-tier-row="15"] [data-count="ranged"]')
    .fill("774235");
  await page.locator("#player-march-back").click();
  await page.locator('.march-card[aria-label="Ground"]').click();
  assert.equal(
    await page
      .locator('[data-tier-row="15"] [data-count="ground"]')
      .inputValue(),
    "2295435",
  );
  await page.screenshot({ path: "test-results/player-marches.png" });
  assert.equal(
    (await page.locator('[data-player-tab="troops"]').textContent()).trim(),
    "Marches",
  );
  await page.locator('[data-march-tab="reinforcements"]').click();
  assert.equal(await page.locator("#player-march-list").isVisible(), false);
  assert.equal(
    await page.locator("#player-reinforcement-list .march-card").count(),
    0,
  );
  await page.locator("#player-add-reinforcement").click();
  await page.locator("#player-reinforcement-name").fill("Building ground");
  await page.locator("#player-reinforcement-capacity").fill("2000000");
  await page
    .locator(
      '[data-reinforcement-tier="15"] [data-reinforcement-type="ground"]',
    )
    .fill("1200000");
  await page
    .locator('[data-reinforcement-tier="1"] [data-reinforcement-type="siege"]')
    .fill("10000");
  assert.match(
    await page.locator("#player-reinforcement-summary").textContent(),
    /1,210,000 troops · 790,000 available/,
  );
  await page.locator('[data-march-tab="attack"]').click();
  assert.equal(
    await page
      .locator('[data-tier-row="15"] [data-count="ground"]')
      .inputValue(),
    "2295435",
  );
  assert.equal(await page.locator('[data-player-tab="subcities"]').count(), 1);
  await page.locator("#player-form [type=submit]").click();
  await page.waitForFunction(
    () =>
      document.getElementById("player-save-status").textContent ===
        "Player · Saved" &&
      document.getElementById("player-save").disabled &&
      document.getElementById("player-screen").getAttribute("aria-busy") ===
        "false",
  );
  if (!(await page.locator("#drive-save").isDisabled()))
    await page.locator("#drive-save").click();
  await page.waitForFunction(
    () =>
      document.getElementById("drive-save").disabled &&
      document.getElementById("drive-save").getAttribute("aria-label") ===
        "Save team",
  );
  const shared = [...driveFiles.values()].find(
    (record) => record.data?.format === "evony-consilium-team",
  );
  const details = shared.data.plan.keeps[0].details;
  assert.equal(details.rallyCapacity, 12000000);
  assert.equal(details.marchBoost, 200);
  assert.equal(details.marchSizes.ground, 7936450);
  assert.equal(details.buffs.rally.ground.attack, 4333);
  assert.equal(details.buffs.city.siege.hp, 0);
  assert.equal(details.buffs.city.ground.hp, null);
  assert.equal(details.marches.length, 2);
  assert.deepEqual(
    details.reinforcementMarches[0].layers.sort((a, b) => b.tier - a.tier),
    [
      { tier: 15, ground: 1200000 },
      { tier: 1, siege: 10000 },
    ],
  );
  assert.equal(details.reinforcementMarches[0].capacityOverride, 2000000);
  const groundMarch = details.marches.find((march) => march.name === "Ground");
  assert.equal(groundMarch.baseThrough, 9);
  assert.equal(groundMarch.generation.manual, true);
  assert.equal(groundMarch.layers.find((row) => row.tier === 16).ground, 0);
  assert.equal(
    groundMarch.layers.some((row) => row.tier === 17),
    false,
  );
  assert.equal(details.subcities, undefined);
  await playersScreen();
  await page.locator("#players .player-card").last().click();
  await page.locator('[data-player-tab="buffs"]').click();
  assert.equal(
    await page.locator('[data-buff="city.ground.attack"]').inputValue(),
    "",
  );
  await playersScreen();
  await page.locator("#players .player-card").first().click();
  await page.locator('[data-player-tab="buffs"]').click();
  assert.equal(
    await page.locator('[data-buff="city.ground.attack"]').inputValue(),
    "3385",
  );
  await page.locator('[data-player-tab="troops"]').click();
  await page.locator('[data-march-tab="reinforcements"]').click();
  assert.equal(
    await page.locator('.march-card[aria-label="Building ground"]').count(),
    1,
  );
  await page.locator('[data-march-tab="attack"]').click();
  await page.locator('[data-player-tab="buffs"]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.locator("#player-section-select").inputValue(),
    "buffs",
  );
  await page.locator("#player-section-select").selectOption("overview");
  assert.equal(
    await page.locator('[data-player-panel="overview"]').isVisible(),
    true,
  );
  await page.locator("#player-section-select").selectOption("buffs");
  assert.equal(
    await page
      .locator("#player-buffs")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
    true,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: "test-results/player-details-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Player stats are saved to the source; team Undo does not undo a remote profile save.
  assert.equal(
    await page.locator('[data-buff="city.ground.attack"]').inputValue(),
    "3385",
  );
  for (const [level, highest] of [
    ["45", 16],
    ["50", 17],
  ]) {
    await page.locator('[data-player-tab="overview"]').click();
    await page.locator("#player-level").fill(level);
    await page.locator("#player-form [type=submit]").click();
    await page.waitForFunction(
      () =>
        document.getElementById("player-save-status").textContent ===
          "Player · Saved" &&
        document.getElementById("player-save").disabled &&
        document.getElementById("player-screen").getAttribute("aria-busy") ===
          "false",
    );
    await page.locator('[data-player-tab="troops"]').click();
    if (await page.locator("#player-march-editor").isVisible())
      await page.locator("#player-march-back").click();
    await page.locator('.march-card[aria-label="Ground"]').click();
    assert.equal(await page.locator(`[data-tier-row="${highest}"]`).count(), 1);
  }
  await page.locator("#plan-title").fill("Temporary team edit");
  await page.locator("#plan-title").dispatchEvent("change");
  await page.locator("#undo").click();
  await playersScreen();
}
