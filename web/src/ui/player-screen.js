import { editPlayerProfile } from "../domain/players.js";
import { editPlayerDetails } from "../domain/player-details.js";
import { validatePlan } from "../domain/validation.js";
import { renderAvatarButton } from "./avatar-browser.js";
import { view } from "./dom.js";
import { createPlayerBuffs } from "./player-buffs.js";

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
  const buffs = createPlayerBuffs({ root });
  function showTab(tab) {
    for (const button of root.querySelectorAll("[data-player-tab]")) {
      const active = button.dataset.playerTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    }
    for (const panel of root.querySelectorAll("[data-player-panel]"))
      panel.hidden = panel.dataset.playerPanel !== tab;
  }
  for (const button of root.querySelectorAll("[data-player-tab]"))
    button.onclick = () => showTab(button.dataset.playerTab);
  $("player-form").querySelector('[data-player-tab="buffs"]').hidden = false;
  async function saveProfile(id, changes, detailChanges = null) {
    if (!canEdit()) throw new Error("Unlock this player before editing.");
    let next = editPlayerProfile(getPlan(), id, changes);
    if (detailChanges) next = editPlayerDetails(next, id, detailChanges);
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
      }, buffs.read());
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
    buffs.render(player.details || {});
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
