import { view } from "./dom.js";
import { numeric } from "./player-fields.js";
import { createPlayerBuffs } from "./player-buffs.js";
import { createPlayerDebuffs } from "./player-debuffs.js";
import { createPlayerMarches } from "./player-marches.js";
import { createPlayerMarchSizes } from "./player-march-sizes.js";
import { createPlayerReinforcements } from "./player-reinforcements.js";
import { createPlayerProgress } from "./player-progress.js";
import { PROGRESS_METRICS } from "../domain/player-progress.js";
export function createPlayerDetails({
  root,
  canEdit = () => true,
  saveChanges = () => {},
}) {
  const $ = view(root);
  let signature,
    playerId,
    original = {};
  let live = null,
    historicalBaseline = null;
  const statInput = (key) =>
    key === "level"
      ? $("player-level")
      : key === "rallyCapacity"
        ? $("player-rally-capacity")
        : key.startsWith("buffs.")
          ? root.querySelector(`[data-buff="${key.slice(6)}"]`)
          : key.startsWith("debuffs.")
            ? root.querySelector(`[data-debuff="${key.slice(8)}"]`)
            : root.querySelector(`[data-march-size="${key.slice(11)}"]`);
  const statistics = () =>
    Object.fromEntries(
      PROGRESS_METRICS.map(({ key }) => [key, numeric(statInput(key))]),
    );
  const writeStatistics = (values) => {
    for (const [key, value] of Object.entries(values))
      statInput(key).value = value ?? "";
  };
  function restoreHistoricalInput(input, key) {
    if (
      input.value !== "" ||
      input.validity.badInput ||
      historicalBaseline?.[key] == null
    )
      return false;
    input.value = historicalBaseline[key];
    return true;
  }
  root.addEventListener("focusout", (event) => {
    if (!live || event.target.value !== "") return;
    const metric = PROGRESS_METRICS.find(
      ({ key }) => statInput(key) === event.target,
    );
    if (metric && restoreHistoricalInput(event.target, metric.key))
      event.target.dispatchEvent(new Event("input", { bubbles: true }));
  });
  function mode(active) {
    $("player-form").classList.toggle("historical-mode", active);
    $("player-level").required = !active;
    for (const name of ["troops", "alts", "subcities", "notes", "progress"]) {
      const hidden = active;
      root.querySelector(`[data-player-tab="${name}"]`).hidden = hidden;
      $("player-section-select").querySelector(`[value="${name}"]`).hidden =
        hidden;
    }
  }
  const buffs = createPlayerBuffs({ root }),
    debuffs = createPlayerDebuffs({ root }),
    marchSizes = createPlayerMarchSizes({ root }),
    marches = createPlayerMarches({
      root,
      getSizes: () => marchSizes.read().marchSizes,
    }),
    reinforcements = createPlayerReinforcements({ root }),
    progress = createPlayerProgress({
      root,
      canEdit,
      saveChanges,
      historical: {
        read: statistics,
        setBaseline(values) {
          historicalBaseline = values;
        },
        write: writeStatistics,
        enter(values, metric) {
          live = {
            details: read({ sync: false }),
            level: $("player-level").value,
          };
          mode(true);
          writeStatistics(values);
          const tab =
            { level: "overview", rally: "rally-capacity" }[metric.group] ||
            metric.group;
          showTab(tab);
        },
        leave() {
          if (!live) return;
          const saved = live;
          live = null;
          historicalBaseline = null;
          buffs.render(saved.details || {});
          debuffs.render(saved.details || {});
          marchSizes.render(saved.details || {});
          $("player-rally-capacity").value = saved.details?.rallyCapacity ?? "";
          $("player-level").value = saved.level;
          original = structuredClone(saved.details || {});
          marches.render(original, Number(saved.level), { preserveView: true });
          reinforcements.render(original, Number(saved.level), {
            preserveView: true,
          });
          mode(false);
          showTab("progress");
        },
        validate() {
          for (const { key } of PROGRESS_METRICS) {
            const input = statInput(key);
            restoreHistoricalInput(input, key);
            if (!input.checkValidity()) {
              showTab(input.closest("[data-player-panel]").dataset.playerPanel);
              buffs.reveal(input);
              input.reportValidity();
              return false;
            }
          }
          return true;
        },
      },
    });
  const mainOnlyTabs = new Set([
    "buffs",
    "debuffs",
    "progress",
    "march-size",
    "rally-capacity",
    "troops",
    "alts",
  ]);
  $("player-march-sizes").onchange = () => {
    if (!live) marches.syncSizes();
  };
  function showMarchTab(tab) {
    for (const button of root.querySelectorAll("[data-march-tab]")) {
      const active = button.dataset.marchTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    }
    for (const panel of root.querySelectorAll("[data-march-panel]"))
      panel.hidden = panel.dataset.marchPanel !== tab;
  }
  const marchTabs = [...root.querySelectorAll("[data-march-tab]")];
  marchTabs.forEach((button, index) => {
    button.onclick = () => showMarchTab(button.dataset.marchTab);
    button.onkeydown = (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? marchTabs.length - 1
            : (index +
                (event.key === "ArrowRight" ? 1 : -1) +
                marchTabs.length) %
              marchTabs.length;
      marchTabs[next].click();
      marchTabs[next].focus();
    };
  });
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
    $("player-profile-actions").hidden = [
      "subcities",
      "alts",
      "notes",
    ].includes(tab);
    root.querySelector(".player-footer").hidden = tab === "notes";
    for (const panel of root.querySelectorAll("[data-player-panel]"))
      panel.hidden = panel.dataset.playerPanel !== tab;
  }
  const tabs = [...root.querySelectorAll("[data-player-tab]")];
  for (const [tab, group] of [
    ["overview", "level"],
    ["buffs", "buffs"],
    ["debuffs", "debuffs"],
    ["march-size", "march-size"],
    ["rally-capacity", "rally"],
  ]) {
    const panel = root.querySelector(`[data-player-panel="${tab}"]`);
    const link = document.createElement("button");
    link.type = "button";
    link.className = "player-progress-link";
    link.dataset.playerProgressLink = group;
    link.textContent = "View progress →";
    link.onclick = () => {
      progress.show({
        group,
        context: root.querySelector('[data-buff-context][aria-pressed="true"]')
          ?.dataset.buffContext,
      });
      showTab("progress");
      root.querySelector('[data-progress-view="Statistic"]').focus();
    };
    panel.append(link);
  }
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
    if (live) return { ...structuredClone(live.details), ...progress.read() };
    if (sync) marches.syncSizes();
    const result = {
      rallyCapacity: numeric($("player-rally-capacity")),
      ...buffs.read(),
      ...progress.read(),
      ...(debuffs.hasValues() || Object.hasOwn(original, "debuffs")
        ? debuffs.read()
        : {}),
      ...marchSizes.read(),
      marches: marches.read(),
      ...(reinforcements.read().length ||
      Object.hasOwn(original, "reinforcementMarches")
        ? { reinforcementMarches: reinforcements.read() }
        : {}),
    };
    if (
      !Object.keys(original).length &&
      result.rallyCapacity === null &&
      !buffs.hasValues() &&
      !debuffs.hasValues() &&
      !progress.read().progress &&
      !marchSizes.hasValues() &&
      !result.marches.length &&
      !result.reinforcementMarches?.length
    )
      return undefined;
    return result;
  }
  function render(player, { progressEditor = null } = {}) {
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
    const pending =
      progressEditor ||
      (!changedPlayer && live ? progress.editorDraft() : null);
    if (live) {
      // Background refresh must update the live snapshot without replacing the
      // historical inputs or moving focus.
      if (!changedPlayer) {
        live = {
          details: structuredClone(player.details),
          level: String(player.level),
        };
        progress.render(player, { draft: pending });
        return;
      }
      live = null;
      historicalBaseline = null;
      mode(false);
    }
    original = structuredClone(player.details || {});
    const isAlt = player.ownerId != null;
    for (const link of root.querySelectorAll("[data-player-progress-link]"))
      link.hidden = isAlt;
    for (const tab of mainOnlyTabs) {
      root.querySelector(`[data-player-tab="${tab}"]`).hidden = isAlt;
      $("player-section-select").querySelector(`[value="${tab}"]`).hidden =
        isAlt;
    }
    if (isAlt && mainOnlyTabs.has($("player-section-select").value))
      showTab("overview");
    $("player-rally-capacity").value = original.rallyCapacity ?? "";
    buffs.render(original);
    debuffs.render(original);
    marchSizes.render(original);
    marches.render(original, player.level, { preserveView: !changedPlayer });
    reinforcements.render(original, player.level, {
      preserveView: !changedPlayer,
    });
    progress.render(player, { draft: progressEditor });
    if (changedPlayer && !progress.isEditing()) {
      showMarchTab("attack");
      showTab("overview");
    }
  }
  return {
    read,
    snapshot: () => read({ sync: false }),
    reveal: (input) => buffs.reveal(input),
    render,
    progressEditorDraft: progress.editorDraft,
    isHistorical: progress.isEditing,
    isHistoricalFor: (id) => !!live && playerId === id,
    saveHistorical: progress.saveHistorical,
    currentLevel: () => live?.level ?? $("player-level").value,
    closeEditors: () => {
      marches.close();
      reinforcements.close();
    },
    reset: () => {
      signature = null;
    },
  };
}
