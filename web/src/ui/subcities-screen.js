import { createSubcityOwnerPicker } from "./subcity-owner-picker.js";
import { createSubcityCard } from "./subcity-card.js";
import { createSubcityBrowser } from "./subcity-browser.js";
import { createSubcityDialog } from "./subcity-dialog.js";
import { view } from "./dom.js";
import { bindTileActions } from "./tile-actions.js";
import { removeSubcity } from "../domain/subcities.js";
import { createCollectionControls } from "./collection-controls.js";
import { orderSubcities } from "./subcity-order.js";
import {
  subcityFilterCategory,
  subcityTypeOptions,
} from "./subcity-filters.js";

export function createSubcitiesScreen({
  root,
  search,
  dialog,
  browser,
  ownerBrowser,
  getAvatars,
  locate,
  getPlan,
  getCatalog,
  canEdit,
  commit,
  status,
  context,
}) {
  const $ = view(root);
  const grid = $("subcities"),
    addButton = $("add-subcity");
  const collection = createCollectionControls({
    root,
    grid,
    add: addButton,
    title: "Subcities",
    description: "Your cities, coordinates, and owners",
    label: "Add subcity",
    kind: "subcities",
    emptyTitle: $("subcities-empty"),
  });
  const filter = view(root.closest("#planner"));
  filter("subcities-type").replaceChildren(...subcityTypeOptions());
  const types = () => getCatalog().subcityTypes || [];
  const chooser = createSubcityBrowser({ root: browser, types });
  const owners = createSubcityOwnerPicker({
    root: ownerBrowser,
    getPlan,
    getAvatars,
    locate,
  });
  const editor = createSubcityDialog({
    dialog,
    getPlan,
    types,
    browse: chooser.open,
    browseOwner: owners.open,
    renderOwner: owners.renderOwner,
    closeBrowser: () => {
      chooser.close();
      owners.close();
    },
    canEdit,
    commit,
    context,
    locate,
    status,
  });
  bindTileActions(grid, {
    tileSelector: ".subcity-tile",
    triggerSelector: ".subcity-card",
    className: "player-actions-open",
    enabled: canEdit,
  });
  addButton.onclick = () => editor.open();
  search.oninput = render;
  for (const id of ["subcities-type", "subcities-color"])
    filter(id).oninput = render;
  function tile(city) {
    return createSubcityCard({
      city,
      types: types(),
      owner:
        getPlan().keeps.find((player) => player.id === city.ownerId) || null,
      open: () => editor.open(city),
      remove: canEdit()
        ? () => {
            try {
              if (canEdit()) commit(removeSubcity(getPlan(), city.id));
            } catch (error) {
              status(error.message, true);
            }
          }
        : null,
    });
  }
  function render() {
    editor.refreshAccess();
    addButton.hidden = !canEdit();
    const query = search.value.trim().toLowerCase();
    const cities = (getPlan().subcities || []).filter((city) => {
      const owner = getPlan().keeps.find(
        (player) => player.id === city.ownerId,
      );
      const type = types().find((type) => type.id === city.cityType);
      const category = subcityFilterCategory(type, city.culture);
      return (
        `${city.name} ${type?.name || ""} ${city.culture} ${city.color} ${owner?.name || ""} ${owner?.allianceTag || ""}`
          .toLowerCase()
          .includes(query) &&
        (!filter("subcities-type").value ||
          category === filter("subcities-type").value) &&
        (!filter("subcities-color").value ||
          city.color === filter("subcities-color").value)
      );
    });
    const filtered = !!(
      query ||
      filter("subcities-type").value ||
      filter("subcities-color").value
    );
    orderSubcities(getPlan(), cities);
    collection.render({
      count: cities.length,
      total: getPlan().subcities?.length || 0,
      filtered,
      emptyTitle: getPlan().subcities?.length
        ? "No matching subcities."
        : "No subcities yet.",
      help: filtered
        ? "Try a different name, city type, or color."
        : "Keep your alliance’s subcities and their owners in one place.",
      clear: () => {
        search.value = "";
        filter("subcities-type").value = "";
        filter("subcities-color").value = "";
        render();
        search.focus();
      },
    });
    grid.replaceChildren(...cities.map(tile));
  }
  return {
    render,
    open: (id) => {
      const city = getPlan().subcities.find((city) => city.id === id);
      if (city) editor.open(city);
    },
    add: (ownerId) => editor.open(null, ownerId, { lockOwner: true }),
  };
}
