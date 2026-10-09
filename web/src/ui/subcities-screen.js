import { createSubcityCard } from "./subcity-card.js";
import { createSubcityBrowser } from "./subcity-browser.js";
import { createSubcityDialog } from "./subcity-dialog.js";
import { view } from "./dom.js";
import { bindTileActions } from "./tile-actions.js";
import { removeSubcity } from "../domain/subcities.js";

export function createSubcitiesScreen({
  root, search, dialog, browser, getPlan, getCatalog,
  canEdit, commit, context, status,
}) {
  const $ = view(root);
  const grid = $("subcities"), addButton = $("add-subcity");
  const types = () => getCatalog().subcityTypes || [];
  const chooser = createSubcityBrowser({ root: browser, types });
  const editor = createSubcityDialog({
    dialog, getPlan, types, browse: chooser.open,
    closeBrowser: chooser.close, canEdit, commit, context,
  });
  $("subcities-type").oninput = render;
  $("subcities-color").hidden = true;
  bindTileActions(grid, {
    tileSelector: ".subcity-tile",
    triggerSelector: ".subcity-card",
    className: "player-actions-open",
    enabled: canEdit,
  });
  addButton.onclick = () => editor.open();
  search.oninput = render;
  function tile(city) {
    const card = createSubcityCard({ city, types: types(), owner:
      getPlan().keeps.find((player) => player.id === city.ownerId) || null,
      open: () => editor.open(city),
      remove: canEdit() ? () => {
        try {
          if (canEdit()) commit(removeSubcity(getPlan(), city.id));
        } catch (error) { status(error.message, true); }
      } : null });
    return card;
  }
  function render() {
    editor.refreshAccess();
    addButton.hidden = !canEdit();
    const query = search.value.trim().toLowerCase();
    const cities = (getPlan().subcities || []).filter((city) => {
      const type = types().find((type) => type.id === city.cityType);
      const category = city.cityType ? type?.category : city.culture ? "culture" : "";
      return `${city.name} ${city.culture} ${city.color}`.toLowerCase().includes(query) &&
        (!$("subcities-type").value || category === $("subcities-type").value);
    });
    $("subcities-empty").hidden = cities.length > 0;
    grid.replaceChildren(...cities.map(tile), addButton);
  }
  return {
    render,
    open: (id) => {
      const city = getPlan().subcities.find((city) => city.id === id);
      if (city) editor.open(city);
    },
  };
}
