import { createPlayerDetails } from "./player-details.js";
import { editPlayerDetails } from "../domain/player-details.js";
import { editPlayerProfile } from "../domain/players.js";
import { validatePlan } from "../domain/validation.js";
import { changeAppearance } from "../domain/appearance-commands.js";
import { renderAvatarButton } from "./avatar-browser.js";
import { renderCastleButton } from "./castle-button.js";
import { bindTileActions } from "./tile-actions.js";
import { view } from "./dom.js";

// The player form owns profile fields only. It never reads map-coordinate inputs.
export function createPlayerScreen({
  root,
  getPlan,
  terrainFor,
  getPlayer,
  assets,
  getAvatars,
  catalog,
  browseCastle,
  browseAvatar,
  commit,
  remove,
  status,
  applied,
  canEdit = () => true,
}) {
  const $ = view(root);
  const details = createPlayerDetails({ root });
  bindTileActions(root.querySelector(".player-name-actions"), {
    tileSelector: ".player-name-actions",
    triggerSelector: "#player-title",
    className: "player-name-actions-open",
  });
  async function saveProfile(id, changes, detailChanges) {
    if (!canEdit()) throw new Error("Unlock this player before editing.");
    let next = editPlayerProfile(getPlan(), id, changes);
    if (detailChanges) next = editPlayerDetails(next, id, detailChanges);
    validatePlan(next, catalog);
    await commit(next);
    applied(next.keeps.find((player) => player.id === id));
    render();
  }
  $("player-form").onsubmit = async (event) => {
    event.preventDefault();
    const player = getPlayer();
    if (!player) return;
    try {
      await saveProfile(
        player.id,
        {
          name: $("player-name").value.trim(),
          accountId: $("player-account").value.trim(),
          allianceTag: $("player-tag").value.trim(),
          level: Number($("player-level").value),
        },
        details.read(),
      );
      status("Player saved.");
    } catch (error) {
      status(error.message, true);
    }
  };
  $("player-avatar").onclick = () => {
    const player = getPlayer();
    if (!player) return;
    const id = player.id;
    browseAvatar(player.avatarId, async (avatar) => {
      try {
        await saveProfile(id, { avatarId: avatar.id });
      } catch (error) {
        status(error.message, true);
      }
    });
  };
  $("player-castle").onclick = () => {
    const player = getPlayer();
    if (!player) return;
    if (!canEdit()) return status("Unlock this player before editing.", true);
    const id = player.id;
    browseCastle("keep", async (asset) => {
      try {
        const next = changeAppearance(
          getPlan(),
          id,
          asset,
          terrainFor(getPlan().map),
        );
        validatePlan(next, catalog);
        await commit(next);
      } catch (error) {
        status(error.message, true);
      }
    });
  };
  $("player-remove").onclick = () => {
    const player = getPlayer();
    if (player) remove(player.id);
  };
  function render() {
    const player = getPlayer();
    $("player-inspector").hidden = !player;
    if (!player) return;
    $("player-title").textContent = player.name;
    $("player-remove").setAttribute("aria-label", `Remove ${player.name}`);
    root
      .querySelector(".player-name-actions")
      .classList.remove("player-name-actions-open");
    details.render(player);
    for (const [field, id] of Object.entries({
      name: "player-name",
      accountId: "player-account",
      allianceTag: "player-tag",
      level: "player-level",
    }))
      $(id).value = player[field] ?? "";
    const castle = assets.get(player.skin);
    if (castle) renderCastleButton($("player-castle"), castle);
    renderAvatarButton($("player-avatar"), getAvatars(), player.avatarId);
  }
  return { render };
}
