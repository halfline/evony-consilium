import { view } from "./dom.js";
import {
  names,
  columns,
  numeric,
  element,
  numberInput,
  table,
} from "./player-fields.js";
import { MARCH_SIZE_BOOST } from "../domain/troops.js";

export function createPlayerMarchSizes({ root }) {
  const $ = view(root);
  let original = {};
  const inputs = new Map();
  function render(details) {
    original = details.marchSizes || {};
    inputs.clear();
    const grid = table([
      `March size (+${MARCH_SIZE_BOOST}%)`,
      ...columns.map((type) => names[type]),
    ]);
    const row = grid.tBodies[0].insertRow();
    row.append(element("th", "Troops"));
    for (const type of columns) {
      const input = numberInput(original[type], `${names[type]} march size`);
      input.dataset.marchSize = type;
      row.insertCell().append(input);
      inputs.set(type, input);
    }
    $("player-march-sizes").replaceChildren(grid);
  }
  return {
    render,
    read: () => ({
      marchSizes: {
        ...original,
        ...Object.fromEntries(
          [...inputs].map(([type, input]) => [type, numeric(input)]),
        ),
      },
    }),
    hasValues: () => [...inputs.values()].some((input) => input.value !== ""),
  };
}
