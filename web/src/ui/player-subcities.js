import { view } from "./dom.js";
import { bindTileActions } from "./tile-actions.js";
import { createSubcityCard } from "./subcity-card.js";
import { assignSubcityOwner } from "../domain/subcities.js";

export function createPlayerSubcities({
  root,
  dialog,
  getPlan,
  getPlayerId,
  types,
  canEdit,
  commit,
  openSubcity,
  context,
  status,
}) {
  const $ = view(root, dialog);
  const grid = $("player-subcities"),
    add = $("player-add-subcity");
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
    $("assign-subcity-list").replaceChildren(
      ...(getPlan().subcities || [])
        .filter((city) => city.ownerId !== assigningTo)
        .map((city) =>
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
    $("assign-subcity-empty").hidden = !!$("assign-subcity-list").children
      .length;
    dialog.showModal();
  }
  add.onclick = choose;
  function render() {
    const plan = getPlan(),
      id = getPlayerId();
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
          types: types(),
          open: () => openSubcity(city.id),
          remove: canEdit() ? () => assign(city.id, null) : null,
          removeLabel: `Unlink ${city.name || city.culture} from this player`,
        }),
      ),
      add,
    );
  }
  return { render };
}
