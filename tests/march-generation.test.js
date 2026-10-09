import test from "node:test";
import assert from "node:assert/strict";
import { marchType, marchCapacity } from "../web/src/domain/march-generation.js";

test("march type and capacity use explicit settings before inferred defaults", () => {
  assert.equal(marchType({ name: "Archers" }), "ranged");
  assert.equal(marchType({ name: "Archers", troopType: "siege" }), "siege");
  assert.equal(marchCapacity({ name: "Archers" }, { ranged: 500 }), 500);
  assert.equal(marchCapacity({ name: "Archers", capacityOverride: 700 }, { ranged: 500 }), 700);
  assert.equal(marchCapacity({ name: "Unknown" }), null);
});
