import { createSubcityCard } from "./subcity-card.js";
import { createSubcityBrowser } from "./subcity-browser.js";
import { createSubcityDialog } from "./subcity-dialog.js";
import { view } from "./dom.js";

export function createSubcitiesScreen({
  root, search, dialog, browser, getPlan, getCatalog,
  canEdit, commit, context,
}) {
  const $ = view(root);
  const grid = $("subcities"), addButton = $("add-subcity");
  const types = () => getCatalog().subcityTypes || [];
  const chooser = createSubcityBrowser({ root: browser, types });
  const editor = createSubcityDialog({
    dialog, getPlan, types, browse: chooser.open,
    closeBrowser: chooser.close, canEdit, commit, context,
  });
  $("subcities-type").hidden = true;
  $("subcities-color").hidden = true;
  addButton.onclick = () => editor.open();
  search.oninput = render;
  function tile(city) {
    const card = createSubcityCard({ city, types: types(), owner:
      getPlan().keeps.find((player) => player.id === city.ownerId) || null,
      open: () => editor.open(city) });
    return card;
  }
  function render() {
    editor.refreshAccess();
    addButton.hidden = !canEdit();
    const query = search.value.trim().toLowerCase();
    const cities = (getPlan().subcities || []).filter((city) =>
      `${city.name} ${city.culture} ${city.color}`.toLowerCase().includes(query));
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
