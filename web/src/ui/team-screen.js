import { createTeamDashboard } from "./team-dashboard.js";
import { createLogoPicker } from "./logo-picker.js";
import { bindTileActions } from "./tile-actions.js";
import { normalizeDiscordUrl } from "../domain/team.js";
import { view } from "./dom.js";
export function createTeamScreen({
  root,
  getPlan,
  mutate,
  status,
  navigate,
  context,
  canEdit = () => true,
  unlock = async () => {},
}) {
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
      status("Team Editor access confirmed.");
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
  const logoPicker = createLogoPicker({
    root: $("edit-project-logo"),
    uploadLabel: "Change team logo",
    getValue: () => getPlan().projectLogo,
    change: (logo) =>
      mutate((plan) => {
        plan.projectLogo = logo;
      }),
    status,
    context,
  });
  function render() {
    const plan = getPlan();
    $("team-unlock").hidden = canEdit();
    if (document.activeElement !== $("edit-project-name"))
      $("edit-project-name").value = plan.title;
    dashboard.render();
    const discordUrl = normalizeDiscordUrl(plan.discordUrl);
    if (document.activeElement !== $("team-discord-url")) {
      $("team-discord-url").value = discordUrl;
      $("team-discord-url").removeAttribute("aria-invalid");
    }
    discordTile.classList.remove("discord-actions-open");
    $("team-discord-entry").hidden = !!discordUrl;
    discordTile.hidden = !discordUrl;
    $("team-discord-open").hidden = !discordUrl;
    if (discordUrl) $("team-discord-open").href = discordUrl;
    else $("team-discord-open").removeAttribute("href");
    logoPicker.render();
  }
  return {
    render,
    capturePending: () => {
      if (!canEdit()) return;
      if (document.activeElement === $("edit-project-name")) {
        const title = $("edit-project-name").value.trim();
        if (title && title !== getPlan().title)
          mutate((plan) => {
            plan.title = title;
          });
      }
      if (document.activeElement === $("team-discord-url")) {
        try {
          const discordUrl = normalizeDiscordUrl($("team-discord-url").value);
          if (discordUrl !== getPlan().discordUrl)
            mutate((plan) => {
              plan.discordUrl = discordUrl;
            });
        } catch {
          // Keep an unfinished URL available for the user to complete.
        }
      }
    },
  };
}
