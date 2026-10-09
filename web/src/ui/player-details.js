import { view } from "./dom.js";
import { numeric } from "./player-fields.js";
import { createPlayerBuffs } from "./player-buffs.js";
import { createPlayerMarches } from "./player-marches.js";
import { createPlayerMarchSizes } from "./player-march-sizes.js";

export function createPlayerDetails({ root, getPlayer }) {
  const $ = view(root);
  const buffs = createPlayerBuffs({ root });
  const marchSizes = createPlayerMarchSizes({ root });
  const marches = createPlayerMarches({
    root,
    getSizes: () => getPlayer()?.details?.marchSizes || {},
  });
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
    return {
      ...buffs.read(),
      ...marchSizes.read(),
      marches: marches.read(),
      rallyCapacity: numeric($("player-rally-capacity")),
    };
  }
  function render(player) {
    buffs.render(player.details || {});
    marchSizes.render(player.details || {});
    marches.render(player.details || {}, player.level);
    $("player-rally-capacity").value = player.details?.rallyCapacity ?? "";
  }
  return { read, render };
}
