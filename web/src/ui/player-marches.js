import { MarchDraft } from "../application/march-draft.js";
import { view } from "./dom.js";
import { labelWithIcon } from "./icons.js";
import { createRemoveButton } from "./remove-button.js";
import { bindTileActions } from "./tile-actions.js";
import {
  names,
  columns,
  numeric,
  element,
  numberInput,
  table,
} from "./player-fields.js";
import { marchTotals } from "../domain/attack-marches.js";
import {
  marchType,
  marchCapacity,
  initialGeneration,
  strategyWeights,
} from "../domain/march-generation.js";
import { renderMarchSettings } from "./player-march-settings.js";

export function createPlayerMarches({ root, getSizes }) {
  const $ = view(root);
  const draft = new MarchDraft(getSizes);
  const addTier = $("player-add-tier");
  let editing = false,
    sizes;
  bindTileActions($("player-march-list"), {
    tileSelector: ".march-tile",
    triggerSelector: ".march-card",
    className: "player-actions-open",
  });
  const generate = () => draft.generate();
  function syncSizes() {
    const nextSizes = JSON.stringify(getSizes());
    if (sizes === nextSizes) return;
    sizes = nextSizes;
    draft.syncSizes();
    if (editing) renderMarch();
  }
  function updateTotal() {
    const march = draft.current;
    $("player-reset-strategy").hidden = !march.generation.manual;
    $("player-troops")
      .querySelectorAll("[data-share]")
      .forEach((input) => {
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
      generate,
      renderMarch,
      explicit: draft.explicit,
    });
    const type = marchType(march);
    const root = $("player-troops");
    root.replaceChildren();
    const grid = table(["Tier", "Share (%)", ""]);
    grid.classList.add("player-layer-table");
    const tierHeader = element("span", undefined, "player-tier-header");
    tierHeader.append(element("span", "Tier"), addTier);
    grid.tHead.rows[0].cells[0].replaceChildren(tierHeader);
    const typeSelect = element("select");
    typeSelect.id = "player-march-type";
    typeSelect.setAttribute("aria-label", "March troop type");
    for (const troopType of columns) {
      const option = element("option", names[troopType]);
      option.value = troopType;
      typeSelect.append(option);
    }
    const littleSiege = element("option", "Siege (little)");
    littleSiege.value = "small-siege";
    typeSelect.append(littleSiege);
    typeSelect.value =
      type === "siege" && march.generation.strategy === "small-siege"
        ? "small-siege"
        : type;
    typeSelect.onchange = () => {
      const nextType =
        typeSelect.value === "small-siege" ? "siege" : typeSelect.value;
      march.troopType = nextType;
      const fresh = initialGeneration(march, march.generation.highestTier);
      fresh.strategy =
        nextType === "siege"
          ? typeSelect.value === "small-siege"
            ? "small-siege"
            : "big-siege"
          : "balanced";
      fresh.weights = strategyWeights(
        nextType,
        fresh.strategy,
        fresh.highestTier,
      );
      march.generation = {
        ...fresh,
        layerSize: march.generation.layerSize,
        manual: march.generation.manual,
      };
      draft.markEdited();
      generate();
      renderMarch();
    };
    grid.tHead.rows[0].cells[2].append(typeSelect);
    const tiers = [
      ...new Set([
        ...Array.from(
          { length: march.generation.highestTier - 9 },
          (_, index) => index + 10,
        ),
        ...(march.layers || []).map((row) => row.tier),
      ]),
    ].sort((a, b) => b - a);
    for (const tier of tiers) {
      const row = grid.tBodies[0].insertRow();
      row.dataset.tierRow = tier;
      const tierLabel = element("th", String(tier), "player-tier-number");
      tierLabel.scope = "row";
      row.append(tierLabel);
      const share = numberInput(
        march.generation.weights[tier],
        `T${tier} share (%)`,
        true,
      );
      share.max = "100";
      share.dataset.share = tier;
      share.disabled = march.generation.manual;
      share.onchange = () => {
        march.generation.weights[tier] = numeric(share) ?? 0;
        draft.explicit.add(march.id);
        generate();
        renderMarch();
      };
      row.insertCell().append(share);
      const data = march.layers?.find((layer) => layer.tier === tier);
      for (const troopType of [type]) {
        const input = numberInput(
          data?.[troopType],
          `T${tier} ${names[troopType]}`,
        );
        input.dataset.count = troopType;
        input.oninput = () => {
          draft.count(tier, troopType, numeric(input));
          updateTotal();
        };
        row.insertCell().append(input);
      }
    }
    root.append(grid);
    const label = element("label", "Base layers through tier", "player-boost");
    const through = numberInput(
      march.baseThrough ?? 9,
      "Base layers through tier",
    );
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
    const base = table([
      "Each base tier",
      ...columns.map((type) => names[type]),
    ]);
    const row = base.tBodies[0].insertRow();
    row.append(element("th", "Troops"));
    for (const type of columns) {
      const input = numberInput(
        march.bases?.[type],
        `${names[type]} base count per tier`,
      );
      input.dataset.base = type;
      input.oninput = () => {
        draft.base(type, numeric(input));
        updateTotal();
      };
      row.insertCell().append(input);
    }
    baseDetails.append(base);
    root.append(baseDetails);
    updateTotal();
  }
  function showList() {
    editing = false;
    $("player-march-editor").hidden = true;
    const root = $("player-march-list");
    root.hidden = false;
    root.replaceChildren();
    draft.marches.forEach((march, index) => {
      const tile = element("div", undefined, "march-tile player-tile");
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
      const remove = createRemoveButton({
        className: "player-remove",
        label: `Remove ${march.name} march`,
        remove: () => {
          draft.currentIndex = index;
          draft.remove();
          showList();
        },
      });
      remove.dataset.marchRemove = march.id;
      tile.append(button, remove);
      root.append(tile);
    });
    const add = element("button", "＋", "march-add");
    labelWithIcon(add, "plus");
    add.type = "button";
    add.id = "player-add-march";
    add.setAttribute("aria-label", "Add attack march");
    add.onclick = addMarch;
    root.append(add);
  }
  $("player-march-back").onclick = showList;
  $("player-march-name").oninput = () => {
    draft.current.name = $("player-march-name").value;
    draft.explicit.add(draft.current.id);
  };
  $("player-reset-strategy").onclick = () => {
    draft.current.generation.manual = false;
    generate();
    renderMarch();
  };
  addTier.onclick = () => {
    draft.addTier();
    renderMarch();
  };
  function addMarch() {
    if (!draft.add()) return;
    renderMarch();
    $("player-march-name").focus();
    $("player-march-name").select();
  }
  function render(details, level, { preserveView = false } = {}) {
    // Saving unchanged march data should not replace controls under the user's
    // cursor. Keep the live draft objects too, since handlers refer to them.
    const nextSizes = JSON.stringify(getSizes());
    if (
      preserveView &&
      sizes === nextSizes &&
      draft.maxTier === (level >= 50 ? 17 : level >= 45 ? 16 : 15) &&
      JSON.stringify(draft.read()) === JSON.stringify(details.marches || [])
    ) {
      draft.original = structuredClone(details);
      return;
    }
    const selected = preserveView && editing ? draft.current : null;
    const transient =
      selected &&
      !draft.original.marches?.some((march) => march.id === selected.id);
    const baseOpen = $("player-troops").querySelector("details")?.open;
    draft.load(details, level);
    sizes = nextSizes;
    const index = selected
      ? draft.marches.findIndex(
          (march) =>
            march.id === selected.id ||
            (transient &&
              march.name === selected.name &&
              marchType(march) === marchType(selected)),
        )
      : -1;
    if (index >= 0) {
      draft.currentIndex = index;
      renderMarch();
      $("player-troops").querySelector("details").open = !!baseOpen;
    } else showList();
  }
  return { render, read: () => draft.read(), syncSizes, close: showList };
}
