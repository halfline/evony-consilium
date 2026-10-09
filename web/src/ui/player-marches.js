import { MarchDraft } from "../application/march-draft.js";
import { marchType, marchCapacity } from "../domain/march-generation.js";
import { marchTotals } from "../domain/attack-marches.js";
import { names, columns, numeric, element, numberInput, table } from "./player-fields.js";
import { view } from "./dom.js";

export function createPlayerMarches({ root, getSizes }) {
  const $ = view(root);
  const draft = new MarchDraft(getSizes);
  let editing = false;
  function updateTotal() {
    const march = draft.current;
    const total = marchTotals(march).total;
    const capacity = marchCapacity(march, getSizes());
    $("player-troop-summary").textContent =
      `${total.toLocaleString()} troops` + (capacity == null ? "" : ` · ${(capacity - total).toLocaleString()} available`);
  }
  function renderMarch() {
    editing = true;
    $("player-march-list").hidden = true;
    $("player-march-editor").hidden = false;
    $("player-reset-strategy").hidden = true;
    const march = draft.current;
    $("player-march-name").value = march.name;
    const tableRoot = $("player-troops");
    const grid = table(["Tier", names[marchType(march)]]);
    for (let tier = march.generation.highestTier; tier >= 10; tier--) {
      const row = grid.tBodies[0].insertRow();
      row.append(element("th", `T${tier}`));
      const value = march.layers.find((entry) => entry.tier === tier)?.[marchType(march)];
      const input = numberInput(value, `T${tier} ${names[marchType(march)]}`);
      input.dataset.count = marchType(march);
      input.oninput = () => {
        draft.count(tier, marchType(march), numeric(input));
        updateTotal();
      };
      row.insertCell().append(input);
    }
    const base = table(["Base", ...columns.map((type) => names[type])]);
    const row = base.tBodies[0].insertRow();
    row.append(element("th", "Troops"));
    for (const type of columns) {
      const input = numberInput(march.bases?.[type], `${names[type]} base count`);
      input.dataset.base = type;
      input.oninput = () => {
        draft.base(type, numeric(input));
        updateTotal();
      };
      row.insertCell().append(input);
    }
    tableRoot.replaceChildren(grid, base);
    updateTotal();
  }
  function showList() {
    editing = false;
    $("player-march-editor").hidden = true;
    const list = $("player-march-list");
    list.hidden = false;
    list.replaceChildren();
    draft.marches.forEach((march, index) => {
      const button = element("button", march.name, "march-card");
      button.type = "button";
      button.dataset.march = march.id;
      button.onclick = () => {
        draft.currentIndex = index;
        renderMarch();
      };
      list.append(button);
    });
    const add = element("button", "＋", "march-add");
    add.type = "button";
    add.id = "player-add-march";
    add.setAttribute("aria-label", "Add attack march");
    add.onclick = () => {
      if (draft.add()) renderMarch();
    };
    list.append(add);
  }
  $("player-march-back").onclick = showList;
  $("player-march-name").oninput = () => {
    draft.current.name = $("player-march-name").value;
    draft.explicit.add(draft.current.id);
  };
  $("player-remove-march").onclick = () => {
    draft.remove();
    showList();
  };
  $("player-add-tier").onclick = () => {
    draft.addTier();
    renderMarch();
  };
  function render(details, level) {
    draft.load(details, level);
    showList();
  }
  return {
    render,
    read: () => draft.read(),
    syncSizes: () => {
      draft.syncSizes();
      if (editing) renderMarch();
    },
  };
}
