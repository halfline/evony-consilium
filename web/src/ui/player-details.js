import { view } from "./dom.js";
import { numeric } from "./player-fields.js";
import { createPlayerBuffs } from "./player-buffs.js";
import { createPlayerMarches } from "./player-marches.js";
import { createPlayerMarchSizes } from "./player-march-sizes.js";

export function createPlayerDetails({ root, getPlayer }) {
  const $ = view(root);
  let original = {};
  const buffs = createPlayerBuffs({ root });
  const marchSizes = createPlayerMarchSizes({ root });
  const marches = createPlayerMarches({
    root,
    getSizes: () => marchSizes.read().marchSizes,
  });
  $("player-march-sizes").onchange = () => marches.syncSizes();
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
  $("player-form").querySelector('[data-player-tab="march-size"]').hidden = false;
  $("player-form").querySelector('[data-player-tab="rally-capacity"]').hidden = false;
  $("player-form").querySelector('[data-player-tab="troops"]').hidden = false;
  function read() {
    marches.syncSizes();
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
    original = structuredClone(player.details || {});
    buffs.render(original);
    marchSizes.render(original);
    marches.render(original, player.level);
    $("player-rally-capacity").value = original.rallyCapacity ?? "";
  }
  return { read, render };
}
