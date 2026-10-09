import { editPlayerProfile } from "../domain/players.js";
import { validatePlan } from "../domain/validation.js";
import { renderAvatarButton } from "./avatar-browser.js";
import { view } from "./dom.js";

// The first profile screen edits the linked player's identity fields.
export function createPlayerScreen({
  root,
  getPlan,
  getPlayer,
  getAvatars,
  catalog,
  browseAvatar,
  commit,
  remove,
  canEdit,
  status,
}) {
  const $ = view(root);
  async function saveProfile(id, changes) {
    if (!canEdit()) throw new Error("Unlock this player before editing.");
    const next = editPlayerProfile(getPlan(), id, changes);
    validatePlan(next, catalog);
    await commit(next.keeps.find((player) => player.id === id));
    render();
  }
  $("player-form").onsubmit = async (event) => {
    event.preventDefault();
    const player = getPlayer();
    if (!player) return;
    try {
      await saveProfile(player.id, {
        name: $("player-name").value.trim(),
        accountId: $("player-account").value.trim(),
        allianceTag: $("player-tag").value.trim(),
        level: Number($("player-level").value),
      });
      status("Player saved.");
    } catch (error) {
      status(error.message, true);
    }
  };
  $("player-avatar").onclick = () => {
    const player = getPlayer();
    if (!player || !canEdit()) return;
    browseAvatar(player.avatarId, async (avatar) => {
      try {
        await saveProfile(player.id, { avatarId: avatar.id });
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
    $("player-avatar").disabled = !canEdit();
    $("player-unlock").hidden = true;
    $("player-remove").hidden = false;
    $("player-remove").setAttribute("aria-label", `Remove ${player.name}`);
    for (const [field, id] of Object.entries({
      name: "player-name",
      accountId: "player-account",
      allianceTag: "player-tag",
      level: "player-level",
    })) $(id).value = player[field] ?? "";
    renderAvatarButton($("player-avatar"), getAvatars(), player.avatarId);
  }
  return { render };
}
