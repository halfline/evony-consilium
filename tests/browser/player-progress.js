import assert from "node:assert/strict";
import { mockGoogleDrive } from "../drive-mock.js";

export async function playerProgress({
  browser,
  base = "http://127.0.0.1:4174",
}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  let page;
  try {
    await context.addInitScript(() => {
      const original = window.setInterval;
      window.setInterval = (callback, delay, ...args) => {
        if (delay === 30000) {
          window.__progressTick = () => callback(...args);
          return original(() => {}, 86400000);
        }
        return original(callback, delay, ...args);
      };
    });
    const files = await mockGoogleDrive(context),
      errors = [];
    page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.setDefaultTimeout(15000);
    await page.goto(base);
    await page.locator("#google-login:not([disabled])").click();
    await page.locator("#project-tab-create").click();
    await page.locator("#project-name").fill("Progress team");
    await page.locator("[form=project-create]").click();
    await page.locator("#planner").waitFor({ state: "visible" });
    await page.locator('[data-screen="players"]').click();
    await page.locator("#add-player").click();
    await page.locator("#new-player-name").fill("Growing player");
    await page.locator("#new-player-form [type=submit]").click();
    await page.locator("#add-player-dialog").waitFor({ state: "hidden" });
    await page.waitForFunction(
      () => !document.getElementById("player-name").readOnly,
    );
    const source = [...files.values()].find(
      (file) => file.data?.format === "evony-consilium-player",
    );
    const history = () => source.data.profile.details.progress;
    const records = () =>
      Object.values(history()).filter((entry) => !entry.deletedAt);
    const tick = () => page.evaluate(() => window.__progressTick());
    const openRow = async (row) => {
      if (!(await row.evaluate((node) => node.open)))
        await row.locator(":scope > summary").click();
    };
    const waitSaved = async () => {
      await page.waitForFunction(
        () =>
          document.getElementById("player-save-status").textContent ===
            "Player · Saved" &&
          document.getElementById("player-save").disabled &&
          document.getElementById("player-screen").getAttribute("aria-busy") ===
            "false",
      );
    };
    // Simulate a pre-history player, then sign in without editing any stats.
    await tick();
    const legacyTeam = [...files.values()].find(
      (file) => file.data?.format === "evony-consilium-team",
    );
    const savedLevel = source.data.profile.level;
    delete source.data.profile.details.progress;
    delete legacyTeam.data.plan.keeps[0].details.progress;
    source.file.version = String(Number(source.file.version) + 1);
    legacyTeam.file.version = String(Number(legacyTeam.file.version) + 1);
    const initializedOnOpen = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        response.url().includes(`/files/${source.file.id}`) &&
        response.ok(),
    );
    await page.reload();
    await page.locator("#google-login:not([disabled])").click();
    await page.locator("#planner").waitFor({ state: "visible" });
    await initializedOnOpen;
    assert.equal(records().length, 1);
    assert.deepEqual(records()[0].values, { level: savedLevel });
    await page.locator('[data-screen="players"]').click();
    await page.locator("#players .player-card").first().click();
    await page.waitForFunction(
      () => !document.getElementById("player-name").readOnly,
    );
    await page.locator('[data-player-tab="progress"]').click();
    assert.equal(records().length, 1);
    assert.equal(await page.locator("[data-progress-record]").count(), 1);
    assert.equal(
      await page.locator('[data-progress-view="Statistic"]').inputValue(),
      "level",
    );
    assert.equal(
      await page.getByRole("button", { name: "Start tracking" }).count(),
      0,
    );
    assert.equal(
      await page
        .getByText("Positive entries are converted automatically.", {
          exact: false,
        })
        .count(),
      0,
    );
    assert.equal(await page.locator("#player-save").isDisabled(), true);
    await page
      .locator('[data-progress-view="Statistic"]')
      .selectOption("level");
    assert.equal(await page.locator("[data-progress-snapshot]").count(), 1);
    assert.equal(await page.locator("#player-save").isDisabled(), true);
    await page.locator('[data-player-tab="buffs"]').click();
    await page.locator('[data-buff="city.ground.attack"]').fill("1200");
    await page.locator('[data-buff="city.ground.hp"]').fill("0");
    await tick();
    assert.equal(records().length, 2);
    assert.equal(records()[1].values["buffs.city.ground.attack"], 1200);
    await tick();
    assert.equal(records().length, 2);
    await page.locator('[data-player-tab="progress"]').click();
    await page
      .locator('[data-progress-view="Statistic"]')
      .selectOption("buffs");
    assert.equal(await page.locator("[data-progress-snapshot]").count(), 2);
    const attack = page.locator('[data-buff="city.ground.attack"]');
    const hp = page.locator('[data-buff="city.ground.hp"]');
    const date = page.getByLabel("Historical date", { exact: true });
    const saveHistory = async () => {
      await page
        .getByRole("button", { name: "Save historical changes", exact: true })
        .click();
      await page.locator(".historical-mode").waitFor({ state: "detached" });
      await waitSaved();
    };
    const addHistory = () =>
      page.getByRole("button", { name: "Add past stats", exact: true }).click();
    await page.locator('[data-player-tab="overview"]').click();
    await page.locator("#player-name").fill("Growing player updated");
    await page.locator('[data-player-tab="progress"]').click();
    await addHistory();
    assert.equal(await attack.inputValue(), "1200");
    await date.fill("2025-04-01");
    assert.equal(await attack.inputValue(), "");
    assert.equal(await hp.inputValue(), "");
    await attack.fill("750");
    await date.fill("2999-01-01");
    await page
      .getByRole("button", { name: "Save historical changes", exact: true })
      .click();
    assert.equal(
      await date.evaluate((input) => input.validity.rangeOverflow),
      true,
    );
    assert.equal(records().length, 2);
    await date.fill("2025-04-01");
    await hp.fill("0");
    await page.locator('[data-player-tab="overview"]').click();
    assert.equal(await page.locator("#player-level").inputValue(), "");
    await page.locator("#player-level").fill("");
    await page.locator("#player-level").press("e");
    await tick();
    assert.equal(
      await page
        .locator("#player-level")
        .evaluate((input) => input.validity.badInput),
      true,
    );
    await page.locator("#player-level").fill("40");
    assert.equal(
      records().length,
      2,
      "Historical draft never autosaves as current stats",
    );
    assert.equal(source.data.profile.name, "Growing player updated");
    assert.equal(await page.locator("#player-level").inputValue(), "40");
    assert.equal(await attack.inputValue(), "750");
    await page
      .getByRole("button", { name: "Return to current stats", exact: true })
      .click();
    await page.locator('[data-player-tab="buffs"]').click();
    assert.equal(await attack.inputValue(), "1200");
    await page.locator('[data-player-tab="progress"]').click();
    await openRow(page.locator("[data-progress-record]").first());
    assert.equal(
      await page
        .getByRole("button", { name: "Edit record", exact: true })
        .first()
        .isDisabled(),
      true,
    );
    await page
      .getByRole("button", { name: "Resume historical entry", exact: true })
      .click();
    assert.equal(await attack.inputValue(), "750");
    // Switching players must not leak historical mode or its values.
    await page.locator('[data-screen="players"]').click();
    await page.locator("#add-player").click();
    await page.locator("#new-player-name").fill("ZZ review player");
    await page.locator("#new-player-form [type=submit]").click();
    await page.locator("#add-player-dialog").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".historical-mode").count(), 0);
    assert.equal(
      await page.locator("#player-level").inputValue(),
      String(savedLevel),
    );
    await page.locator('[data-screen="players"]').click();
    await page
      .locator("#players .player-card")
      .filter({ hasText: "Growing player updated" })
      .click();
    await date.waitFor({ state: "visible" });
    assert.equal(await attack.inputValue(), "750");
    await page.reload();
    await page.locator("#google-login:not([disabled])").click();
    await page.locator("#planner").waitFor({ state: "visible" });
    await page.locator('[data-screen="players"]').click();
    await page.locator("#players .player-card").first().click();
    await date.waitFor({ state: "visible" });
    assert.equal(await date.inputValue(), "2025-04-01");
    assert.equal(await attack.inputValue(), "750");
    assert.equal(await page.locator("#player-level").inputValue(), "40");
    await saveHistory();
    assert.equal(records().length, 3);
    assert.equal(source.data.profile.details.buffs.city.ground.attack, 1200);
    assert.equal(source.data.profile.level, savedLevel);
    const firstPast = records().find((entry) => entry.kind === "manual");
    assert.deepEqual(firstPast.values, {
      level: 40,
      "buffs.city.ground.attack": 750,
      "buffs.city.ground.hp": 0,
    });

    // Reconstruct every metric independently, then save only actual changes.
    await page
      .locator('[data-progress-view="Statistic"]')
      .selectOption("buffs");
    await addHistory();
    await date.fill("2025-06-01");
    assert.equal(await attack.inputValue(), "750");
    assert.equal(await hp.inputValue(), "0");
    assert.equal(await page.locator("#player-level").inputValue(), "40");
    await attack.fill("900");
    await page.locator('[data-player-tab="march-size"]').click();
    await page.locator('[data-march-size="ground"]').fill("1800000");
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: "test-results/player-progress-editor-mobile.png",
      fullPage: true,
    });
    await saveHistory();
    const secondPast = records().find(
      (entry) => entry.values["buffs.city.ground.attack"] === 900,
    );
    assert.deepEqual(secondPast.values, {
      "marchSizes.ground": 1800000,
      "buffs.city.ground.attack": 900,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await addHistory();
    await date.fill("2025-07-01");
    assert.equal(await attack.inputValue(), "900");
    await hp.fill("");
    await attack.fill("1000");
    assert.equal(await hp.inputValue(), "0");
    await saveHistory();
    const july = records().find(
      (entry) => entry.values["buffs.city.ground.attack"] === 1000,
    );
    assert.deepEqual(july.values, { "buffs.city.ground.attack": 1000 });
    await addHistory();
    await date.fill("2025-08-01");
    assert.equal(await hp.inputValue(), "0");
    await date.fill("2025-05-01");
    assert.equal(
      await attack.inputValue(),
      "750",
      "Later observations never leak backward",
    );
    assert.equal(await hp.inputValue(), "0");
    await page
      .getByRole("button", { name: "Discard historical changes", exact: true })
      .click();

    // Editing uses the original observation's ordering, retaining sparse keys.
    const row = page.locator(`[data-progress-record="${secondPast.id}"]`);
    await openRow(row);
    await row.getByRole("button", { name: "Edit record", exact: true }).click();
    assert.equal(await attack.inputValue(), "900");
    await attack.fill("");
    await hp.focus();
    assert.equal(await attack.inputValue(), "900");
    await attack.fill("");
    await attack.press("e");
    await hp.focus();
    assert.equal(
      await attack.evaluate((input) => input.validity.badInput),
      true,
    );
    await page
      .getByRole("button", { name: "Save historical changes", exact: true })
      .click();
    assert.equal(await page.locator(".historical-mode").count(), 1);
    assert.equal(
      history()[secondPast.id].values["buffs.city.ground.attack"],
      900,
    );
    await attack.fill("950");
    await page.locator(".historical-actions summary").click();
    await page
      .getByLabel("Historical entry note")
      .fill("Verified against screenshot");
    await page
      .getByRole("button", { name: "Return to current stats", exact: true })
      .click();
    await openRow(row);
    await row.getByRole("button", { name: "Edit record", exact: true }).click();
    assert.equal(await attack.inputValue(), "950");
    assert.equal(
      await page.getByLabel("Historical entry note").inputValue(),
      "Verified against screenshot",
    );
    await saveHistory();
    assert.equal(history()[secondPast.id].observedAt, secondPast.observedAt);
    assert.equal(history()[secondPast.id].note, "Verified against screenshot");
    assert.equal(
      history()[secondPast.id].values["buffs.city.ground.attack"],
      950,
    );
    assert.equal(source.data.profile.details.buffs.city.ground.attack, 1200);
    assert.equal(records().length, 5);
    await openRow(page.locator(`[data-progress-record="${july.id}"]`));
    await page
      .locator(`[data-progress-record="${july.id}"]`)
      .getByRole("button", { name: "Remove entry", exact: true })
      .click();
    await waitSaved();
    assert.ok(history()[july.id].deletedAt);
    await page
      .getByRole("button", { name: "Undo removal", exact: true })
      .click();
    await waitSaved();
    assert.equal(history()[july.id].deletedAt, undefined);
    await page
      .locator('[data-progress-view="Statistic"]')
      .selectOption("debuffs");
    assert.equal(await page.locator("[data-progress-record]").count(), 0);
    await page
      .locator('[data-progress-view="Statistic"]')
      .selectOption("buffs");
    for (const dateLabel of await page
      .locator(".progress-record > summary > strong")
      .allTextContents())
      assert.ok(!/\d{1,2}:\d{2}/.test(dateLabel), dateLabel);
    for (const label of await page
      .locator("[data-progress-point]")
      .evaluateAll((points) =>
        points.map((point) => point.getAttribute("aria-label")),
      ))
      assert.ok(!/\d{1,2}:\d{2}/.test(label), label);
    const previews = (
      await page.locator(".progress-record-preview").allTextContents()
    ).join(" ");
    assert.ok(previews.includes("0%"));
    assert.ok(!previews.includes("0% → 0%"));
    const point = page.locator("[data-progress-point]").first();
    await point.focus();
    await page.keyboard.press("Enter");
    assert.ok(
      await page
        .getByRole("button", { name: "View record", exact: true })
        .isVisible(),
    );
    await page.locator('[data-progress-series="buffs.city.ground.hp"]').click();
    assert.equal(await page.locator("#player-save").isDisabled(), true);
    await page.screenshot({
      path: "test-results/player-progress.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: "test-results/player-progress-mobile.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);

    // A second account sees published history without permission to edit it.
    const team = [...files.values()].find(
      (file) => file.data?.format === "evony-consilium-team",
    );
    const viewer = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    try {
      await mockGoogleDrive(viewer, {
        files,
        account: { sub: "viewer", email: "viewer@example.test" },
        access: new Map([
          [team.file.id, { canEdit: false }],
          [source.file.id, { canEdit: false }],
        ]),
      });
      const p = await viewer.newPage();
      await p.goto(base);
      await p.locator("#google-login:not([disabled])").click();
      await p
        .locator("#project-url")
        .fill(`https://drive.google.com/file/d/${team.file.id}/view`);
      await p.locator("[form=project-join]").click();
      await p.locator("#planner").waitFor({ state: "visible" });
      await p.locator('[data-screen="players"]').click();
      await p.locator("#players .player-card").first().click();
      await p.locator('[data-player-tab="progress"]').click();
      assert.equal(
        await p
          .getByRole("button", { name: "Add past stats", exact: true })
          .isDisabled(),
        true,
      );
      assert.equal(
        await p.locator('[data-progress-view="Statistic"]').isEnabled(),
        true,
      );
      await p.locator('[data-progress-view="Statistic"]').selectOption("buffs");
      assert.equal(await p.locator("[data-progress-record]").count(), 4);
      assert.ok((await p.locator("[data-progress-point]").count()) > 0);
    } finally {
      await viewer.close();
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('[data-player-tab="buffs"]').click();
    await attack.fill("1250");
    await tick();
    await waitSaved();
    await page.locator('[data-player-tab="progress"]').click();
    const automaticDates = await page
      .locator(".progress-record")
      .filter({ hasText: "Automatic update" })
      .locator(":scope > summary > strong")
      .allTextContents();
    assert.equal(automaticDates.length, 2);
    assert.ok(automaticDates.every((label) => /\d{1,2}:\d{2}/.test(label)));
    const pastDates = await page
      .locator(".progress-record")
      .filter({ hasText: "Past entry" })
      .locator(":scope > summary > strong")
      .allTextContents();
    assert.ok(pastDates.every((label) => !/\d{1,2}:\d{2}/.test(label)));
  } catch (error) {
    if (page) {
      await page.screenshot({
        path: "test-results/player-progress-failure.png",
        fullPage: true,
      });
      console.error(await page.locator("#toast").textContent());
    }
    throw error;
  } finally {
    await context.close();
  }
}
