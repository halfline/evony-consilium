import { renderPortrait } from "./portrait.js";

export function playerPickerCard(
  player,
  getAvatars,
  { details = false, query = "" } = {},
) {
  const catalog = getAvatars();
  const avatar =
    catalog.avatars.find((item) => item.id === player.avatarId) ||
    catalog.avatars.find((item) => item.id === catalog.defaultId);
  const button = document.createElement("button");
  button.className = "castle-card player-picker-card";
  button.dataset.player = player.id;
  const portrait = document.createElement("span");
  portrait.className = "avatar-choice";
  renderPortrait(portrait, avatar && (avatar.previewSrc || avatar.src));
  const name = document.createElement("strong");
  name.textContent = `${player.allianceTag ? `[${player.allianceTag}] ` : ""}${player.name}`;
  button.append(portrait, name);
  const matchingId =
    query && player.accountId?.toLowerCase().includes(query.toLowerCase());
  if (details || matchingId) {
    const detail = document.createElement("small");
    detail.textContent = `${details ? `K${player.level}` : ""}${matchingId ? `${details ? " · " : ""}ID ${player.accountId}` : ""}`;
    button.append(detail);
  }
  return button;
}
