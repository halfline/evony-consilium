import { footprint, addEntity } from "./entities.js";
import { validatePlayerDetails } from "./player-details-schema.js";
import { number, string } from "./constraints.js";
import { castleForLevel } from "./castles.js";
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
