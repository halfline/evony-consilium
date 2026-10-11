import { isTeamLogo } from "../domain/team.js";
import { bindTileActions } from "./tile-actions.js";
import { initialsFor } from "./portrait.js";
import { icon } from "./icons.js";
import { createRemoveButton } from "./remove-button.js";

export function createTeamList({
  root,
  files,
  open: openTeam,
  forget: forgetTeam,
}) {
  bindTileActions(root, {
    tileSelector: ".project-row",
    triggerSelector: ".project-row > button:first-child",
    className: "team-actions-open",
  });
  function render() {
    const list = root;
    list.replaceChildren();
    const rows = files();
    list.hidden = rows.length === 0;
    for (const file of rows) {
      const row = document.createElement("div");
      row.className = "project-row";
      const open = document.createElement("button");
      const name = document.createElement("span");
      name.textContent = file.name;
      const arrow = icon("forward");
      const portrait = document.createElement("span");
      portrait.className = "team-portrait";
      if (isTeamLogo(file.logo)) {
        const logo = document.createElement("img");
        logo.src = file.logo;
        logo.alt = "";
        logo.className = "project-logo";
        portrait.append(logo);
      } else {
        const initials = document.createElement("span");
        initials.className = "team-initials";
        initials.textContent = initialsFor(file.name);
        initials.setAttribute("aria-hidden", "true");
        portrait.append(initials);
      }
      name.className = "project-row-name";
      const caption = document.createElement("span");
      caption.className = "team-caption";
      caption.append(name, arrow);
      open.append(portrait, caption);
      open.onclick = () => openTeam(file);
      const forget = createRemoveButton({
        className: "team-forget",
        label: `Forget ${file.name}`,
        remove: () => forgetTeam(file.id),
      });
      row.append(open, forget);
      list.append(row);
    }
    return rows.length;
  }
  return { render };
}
