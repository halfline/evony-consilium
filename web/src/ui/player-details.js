import { view } from "./dom.js";
import { numeric } from "./player-fields.js";
import { createPlayerBuffs } from "./player-buffs.js";
import { createPlayerMarches } from "./player-marches.js";
import { createPlayerMarchSizes } from "./player-march-sizes.js";
export function createPlayerDetails({ root }) {
  const $ = view(root);
  let signature,
    playerId,
    original = {};
  const buffs = createPlayerBuffs({ root }),
    marchSizes = createPlayerMarchSizes({ root }),
    marches = createPlayerMarches({
      root,
      getSizes: () => marchSizes.read().marchSizes,
    });
  $("player-march-sizes").onchange = () => marches.syncSizes();
  function showTab(tab) {
    for (const button of root.querySelectorAll("[data-player-tab]")) {
      const active = button.dataset.playerTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    }
    $("player-profile-actions").hidden = ["subcities", "alts"].includes(tab);
    for (const panel of root.querySelectorAll("[data-player-panel]"))
      panel.hidden = panel.dataset.playerPanel !== tab;
  }
  const tabs = [...root.querySelectorAll("[data-player-tab]")];
  tabs.forEach((button, index) => {
    button.onclick = () => showTab(button.dataset.playerTab);
    button.onkeydown = (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
              tabs.length;
      tabs[next].click();
      tabs[next].focus();
    };
  });
  function read({ sync = true } = {}) {
    if (sync) marches.syncSizes();
    const result = {
      rallyCapacity: numeric($("player-rally-capacity")),
      ...buffs.read(),
      ...marchSizes.read(),
      marches: marches.read(),
    };
    if (
      !Object.keys(original).length &&
      result.rallyCapacity === null &&
      !buffs.hasValues() &&
      !marchSizes.hasValues() &&
      !result.marches.length
    )
      return undefined;
    return result;
  }
  function render(player) {
    const nextSignature = JSON.stringify([
      player.id,
      player.details,
      player.level,
    ]);
    if (signature === nextSignature) return;
    const changedPlayer = playerId !== player.id;
    playerId = player.id;
    signature = nextSignature;
    original = structuredClone(player.details || {});
    $("player-rally-capacity").value = original.rallyCapacity ?? "";
    buffs.render(original);
    marchSizes.render(original);
    marches.render(original, player.level);
    if (changedPlayer) showTab("overview");
  }
  return {
    read,
    snapshot: () => read({ sync: false }),
    render,
    reset: () => {
      signature = null;
    },
  };
}
