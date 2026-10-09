export const MAX_ENTITIES = 500;
export const ENTITY_COLLECTIONS = Object.freeze([
  "keeps",
  "structures",
  "obstacles",
]);
export const footprint = (asset) => asset.footprint || 2;

export function newStructure(asset) {
  return {
    id: crypto.randomUUID(),
    name: asset.name,
    skin: asset.id,
    w: footprint(asset),
    h: footprint(asset),
    x: null,
    y: null,
    locked: false,
  };
}
export function newObstacle() {
  return {
    id: crypto.randomUUID(),
    name: "Blocked tile",
    w: 1,
    h: 1,
    x: null,
    y: null,
    locked: false,
  };
}
function assertEntityCapacity(collection, label) {
  if (collection.length >= MAX_ENTITIES)
    throw new Error(`Maximum ${MAX_ENTITIES} ${label} per team.`);
}
export function addEntity(plan, collection, entity) {
  if (!ENTITY_COLLECTIONS.includes(collection))
    throw new Error("Unknown entity collection.");
  assertEntityCapacity(
    plan[collection],
    collection === "keeps" ? "players" : collection,
  );
  const next = structuredClone(plan);
  next[collection].push(structuredClone(entity));
  return next;
}
