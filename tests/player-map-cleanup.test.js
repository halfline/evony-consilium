import test from "node:test";
import assert from "node:assert/strict";
import { createDemoPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";
import { removePlayer } from "../web/src/domain/players.js";
import { catalog } from "./fixtures/catalog.js";

test("removing a player also removes references from inactive maps", () => {
  const plan = validatePlan(createDemoPlan(catalog), catalog);
  const id = plan.keeps[0].id;
  const inactive = structuredClone(plan.maps[0]);
  inactive.id = "inactive";
  plan.maps.push(inactive);
  const next = removePlayer(plan, id);
  assert.equal(next.keeps.some((player) => player.id === id), false);
  assert.equal(next.maps.every((map) =>
    map.layout.positions.every((position) => position.id !== id)), true);
  assert.equal(plan.maps[0].layout.positions.some((position) => position.id === id), true);
});
