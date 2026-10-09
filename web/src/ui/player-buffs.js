import { view } from "./dom.js";
import {
  names,
  columns,
  numeric,
  element,
  numberInput,
  table,
} from "./player-fields.js";
import { BUFF_TYPES, BUFF_CONTEXTS } from "../domain/troops.js";
export function createPlayerBuffs({ root }) {
  const $ = view(root);
  let original = {};
  const buffInputs = new Map();
  function render(details) {
    original = details;
    const root = $("player-buffs");
    root.replaceChildren();
    buffInputs.clear();
    for (const context of BUFF_CONTEXTS) {
      root.append(
        element(
          "h3",
          { city: "In-City", rally: "In-Rally", solo: "Solo" }[context],
        ),
      );
      const grid = table(["Buff (%)", ...columns.map((type) => names[type])]);
      for (const stat of BUFF_TYPES) {
        const row = grid.tBodies[0].insertRow();
        row.append(
          element(
            "th",
            stat === "hp" ? "HP" : stat[0].toUpperCase() + stat.slice(1),
          ),
        );
        for (const type of columns) {
          const input = numberInput(
            original.buffs?.[context]?.[type]?.[stat],
            `${context} ${names[type]} ${stat} (%)`,
            true,
          );
          input.dataset.buff = `${context}.${type}.${stat}`;
          row.insertCell().append(input);
          buffInputs.set(input.dataset.buff, input);
        }
      }
      root.append(grid);
    }
  }
  function read() {
    const buffs = structuredClone(original.buffs || {});
    for (const [key, input] of buffInputs) {
      const [context, type, stat] = key.split(".");
      buffs[context] ||= {};
      buffs[context][type] ||= {};
      buffs[context][type][stat] = numeric(input);
    }
    return {
      buffs,
    };
  }
  return {
    render,
    read,
    hasValues: () =>
      [...buffInputs.values()].some((input) => input.value !== ""),
  };
}
