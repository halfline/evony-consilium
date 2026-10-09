import { isTeamLogo, normalizeDiscordUrl } from "./team.js";
import { validatePlayerProfile } from "./players.js";
import { validatePlayerSource } from "./player-document.js";
import { validateSubcities } from "./subcities.js";
import { number, string } from "./constraints.js";
import { MAPS } from "./maps.js";

function validateMapPresets(plan) {
  if (!Array.isArray(plan.mapPresets) || plan.mapPresets.length > 30)
    throw new Error("Invalid map presets.");
  for (const preset of plan.mapPresets) {
    string(preset.id, 100, "map ID");
    string(preset.name, 100, "map name");
    string(preset.subtitle, 100, "map subtitle");
    if (!/^#[\da-f]{6}$/i.test(preset.color))
      throw new Error("Invalid map color.");
  }
  if (!plan.mapPresets.some((preset) => preset.id === "blank"))
    plan.mapPresets.push({ ...MAPS.find((preset) => preset.id === "blank") });
  if (!plan.mapPresets.some((preset) => preset.id === plan.map))
    throw new Error("Unknown map.");
}

// Validate the shared team envelope while preserving fields owned by later editors.
export function validatePlan(input, catalog = { assets: [] }) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid team document.");
  if (input.version !== 1)
    throw new Error("Unsupported team document version.");
  const plan = structuredClone(input);
  if (
    typeof plan.title !== "string" ||
    !plan.title.trim() ||
    plan.title.length > 120
  )
    throw new Error("Enter a team name (up to 120 characters).");
  if (
    plan.projectLogo !== undefined &&
    plan.projectLogo !== "" &&
    !isTeamLogo(plan.projectLogo)
  )
    throw new Error("Invalid team logo.");
  if (plan.discordUrl !== undefined)
    plan.discordUrl = normalizeDiscordUrl(plan.discordUrl);
  if (
    plan.allianceTag !== undefined &&
    (typeof plan.allianceTag !== "string" || plan.allianceTag.length > 16)
  )
    throw new Error("Invalid alliance tag.");
  if (!Array.isArray(plan.keeps)) throw new Error("Invalid player list.");
  if (plan.keeps.length > 500) throw new Error("Too many keeps.");
  const ids = new Set();
  const assets = new Set(
    [...(catalog.assets || []), ...(plan.customAssets || [])].map((asset) => asset.id),
  );
  for (const player of plan.keeps) {
    string(player.id, 120, "ID");
    if (!player.id || ids.has(player.id)) throw new Error("Duplicate player ID.");
    ids.add(player.id);
    validatePlayerProfile(player, plan.allianceTag || "");
    if (player.playerSource !== undefined) validatePlayerSource(player.playerSource);
    if (!assets.has(player.skin)) throw new Error("Missing castle sprite: " + player.skin);
    number(player.w, 1, 20, "footprint");
    number(player.h, 1, 20, "footprint");
    if (player.x !== null || player.y !== null) {
      number(player.x, 0, plan.extent - player.w, "X");
      number(player.y, 0, plan.extent - player.h, "Y");
    }
    player.locked = Boolean(player.locked);
  }
  delete plan.allianceTag;
  plan.subcities ||= [];
  validateSubcities(plan.subcities, catalog.subcityTypes || null, plan.keeps);
  validateMapPresets(plan);
  return plan;
}
