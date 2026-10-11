import assert from "node:assert/strict";
import { mockGoogleDrive } from "../drive-mock.js";

export async function playerNotes({ browser, base = "http://127.0.0.1:4174" }) {
  const admin = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const member = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  const clock = (context) =>
    context.addInitScript(() => {
      const interval = window.setInterval;
      window.setInterval = (callback, delay, ...args) => {
        if (delay === 30000) {
          window.__notesTick = () => callback(...args);
          return interval(() => {}, 86400000);
        }
        return interval(callback, delay, ...args);
      };
    });
  try {
    await clock(admin);
    await clock(member);
    const files = await mockGoogleDrive(admin, {
      account: { sub: "alice", email: "alice@example.test" },
    });
    const a = await admin.newPage();
    a.on("pageerror", (error) => errors.push(error.message));
    await a.goto(base);
    await a.locator("#google-login:not([disabled])").click();
    await a.locator("#project-tab-create").click();
    await a.locator("#project-name").fill("Notes team");
    await a.locator("[form=project-create]").click();
    await a.locator("#planner").waitFor({ state: "visible" });
    await a.locator('[data-screen="players"]').click();
    await a.locator("#add-player").click();
    await a.locator("#new-player-name").fill("Tracked account");
    await a.locator("#new-player-form [type=submit]").click();
    await a.locator("#add-player-dialog").waitFor({ state: "hidden" });
    await a.locator('[data-player-tab="notes"]').click();
    assert.equal(await a.locator(".player-footer").isVisible(), false);
    await a.locator("#note-new").click();
    await a.locator("#note-dialog").waitFor({ state: "visible" });
    assert.equal(await a.locator("#note-audience").inputValue(), "personal");
    await a.locator("#note-title").fill("Personal assessment");
    await a
      .locator("#note-body")
      .fill("Only my draft\n\n<script>literal text, not HTML</script>");
    await a.locator("#note-save").click();
    await a.locator("#note-dialog").waitFor({ state: "hidden" });
    const personal = [...files.values()].find(
      (row) => row.data?.format === "evony-consilium-note",
    );
    const team = [...files.values()].find(
      (row) => row.data?.format === "evony-consilium-team",
    );
    assert.notEqual(personal.file.parents[0], team.file.parents[0]);
    const adminIndex = [...files.values()].find(
      (row) =>
        row.owner === "alice" &&
        row.data?.format === "evony-consilium-notes-index",
    );
    assert.deepEqual(adminIndex.file.parents, personal.file.parents);
    assert.match(
      personal.file.name,
      /^Note - Notes team - Tracked account - Personal assessment \[[\da-f]{8}\]\.note\.consilium\.json$/,
    );
    assert.doesNotMatch(
      JSON.stringify(team.data),
      /Personal assessment|Only my draft/,
    );
    assert.equal(
      await a.locator("#player-save-status").getAttribute("data-status"),
      "saved",
    );
    await a.locator(`[data-note-id="${personal.file.id}"]`).click();
    await a.locator("#note-body").fill("Durable note draft");
    await a.locator("#note-close").click();
    await a.reload();
    await a.locator("#google-login:not([disabled])").click();
    await a.locator("#planner").waitFor({ state: "visible" });
    if (!(await a.locator("#player-screen").isVisible())) {
      await a.locator('[data-screen="players"]').click();
      await a.locator("#players .player-card").first().click();
    }
    await a.locator('[data-player-tab="notes"]').click();
    await a.locator(`[data-note-id="${personal.file.id}"]`).click();
    await a.waitForFunction(
      () => document.getElementById("note-body").value === "Durable note draft",
    );
    await a.locator("#note-save").click();
    await a.locator("#note-dialog").waitFor({ state: "hidden" });
    assert.equal(personal.data.note.body, "Durable note draft");
    await a.locator(`[data-note-id="${personal.file.id}"]`).click();
    await a.locator("#note-sharing summary").click();
    await a.locator("#note-email").fill("bob@example.test");
    await a.locator("#note-share").click();
    await a.waitForFunction(() =>
      document
        .getElementById("note-message")
        .textContent.includes("Access granted"),
    );
    assert.ok(
      personal.permissions.some(
        (permission) =>
          permission.emailAddress === "bob@example.test" &&
          permission.role === "reader",
      ),
    );
    await a.locator("#note-copy-link").click();
    const privateLink = await a.locator("#note-link-result").inputValue();
    await a.locator("#note-close").click();

    const memberAccess = new Map([
      [team.file.id, { canEdit: false }],
      [personal.file.id, { canEdit: false, canShare: false }],
    ]);
    const memberGrants = new Set();
    await mockGoogleDrive(member, {
      files,
      grants: memberGrants,
      account: { sub: "bob", email: "bob@example.test" },
      access: memberAccess,
    });
    const m = await member.newPage();
    m.on("pageerror", (error) => errors.push(error.message));
    await m.goto(
      `${base}/#team=${team.file.id}&screen=player&player=${team.data.plan.keeps[0].id}&section=notes`,
    );
    await m.locator("#google-login:not([disabled])").click();
    await m.locator("#planner").waitFor({ state: "visible" });
    assert.equal(await m.locator("#player-name").getAttribute("readonly"), "");
    assert.equal(await m.locator("#note-new").isEnabled(), true);
    assert.equal(
      await m.locator(`[data-note-id="${personal.file.id}"]`).count(),
      0,
    );
    await m.locator("#note-new").click();
    await m.locator("#note-dialog").waitFor({ state: "visible" });
    await m.locator("#note-audience").selectOption("team");
    await m.locator("#note-title").fill("Team growth plan");
    await m.locator("#note-body").fill("Pending contribution");
    await m.locator("#note-save").click();
    await m.waitForFunction(() =>
      [...document.querySelectorAll("[data-note-id]")].some((card) =>
        card.textContent.includes("Team growth plan"),
      ),
    );
    await m.locator("#note-dialog").waitFor({ state: "hidden" });
    const contribution = [...files.values()].find(
      (row) => row.data?.note?.title === "Team growth plan",
    );
    assert.equal(contribution.file.parents[0], team.file.parents[0]);
    const memberIndex = [...files.values()].find(
      (row) =>
        row.owner === "bob" &&
        row.data?.format === "evony-consilium-notes-index",
    );
    assert.deepEqual(memberIndex.file.parents, [memberIndex.data.folder.id]);
    assert.notEqual(memberIndex.data.folder.id, team.file.parents[0]);
    assert.notEqual(memberIndex.data.folder.id, adminIndex.data.folder.id);
    assert.equal(team.data.plan.teamNotes, undefined);
    await m.locator(`[data-note-id="${contribution.file.id}"]`).click();
    await m.locator("#note-copy-link").click();
    const editorLink = await m.locator("#note-link-result").inputValue();
    assert.equal(
      new URL(editorLink).hash.includes(`note=${contribution.file.id}`),
      true,
    );
    await m.locator("#note-close").click();

    await a.goto(editorLink);
    if (await a.locator("#google-login").isVisible())
      await a.locator("#google-login:not([disabled])").click();
    await a.locator("#planner").waitFor({ state: "visible" });
    await a.locator("#note-connect-incoming").click();
    await a.locator("#note-dialog").waitFor({ state: "visible" });
    assert.equal(
      await a.evaluate(() => window.__pickerCalls.at(-1).ids),
      contribution.file.id,
    );
    assert.equal(
      await a.evaluate(() => window.__pickerModalStates.at(-1)),
      false,
    );
    await a.locator("#note-publish").click();
    await a.waitForFunction(() =>
      document
        .getElementById("note-save-status")
        .textContent.includes("Team copy refreshed"),
    );
    assert.equal(
      team.data.plan.teamNotes[0].noteCache.note.body,
      "Pending contribution",
    );
    assert.doesNotMatch(
      JSON.stringify(team.data),
      /Durable note draft|Personal assessment/,
    );
    await a.locator("#note-close").click();
    await m.evaluate(() => window.__notesTick());
    await m.locator(`[data-note-id="${contribution.file.id}"]`).click();
    assert.equal(
      await m.locator(`[data-note-remove="${contribution.file.id}"]`).count(),
      0,
    );
    await m.locator("#note-body").fill("Author updated this later");
    await m.locator("#note-save").click();
    await m.locator("#note-dialog").waitFor({ state: "hidden" });
    assert.equal(contribution.data.note.body, "Author updated this later");
    assert.equal(
      team.data.plan.teamNotes[0].noteCache.note.body,
      "Pending contribution",
    );
    await a.evaluate(() => window.__notesTick());
    assert.equal(
      team.data.plan.teamNotes[0].noteCache.note.body,
      "Author updated this later",
    );
    await a.screenshot({ path: "test-results/notes-desktop.png" });

    await m.goto(privateLink);
    if (await m.locator("#google-login").isVisible())
      await m.locator("#google-login:not([disabled])").click();
    await m.locator("#planner").waitFor({ state: "visible" });
    await m.locator("#note-connect-incoming").click();
    await m.locator("#note-dialog").waitFor({ state: "visible" });
    assert.equal(await m.locator("#note-body").getAttribute("readonly"), "");
    assert.equal(
      await m.locator("#note-body").inputValue(),
      "Durable note draft",
    );
    assert.equal(await m.locator("#note-publish").isVisible(), false);
    await m.locator("#note-close").click();
    await a.locator(`[data-note-id="${contribution.file.id}"]`).click();
    for (const width of [390, 320]) {
      await a.setViewportSize({ width, height: 844 });
      const rect = await a.locator("#note-dialog").boundingBox();
      assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1);
      assert.equal(
        await a
          .locator("#note-body")
          .evaluate((field) => getComputedStyle(field).textAlign),
        "left",
      );
      await a.screenshot({ path: `test-results/notes-mobile-${width}.png` });
    }
    await a.setViewportSize({ width: 1440, height: 1000 });
    await a.locator("#note-close").click();
    await a.locator('[data-screen="alts"]').click();
    await a.locator("#add-alt").click();
    await a.locator("#new-player-owner-choice").click();
    await a
      .locator("#new-player-owner-grid .player-picker-card")
      .first()
      .click();
    await a.locator("#new-player-name").fill("Farming alt");
    await a.locator("#new-player-form [type=submit]").click();
    await a.locator("#add-player-dialog").waitFor({ state: "hidden" });
    await a.locator('[data-player-tab="notes"]').click();
    await a.locator("#note-new").click();
    await a.locator("#note-body").fill("Notes belong to the alt itself");
    await a.locator("#note-save").click();
    await a.locator("#note-dialog").waitFor({ state: "hidden" });
    const altNote = [...files.values()].find(
      (row) => row.data?.note?.body === "Notes belong to the alt itself",
    );
    assert.equal(
      altNote.data.note.subject,
      `player:${team.data.plan.keeps[1].playerSource.fileId}`,
    );
    assert.notEqual(altNote.data.note.subject, personal.data.note.subject);

    await a.locator('[data-screen="players"]').click();
    await a
      .locator("#players .player-card")
      .filter({ hasText: "Tracked account" })
      .click();
    await a.locator('[data-player-tab="notes"]').click();
    const personalCard = a.locator(`[data-note-id="${personal.file.id}"]`);
    const personalRemoval = a.locator(
      `[data-note-remove="${personal.file.id}"]`,
    );
    await personalCard.focus();
    await a.waitForFunction(
      (id) =>
        getComputedStyle(document.querySelector(`[data-note-remove="${id}"]`))
          .opacity === "1",
      personal.file.id,
    );
    assert.match(
      await personalRemoval.getAttribute("aria-label"),
      /from my notes/,
    );
    await personalRemoval.click();
    await personalCard.waitFor({ state: "detached" });
    assert.equal(files.has(personal.file.id), true);
    assert.equal(personal.data.note.body, "Durable note draft");
    assert.equal(team.data.plan.teamNotes.length, 1);

    await a.setViewportSize({ width: 390, height: 844 });
    const teamCard = a.locator(`[data-note-id="${contribution.file.id}"]`);
    await teamCard.dispatchEvent("pointerdown", {
      pointerType: "touch",
      clientX: 10,
      clientY: 10,
    });
    await a.waitForFunction(
      (id) =>
        document
          .querySelector(`[data-note-id="${id}"]`)
          .closest(".note-tile")
          .classList.contains("player-actions-open"),
      contribution.file.id,
    );
    await teamCard.dispatchEvent("pointerup", { pointerType: "touch" });
    await teamCard.dispatchEvent("click");
    assert.equal(await a.locator("#note-dialog").isVisible(), false);
    const teamRemoval = a.locator(
      `[data-note-remove="${contribution.file.id}"]`,
    );
    await a.waitForFunction(
      (id) =>
        getComputedStyle(document.querySelector(`[data-note-remove="${id}"]`))
          .opacity === "1",
      contribution.file.id,
    );
    assert.match(await teamRemoval.getAttribute("aria-label"), /from the team/);
    await a.screenshot({ path: "test-results/note-removal-mobile.png" });
    await teamRemoval.click();
    await teamCard.waitFor({ state: "detached" });
    assert.equal(team.data.plan.teamNotes.length, 0);
    assert.equal(files.has(contribution.file.id), true);
    assert.equal(contribution.data.note.body, "Author updated this later");
    assert.equal(files.has(altNote.file.id), true);
    assert.deepEqual(errors, []);
  } finally {
    await admin.close();
    await member.close();
  }
}
