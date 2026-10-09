import { validatePlayerProfile } from "./players.js";

const FIELDS = [
  "name",
  "accountId",
  "allianceTag",
  "level",
  "skin",
  "avatarId",
  "details",
];
export function playerProfile(player) {
  return Object.fromEntries(
    FIELDS.filter((key) => player[key] !== undefined).map((key) => [
      key,
      structuredClone(player[key]),
    ]),
  );
}
export function validateProfile(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid player profile.");
  const profile = playerProfile(input);
  validatePlayerProfile(profile);
  if (
    !profile.name.trim() ||
    typeof profile.skin !== "string" ||
    !profile.skin ||
    profile.skin.length > 120
  )
    throw new Error("Invalid player name or castle.");
  return profile;
}
export function playerDocument(profile) {
  return {
    format: "evony-consilium-player",
    schema: 1,
    profile: validateProfile(profile),
  };
}
export function readPlayerDocument(input) {
  if (input?.format !== "evony-consilium-player" || input.schema !== 1)
    throw new Error("This file is not an Evony Consilium player.");
  return validateProfile(input.profile);
}
export function validatePlayerSource(source) {
  if (
    !source ||
    typeof source !== "object" ||
    Array.isArray(source) ||
    typeof source.fileId !== "string" ||
    !/^[\w-]{1,200}$/.test(source.fileId) ||
    typeof source.resourceKey !== "string" ||
    source.resourceKey.length > 200 ||
    typeof source.version !== "string" ||
    source.version.length > 100 ||
    typeof source.syncedAt !== "string" ||
    !Number.isFinite(Date.parse(source.syncedAt))
  )
    throw new Error("Invalid player file link.");
  source.baseline = validateProfile(source.baseline);
}
export function applyPlayerProfile(player, profile) {
  const next = { ...structuredClone(player) };
  for (const field of FIELDS) delete next[field];
  Object.assign(next, validateProfile(profile));
  return next;
}
export function linkedPlayer(player, profile, file) {
  const next = applyPlayerProfile(player, profile);
  next.playerSource = {
    fileId: file.id,
    resourceKey: file.resourceKey || "",
    version: file.version,
    baseline: playerProfile(next),
    syncedAt: new Date().toISOString(),
  };
  return next;
}
export function profileFingerprint(value) {
  if (Array.isArray(value))
    return `[${value.map(profileFingerprint).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${profileFingerprint(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
const equal = (a, b) => profileFingerprint(a) === profileFingerprint(b);
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
// Arrays (including marches) are one unit; unrelated object fields merge independently.
export function mergePlayerProfiles(base, team, remote, resolution = null) {
  const conflicts = [];
  function merge(before, local, source, path) {
    if (equal(local, source) || equal(before, source))
      return structuredClone(local);
    if (equal(before, local)) return structuredClone(source);
    if (object(before) && object(local) && object(source)) {
      const result = {};
      for (const key of new Set([
        ...Object.keys(before),
        ...Object.keys(local),
        ...Object.keys(source),
      ])) {
        const value = merge(
          before[key],
          local[key],
          source[key],
          path ? `${path}.${key}` : key,
        );
        if (value !== undefined) result[key] = value;
      }
      return result;
    }
    conflicts.push(path);
    return structuredClone(resolution === "player" ? source : local);
  }
  return { profile: merge(base, team, remote, ""), conflicts };
}
