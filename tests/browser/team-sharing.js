import assert from "node:assert/strict";
import { mockGoogleDrive } from "../drive-mock.js";

export async function teamSharing({ browser }) {
  const editor = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const viewer = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    const files = await mockGoogleDrive(editor);
    const page = await editor.newPage();
    await page.goto("http://127.0.0.1:4174");
    await page.locator("#google-login:not([disabled])").click();
    await page.locator("#project-tab-create").click();
    await page.locator("#project-name").fill("Sharing test");
    await page.locator("[form=project-create]").click();
    await page.locator("#planner").waitFor({ state: "visible" });
    const team = [...files.values()].find(
      (record) => record.data?.format === "evony-consilium-team",
    );
    const folder = files.get(team.file.parents[0]);
    // Sharing from another screen still creates a link to the team overview.
    await page.locator('[data-screen="maps"]').click();
    await page.keyboard.press("Escape");
    await page.locator("#team-share").click();
    const url = await page.locator("#team-link").inputValue();
    const route = new URLSearchParams(new URL(url).hash.slice(1));
    assert.equal(route.get("team"), team.file.id);
    assert.equal(route.get("screen"), "project");
    assert.equal(route.has("map"), false);
    assert.equal(
      await page.locator("#team-drive-link").getAttribute("href"),
      `https://drive.google.com/drive/folders/${folder.file.id}`,
    );
    await page.locator("#team-copy-link").click();
    await page.getByText("Copied.", { exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      url,
    );
    await page.screenshot({ path: "test-results/team-sharing.png" });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#team-share-dialog").isVisible(), false);

    // The copied link works for a different Google account with read-only access.
    team.file.capabilities.canEdit = false;
    team.file.resourceKey = "team-key";
    await mockGoogleDrive(viewer, {
      files,
      grants: new Set([team.file.id, folder.file.id]),
    });
    const member = await viewer.newPage();
    await member.goto(url);
    await member.locator("#google-login:not([disabled])").click();
    await member.locator("#planner.read-only").waitFor({ state: "visible" });
    assert.equal(await member.locator("#project-screen").isVisible(), true);
    await member.locator("#team-share").click();
    const keyedUrl = await member.locator("#team-link").inputValue();
    assert.equal(
      new URLSearchParams(new URL(keyedUrl).hash.slice(1)).get("resourceKey"),
      "team-key",
    );
    assert.equal(
      await member.locator("#team-drive-link").getAttribute("href"),
      `https://drive.google.com/drive/folders/${folder.file.id}`,
    );
    // A denied clipboard leaves the link selected for manual copying.
    await member.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new Error("Denied")) },
      });
    });
    await member.locator("#team-copy-link").click();
    await member.getByText("Select and copy the team link.").waitFor();
    assert.deepEqual(
      await member
        .locator("#team-link")
        .evaluate((input) => [
          document.activeElement === input,
          input.selectionStart,
          input.selectionEnd,
        ]),
      [true, 0, keyedUrl.length],
    );
    assert.equal(
      await member.locator("#team-share-dialog").evaluate((dialog) => {
        const rect = dialog.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth;
      }),
      true,
    );
    await member.screenshot({ path: "test-results/team-sharing-mobile.png" });
    await member.getByRole("button", { name: "Close team sharing" }).click();
  } finally {
    await editor.close();
    await viewer.close();
  }
}
