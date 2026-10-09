import { isTeamLogo, normalizeDiscordUrl } from "./team.js";

// Validate the shared team envelope while preserving fields owned by later editors.
export function validatePlan(input) {
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
  return plan;
}
