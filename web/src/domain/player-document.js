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
