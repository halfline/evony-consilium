import assert from "node:assert/strict";
import { mockGoogleDrive } from "../drive-mock.js";

export async function visualPolish({ browser }) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  try {
    const files = await mockGoogleDrive(context);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:4174");
    await page.locator("#google-login:not([disabled])").click();
    await page.locator("#project-tab-create").click();
    await page.locator("#project-name").fill("Avalon • Server 1851");
    await page.locator("[form=project-create]").click();
    await page.locator("#planner").waitFor({ state: "visible" });
    await page.locator('[data-screen="players"]').click();
    await page.locator("#add-player").click();
    await page
      .locator("#new-player-name")
      .fill("Alexandra of the Northern Alliance");
    await page.locator("#new-player-form [type=submit]").click();
    await page.locator("#add-player-dialog").waitFor({ state: "hidden" });
    await page.waitForFunction(
      () =>
        document.getElementById("player-save-status").dataset.status ===
        "saved",
    );
    await page.locator("#player-section-select").selectOption("buffs");
    const before = await page.locator("#player-save-status").textContent();
    await page.locator('[data-buff-context="rally"]').click();
    assert.equal(
      await page.locator("#player-save-status").textContent(),
      before,
    );
    assert.equal(await page.locator("#player-save").isDisabled(), true);
    assert.equal(
      await page.locator('[data-buff-section="rally"]').isVisible(),
      true,
    );
    assert.equal(
      await page.locator('[data-buff-section="city"]').isVisible(),
      false,
    );
    await page.locator('[data-buff="rally.ground.attack"]').fill("123.5");
    await page.locator('[data-buff-context="city"]').click();
    await page.locator('[data-buff-context="rally"]').click();
    assert.equal(
      await page.locator('[data-buff="rally.ground.attack"]').inputValue(),
      "123.5",
    );
    await page.locator('[data-buff="rally.ground.attack"]').fill("-1");
    await page.locator('[data-buff-context="city"]').click();
    await page.locator("#player-save").click();
    assert.equal(
      await page.locator('[data-buff-section="rally"]').isVisible(),
      true,
    );
    assert.equal(
      await page
        .locator('[data-buff="rally.ground.attack"]')
        .evaluate((input) => input === document.activeElement),
      true,
    );
    await page.locator('[data-buff="rally.ground.attack"]').fill("123.5");
    await page.locator("#player-save").click();
    await page.waitForFunction(
      () =>
        document.getElementById("player-save").disabled &&
        document.getElementById("player-save-status").dataset.status ===
          "saved",
    );
    const header = await page.evaluate(
      () =>
        document.querySelector(".topbar").getBoundingClientRect().height +
        document.querySelector(".workflow-nav").getBoundingClientRect().height,
    );
    assert.ok(header <= 180, `Mobile profile header occupies ${header}px`);
    await page.locator("#header-more-toggle").click();
    assert.equal(
      await page.locator("#header-more-toggle").getAttribute("aria-expanded"),
      "true",
    );
    await page.locator("#header-more-toggle").press("Escape");
    assert.equal(
      await page.locator("#header-more-toggle").getAttribute("aria-expanded"),
      "false",
    );
    await page.locator('[data-screen="players"]').click();
    await page.locator("#players-search").fill("unmatched name");
    assert.equal(await page.locator("#add-player").isVisible(), true);
    await page
      .locator("#players-screen .collection-empty .text-button")
      .click();
    assert.equal(await page.locator("#players-search").inputValue(), "");
    assert.equal(await page.locator("#players .player-card").count(), 1);
    assert.equal(
      await page.locator("#players .player-portrait img").count(),
      1,
    );
    await page.locator('[data-screen="alts"]').click();
    assert.equal(
      await page.locator("#alts-search-control svg").isVisible(),
      true,
    );
    await page.locator("#alts-search").fill("Alexandra");
    assert.equal(await page.locator("#alts-search").inputValue(), "Alexandra");
    await page.locator('[data-screen="players"]').click();
    await page.locator("#add-player").click();
    await page.locator("#new-player-castle").click();
    await page
      .locator("#catalog-chips button")
      .filter({ hasText: "Culture" })
      .click();
    assert.equal(
      await page
        .locator('#catalog-chips [data-category="culture"]')
        .getAttribute("aria-pressed"),
      "true",
    );
    await page.locator("#catalog-search").fill("No such castle decoration");
    assert.equal(await page.locator("#catalog-grid .castle-card").count(), 0);
    await page.locator("#catalog-grid > button").click();
    assert.ok((await page.locator("#catalog-grid .castle-card").count()) > 0);
    await page
      .locator("#catalog-grid .art-preview img")
      .first()
      .evaluate((image) => image.decode());
    await page.waitForFunction(() =>
      document
        .querySelector("#catalog-grid .art-preview")
        .classList.contains("art-ready"),
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.locator("#catalog-dialog [data-close]").click();
    await page.locator("#add-player-dialog [data-close]").first().click();
    await page
      .locator('#players-actions [data-collection-view="list"]')
      .click();
    assert.equal(
      await page
        .locator("#players")
        .evaluate((node) => node.classList.contains("compact-list")),
      true,
    );
    for (const width of [320, 360, 390, 600, 800, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${width}px roster overflow`,
      );
      await page.locator('[data-screen="project"]').click();
      assert.equal(
        await page.locator("#team-roster-preview .roster-preview-row").count(),
        1,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${width}px dashboard overflow`,
      );
      await page.locator("#team-roster-preview .roster-preview-row").click();
      assert.match(
        await page.locator("#player-title").textContent(),
        /Alexandra/,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${width}px profile overflow`,
      );
      const footer = await page.locator("#player-save").boundingBox();
      const status = await page.locator("#player-save-status").boundingBox();
      const share = await page.locator("#player-drive-link").boundingBox();
      const middle = (box) => box.y + box.height / 2;
      assert.ok(
        Math.abs(middle(status) - middle(footer)) < 1,
        `${width}px save status alignment`,
      );
      assert.ok(
        Math.abs(middle(share) - middle(footer)) < 1,
        `${width}px sharing action alignment`,
      );
      await page.locator('[data-screen="players"]').click();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-screen="maps"]').click();
    await page.locator("#new-formation-type").selectOption("blank");
    await page.locator("#add-map-form [type=submit]").click();
    assert.equal(
      await page
        .locator("#formation-sidebar")
        .evaluate((node) => node.classList.contains("is-collapsed")),
      true,
    );
    await page.locator(".mobile-roster-link").click();
    assert.equal(
      await page.locator(".mobile-roster-link").getAttribute("aria-expanded"),
      "true",
    );
    // Keep the rally action outside the level badge, including narrow rows
    // containing a long player name and the placement hint.
    for (const width of [320, 390, 620, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const row = page.locator(".formation-player-row").first();
      const level = await row.locator(".level").boundingBox();
      const star = await row.locator(".rally-star").boundingBox();
      const button = await row.locator(".players-row").boundingBox();
      assert.ok(
        star.x >= level.x + level.width + 4,
        `${width}px rally badge overlap`,
      );
      assert.ok(
        star.x + star.width <= button.x + button.width,
        `${width}px rally action overflow`,
      );
      assert.ok(star.width >= 44 && star.height >= 44);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${width}px formation overflow`,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(".mobile-map-link").click();
    assert.equal(
      await page.locator(".mobile-roster-link").getAttribute("aria-expanded"),
      "false",
    );
    await page.locator('[data-screen="project"]').click();
    await page.locator("#team-map-preview .formation-preview").click();
    assert.equal(await page.locator("#formation-screen").isVisible(), true);
    assert.equal(await page.locator("#map-surface #toast").count(), 0);
    if (!(await page.locator("#drive-save").isDisabled()))
      await page.locator("#drive-save").click();
    await page.waitForFunction(
      () =>
        document.getElementById("team-save-status").dataset.status === "saved",
    );
    await page.locator('[data-screen="players"]').click();
    await page.reload();
    await page.locator("#google-login:not([disabled])").click();
    await page.locator("#players-screen").waitFor({ state: "visible" });
    assert.equal(
      await page
        .locator('#players-actions [data-collection-view="list"]')
        .getAttribute("aria-pressed"),
      "true",
    );
    const team = [...files.values()].find(
      (record) => record.data?.format === "evony-consilium-team",
    );
    team.file.capabilities.canEdit = false;
    files.get(
      team.data.plan.keeps[0].playerSource.fileId,
    ).file.capabilities.canEdit = false;
    const viewer = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    try {
      await mockGoogleDrive(viewer, { files, grants: new Set() });
      const member = await viewer.newPage();
      await member.goto("http://127.0.0.1:4174");
      await member.locator("#google-login:not([disabled])").click();
      await member
        .locator("#project-url")
        .fill(`https://drive.google.com/file/d/${team.file.id}/view`);
      await member.locator("[form=project-join]").click();
      await member.locator("#planner.read-only").waitFor({ state: "visible" });
      await member.locator('[data-screen="players"]').click();
      assert.equal(await member.locator("#add-player").isVisible(), false);
      await member.locator("#players .player-card").first().click();
      assert.equal(
        await member.locator("#player-section-select").isEnabled(),
        true,
      );
      await member.locator("#player-section-select").selectOption("buffs");
      await member.locator('[data-buff-context="rally"]').click();
      assert.equal(
        await member
          .locator('[data-buff="rally.ground.attack"]')
          .getAttribute("readonly"),
        "",
      );
      assert.equal(
        await member.locator('[data-buff="rally.ground.attack"]').inputValue(),
        "123.5",
      );
    } finally {
      await viewer.close();
    }
    assert.deepEqual(errors, []);
  } catch (error) {
    await page.screenshot({
      path: "test-results/visual-polish-failure.png",
      fullPage: true,
    });
    throw error;
  } finally {
    await context.close();
  }
}
