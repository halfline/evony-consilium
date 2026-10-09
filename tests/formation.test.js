import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "./fixtures/catalog.js";
import { createDemoPlan } from "../web/src/domain/plan.js";
import { autoFormation } from "../web/src/domain/formation.js";
import { canPlace } from "../web/src/domain/placement.js";
const clone = structuredClone;
const keep = (id, level, x = null, y = null) => ({
  id,
  name: id,
  accountId: "",
  level,
  skin: "map-evony1-castle_lv7",
  x,
  y,
  w: 2,
  h: 2,
  locked: false,
});
function planWith(keeps) {
  const p = createDemoPlan(catalog);
  p.keeps = keeps;
  p.structures = [];
  p.obstacles = [];
  p.rallyId = keeps[0]?.id || null;
  return p;
}
test("rally setter stays central and level ranking determines proximity", () => {
  const p = planWith([
    keep("rally", 30),
    keep("low", 20),
    keep("strong", 45),
    ...Array.from({ length: 35 }, (_, i) => keep("k" + i, 44 - i)),
  ]);
  const result = autoFormation(p);
  const leader = result.keeps[0];
  assert.deepEqual([leader.x, leader.y], [600, 600]);
  const ranked = result.keeps.slice(1).sort((a, b) => b.level - a.level);
  const d = (k) => (k.x - leader.x) ** 2 + (k.y - leader.y) ** 2;
  for (let i = 1; i < ranked.length; i++)
    assert.ok(d(ranked[i]) >= d(ranked[i - 1]));
  for (const k of result.keeps) assert.ok(canPlace(k, k.x, k.y, result));
  assert.equal(p.keeps[0].x, null);
});
test("formation respects locked keeps, structures, blockers and mixed footprints", () => {
  const locked = { ...keep("locked", 31, 602, 600), locked: true };
  const p = planWith([
    keep("rally", 45),
    locked,
    ...Array.from({ length: 80 }, (_, i) => ({
      ...keep("k" + i, 40 - (i % 30)),
      w: i % 3 === 0 ? 3 : 2,
      h: i % 3 === 0 ? 3 : 2,
    })),
  ]);
  p.structures = [
    {
      id: "castle",
      name: "Alliance",
      skin: "map-world_castle_guild",
      x: 595,
      y: 595,
      w: 3,
      h: 3,
      locked: true,
    },
  ];
  p.obstacles = [
    { id: "river", name: "River", x: 610, y: 610, w: 5, h: 4, locked: true },
  ];
  const result = autoFormation(p);
  assert.deepEqual(
    result.keeps.find((k) => k.id === "locked"),
    locked,
  );
  assert.deepEqual(result.structures, p.structures);
  for (const k of result.keeps) assert.ok(canPlace(k, k.x, k.y, result));
});
test("a locked rally setter remains the center even when the configured center differs", () => {
  const p = planWith([
    { ...keep("rally", 30, 200, 300), locked: true },
    keep("strong", 45),
  ]);
  const r = autoFormation(p);
  assert.equal(r.keeps[0].x, 200);
  assert.ok(Math.abs(r.keeps[1].x - 200) + Math.abs(r.keeps[1].y - 300) === 2);
});
test("a fully blocked map fails without changing the original plan", () => {
  const p = planWith([keep("rally", 45)]);
  p.obstacles = [{ id: "blocked", x: 0, y: 0, w: 1200, h: 1200 }];
  const original = clone(p);
  assert.throws(() => autoFormation(p), /free position/);
  assert.deepEqual(p, original);
});
test("auto formation handles the edge of the map", () => {
  const p = planWith(
    Array.from({ length: 100 }, (_, i) => keep("k" + i, 50 - (i % 40))),
  );
  p.keeps[0].x = 0;
  p.keeps[0].y = 0;
  const r = autoFormation(p);
  for (const k of r.keeps) assert.ok(canPlace(k, k.x, k.y, r));
});

test("an unplaced rally setter starts near the map midpoint when its center is blocked", () => {
  const plan = planWith([keep("rally", 45), keep("other", 40)]);
  plan.obstacles = [{ id: "blocked", x: 600, y: 600, w: 5, h: 5 }];
  const next = autoFormation(plan);
  for (const player of next.keeps)
    assert.ok(canPlace(player, player.x, player.y, next));
  assert.ok(Math.abs(next.keeps[0].x - 600) < 10);
});
