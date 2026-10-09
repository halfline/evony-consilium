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

test("profile edits cannot write placements and retain other player data", async () => {
  const { editPlayerProfile } = await import("../web/src/domain/players.js");
  const { createMapPlan, selectMapPlan, syncMapLayouts } = await import(
    "../web/src/domain/map-plans.js"
  );
  let plan = validatePlan(createDemoPlan(catalog), catalog);
  const first = plan.activeMapId;
  const player = structuredClone(plan.keeps[0]);
  // A future profile extension must survive every existing map and profile operation.
  plan.keeps[0].stats = { marchSize: 2000000, troops: { ground: 1000000 } };
  plan = createMapPlan(plan, "boc", "Rally");
  plan.keeps[0].x = 10;
  plan.keeps[0].y = 20;
  syncMapLayouts(plan);
  const edited = editPlayerProfile(plan, player.id, {
    name: "New name",
    level: 42,
    x: 999,
    locked: true,
  });
  assert.equal(edited.keeps[0].x, 10);
  assert.equal(edited.keeps[0].locked, false);
  assert.deepEqual(edited.keeps[0].stats, plan.keeps[0].stats);
  const restored = selectMapPlan(edited, first);
  assert.equal(restored.keeps[0].x, player.x);
  assert.equal(restored.keeps[0].name, "New name");
  assert.deepEqual(
    validatePlan(restored, catalog).keeps[0].stats,
    plan.keeps[0].stats,
  );
  assert.equal(plan.keeps[0].name, player.name);
});
