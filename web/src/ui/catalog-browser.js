import { castlePickerEntries, castleForLevel } from "../domain/castles.js";
import { view, option } from "./dom.js";
import { artPreview } from "./art-preview.js";
export function createCatalogBrowser({
  root,
  variantDialog,
  assets,
  getCatalog,
  selected,
}) {
  const $ = view(root, variantDialog);
  $("catalog-search").oninput = render;
  $("catalog-category").onchange = render;
  let catalogKind = "keep",
    catalogCallback = null;
  function open(kind, callback) {
    catalogKind = kind;
    catalogCallback = callback;
    $("catalog-title").textContent =
      kind === "keep" ? "Choose a castle" : "Choose a " + kind + " sprite";
    $("catalog-search").value = "";
    $("catalog-category").replaceChildren(
      option("", "All castles"),
      ...(getCatalog().keepCategories || []).map((category) =>
        option(category.id, category.name),
      ),
    );
    $("catalog-category").value = "";
    $("catalog-category").hidden = kind !== "keep";
    $("catalog-chips").hidden = kind !== "keep";
    $("catalog-chips").replaceChildren(
      ...[
        { id: "", name: "All castles" },
        ...(getCatalog().keepCategories || []),
      ].map((category) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.category = category.id;
        button.textContent = category.name;
        button.onclick = () => {
          $("catalog-category").value = category.id;
          render();
        };
        return button;
      }),
    );
    render();
    $("catalog-dialog").showModal();
  }
  function render() {
    const q = $("catalog-search").value.toLowerCase(),
      filter = $("catalog-category").value;
    const entries = castlePickerEntries(
      [...assets.values()].filter(
        (asset) => asset.kind === catalogKind && !asset.legacyOnly,
      ),
    );
    const list = entries.filter((entry) =>
      entry.variants.some(
        (asset) =>
          (!filter || asset.categories?.includes(filter)) &&
          [
            entry.name,
            asset.name,
            asset.variantName || "",
            ...(asset.aliases || []),
            "tier " + asset.tier,
            asset.id,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q),
      ),
    );
    for (const chip of $("catalog-chips").querySelectorAll("button"))
      chip.setAttribute(
        "aria-pressed",
        String(chip.dataset.category === filter),
      );
    const noun = catalogKind === "keep" ? "castle" : "sprite";
    $("catalog-results").textContent =
      `${list.length} ${noun}${list.length === 1 ? "" : "s"}${filter || q ? " matching your filters" : " to explore"}`;
    $("catalog-grid").replaceChildren(
      ...list.map((family) => {
        const variants = family.variants;
        const a = family.automatic
          ? castleForLevel(variants, selected()?.level || 35)
          : family.variants.find((a) => !a.unavailable) ||
            variants.find((a) => !a.unavailable) ||
            family.variants[0];
        const b = document.createElement("button");
        b.className =
          "castle-card" +
          (variants.some((a) => selected()?.skin === a.id) ? " selected" : "");
        b.dataset.asset = a.id;
        b.dataset.family = family.family;
        b.dataset.group = family.id;
        b.disabled = variants.every((a) => a.unavailable);
        b.type = "button";
        b.setAttribute(
          "aria-pressed",
          String(variants.some((asset) => selected()?.skin === asset.id)),
        );
        const im = artPreview(a.previewSrc || a.src, family.name);
        const name = document.createElement("strong");
        name.textContent = family.name;
        name.title = family.name;
        b.append(im, name);
        if (!family.automatic && variants.length > 1) {
          const tier = document.createElement("small");
          tier.textContent = variants.length + " tiers";
          b.append(tier);
        }
        b.onclick = () => {
          if (family.automatic || variants.length === 1) {
            $("catalog-dialog").close();
            catalogCallback(a);
          } else {
            $("variant-title").textContent = family.name;
            $("variant-grid").replaceChildren(
              ...variants
                .sort((a, b) => a.tier - b.tier)
                .map((variant) => {
                  const button = document.createElement("button");
                  button.className = "castle-card";
                  button.dataset.asset = variant.id;
                  button.disabled = !!variant.unavailable;
                  button.type = "button";
                  button.setAttribute(
                    "aria-pressed",
                    String(selected()?.skin === variant.id),
                  );
                  const img = artPreview(
                    variant.previewSrc || variant.src,
                    variant.variantName || "Tier " + variant.tier,
                  );
                  const label = document.createElement("strong");
                  label.textContent =
                    variant.variantName || "Tier " + variant.tier;
                  button.append(img, label);
                  if (variant.unavailable) {
                    const note = document.createElement("small");
                    note.textContent = "Resource unavailable in this snapshot";
                    button.append(note);
                  }
                  button.onclick = () => {
                    $("variant-dialog").close();
                    $("catalog-dialog").close();
                    catalogCallback(variant);
                  };
                  return button;
                }),
            );
            $("variant-dialog").showModal();
          }
        };
        return b;
      }),
    );
    if (!list.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "No matching sprites. Try another name or category.";
      $("catalog-grid").append(p);
      const clear = document.createElement("button");
      clear.type = "button";
      clear.textContent = "Clear filters";
      clear.onclick = () => {
        $("catalog-search").value = "";
        $("catalog-category").value = "";
        render();
        $("catalog-search").focus();
      };
      $("catalog-grid").append(clear);
    }
  }

  return { open, render };
}
