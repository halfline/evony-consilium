import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDiscordUrl } from "../web/src/domain/team.js";
import { createDemoPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";
import {
  createMapPlan,
  selectMapPlan,
  projectFingerprint,
} from "../web/src/domain/map-plans.js";
import { catalog } from "./fixtures/catalog.js";

test("Discord invites and channel links normalize to HTTPS", () => {
  assert.equal(
    normalizeDiscordUrl(" discord.gg/team "),
    "https://discord.gg/team",
  );
  assert.equal(
    normalizeDiscordUrl("https://discord.com/channels/123/456"),
    "https://discord.com/channels/123/456",
  );
  assert.equal(normalizeDiscordUrl(""), "");
  assert.equal(normalizeDiscordUrl(), "");
});
test("Discord links reject other sites and unsafe protocols", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://discord.gg/team",
    "https://discord.com.evil.test/team",
    "https://evil.test",
    "https://user:pass@discord.com/channels/1",
    42,
  ])
    assert.throws(() => normalizeDiscordUrl(url), /valid Discord/);
});
test("Discord metadata stays shared when switching maps and affects Save state", () => {
  let plan = validatePlan(createDemoPlan(catalog), catalog);
  const baseline = projectFingerprint(plan);
  assert.equal(projectFingerprint({ ...plan, discordUrl: "" }), baseline);
  const first = plan.activeMapId;
  plan.discordUrl = "discord.gg/team";
  plan = validatePlan(plan, catalog);
  assert.notEqual(projectFingerprint(plan), baseline);
  plan = createMapPlan(plan, "boc", "Rally");
  plan = selectMapPlan(plan, first);
  assert.equal(plan.discordUrl, "https://discord.gg/team");
  assert.throws(
    () => validatePlan({ ...plan, discordUrl: "javascript:alert(1)" }, catalog),
    /valid Discord/,
  );
});
