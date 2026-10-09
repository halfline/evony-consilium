import { number, string } from "./constraints.js";

export const SUBCITY_CULTURES = Object.freeze([
  "Europe",
  "China",
  "Japan",
  "Korea",
  "America",
  "Russia",
  "Arabia",
]);
export const SUBCITY_COLORS = Object.freeze([
  { id: "white", name: "White", color: "#e7e7da" },
  { id: "green", name: "Green", color: "#74b77b" },
  { id: "blue", name: "Blue", color: "#73a8e1" },
  { id: "purple", name: "Purple", color: "#b58add" },
  { id: "gold", name: "Gold", color: "#cbb477" },
  { id: "red", name: "Red", color: "#e17b75" },
]);
export const MAX_SUBCITIES = 500;
export const SUBCITY_COORDINATE_MAX = 1199;

export function validateSubcities(cities, types = null, players = null) {
  if (!Array.isArray(cities) || cities.length > MAX_SUBCITIES)
    throw new Error(`Maximum ${MAX_SUBCITIES} subcities per team.`);
  const ids = new Set();
  for (const city of cities) {
    if (!city || typeof city !== "object" || Array.isArray(city))
      throw new Error("Invalid subcity.");
    string(city.id, 120, "subcity ID");
    if (!city.id || ids.has(city.id))
      throw new Error("Duplicate or missing subcity ID.");
    ids.add(city.id);
    string(city.name, 100, "subcity name");
    if (city.ownerId != null) {
      string(city.ownerId, 120, "subcity owner");
      if (
        !city.ownerId ||
        (players && !players.some((player) => player.id === city.ownerId))
      )
        throw new Error("Choose a player on this team as the subcity owner.");
    }
    if (city.color === "red") {
      string(city.cityType, 120, "red subcity type");
      if (!city.cityType) throw new Error("Choose a specific red subcity.");
      string(city.culture, 100, "subcity culture");
      if (types) {
        const type = types.find(
          (item) => item.id === city.cityType && item.color === "red",
        );
        if (!type || type.culture !== city.culture)
          throw new Error("Choose a specific red subcity.");
      }
    } else {
      if (!SUBCITY_CULTURES.includes(city.culture))
        throw new Error("Choose a subcity culture.");
      if (city.cityType != null)
        throw new Error("Only red subcities use a named city type.");
    }
    if (!SUBCITY_COLORS.some((color) => color.id === city.color))
      throw new Error("Choose a subcity color.");
    if (city.x === null && city.y === null) continue;
    if (city.x === null || city.y === null)
      throw new Error("Enter both subcity coordinates, or leave both blank.");
    number(city.x, 0, SUBCITY_COORDINATE_MAX, "subcity X");
    number(city.y, 0, SUBCITY_COORDINATE_MAX, "subcity Y");
  }
  return cities;
}
export function saveSubcity(plan, values, id = null, types = null) {
  const next = structuredClone(plan);
  next.subcities ||= [];
  if (id && !next.subcities.some((city) => city.id === id))
    throw new Error("Subcity not found.");
  const city = {
    id: id || crypto.randomUUID(),
    name: values.name.trim(),
    culture: values.culture,
    color: values.color,
    cityType: values.color === "red" ? values.cityType : null,
    ownerId: Object.hasOwn(values, "ownerId")
      ? values.ownerId
      : (next.subcities.find((item) => item.id === id)?.ownerId ?? null),
    x: values.x,
    y: values.y,
  };
  if (id)
    next.subcities[next.subcities.findIndex((item) => item.id === id)] = city;
  else next.subcities.push(city);
  validateSubcities(next.subcities, types, next.keeps);
  return next;
}
