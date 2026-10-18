import { view } from "./dom.js";
import {
  names,
  columns,
  numeric,
  element,
  numberInput,
  table,
} from "./player-fields.js";
import { BUFF_TYPES } from "../domain/troops.js";

export function createPlayerDebuffs({ root }) {
  const $ = view(root);
  let original = {};
  const inputs = new Map();
  $("player-debuffs").addEventListener("keydown", (event) => {
    if (
      event.key !== "Tab" ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      !event.target.matches("[data-debuff]")
    )
      return;
    const [type, stat] = event.target.dataset.debuff.split(".");
    const index =
      columns.indexOf(type) * BUFF_TYPES.length + BUFF_TYPES.indexOf(stat);
    const next = index + (event.shiftKey ? -1 : 1);
    if (next < 0 || next >= columns.length * BUFF_TYPES.length) return;
    event.preventDefault();
    const nextType = columns[Math.floor(next / BUFF_TYPES.length)];
    const nextStat = BUFF_TYPES[next % BUFF_TYPES.length];
    inputs.get(`${nextType}.${nextStat}`).focus();
  });
  function render(details) {
    original = details.debuffs || {};
    inputs.clear();
    const grid = table(["Debuff (%)", ...columns.map((type) => names[type])]);
    for (const stat of BUFF_TYPES) {
      const row = grid.tBodies[0].insertRow();
      const header = element(
        "th",
        stat === "hp" ? "HP" : stat[0].toUpperCase() + stat.slice(1),
      );
      header.scope = "row";
      row.append(header);
      for (const type of columns) {
        const input = numberInput(
          original[type]?.[stat],
          `${names[type]} ${stat} debuff (%)`,
          true,
        );
        input.min = "-1000000";
        input.max = "0";
        input.dataset.debuff = `${type}.${stat}`;
        const normalize = () => {
          const value = numeric(input);
          if (value > 0) input.value = String(-value);
        };
        input.addEventListener("input", normalize);
        input.addEventListener("change", normalize);
        row.insertCell().append(input);
        inputs.set(input.dataset.debuff, input);
      }
    }
    $("player-debuffs").replaceChildren(grid);
  }
  return {
    render,
    read: () => {
      const debuffs = structuredClone(original);
      for (const [key, input] of inputs) {
        const [type, stat] = key.split(".");
        debuffs[type] ||= {};
        debuffs[type][stat] = numeric(input);
      }
      return { debuffs };
    },
    hasValues: () => [...inputs.values()].some((input) => input.value !== ""),
  };
}
