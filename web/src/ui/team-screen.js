import { createTeamDashboard } from "./team-dashboard.js";
import { createLogoPicker } from "./logo-picker.js";
import { bindTileActions } from "./tile-actions.js";
import { normalizeDiscordUrl } from "../domain/team.js";
import { view } from "./dom.js";
import { routeHash } from "./navigation.js";
export function createTeamScreen({
  root,
  getPlan,
  mutate,
  status,
  navigate,
  context,
  canEdit = () => true,
  unlock = async () => {},
  getWorkspace = () => null,
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
  $("team-copy-link").onclick = async () => {
    const file = getWorkspace()?.sync.file;
    if (!file) return;
    const url = new URL(location.href);
    url.hash = routeHash({
      team: file.id,
      resourceKey: file.resourceKey,
      screen: "project",
    });
    try {
      await navigator.clipboard.writeText(url.href);
      status("Team link copied. Grant access in Drive before sending it.");
    } catch {
      status(
        "Could not copy the link. Copy this page's address from your browser.",
        true,
      );
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
    const workspace = getWorkspace(),
      file = workspace?.sync.file,
      folder = workspace?.project?.folder;
    $("team-copy-link").disabled = !file;
    for (const [id, resource, folderLink] of [
      ["team-drive-link", file, false],
      ["team-folder-link", folder, true],
    ]) {
      const link = $(id);
      link.hidden = !resource || (folderLink && folder.id === file?.id);
      if (resource) {
        const url = new URL(
          folderLink
            ? `https://drive.google.com/drive/folders/${resource.id}`
            : `https://drive.google.com/file/d/${resource.id}/view`,
        );
        if (resource.resourceKey)
          url.searchParams.set("resourcekey", resource.resourceKey);
        link.href = url.href;
      }
    }
    $("team-access-status").textContent = canEdit()
      ? "You can edit the team. Player editing is controlled by each player file's Drive permissions."
      : "You have read-only team access. You can still edit player files shared with you as Editor.";
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
    logoPicker.render();
  }
  return { render };
}
