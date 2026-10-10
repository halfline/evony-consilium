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
  const mainOnlyTabs = new Set([
    "buffs",
    "march-size",
    "rally-capacity",
    "troops",
    "alts",
  ]);
  $("player-march-sizes").onchange = () => marches.syncSizes();
  function showTab(tab) {
    if (root.querySelector(`[data-player-tab="${tab}"]`)?.hidden)
      tab = "overview";
    $("player-section-select").value = tab;
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
  $("player-section-select").onchange = (event) => showTab(event.target.value);
  tabs.forEach((button) => {
    button.onclick = () => showTab(button.dataset.playerTab);
    button.onkeydown = (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      const visibleTabs = tabs.filter((tab) => !tab.hidden);
      const index = visibleTabs.indexOf(button);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? visibleTabs.length - 1
            : (index +
                (event.key === "ArrowRight" ? 1 : -1) +
                visibleTabs.length) %
              visibleTabs.length;
      visibleTabs[next].click();
      visibleTabs[next].focus();
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
      player.ownerId,
    ]);
    if (signature === nextSignature) return;
    const changedPlayer = playerId !== player.id;
    playerId = player.id;
    signature = nextSignature;
    original = structuredClone(player.details || {});
    const isAlt = player.ownerId != null;
    for (const tab of mainOnlyTabs) {
      root.querySelector(`[data-player-tab="${tab}"]`).hidden = isAlt;
      $("player-section-select").querySelector(`[value="${tab}"]`).hidden =
        isAlt;
    }
    if (isAlt && mainOnlyTabs.has($("player-section-select").value))
      showTab("overview");
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
