import { footprint, addEntity } from "./entities.js";
import { number, string } from "./constraints.js";
import { castleForLevel } from "./castles.js";
import { validatePlayerDetails } from "./player-details-schema.js";
import { syncMapLayouts } from "./map-plans.js";
export function newPlayer(assets, allianceTag = "") {
  const variants = [...assets.values()].filter(
    (asset) => asset.family === "culture-japan",
  );
  const castle = castleForLevel(variants, 42);
  if (!castle) throw new Error("Japan castle assets are unavailable.");
  return {
    id: crypto.randomUUID(),
    name: "",
    accountId: "",
    allianceTag,
    level: 42,
    skin: castle.id,
    w: footprint(castle),
    h: footprint(castle),
    x: null,
    y: null,
    locked: false,
  };
}

// Only profile fields may be written by the player editor. Placements belong to maps.
const PLAYER_PROFILE_FIELDS = [
  "name",
  "accountId",
  "allianceTag",
  "level",
  "skin",
  "avatarId",
];
export function validatePlayerProfile(player, defaultTag = "") {
  if (player.details !== undefined) validatePlayerDetails(player.details);
  string(player.name, 100, "name");
  number(player.level, 1, 100, "keep level");
  if (player.avatarId !== undefined) string(player.avatarId, 120, "avatar ID");
  player.allianceTag ??= defaultTag;
  string(player.allianceTag, 16, "alliance tag");
  string(player.accountId, 40, "account ID");
  if (player.accountId && !/^\d+$/.test(player.accountId))
    throw new Error("Account IDs must contain digits.");
  return player;
}
export function editPlayerProfile(plan, id, changes) {
  const next = structuredClone(plan);
  const player = next.keeps.find((item) => item.id === id);
  if (!player) throw new Error("Player not found.");
  for (const field of PLAYER_PROFILE_FIELDS)
    if (Object.hasOwn(changes, field)) player[field] = changes[field];
  validatePlayerProfile(player);
  if (!player.name.trim()) throw new Error("Enter a player name.");
  return next;
}
export function removePlayer(plan, id) {
  const next = structuredClone(plan);
  next.keeps = next.keeps.filter((player) => player.id !== id);
  for (const city of next.subcities || [])
    if (city.ownerId === id) city.ownerId = null;
  if (next.rallyId === id) next.rallyId = next.keeps[0]?.id || null;
  return syncMapLayouts(next);
}

export function addPlayer(plan, player) {
  validatePlayerProfile(player);
  if (!player.name.trim()) throw new Error("Enter a player name.");
  return addEntity(plan, "keeps", player);
}
