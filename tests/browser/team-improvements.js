import assert from "node:assert/strict";
import { mockGoogleDrive } from "../drive-mock.js";
export async function teamImprovements({ browser }) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  try {
    await mockGoogleDrive(context);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:4174");
    await page.locator("#google-login:not([disabled])").click();
    await page.locator("#project-tab-create").click();
    await page.locator("#project-name").fill("Server 1851 Avalon");
    await page.locator("[form=project-create]").click();
    await page.locator("#planner").waitFor({ state: "visible" });
    await page.locator("#team-players").click();
    await page.locator("#add-player").click();
    await page
      .locator("#new-player-name")
      .fill("An owner with a considerably longer name");
    await page.locator("#new-player-form [type=submit]").click();
    await page.locator("#add-player-dialog").waitFor({ state: "hidden" });
    await page.locator('[data-screen="players"]').click();
    await page.locator("#add-player").click();
    await page.locator("#new-player-name").fill("High keep");
    await page.locator("#new-player-level").fill("45");
    await page.locator("#new-player-form [type=submit]").click();
    await page.locator("#add-player-dialog").waitFor({ state: "hidden" });
    await page.locator('[data-screen="project"]').click();
    await page.locator("#team-subcities").click();
    await page.locator("#add-subcity").click();
    await page.locator("#subcity-name").fill("Harbor city");
    await page.locator("#subcity-x").fill("100");
    await page.locator("#subcity-y").fill("200");
    await page.locator("#subcity-save").click();
    await page.locator("#subcities-search").fill("missing");
    assert.equal(await page.locator("#subcities .subcity-card").count(), 0);
    await page.locator("#subcities-search").fill("Harbor");
    assert.equal(await page.locator("#subcities .subcity-card").count(), 1);
    await page.locator('[data-screen="project"]').click();
    assert.equal(await page.locator("#team-subcity-count").textContent(), "1");
    assert.match(
      await page.locator("#team-save-status").getAttribute("title"),
      /autosaving/,
    );
    // Navigation changes neither data nor save state.
    await page.locator("#team-subcities").click();
    assert.match(page.url(), /screen=subcities/);
    await page.goBack();
    await page.locator("#project-screen").waitFor({ state: "visible" });
    await page.locator("#team-maps").click();
    await page.locator("#new-formation-type").selectOption("server");
    await page.locator('#add-map-form button[type="submit"]').click();
    assert.equal(await page.locator(".formation-box").count(), 0);
    const high = page
      .locator(".formation-player-row")
      .filter({ hasText: "High keep" });
    const low = page
      .locator(".formation-player-row")
      .filter({ hasText: "An owner" });
    assert.equal(await high.locator(".rally-star.active").count(), 1);
    await low.locator(".players-row").hover();
    await low.locator(".rally-star").click();
    assert.equal(await low.locator(".rally-star.active").count(), 1);
    await page.mouse.move(0, 0);
    assert.equal(
      await high
        .locator(".rally-star")
        .evaluate((el) => getComputedStyle(el).opacity),
      "0",
    );
    await high.locator(".players-row").dispatchEvent("pointerdown", {
      pointerType: "touch",
      clientX: 5,
      clientY: 5,
    });
    await page.waitForTimeout(600);
    await high
      .locator(".players-row")
      .dispatchEvent("pointerup", { pointerType: "touch" });
    await high.locator(".rally-star").click();
    await page.locator("#auto-place").click();
    assert.equal(
      await page
        .locator("#formation-players .detail")
        .filter({ hasText: "Unplaced" })
        .count(),
      0,
    );
    await low.locator(".players-row").click();
    assert.equal(await page.locator("#entity-w").getAttribute("readonly"), "");
    assert.equal(await page.locator("#entity-h").getAttribute("readonly"), "");
    await page.locator('[data-screen="subcities"]').click();
    await page.locator("#subcities .subcity-card").first().click();
    await page.locator("#subcity-locate").click();
    await page.locator("#formation-screen").waitFor({ state: "visible" });
    assert.match(page.url(), /screen=formation/);
    await page.locator('[data-screen="project"]').click();
    for (const width of [390, 600, 800, 1100]) {
      await page.setViewportSize({ width, height: 1000 });
      const metrics = await page.evaluate(() => {
        const name = document.getElementById("plan-title"),
          ctx = document.createElement("canvas").getContext("2d"),
          style = getComputedStyle(name);
        ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const account = document
          .getElementById("account-menu")
          .getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          nameWidth: name.clientWidth,
          textWidth: ctx.measureText(name.value).width,
          accountRight: account.right,
        };
      });
      assert.equal(metrics.overflow, false, `${width}px dashboard overflow`);
      assert.ok(
        metrics.nameWidth > metrics.textWidth,
        `${width}px clipped team name`,
      );
      assert.ok(metrics.accountRight <= width);
      await page.locator("#team-subcities").click();
      await page.locator("#subcities .subcity-card").first().click();
      const bounds = await page.locator("#subcity-dialog").boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
      await page.locator("#subcity-dialog [data-close]").click();
      await page.locator('[data-screen="project"]').click();
    }
    await page.screenshot({
      path: "test-results/dashboard-overview.png",
      fullPage: true,
    });
    if (!(await page.locator("#drive-save").isDisabled()))
      await page.locator("#drive-save").click();
    await page.waitForFunction(
      () => document.getElementById("drive-save").disabled,
    );
    await page.locator('[data-screen="players"]').click();
    await page.locator("#players .player-card").first().click();
    const currentPlayer = await page.locator("#player-title").textContent();
    await page.locator("#project-reload").evaluate((button) => {
      button.hidden = false;
    });
    await page.locator("#project-reload").click();
    await page.locator("#player-screen").waitFor({ state: "visible" });
    assert.equal(
      await page.locator("#player-title").textContent(),
      currentPlayer,
    );
    assert.match(page.url(), /screen=player/);
    await page.locator("#project-back").click();
    for (const width of [390, 600, 800]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      const account = await page.locator("#account-menu").boundingBox();
      assert.ok(account.x + account.width <= width);
    }
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}
