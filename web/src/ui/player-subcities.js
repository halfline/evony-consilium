import { view } from "./dom.js";
import { bindTileActions } from "./tile-actions.js";
import { createSubcityCard } from "./subcity-card.js";
import { assignSubcityOwner } from "../domain/subcities.js";

function cityLabel(city, types) {
  if (city.color === "red")
    return (
      types.find((type) => type.id === city.cityType)?.name || city.cityType
    );
  return city.name || city.culture;
}

export function createPlayerSubcities({
  root,
  dialog,
  getPlan,
  getPlayerId,
  types,
  canEdit,
  commit,
  openSubcity,
  addSubcity,
  context,
  status,
}) {
  const $ = view(root, dialog);
  const grid = $("player-subcities"),
    add = $("player-add-subcity"),
    create = $("player-create-subcity");
  let assigningTo = null,
    openedContext;
  bindTileActions(grid, {
    tileSelector: ".subcity-tile",
    triggerSelector: ".subcity-card",
    className: "player-actions-open",
    enabled: canEdit,
  });
  function assign(id, ownerId) {
    if (!canEdit()) return;
    try {
      commit(assignSubcityOwner(getPlan(), id, ownerId));
    } catch (error) {
      status(error.message, true);
    }
  }
  function choose() {
    if (!canEdit()) return;
    assigningTo = getPlayerId();
    openedContext = context();
    if (!getPlan().keeps.some((player) => player.id === assigningTo)) return;
    const available = (getPlan().subcities || []).filter(
      (city) => city.ownerId !== assigningTo,
    );
    if (!available.length) {
      addSubcity(assigningTo);
      return;
    }
    $("assign-subcity-list").replaceChildren(
      ...available.map((city) =>
        createSubcityCard({
          city,
          types: types(),
          owner:
            getPlan().keeps.find((player) => player.id === city.ownerId) ||
            null,
          open: () => {
            if (openedContext !== context() || !canEdit()) {
              dialog.close();
              return;
            }
            assign(city.id, assigningTo);
            dialog.close();
          },
        }),
      ),
    );
    $("assign-subcity-list").append(create);
    dialog.showModal();
  }
  add.onclick = choose;
  create.onclick = () => {
    if (openedContext !== context() || !canEdit()) return;
    const owner = assigningTo;
    dialog.close();
    addSubcity(owner);
  };
  function render() {
    const plan = getPlan(),
      id = getPlayerId(),
      subcityTypes = types();
    if (
      dialog.open &&
      (openedContext !== context() || !canEdit() || id !== assigningTo)
    )
      dialog.close();
    const cities = (plan.subcities || []).filter((city) => city.ownerId === id);
    add.hidden = !canEdit() || !id;
    $("player-subcities-empty").hidden = cities.length > 0;
    grid.replaceChildren(
      ...cities.map((city) =>
        createSubcityCard({
          city,
          types: subcityTypes,
          open: () => openSubcity(city.id),
          remove: canEdit() ? () => assign(city.id, null) : null,
          removeLabel: `Unlink ${cityLabel(city, subcityTypes)} from this player`,
        }),
      ),
      add,
    );
  }
  return { render };
}
