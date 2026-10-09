import { isTeamLogo, normalizeDiscordUrl } from "./team.js";
import { validatePlayerProfile } from "./players.js";
import { validatePlayerSource } from "./player-document.js";
import { validateSubcities } from "./subcities.js";
import { number, string } from "./constraints.js";
import { MAPS } from "./maps.js";
import { captureLayout } from "./layout.js";
import { defaultFormationName } from "./map-plans.js";
import { migratePlan } from "./document-migrations.js";
import { unproject } from "./geometry.js";

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

function validateCustomAssets(plan) {
  if (!Array.isArray(plan.customAssets) || plan.customAssets.length > 150)
    throw new Error("Invalid custom assets.");
  for (const asset of plan.customAssets) {
    string(asset.id, 120, "asset ID");
    string(asset.name, 100, "asset name");
    string(asset.src, 6000000, "image");
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(asset.src))
      throw new Error("Custom assets must be PNG, JPEG, or WebP images.");
    number(asset.width, 1, 10000, "image width");
    number(asset.height, 1, 10000, "image height");
    number(asset.tier, 1, 100, "tier");
    string(asset.family, 120, "asset family");
    if (
      !["keep", "alliance", "warehouse", "resource", "objective"].includes(
        asset.kind,
      )
    )
      throw new Error("Invalid asset kind.");
  }
}

function validateMapCollection(plan) {
  if (plan.maps === undefined) {
    const id = crypto.randomUUID();
    plan.maps = [{ id, name: defaultFormationName(plan.map), type: plan.map, layout: captureLayout(plan) }];
    plan.activeMapId = id;
  }
  if (!Array.isArray(plan.maps) || plan.maps.length > 50)
    throw new Error("Invalid map collection.");
  const ids = new Set();
  const players = new Set(plan.keeps.map(({ id }) => id));
  for (const map of plan.maps) {
    if (!map || typeof map !== "object") throw new Error("Invalid map entry.");
    string(map.id, 100, "map ID");
    string(map.name, 100, "formation name");
    if (!map.id || !map.name.trim() || ids.has(map.id))
      throw new Error("Invalid map entry.");
    ids.add(map.id);
    if (!plan.mapPresets.some(({ id }) => id === map.type) ||
      map.type !== map.layout?.map || !Array.isArray(map.layout.positions))
      throw new Error("Invalid map layout.");
    const positionIds = new Set();
    for (const position of map.layout.positions) {
      if (!position || typeof position !== "object")
        throw new Error("Invalid map player reference.");
      if (!players.has(position.id) || positionIds.has(position.id))
        throw new Error("Invalid map player reference.");
      positionIds.add(position.id);
    }
  }
  if (plan.activeMapId !== null && !ids.has(plan.activeMapId))
    throw new Error("Unknown active map.");
  if (plan.maps.length && plan.activeMapId === null)
    throw new Error("Choose an active map.");
}

// Validate the shared team envelope while preserving fields owned by later editors.
export function validatePlan(input, catalog = { assets: [] }) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid team document.");
  const plan = migratePlan(input);
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
  number(plan.extent, 10, 10000, "map extent");
  number(plan.spacing, 0, 10, "spacing");
  if (typeof plan.rallyManual !== "boolean")
    throw new Error("Invalid rally setter preference.");
  if (!["rings", "diamond"].includes(plan.formation))
    throw new Error("Invalid formation.");
  for (const key of ["x", "y"])
    number(plan.center?.[key], 0, plan.extent - 1, "center");
  for (const key of ["ax", "ay", "bx", "by"])
    number(plan.grid?.[key], -200, 200, "grid", false);
  unproject(0, 0, plan.grid);
  validateCustomAssets(plan);
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
  validateMapCollection(plan);
  return plan;
}
