import { MarchDraft } from "../application/march-draft.js";
import { marchType, marchCapacity, initialGeneration } from "../domain/march-generation.js";
import { marchTotals } from "../domain/attack-marches.js";
import { names, columns, numeric, element, numberInput, table } from "./player-fields.js";
import { view } from "./dom.js";
import { renderMarchSettings } from "./player-march-settings.js";

export function createPlayerMarches({ root, getSizes }) {
  const $ = view(root);
  const draft = new MarchDraft(getSizes);
  const addTier = $("player-add-tier");
  let editing = false;
  function updateTotal() {
    const march = draft.current;
    $("player-reset-strategy").hidden = !march.generation.manual;
    $("player-troops").querySelectorAll("[data-share]").forEach((input) => {
      input.disabled = march.generation.manual;
    });
    try {
      const total = marchTotals(march).total;
      const capacity = marchCapacity(march, getSizes());
      const difference =
        capacity == null || total == null ? null : capacity - total;
      const usage =
        difference == null
          ? ""
          : difference === 0
            ? " · Full"
            : difference > 0
              ? ` · ${difference.toLocaleString()} available`
              : ` · ${(-difference).toLocaleString()} over capacity`;
      $("player-troop-summary").textContent =
        draft.errors.get(march.id) ||
        (total == null ? "" : `${total.toLocaleString()} troops${usage}`);
    } catch (error) {
      $("player-troop-summary").textContent = error.message;
    }
  }
  function renderMarch() {
    editing = true;
    $("player-march-list").hidden = true;
    $("player-march-editor").hidden = false;
    const march = draft.current;
    $("player-march-name").value = march.name;
    renderMarchSettings({
      root: $("player-march-settings"),
      march,
      getSizes,
      generate: () => draft.generate(),
      renderMarch,
      explicit: draft.explicit,
    });
    const tableRoot = $("player-troops");
    const grid = table(["Tier", "Share", names[marchType(march)]]);
    grid.classList.add("player-layer-table");
    const tierHeader = element("span", undefined, "player-tier-header");
    tierHeader.append(element("span", "Tier"), addTier);
    grid.tHead.rows[0].cells[0].replaceChildren(tierHeader);
    const typeSelect = element("select");
    typeSelect.id = "player-march-type";
    typeSelect.setAttribute("aria-label", "March troop type");
    for (const type of columns) {
      const option = element("option", names[type]);
      option.value = type;
      typeSelect.append(option);
    }
    typeSelect.value = marchType(march);
    typeSelect.onchange = () => {
      march.troopType = typeSelect.value;
      const fresh = initialGeneration(march, march.generation.highestTier);
      march.generation = {
        ...fresh,
        layerSize: march.generation.layerSize,
        manual: march.generation.manual,
      };
      draft.generate();
      renderMarch();
    };
    grid.tHead.rows[0].cells[2].replaceChildren(typeSelect);
    const tiers = [
      ...new Set([
        ...Array.from({ length: march.generation.highestTier - 9 }, (_, index) => index + 10),
        ...(march.layers || []).map((row) => row.tier),
      ]),
    ].sort((a, b) => b - a);
    for (const tier of tiers) {
      const row = grid.tBodies[0].insertRow();
      row.dataset.tierRow = tier;
      const tierLabel = element("th", String(tier), "player-tier-number");
      tierLabel.scope = "row";
      row.append(tierLabel);
      const share = numberInput(march.generation.weights[tier], `T${tier} share (%)`, true);
      share.max = "100";
      share.dataset.share = tier;
      share.disabled = march.generation.manual;
      share.onchange = () => {
        march.generation.weights[tier] = numeric(share) ?? 0;
        draft.explicit.add(march.id);
        draft.generate();
        renderMarch();
      };
      row.insertCell().append(share);
      const value = march.layers.find((entry) => entry.tier === tier)?.[marchType(march)];
      const input = numberInput(value, `T${tier} ${names[marchType(march)]}`);
      input.dataset.count = marchType(march);
      input.oninput = () => {
        draft.count(tier, marchType(march), numeric(input));
        updateTotal();
      };
      row.insertCell().append(input);
    }
    const label = element("label", "Base layers through tier", "player-boost");
    const through = numberInput(march.baseThrough ?? 9, "Base layers through tier");
    through.id = "player-base-through";
    through.max = "100";
    through.oninput = () => {
      draft.current.baseThrough = numeric(through);
      draft.manual();
      updateTotal();
    };
    label.append(through);
    const baseDetails = element("details");
    baseDetails.append(element("summary", "Base layers"), label);
    const base = table(["Each base tier", ...columns.map((type) => names[type])]);
    const row = base.tBodies[0].insertRow();
    row.append(element("th", "Troops"));
    for (const type of columns) {
      const input = numberInput(march.bases?.[type], `${names[type]} base count per tier`);
      input.dataset.base = type;
      input.oninput = () => {
        draft.base(type, numeric(input));
        updateTotal();
      };
      row.insertCell().append(input);
    }
    baseDetails.append(base);
    tableRoot.replaceChildren(grid, baseDetails);
    updateTotal();
  }
  function showList() {
    editing = false;
    $("player-march-editor").hidden = true;
    const list = $("player-march-list");
    list.hidden = false;
    list.replaceChildren();
    draft.marches.forEach((march, index) => {
      const button = element("button", undefined, "march-card");
      button.type = "button";
      button.dataset.march = march.id;
      button.setAttribute("aria-label", march.name);
      const portrait = element("span", undefined, "map-portrait");
      const image = element("img");
      image.src = `assets/troop-icons/${marchType(march)}.webp`;
      image.alt = "";
      portrait.append(image);
      button.append(portrait, element("strong", march.name));
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
    add.onclick = addMarch;
    list.append(add);
  }
  function addMarch() {
    if (!draft.add()) return;
    renderMarch();
    $("player-march-name").focus();
    $("player-march-name").select();
  }
  $("player-march-back").onclick = showList;
  $("player-march-name").oninput = () => {
    draft.current.name = $("player-march-name").value;
    draft.explicit.add(draft.current.id);
  };
  $("player-reset-strategy").onclick = () => {
    draft.current.generation.manual = false;
    draft.generate();
    renderMarch();
  };
  $("player-remove-march").onclick = () => {
    draft.remove();
    showList();
  };
  addTier.onclick = () => {
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
