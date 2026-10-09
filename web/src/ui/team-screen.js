import { bindTileActions } from "./tile-actions.js";
import { normalizeDiscordUrl } from "../domain/team.js";
import { createTeamDashboard } from "./team-dashboard.js";
import { view } from "./dom.js";
export function createTeamScreen({ root, getPlan, mutate, status, navigate, canEdit = () => true, unlock = async () => {} }) {
  const $ = view(root);
  $("edit-project-name").onchange = () => {
    const title = $("edit-project-name").value.trim();
    if (!title) {
      status("Enter a team name.", true);
      render();
      return;
    }
    mutate((plan) => {
      plan.title = title;
    });
  };
  $("team-unlock").onclick = async () => {
    $("team-unlock").disabled = true;
    try {
      await unlock();
      status("Team administration unlocked.");
    } catch (error) {
      status(error.message, true);
    } finally {
      $("team-unlock").disabled = false;
      render();
    }
  };
  const dashboard = createTeamDashboard({
    root,
    getPlan,
    navigate,
  });
  $("team-discord-url").oninput = () =>
    $("team-discord-url").removeAttribute("aria-invalid");
  $("team-discord-url").onchange = () => {
    try {
      const discordUrl = normalizeDiscordUrl($("team-discord-url").value);
      mutate((plan) => {
        plan.discordUrl = discordUrl;
      });
    } catch (error) {
      $("team-discord-url").setAttribute("aria-invalid", "true");
      status(error.message, true);
    }
  };
  const discordTile = $("team-discord-tile"),
    discordLink = $("team-discord-open");
  bindTileActions(discordTile, {
    tileSelector: ".discord-tile",
    triggerSelector: ".discord-open",
    className: "discord-actions-open",
  });
  $("team-discord-remove").onclick = () => {
    mutate((plan) => {
      plan.discordUrl = "";
    });
    $("team-discord-url").focus();
  };
  function render() {
    const plan = getPlan();
    $("team-unlock").hidden = canEdit();
    $("edit-project-name").value = plan.title;
    dashboard.render();
    const discordUrl = normalizeDiscordUrl(plan.discordUrl);
    $("team-discord-url").value = discordUrl;
    $("team-discord-url").removeAttribute("aria-invalid");
    discordTile.classList.remove("discord-actions-open");
    $("team-discord-entry").hidden = !!discordUrl;
    discordTile.hidden = !discordUrl;
    $("team-discord-open").hidden = !discordUrl;
    if (discordUrl) $("team-discord-open").href = discordUrl;
    else $("team-discord-open").removeAttribute("href");
  }
  return { render };
}
