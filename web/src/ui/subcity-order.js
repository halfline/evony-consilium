import { SUBCITY_COLORS, SUBCITY_CULTURES } from "../domain/subcities.js";
import { orderByPlayerOwner } from "./owner-group-order.js";

const colors = [...SUBCITY_COLORS].reverse().map((color) => color.id);
const cultures = [
  "Japan",
  "Russia",
  ...SUBCITY_CULTURES.filter(
    (culture) => !["Japan", "Russia"].includes(culture),
  ),
];

export function compareSubcityQuality(a, b) {
  return (
    colors.indexOf(a.color) - colors.indexOf(b.color) ||
    cultures.indexOf(a.culture) - cultures.indexOf(b.culture)
  );
}

export function orderSubcities(plan, cities) {
  return orderByPlayerOwner(
    plan,
    cities,
    (city) => city.ownerId,
    compareSubcityQuality,
  );
}
