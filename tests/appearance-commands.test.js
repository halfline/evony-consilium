import test from "node:test";
import assert from "node:assert/strict";
import { changeAppearance } from "../web/src/domain/appearance-commands.js";

function fixture(collection) {
  const entity = {
    id: "a",
    name: "A",
    skin: "old",
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    locked: false,
  };
  if (collection === "keeps")
    Object.assign(entity, {
      level: 42,
      accountId: "",
      allianceTag: "",
      details: { notes: "Preserve" },
    });
  return {
    extent: 100,
    keeps: [],
    structures: [],
    obstacles: [],
    [collection]: [entity],
  };
}
for (const collection of ["keeps", "structures"]) {
  test(`${collection} appearance changes share footprint checks and preserve the input`, () => {
    const plan = fixture(collection);
    const snapshot = structuredClone(plan);
    const next = changeAppearance(plan, "a", { id: "new", footprint: 3 });
    assert.equal(next[collection][0].skin, "new");
    assert.equal(next[collection][0].w, 3);
    assert.deepEqual(plan, snapshot);
    plan.obstacles.push({ id: "occupied", x: 2, y: 0, w: 1, h: 1 });
    assert.throws(
      () => changeAppearance(plan, "a", { id: "new", footprint: 3 }),
      /overlaps/,
    );
    assert.equal(plan[collection][0].skin, "old");
    plan[collection][0].x = plan[collection][0].y = null;
    assert.equal(
      changeAppearance(plan, "a", { id: "new", footprint: 3 })[collection][0].w,
      3,
    );
  });
}
