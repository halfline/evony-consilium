import { number, string } from "./constraints.js";
import {
  BUFF_CONTEXTS,
  BUFF_TYPES,
  TROOP_TYPES,
  TROOP_NAMES,
} from "./troops.js";

const contexts = { city: "In-City", rally: "In-Rally", solo: "Solo" };
const statName = (stat) =>
  stat === "hp" ? "HP" : stat[0].toUpperCase() + stat.slice(1);
export const PROGRESS_METRICS = Object.freeze([
  {
    key: "level",
    label: "Keep level",
    group: "level",
    min: 1,
    max: 100,
    integer: true,
    unit: "",
  },
  {
    key: "rallyCapacity",
    label: "Rally capacity",
    group: "rally",
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    integer: true,
    unit: "troops",
  },
  ...TROOP_TYPES.map((type) => ({
    key: `marchSizes.${type}`,
    label: `${TROOP_NAMES[type]} march size (+200%)`,
    group: "march-size",
    type,
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    integer: true,
    unit: "troops",
  })),
  ...BUFF_CONTEXTS.flatMap((context) =>
    TROOP_TYPES.flatMap((type) =>
      BUFF_TYPES.map((stat) => ({
        key: `buffs.${context}.${type}.${stat}`,
        label: `${contexts[context]} ${TROOP_NAMES[type]} ${statName(stat)} buff`,
        group: "buffs",
        type,
        context,
        stat,
        min: 0,
        max: 1000000,
        unit: "%",
      })),
    ),
  ),
  ...TROOP_TYPES.flatMap((type) =>
    BUFF_TYPES.map((stat) => ({
      key: `debuffs.${type}.${stat}`,
      label: `${TROOP_NAMES[type]} ${statName(stat)} debuff`,
      group: "debuffs",
      type,
      stat,
      min: -1000000,
      max: 0,
      unit: "%",
    })),
  ),
]);
export const PROGRESS_METRIC_BY_KEY = new Map(
  PROGRESS_METRICS.map((metric) => [metric.key, metric]),
);
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const timestamp = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;

export function validateProgress(progress) {
  if (!object(progress) || Object.keys(progress).length > 100000)
    throw new Error("Invalid player progress history.");
  for (const [id, entry] of Object.entries(progress)) {
    if (
      !/^[\w-]{1,200}$/.test(id) ||
      ["__proto__", "constructor", "prototype"].includes(id) ||
      !object(entry) ||
      entry.id !== id
    )
      throw new Error("Invalid progress record ID.");
    if (!["baseline", "automatic", "manual"].includes(entry.kind))
      throw new Error("Invalid progress record source.");
    for (const field of ["observedAt", "recordedAt", "updatedAt"])
      if (!timestamp(entry[field]))
        throw new Error("Invalid progress record date.");
    number(
      entry.revision,
      1,
      Number.MAX_SAFE_INTEGER,
      "progress record revision",
    );
    string(entry.account, 200, "progress account");
    string(entry.note, 1000, "progress note");
    if (entry.dateOnly !== undefined && typeof entry.dateOnly !== "boolean")
      throw new Error("Invalid progress date precision.");
    if (entry.editedBy !== undefined)
      string(entry.editedBy, 200, "progress editor");
    if (entry.deletedAt !== undefined && !timestamp(entry.deletedAt))
      throw new Error("Invalid removed progress record date.");
    if (
      entry.applyToCurrent !== undefined &&
      typeof entry.applyToCurrent !== "boolean"
    )
      throw new Error("Invalid current-stat correction.");
    if (!object(entry.values) || !Object.keys(entry.values).length)
      throw new Error("Enter at least one historical statistic.");
    if (
      entry.currentCorrections !== undefined &&
      (!Array.isArray(entry.currentCorrections) ||
        entry.currentCorrections.some(
          (key) =>
            !PROGRESS_METRIC_BY_KEY.has(key) ||
            !Object.hasOwn(entry.values, key),
        ))
    )
      throw new Error("Invalid corrected statistics.");
    for (const [key, value] of Object.entries(entry.values)) {
      const metric = PROGRESS_METRIC_BY_KEY.get(key);
      if (!metric) throw new Error("Unknown progress statistic.");
      if (value !== null)
        number(value, metric.min, metric.max, metric.label, !!metric.integer);
    }
  }
  return progress;
}

export function playerStatistics(profile) {
  return Object.fromEntries(
    PROGRESS_METRICS.map(({ key }) => [
      key,
      key === "level"
        ? (profile.level ?? null)
        : (key
            .split(".")
            .reduce((value, part) => value?.[part], profile.details) ?? null),
    ]),
  );
}

export function progressRecord(
  values,
  {
    id = crypto.randomUUID(),
    at = new Date().toISOString(),
    account = "Unknown Google account",
    observedAt = at,
    note = "",
    kind = "manual",
  } = {},
) {
  const record = {
    id,
    kind,
    observedAt,
    recordedAt: at,
    updatedAt: at,
    account,
    revision: 1,
    note,
    values: structuredClone(values),
  };
  validateProgress({ [id]: record });
  return record;
}

export function orderedProgress(progress = {}, includeRemoved = false) {
  return Object.values(progress)
    .filter((entry) => includeRemoved || !entry.deletedAt)
    .sort(
      (a, b) =>
        a.observedAt.localeCompare(b.observedAt) ||
        a.recordedAt.localeCompare(b.recordedAt) ||
        Number(a.kind !== "baseline") - Number(b.kind !== "baseline") ||
        a.id.localeCompare(b.id),
    );
}

export function progressDay(at) {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
