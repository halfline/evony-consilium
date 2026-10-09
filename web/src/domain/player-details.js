import { regenerateMarch } from "./march-generation.js";
import { MARCH_SIZE_BOOST } from "./troops.js";
import { validatePlayerDetails } from "./player-details-schema.js";

export function editPlayerDetails(plan, id, changes) {
  const next = structuredClone(plan);
  const player = next.keeps.find((item) => item.id === id);
  if (!player) throw new Error("Player not found.");
  const details = { ...player.details };
  for (const key of [
    "marchSize",
    "rallyCapacity",
    "buffs",
    "marchSizes",
    "marches",
    "troops",
  ])
    if (Object.hasOwn(changes, key))
      details[key] = structuredClone(changes[key]);
  if (details.marchSizes !== undefined) details.marchBoost = MARCH_SIZE_BOOST;
  if (details.marches)
    details.marches = details.marches.map((march) =>
      regenerateMarch(march, details.marchSizes),
    );
  player.details = validatePlayerDetails(details);
  return next;
}
