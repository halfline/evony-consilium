import { isTeamLogo, normalizeDiscordUrl } from "./team.js";
import { validatePlayerProfile, validatePlayerOwnership } from "./players.js";
import { validatePlayerSource } from "./player-document.js";
import { validateSubcities } from "./subcities.js";
import { number, string } from "./constraints.js";
import { MAPS } from "./maps.js";
import { captureLayout, applyLayout } from "./layout.js";
import { defaultFormationName } from "./map-plans.js";
import { migratePlan } from "./document-migrations.js";
import { overlap, unproject } from "./geometry.js";
import { MAX_ENTITIES, ENTITY_COLLECTIONS } from "./entities.js";

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

function validateEntities(plan, catalog) {
  const assets = new Set(
    [...(catalog.assets || []), ...plan.customAssets].map((asset) => asset.id),
  );
  const ids = new Set();
  for (const collection of ENTITY_COLLECTIONS) {
    if (!Array.isArray(plan[collection]) && collection === "keeps")
      throw new Error("Invalid player list.");
    if (
      !Array.isArray(plan[collection]) ||
      plan[collection].length > MAX_ENTITIES
    )
      throw new Error("Too many " + collection + ".");
    for (const entity of plan[collection]) {
      string(entity.id, 120, "ID");
      if (!entity.id || ids.has(entity.id))
        throw new Error(
          collection === "keeps"
            ? "Duplicate player ID."
            : "Duplicate entity ID.",
        );
      ids.add(entity.id);
      string(entity.name, 100, "name");
      number(entity.w, 1, 20, "footprint");
      number(entity.h, 1, 20, "footprint");
      if (entity.x === null) {
        if (entity.y !== null) throw new Error("Invalid coordinates.");
      } else {
        number(entity.x, 0, plan.extent - entity.w, "X");
        number(entity.y, 0, plan.extent - entity.h, "Y");
      }
      if (collection === "keeps") {
        validatePlayerProfile(entity, plan.allianceTag || "");
        if (entity.playerSource !== undefined)
          validatePlayerSource(entity.playerSource);
      }
      if (collection !== "obstacles" && !assets.has(entity.skin))
        throw new Error("Missing castle sprite: " + entity.skin);
      entity.locked = Boolean(entity.locked);
    }
  }
}

function validatePlacement(plan) {
  if (
    plan.rallyId !== null &&
    !plan.keeps.some((keep) => keep.id === plan.rallyId)
  )
    throw new Error("Unknown rally setter.");
  const placed = [...plan.keeps, ...plan.structures, ...plan.obstacles].filter(
    (entity) => entity.x !== null,
  );
  for (let i = 0; i < placed.length; i++)
    for (let j = i + 1; j < placed.length; j++)
      if (overlap(placed[i], placed[j]))
        throw new Error("Overlapping tiles in imported plan.");
}

function validateBackgrounds(plan) {
  if (
    !plan.backgrounds ||
    typeof plan.backgrounds !== "object" ||
    Array.isArray(plan.backgrounds)
  )
    throw new Error("Invalid backgrounds.");
  for (const background of Object.values(plan.backgrounds)) {
    string(background.src, 12000000, "background image");
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(background.src))
      throw new Error("Invalid background image.");
    number(background.x, 0, plan.extent, "background X");
    number(background.y, 0, plan.extent, "background Y");
    number(background.width, 1, 20000, "background width", false);
    number(background.height, 1, 20000, "background height", false);
    number(background.opacity, 0, 1, "background opacity", false);
  }
  plan.labels = Boolean(plan.labels);
  plan.showGrid = Boolean(plan.showGrid);
}

function validateMapCollection(plan, catalog) {
  if (plan.maps === undefined) {
    const id = crypto.randomUUID();
    plan.maps = [
      {
        id,
        name: defaultFormationName(plan.map),
        type: plan.map,
        layout: captureLayout(plan),
      },
    ];
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
    if (
      !plan.mapPresets.some(({ id }) => id === map.type) ||
      map.type !== map.layout?.map ||
      !Array.isArray(map.layout.positions)
    )
      throw new Error("Invalid map layout.");
    const positionIds = new Set();
    for (const position of map.layout.positions) {
      if (!position || typeof position !== "object")
        throw new Error("Invalid map player reference.");
      if (!players.has(position.id) || positionIds.has(position.id))
        throw new Error("Invalid map player reference.");
      positionIds.add(position.id);
    }
    const { maps, activeMapId, ...shared } = plan;
    const view = structuredClone(shared);
    applyLayout(view, map.layout);
    const checked = validatePlan(view, catalog, false);
    map.layout = captureLayout(checked);
  }
  if (plan.activeMapId !== null && !ids.has(plan.activeMapId))
    throw new Error("Unknown active map.");
  if (plan.maps.length && plan.activeMapId === null)
    throw new Error("Choose an active map.");
}

function validateDocument(plan) {
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
  if (
    plan.excludedPlayerFileIds !== undefined &&
    (!Array.isArray(plan.excludedPlayerFileIds) ||
      plan.excludedPlayerFileIds.length > 500 ||
      plan.excludedPlayerFileIds.some(
        (id) => typeof id !== "string" || !/^[\w-]{1,200}$/.test(id),
      ) ||
      new Set(plan.excludedPlayerFileIds).size !==
        plan.excludedPlayerFileIds.length)
  )
    throw new Error("Invalid excluded player files.");
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
}

// Validate the shared team envelope while preserving fields owned by later editors.
export function validatePlan(
  input,
  catalog = { assets: [] },
  validateMaps = true,
) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid team document.");
  const plan = migratePlan(input);
  validateDocument(plan);
  validateCustomAssets(plan);
  validateEntities(plan, catalog);
  validatePlayerOwnership(plan.keeps);
  validatePlacement(plan);
  validateBackgrounds(plan);
  delete plan.allianceTag;
  plan.subcities ||= [];
  validateSubcities(plan.subcities, catalog.subcityTypes || null, plan.keeps);
  validateMapPresets(plan);
  if (validateMaps) validateMapCollection(plan, catalog);
  return plan;
}
