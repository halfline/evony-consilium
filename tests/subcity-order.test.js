import test from "node:test";
import assert from "node:assert/strict";
import { orderSubcities } from "../web/src/ui/subcity-order.js";

test("subcities group by main owner's keep before sorting by quality", () => {
  const plan = {
    keeps: [
      { id: "low", level: 35, ownerId: null },
      { id: "high", level: 42, ownerId: null },
      { id: "alt", level: 40, ownerId: "high" },
    ],
  };
  const cities = [
    { id: "low-red", ownerId: "low", color: "red", culture: "Europe" },
    { id: "high-blue", ownerId: "high", color: "blue", culture: "Japan" },
    { id: "unowned-red", ownerId: null, color: "red", culture: "Japan" },
    { id: "alt-gold-russia", ownerId: "alt", color: "gold", culture: "Russia" },
    {
      id: "high-gold-europe",
      ownerId: "high",
      color: "gold",
      culture: "Europe",
    },
    { id: "high-gold-japan", ownerId: "high", color: "gold", culture: "Japan" },
    {
      id: "high-gold-russia",
      ownerId: "high",
      color: "gold",
      culture: "Russia",
    },
    { id: "low-white", ownerId: "low", color: "white", culture: "Japan" },
  ];
  assert.deepEqual(
    orderSubcities(plan, cities).map((city) => city.id),
    [
      "high-gold-japan",
      "alt-gold-russia",
      "high-gold-russia",
      "high-gold-europe",
      "high-blue",
      "low-red",
      "low-white",
      "unowned-red",
    ],
  );
});
