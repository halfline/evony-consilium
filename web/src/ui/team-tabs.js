import { view } from "./dom.js";
export function createTeamTabs({ root, changed }) {
  const $ = view(root);
  const modes = ["teams", "open", "create"];
  let current = "open";
  function select(mode) {
    current = mode;
    for (const name of modes) {
      const active = name === mode;
      const tab = $("project-tab-" + name);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      tab.classList.toggle("active", active);
      $("project-panel-" + name).hidden = !active;
    }
    changed();
  }
  modes.forEach((mode) => {
    const tab = $("project-tab-" + mode);
    tab.onclick = () => select(mode);
    tab.onkeydown = (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      const available = modes.filter(
        (name) => !$("project-tab-" + name).hidden,
      );
      const position = available.indexOf(mode);
      const next =
        event.key === "Home"
          ? available[0]
          : event.key === "End"
            ? available.at(-1)
            : available[
                (position +
                  (event.key === "ArrowRight" ? 1 : -1) +
                  available.length) %
                  available.length
              ];
      select(next);
      $("project-tab-" + next).focus();
    };
  });
  function setTeamsAvailable(available) {
    $("project-tab-teams").hidden = !available;
    if (!available && current === "teams") select("open");
  }
  return { select, setTeamsAvailable };
}
