import { view } from "./dom.js";
import { labelWithIcon } from "./icons.js";

export function bindShellControls(root) {
  const $ = view(root);
  for (const [id, name] of [
    ["project-back", "back"],
    ["undo", "undo"],
    ["auto-place", "arrange"],
    ["zoom-in", "plus"],
    ["zoom-out", "minus"],
    ["reset-view", "center"],
    ["player-march-back", "back"],
    ["player-remove-march", "close"],
    ["player-remove", "close"],
    ["player-add-tier", "plus"],
    ["player-add-subcity", "plus"],
    ["team-discord-remove", "close"],
    ["close-inspector", "close"],
    ["header-more-toggle", "more"],
  ])
    labelWithIcon($(id), name);
  for (const [id, text] of [
    ["undo", "Undo team edit"],
    ["team-activity", "Activity log"],
  ]) {
    const label = document.createElement("span");
    label.className = "overflow-action-label";
    label.textContent = text;
    $(id).append(label);
  }
  for (const button of root.querySelectorAll("[data-close]"))
    if (button.textContent.trim() === "×") labelWithIcon(button, "close");
  const more = $("header-more-toggle").parentElement;
  const closeMore = () => {
    more.classList.remove("is-open");
    $("header-more-toggle").setAttribute("aria-expanded", "false");
  };
  $("header-more-toggle").onclick = () => {
    const open = more.classList.toggle("is-open");
    $("header-more-toggle").setAttribute("aria-expanded", String(open));
  };
  document.addEventListener("click", (event) => {
    if (!more.contains(event.target)) closeMore();
  });
  more.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMore();
      $("header-more-toggle").focus();
    }
  });
  $("header-more-menu").addEventListener("click", (event) => {
    if (event.target.closest("button")) closeMore();
  });
  const sidebar = $("formation-sidebar");
  const rosterLink = root.querySelector(".mobile-roster-link");
  const mapLink = root.querySelector(".mobile-map-link");
  function roster(open) {
    sidebar.classList.toggle("is-collapsed", !open);
    rosterLink.setAttribute("aria-expanded", String(open));
    mapLink.setAttribute("aria-expanded", String(open));
    mapLink.setAttribute("aria-controls", "formation-sidebar");
    mapLink.textContent = open ? "Hide roster" : "Expand roster";
  }
  roster(false);
  rosterLink.onclick = () => {
    roster(true);
    sidebar.scrollIntoView({ block: "start" });
  };
  mapLink.onclick = (event) => {
    event.preventDefault();
    roster(sidebar.classList.contains("is-collapsed"));
    (sidebar.classList.contains("is-collapsed")
      ? $("map-surface")
      : sidebar
    ).scrollIntoView({ block: "start" });
  };
  function showPanel(tab) {
    for (const button of root.querySelectorAll("[data-tab]"))
      button.classList.toggle("active", button.dataset.tab === tab);
    for (const name of ["formation", "hive"])
      $("panel-" + name).hidden = name !== tab;
  }
  for (const button of root.querySelectorAll("[data-tab]"))
    button.onclick = () => showPanel(button.dataset.tab);
  for (const button of root.querySelectorAll("[data-close]"))
    button.onclick = () => $(button.dataset.close).close();
  $("help").onclick = () => $("help-dialog").showModal();
}
