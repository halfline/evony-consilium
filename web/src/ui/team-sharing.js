import { routeHash } from "./navigation.js";

export function bindTeamSharing({ button, dialog, getWorkspace }) {
  const link = dialog.querySelector("#team-link");
  const drive = dialog.querySelector("#team-drive-link");
  const status = dialog.querySelector("#team-share-status");
  dialog.querySelector("[data-close]").onclick = () => dialog.close();
  button.onclick = () => {
    const workspace = getWorkspace();
    const file = workspace?.sync.file;
    if (!file) return;
    const url = new URL(location.href);
    url.hash = routeHash({
      team: file.id,
      resourceKey: file.resourceKey,
      screen: "project",
    });
    link.value = url.href;
    const folder = workspace.project?.folder;
    const hasFolder = folder?.id && folder.id !== file.id;
    const resource = hasFolder ? folder : file;
    const driveUrl = new URL(
      hasFolder
        ? `https://drive.google.com/drive/folders/${resource.id}`
        : `https://drive.google.com/file/d/${resource.id}/view`,
    );
    if (resource.resourceKey)
      driveUrl.searchParams.set("resourcekey", resource.resourceKey);
    drive.href = driveUrl.href;
    drive.title = hasFolder
      ? "Manage team folder access in Google Drive"
      : "Manage team file access in Google Drive";
    status.textContent = "";
    dialog.showModal();
  };
  link.onclick = () => link.select();
  dialog.querySelector("#team-copy-link").onclick = async () => {
    try {
      await navigator.clipboard.writeText(link.value);
      status.textContent = "Copied.";
    } catch {
      link.focus();
      link.select();
      status.textContent = "Select and copy the team link.";
    }
  };
}
