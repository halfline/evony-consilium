import test from "node:test";
import assert from "node:assert/strict";
import { newPlayer } from "../web/src/domain/players.js";
import { createEmptyPlan, createDemoPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";
import { catalog } from "./fixtures/catalog.js";
test("new players default to K42 Japan, reuse a tag, and have no map placement", () => {
  const assets = new Map(catalog.assets.map((asset) => [asset.id, asset]));
  const player = newPlayer(assets, "TEAM");
  assert.equal(player.level, 42);
  assert.equal(assets.get(player.skin).family, "culture-japan");
  assert.equal(player.allianceTag, "TEAM");
  assert.equal(player.x, null);
  assert.equal(player.y, null);
  assert.equal(player.accountId, "");
  const plan = createEmptyPlan();
  player.name = "Player";
  plan.keeps.push(player);
  assert.equal(validatePlan(plan, catalog).keeps[0].allianceTag, "TEAM");
});
test("legacy project tags become player tags without overriding individual tags", () => {
  const plan = createDemoPlan(catalog);
  plan.allianceTag = "OLD";
  plan.keeps[0].allianceTag = "OTHER";
  const validated = validatePlan(plan, catalog);
  assert.equal(validated.keeps[0].allianceTag, "OTHER");
  assert.equal(validated.keeps[1].allianceTag, "OLD");
  assert.equal("allianceTag" in validated, false);
  validated.keeps[0].allianceTag = "a".repeat(17);
  assert.throws(() => validatePlan(validated, catalog), /alliance tag/);
});

