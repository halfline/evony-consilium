import { TROOP_NAMES, TROOP_TYPES } from "../domain/troops.js";

export const names = TROOP_NAMES;
export const columns = TROOP_TYPES;
export const numeric = (input) =>
  input.value === "" ? null : Number(input.value);
export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function numberInput(value, label, decimal = false) {
  const input = element("input");
  input.type = "number";
  input.min = "0";
  input.step = decimal ? "any" : "1";
  input.value = value ?? "";
  input.placeholder = "—";
  input.inputMode = decimal ? "decimal" : "numeric";
  input.setAttribute("aria-label", label);
  return input;
}
export function table(headers) {
  const node = element("table", undefined, "player-data-table");
  const head = node.createTHead().insertRow();
  for (const name of headers) {
    const header = element("th", name);
    header.scope = "col";
    head.append(header);
  }
  node.createTBody();
  return node;
}
