import test from "node:test";
import assert from "node:assert/strict";
import { ensureRallySetter, setRallySetter } from "../web/src/domain/rally.js";
import { autoFormation } from "../web/src/domain/formation.js";
import { createDemoPlan } from "../web/src/domain/plan.js";
import { catalog } from "./fixtures/catalog.js";
test("highest keep is the default and manual choices survive stronger new players", () => {
  const plan = {
    keeps: [
      { id: "low", level: 30, name: "Low" },
      { id: "high", level: 45, name: "High" },
    ],
    rallyId: null,
  };
  ensureRallySetter(plan);
  assert.equal(plan.rallyId, "high");
  const manual = setRallySetter(plan, "low");
  manual.keeps.push({ id: "stronger", level: 50, name: "Stronger" });
  ensureRallySetter(manual);
  assert.equal(manual.rallyId, "low");
  manual.keeps = manual.keeps.filter((player) => player.id !== "low");
  ensureRallySetter(manual);
  assert.equal(manual.rallyId, "stronger");
  assert.equal(manual.rallyManual, false);
});
test("Arrange preserves an unlocked rally setter and ignores old gap, center, and layout settings", () => {
  const plan = createDemoPlan(catalog);
  plan.structures = [];
  plan.obstacles = [];
  const leader = plan.keeps.find((player) => player.id === plan.rallyId);
  leader.x = 100;
  leader.y = 200;
  plan.spacing = 10;
  plan.formation = "diamond";
  plan.center = { x: 800, y: 800 };
  const next = autoFormation(plan);
  const result = next.keeps.find((player) => player.id === plan.rallyId);
  assert.equal(result.x, 100);
  assert.equal(result.y, 200);
  assert.equal(next.spacing, 0);
  assert.equal(next.formation, "rings");
  const nearest = next.keeps
    .filter((player) => player.id !== result.id && !player.locked)
    .sort(
      (a, b) =>
        (a.x - 100) ** 2 +
        (a.y - 200) ** 2 -
        ((b.x - 100) ** 2 + (b.y - 200) ** 2),
    )[0];
  assert.equal((nearest.x - 100) ** 2 + (nearest.y - 200) ** 2, 4);
});
