import { element } from "./player-fields.js";
import { TROOP_NAMES, TROOP_TYPES } from "../domain/troops.js";

export const categories = [
  ["buffs", "Buffs"],
  ["debuffs", "Debuffs"],
  ["march-size", "March size (+200%)"],
  ["rally", "Rally capacity"],
  ["level", "Keep level"],
];
export const troops = TROOP_TYPES.map((type) => [type, TROOP_NAMES[type]]);
export const contexts = [
  ["city", "In-City"],
  ["rally", "In-Rally"],
  ["solo", "Solo"],
];
export function control(label, node) {
  const wrapper = element("label", label);
  wrapper.append(node);
  return wrapper;
}
export function select(label, choices, view = false) {
  const node = element("select");
  node.setAttribute("aria-label", label);
  if (view) node.dataset.progressView = label;
  setOptions(node, choices);
  return node;
}
function setOptions(node, choices) {
  node.replaceChildren(
    ...choices.map(([value, label]) => {
      const option = element("option", label);
      option.value = value;
      return option;
    }),
  );
}
export const metricName = (metric) =>
  metric.stat === "hp"
    ? "HP"
    : metric.stat
      ? metric.stat[0].toUpperCase() + metric.stat.slice(1)
      : metric.label;
