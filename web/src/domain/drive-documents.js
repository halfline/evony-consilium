export const TEAM_MIME = "application/vnd.evony-consilium.team+json";
export const PLAYER_MIME = "application/vnd.evony-consilium.player+json";
export const TEAM_SUFFIX = ".team.consilium.json";
export const PLAYER_SUFFIX = ".player.consilium.json";
const title = (value) =>
  String(value || "")
    .trim()
    .replace(/[\u0000-\u001f/\\]/g, " ")
    .slice(0, 100) || "Untitled";
export const teamFilename = (name) => `Team - ${title(name)}${TEAM_SUFFIX}`;
export const playerFilename = (name) =>
  `Player - ${title(name)}${PLAYER_SUFFIX}`;
export const isTeamFile = (file) =>
  file.mimeType === TEAM_MIME ||
  file.name === "team.consilium.json" ||
  file.name?.endsWith(TEAM_SUFFIX);
