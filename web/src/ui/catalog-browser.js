import { castlePickerEntries, castleForLevel } from "../domain/castles.js";
import { view, option } from "./dom.js";
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
        const im = document.createElement("img");
        im.src = a.previewSrc || a.src;
        im.alt = family.name;
        im.loading = "lazy";
        const name = document.createElement("strong");
        name.textContent = family.name;
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
                  const img = document.createElement("img");
                  img.src = variant.previewSrc || variant.src;
                  img.alt = variant.variantName || "Tier " + variant.tier;
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
      p.textContent = "No matching sprites.";
      $("catalog-grid").append(p);
    }
  }

  return { open, render };
}
