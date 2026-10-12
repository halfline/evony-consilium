import test from "node:test";
import assert from "node:assert/strict";
import { orderByPlayerOwner } from "../web/src/ui/owner-group-order.js";

test("group entries by main player keep level with unowned entries last", () => {
  const plan = {
    keeps: [
      { id: "low", level: 35, ownerId: null },
      { id: "high", level: 42, ownerId: null },
      { id: "alt", level: 40, ownerId: "high" },
    ],
  };
  const entries = [
    { id: "low-1", ownerId: "low" },
    { id: "high-1", ownerId: "high" },
    { id: "none", ownerId: null },
    { id: "low-2", ownerId: "low" },
    { id: "alt-1", ownerId: "alt" },
  ];
  assert.deepEqual(
    orderByPlayerOwner(plan, entries, (item) => item.ownerId).map(
      (item) => item.id,
    ),
    ["high-1", "alt-1", "low-1", "low-2", "none"],
  );
});
