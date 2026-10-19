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

// A stable operation ID and time are stored in the submitted draft before upload.
// Observations use saved source statistics, including the initial baseline.
export function recordPlayerProgress(before, after, { id, at, account }) {
  const next = structuredClone(after);
  const progress = next.details?.progress || {};
  for (const entry of Object.values(progress)) {
    const old = before?.details?.progress?.[entry.id];
    if (!old) entry.account = account;
    else if (entry.revision !== old.revision) entry.editedBy = account;
  }
  if (
    before?.details?.progress === undefined &&
    !Object.values(progress).some((entry) => entry.kind === "baseline")
  ) {
    const values = Object.fromEntries(
      Object.entries(playerStatistics(before || after)).filter(
        ([, value]) => value !== null,
      ),
    );
    if (Object.keys(values).length) {
      const record = progressRecord(values, {
        id: `baseline-${id}`,
        at,
        account,
        kind: "baseline",
      });
      progress[record.id] ||= record;
    }
  }
  if (before) {
    const previous = playerStatistics(before);
    const changed = Object.fromEntries(
      Object.entries(playerStatistics(after)).filter(
        ([key, value]) => value !== null && previous[key] !== value,
      ),
    );
    // An explicitly requested correction updates the existing observation rather
    // than creating a second observation that looks like player growth.
    for (const entry of Object.values(progress)) {
      const old = before.details?.progress?.[entry.id];
      if (
        !entry.deletedAt &&
        (entry.applyToCurrent || entry.currentCorrections?.length) &&
        entry.revision !== old?.revision
      )
        for (const key of entry.currentCorrections || Object.keys(entry.values))
          if (changed[key] === entry.values[key]) delete changed[key];
    }
    if (Object.keys(changed).length) {
      const record = progressRecord(changed, {
        id: `auto-${id}`,
        at,
        account,
        kind: "automatic",
      });
      progress[record.id] ||= record;
    }
  }
  if (Object.keys(progress).length || after.details?.progress !== undefined) {
    next.details ||= {};
    next.details.progress = validateProgress(progress);
  }
  return next;
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

// Duplicate observations do not make a day ambiguous. Count actual changes in
// the selected metrics, sharing the same decision between chart and history.
export function progressRecordsWithTime(progress, keys) {
  const previous = {},
    days = new Map();
  for (const record of orderedProgress(progress)) {
    let changed = false;
    for (const key of keys) {
      const value = record.values[key];
      if (value == null) continue;
      if (value !== previous[key]) changed = true;
      previous[key] = value;
    }
    if (!changed) continue;
    const day = progressDay(record.observedAt);
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(record);
  }
  return new Set(
    [...days.values()]
      .filter((records) => records.length > 1)
      .flatMap((records) =>
        records
          .filter((record) => record.kind !== "manual" && !record.dateOnly)
          .map((record) => record.id),
      ),
  );
}

export function progressSeries(
  progress,
  keys,
  { daily = true, since = null } = {},
) {
  const records = orderedProgress(progress);
  const timed = progressRecordsWithTime(progress, keys);
  return keys.map((key) => {
    const points = [];
    let previous;
    for (const entry of records) {
      if (entry.values[key] == null) continue;
      const point = {
        id: entry.id,
        at: entry.observedAt,
        value: entry.values[key],
        showTime: timed.has(entry.id),
      };
      if (since && entry.observedAt < since) {
        previous = point;
        continue;
      }
      if (
        daily &&
        points.length &&
        progressDay(points.at(-1).at) === progressDay(point.at)
      )
        points[points.length - 1] = point;
      else points.push(point);
    }
    // Carry the last observation into the window without inventing a new one.
    // Keep the boundary point separate from daily aggregation.
    if (previous)
      points.unshift({
        ...previous,
        at: since,
        observedAt: previous.at,
        carried: true,
      });
    return { ...PROGRESS_METRIC_BY_KEY.get(key), points };
  });
}

// Date-only entries represent the end of the selected local day. When editing
// an existing observation, stop at that observation, including same-day order.
export function progressObservationsAt(progress, day, record = null) {
  const values = {};
  for (const entry of orderedProgress(progress)) {
    if (progressDay(entry.observedAt) > day) break;
    Object.assign(
      values,
      Object.fromEntries(
        Object.entries(entry.values).filter(([, value]) => value !== null),
      ),
    );
    if (
      record &&
      progressDay(record.observedAt) === day &&
      entry.id === record.id
    )
      break;
  }
  return values;
}

export function progressStatisticsAt(progress, day, record = null) {
  return {
    ...Object.fromEntries(PROGRESS_METRICS.map(({ key }) => [key, null])),
    ...progressObservationsAt(progress, day, record),
  };
}

export function historicalChanges(baseline, values, record = null) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) =>
        value !== null &&
        (value !== baseline[key] || record?.values[key] != null),
    ),
  );
}
