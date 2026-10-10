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
  let activeContext = "city";
  $("player-buffs").addEventListener("keydown", (event) => {
    if (
      event.key !== "Tab" ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      !event.target.matches("[data-buff]")
    )
      return;
    const [context, type, stat] = event.target.dataset.buff.split(".");
    const index =
      columns.indexOf(type) * BUFF_TYPES.length + BUFF_TYPES.indexOf(stat);
    const next = index + (event.shiftKey ? -1 : 1);
    if (next < 0 || next >= columns.length * BUFF_TYPES.length) return;
    event.preventDefault();
    const nextType = columns[Math.floor(next / BUFF_TYPES.length)];
    const nextStat = BUFF_TYPES[next % BUFF_TYPES.length];
    buffInputs.get(`${context}.${nextType}.${nextStat}`).focus();
  });
  function render(details) {
    original = details;
    const root = $("player-buffs");
    root.replaceChildren();
    buffInputs.clear();
    const switcher = element("div", undefined, "buff-context-switcher");
    switcher.setAttribute("role", "group");
    switcher.setAttribute("aria-label", "Buff context");
    const labels = { city: "In-City", rally: "In-Rally", solo: "Solo" };
    for (const context of BUFF_CONTEXTS) {
      const button = element("button", labels[context]);
      button.type = "button";
      button.dataset.buffContext = context;
      button.onclick = () => showContext(context);
      switcher.append(button);
    }
    root.append(switcher);
    for (const context of BUFF_CONTEXTS) {
      const section = element("section", undefined, "buff-section");
      section.dataset.buffSection = context;
      section.append(element("h3", labels[context]));
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
      for (const header of grid.tBodies[0].querySelectorAll("th"))
        header.scope = "row";
      section.append(grid);
      root.append(section);
    }
    showContext(activeContext);
  }
  function showContext(context) {
    activeContext = context;
    for (const button of $("player-buffs").querySelectorAll(
      "[data-buff-context]",
    ))
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.buffContext === context),
      );
    for (const section of $("player-buffs").querySelectorAll(
      "[data-buff-section]",
    ))
      section.classList.toggle(
        "active-context",
        section.dataset.buffSection === context,
      );
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
    reveal: (input) => {
      const context = input?.dataset.buff?.split(".")[0];
      if (context) showContext(context);
    },
    hasValues: () =>
      [...buffInputs.values()].some((input) => input.value !== ""),
  };
}
