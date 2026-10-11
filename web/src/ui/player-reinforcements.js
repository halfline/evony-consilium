import { marchTotals } from "../domain/attack-marches.js";
import { TROOP_TYPES } from "../domain/troops.js";
import { view } from "./dom.js";
import { labelWithIcon } from "./icons.js";
import { createRemoveButton } from "./remove-button.js";
import { bindTileActions } from "./tile-actions.js";
import {
  element,
  names,
  numberInput,
  numeric,
  table,
} from "./player-fields.js";

// Reinforcements are entered explicitly; no troop mix is generated.
export function createPlayerReinforcements({ root }) {
  const $ = view(root);
  let marches = [],
    selectedId = null,
    maxTier = 15;
  bindTileActions($("player-reinforcement-list"), {
    tileSelector: ".march-tile",
    triggerSelector: ".march-card",
    className: "player-actions-open",
  });
  const current = () => marches.find((march) => march.id === selectedId);
  function totalLabel(march) {
    try {
      return `${(marchTotals(march).total ?? 0).toLocaleString()} troops`;
    } catch (error) {
      return error.message;
    }
  }
  function updateTotal() {
    const march = current();
    let total;
    try {
      total = marchTotals(march).total ?? 0;
    } catch (error) {
      $("player-reinforcement-summary").textContent = error.message;
      return;
    }
    const capacity = march.capacityOverride;
    const usage =
      capacity == null
        ? ""
        : total === capacity
          ? " · Full"
          : total < capacity
            ? ` · ${(capacity - total).toLocaleString()} available`
            : ` · ${(total - capacity).toLocaleString()} over capacity`;
    $("player-reinforcement-summary").textContent =
      `${total.toLocaleString()} troops${usage}`;
  }
  function renderEditor() {
    const march = current();
    $("player-reinforcement-list").hidden = true;
    $("player-reinforcement-editor").hidden = false;
    $("player-reinforcement-name").value = march.name;
    $("player-reinforcement-capacity").value = march.capacityOverride ?? "";
    const grid = table(["Tier", ...TROOP_TYPES.map((type) => names[type])]);
    grid.classList.add("reinforcement-layer-table");
    for (let tier = maxTier; tier >= 1; tier--) {
      const row = grid.tBodies[0].insertRow();
      row.dataset.reinforcementTier = tier;
      const label = element("th", `T${tier}`);
      label.scope = "row";
      row.append(label);
      for (const type of TROOP_TYPES) {
        const input = numberInput(
          march.layers.find((layer) => layer.tier === tier)?.[type],
          `T${tier} ${names[type]}`,
        );
        input.dataset.reinforcementType = type;
        input.oninput = () => {
          const value = numeric(input);
          let layer = march.layers.find((item) => item.tier === tier);
          if (!layer && value != null) {
            layer = { tier };
            march.layers.push(layer);
          }
          if (layer) {
            if (value == null) delete layer[type];
            else layer[type] = value;
            if (!TROOP_TYPES.some((troopType) => layer[troopType] != null))
              march.layers = march.layers.filter((item) => item !== layer);
          }
          updateTotal();
        };
        row.insertCell().append(input);
      }
    }
    $("player-reinforcement-troops").replaceChildren(grid);
    updateTotal();
  }
  function showList() {
    selectedId = null;
    $("player-reinforcement-editor").hidden = true;
    const list = $("player-reinforcement-list");
    list.hidden = false;
    list.replaceChildren();
    if (!marches.length)
      list.append(element("p", "No reinforcement marches yet.", "muted"));
    for (const march of marches) {
      const tile = element("div", undefined, "march-tile player-tile");
      const button = element("button", undefined, "march-card");
      button.type = "button";
      button.setAttribute("aria-label", march.name);
      button.append(
        element("strong", march.name),
        element("small", totalLabel(march)),
      );
      button.onclick = () => {
        selectedId = march.id;
        renderEditor();
      };
      const remove = createRemoveButton({
        className: "player-remove",
        label: `Remove ${march.name} reinforcement march`,
        remove: () => {
          marches = marches.filter((item) => item.id !== march.id);
          showList();
        },
      });
      tile.append(button, remove);
      list.append(tile);
    }
    const add = element("button", "＋", "march-add");
    labelWithIcon(add, "plus");
    add.type = "button";
    add.id = "player-add-reinforcement";
    add.setAttribute("aria-label", "Add reinforcement march");
    add.onclick = () => {
      if (marches.length >= 50) return;
      const march = {
        id: crypto.randomUUID(),
        name: "New reinforcement",
        layers: [],
      };
      marches.push(march);
      selectedId = march.id;
      renderEditor();
      $("player-reinforcement-name").focus();
      $("player-reinforcement-name").select();
    };
    list.append(add);
  }
  $("player-reinforcement-back").onclick = showList;
  $("player-reinforcement-name").oninput = () => {
    current().name = $("player-reinforcement-name").value;
  };
  $("player-reinforcement-capacity").oninput = () => {
    const value = numeric($("player-reinforcement-capacity"));
    if (value == null) delete current().capacityOverride;
    else current().capacityOverride = value;
    updateTotal();
  };
  function render(details, level, { preserveView = false } = {}) {
    const next = details.reinforcementMarches || [];
    const nextTier = Math.max(
      level >= 50 ? 17 : level >= 45 ? 16 : 15,
      ...next.flatMap((march) =>
        (march.layers || []).map((layer) => layer.tier),
      ),
    );
    if (
      preserveView &&
      maxTier === nextTier &&
      JSON.stringify(marches) === JSON.stringify(next)
    )
      return;
    const editing = preserveView ? selectedId : null;
    marches = structuredClone(next);
    for (const march of marches) march.layers ||= [];
    maxTier = nextTier;
    selectedId = marches.some((march) => march.id === editing) ? editing : null;
    if (selectedId) renderEditor();
    else showList();
  }
  return {
    render,
    read: () => structuredClone(marches),
    close: showList,
  };
}
