import { projectFingerprint, syncMapLayouts } from "./map-plans.js";
import { applyLayout } from "./layout.js";
import { playerProfile } from "./player-document.js";
import { ensureMapRallySetters } from "./rally.js";
import { overlap } from "./geometry.js";

const copy = (value) => structuredClone(value);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const profileFields = [
  "name",
  "accountId",
  "allianceTag",
  "level",
  "skin",
  "avatarId",
  "details",
  "playerSource",
];

function canonical(plan) {
  const next = JSON.parse(projectFingerprint(plan));
  if (!next.rallyManual && "rallyId" in next) next.rallyId = null;
  for (const map of next.maps || [])
    if (!map.layout.rallyManual) map.layout.rallyId = null;
  for (const player of next.keeps || []) {
    if (!player.playerSource) continue;
    player.profileCache = {
      ...playerProfile(player),
      playerSource: player.playerSource,
    };
    for (const field of profileFields) delete player[field];
  }
  return next;
}

// Source revisions are authoritative. Cache refreshes never represent a planner edit.
function newerCache(local, remote) {
  if (!local?.playerSource || !remote?.playerSource) return null;
  if (local?.playerSource?.fileId !== remote?.playerSource?.fileId) return null;
  const a = local.playerSource.version,
    b = remote.playerSource.version;
  if (/^\d+$/.test(a) && /^\d+$/.test(b) && a !== b)
    return BigInt(a) > BigInt(b) ? local : remote;
  if (a === b)
    return Date.parse(local.playerSource.syncedAt) >
      Date.parse(remote.playerSource.syncedAt)
      ? local
      : remote;
  return null;
}

export function teamFingerprint(plan) {
  const next = canonical(plan);
  for (const player of next.keeps || []) {
    if (player.profileCache) {
      player.playerFileId = player.profileCache.playerSource.fileId;
      delete player.profileCache;
    }
  }
  return JSON.stringify(next);
}

// Arrays of entities merge by stable ID. A move, array of marches, or deletion
// against an edit is one conflict rather than a mixture of incompatible values.
export function mergeTeamPlans(
  base,
  local,
  remote,
  { resolution = null } = {},
) {
  const conflicts = [];
  function merge(before, mine, theirs, path = "") {
    if (path.endsWith("profileCache")) {
      const newest = newerCache(mine, theirs);
      if (newest) return copy(newest);
    }
    if (equal(mine, theirs)) return copy(mine);
    if (equal(before, mine)) return copy(theirs);
    if (equal(before, theirs)) return copy(mine);
    // Removing membership wins over a concurrent refresh of that member's cache.
    if (
      path.startsWith("keeps[") &&
      (mine === undefined || theirs === undefined)
    ) {
      const remaining = mine ?? theirs;
      const withoutCache = (value) => {
        if (!value) return value;
        const result = { ...value };
        delete result.profileCache;
        return result;
      };
      if (equal(withoutCache(before), withoutCache(remaining)))
        return undefined;
    }
    if (
      !/\.positions\[[^\]]+\]$/.test(path) &&
      object(mine) &&
      object(theirs) &&
      (before === undefined || object(before))
    ) {
      const result = {};
      for (const key of new Set([
        ...Object.keys(before || {}),
        ...Object.keys(mine),
        ...Object.keys(theirs),
      ])) {
        const value = merge(
          before?.[key],
          mine[key],
          theirs[key],
          path ? `${path}.${key}` : key,
        );
        if (value !== undefined) result[key] = value;
      }
      return result;
    }
    if (
      Array.isArray(mine) &&
      Array.isArray(theirs) &&
      (before === undefined || Array.isArray(before))
    ) {
      if (path === "excludedPlayerFileIds")
        return [...new Set([...mine, ...theirs])].sort();
      const rows = [...(before || []), ...mine, ...theirs];
      if (
        rows.length &&
        rows.every((row) => object(row) && typeof row.id === "string") &&
        [before || [], mine, theirs].every(
          (list) => new Set(list.map((row) => row.id)).size === list.length,
        )
      ) {
        const byId = (list) =>
          new Map((list || []).map((row) => [row.id, row]));
        const original = byId(before),
          ours = byId(mine),
          shared = byId(theirs);
        return [
          ...new Set([...shared.keys(), ...ours.keys(), ...original.keys()]),
        ]
          .map((id) =>
            merge(
              original.get(id),
              ours.get(id),
              shared.get(id),
              `${path}[${id}]`,
            ),
          )
          .filter((row) => row !== undefined);
      }
    }
    conflicts.push({
      path,
      base: copy(before),
      local: copy(mine),
      remote: copy(theirs),
    });
    return copy(resolution === "remote" ? theirs : mine);
  }
  const original = canonical(base),
    ours = canonical(local),
    shared = canonical(remote);
  const plan = merge(original, ours, shared);
  for (const player of plan.keeps || []) {
    if (player.profileCache) {
      Object.assign(player, player.profileCache);
      delete player.profileCache;
    }
  }
  // Independent moves can still collide; review the affected formation as a unit.
  const players = new Set(plan.keeps.map((player) => player.id));
  for (const map of plan.maps || []) {
    const placed = [
      ...map.layout.positions.filter((position) => players.has(position.id)),
      ...map.layout.structures,
      ...map.layout.obstacles,
    ].filter((entity) => entity.x !== null);
    const invalid = placed.some(
      (entity, index) =>
        entity.x < 0 ||
        entity.y < 0 ||
        entity.x + entity.w > map.layout.extent ||
        entity.y + entity.h > map.layout.extent ||
        placed.slice(index + 1).some((other) => overlap(entity, other)),
    );
    if (!invalid) continue;
    const mine = ours.maps?.find((item) => item.id === map.id),
      theirs = shared.maps?.find((item) => item.id === map.id);
    if (!mine || !theirs) continue;
    conflicts.push({
      path: `maps[${map.id}].layout (overlapping or out-of-bounds tiles)`,
      base: copy(original.maps?.find((item) => item.id === map.id)?.layout),
      local: copy(mine.layout),
      remote: copy(theirs.layout),
    });
    map.layout = copy(resolution === "remote" ? theirs.layout : mine.layout);
    map.type = map.layout.map;
  }
  if (plan.maps?.length) {
    const active =
      plan.maps.find((map) => map.id === local.activeMapId) ||
      plan.maps.find((map) => map.id === remote.activeMapId) ||
      plan.maps[0];
    plan.activeMapId = active.id;
    applyLayout(plan, active.layout);
  } else {
    plan.activeMapId = null;
    for (const player of plan.keeps || []) {
      player.x ??= null;
      player.y ??= null;
      player.w ??= 2;
      player.h ??= 2;
      player.locked ??= false;
    }
  }
  return { plan: syncMapLayouts(ensureMapRallySetters(plan)), conflicts };
}

export function applyProfileCaches(plan, updates) {
  const next = copy(plan);
  for (const update of updates) {
    if (!update.playerSource) continue;
    const player = next.keeps.find(
      (item) =>
        item.id === update.id &&
        item.playerSource?.fileId === update.playerSource?.fileId,
    );
    if (!player) continue;
    const latest =
      update.playerSource.version === player.playerSource.version
        ? update
        : newerCache(update, player);
    if (latest !== update) continue;
    for (const field of profileFields) delete player[field];
    Object.assign(player, playerProfile(update), {
      playerSource: copy(update.playerSource),
    });
  }
  return next;
}
