import { view } from "./dom.js";
import { element } from "./player-fields.js";
import { TROOP_NAMES } from "../domain/troops.js";
import {
  orderedProgress,
  progressSeries,
  progressRecordsWithTime,
  PROGRESS_METRICS,
  PROGRESS_METRIC_BY_KEY,
} from "../domain/player-progress.js";
import {
  progressDate,
  progressValue,
  renderProgressChart,
} from "./player-progress-chart.js";

import {
  categories,
  troops,
  contexts,
  control,
  select as makeSelect,
} from "./player-progress-controls.js";
import { createProgressEditor } from "./player-progress-editor.js";

export function createPlayerProgress({
  root,
  canEdit,
  historical,
  saveChanges,
}) {
  const $ = view(root),
    host = $("player-progress");
  let player,
    progress = {},
    initialized = false,
    removedId,
    revealedId = null,
    limit = 25,
    chosenMetrics = false;
  const select = (name, choices) => makeSelect(name, choices, true);
  const button = (label, action, write = false) => {
    const node = element("button", label);
    node.type = "button";
    if (write) node.dataset.progressWrite = "";
    node.onclick = () => {
      if (!write || canEdit()) action();
    };
    return node;
  };
  const changed = () =>
    host.dispatchEvent(new Event("change", { bubbles: true }));
  const persist = () => {
    changed();
    queueMicrotask(saveChanges);
  };
  const filters = element("div", undefined, "progress-filters");
  const category = select("Statistic", categories);
  const troop = select("Troop type", troops);
  const context = select("Buff context", contexts);
  const range = select("Date range", [
    ["all", "All time"],
    ["30", "Last 30 days"],
    ["90", "Last 90 days"],
    ["365", "Last year"],
  ]);
  const frequency = select("Chart entries", [
    ["daily", "Daily values"],
    ["all", "Every change"],
  ]);
  const troopLabel = control("Troop type", troop),
    contextLabel = control("Buff context", context);
  filters.append(
    control("Statistic", category),
    troopLabel,
    contextLabel,
    control("Date range", range),
  );
  const chartOptions = element("details", undefined, "progress-options");
  chartOptions.append(
    element("summary", "Chart options"),
    control("Show", frequency),
  );
  const title = element("h3", undefined, "progress-chart-title");
  const chart = element("div", undefined, "progress-chart");
  const actions = element("div", undefined, "progress-actions");
  const add = button("Add past stats", () => openEditor(), true);
  const undo = button(
    "Undo removal",
    () => {
      const record = progress[removedId];
      if (!record) return;
      restoreRecord(record);
    },
    true,
  );
  const showRemoved = element("input");
  showRemoved.type = "checkbox";
  showRemoved.dataset.progressView = "Removed records";
  const historyOptions = element(
    "details",
    undefined,
    "progress-options progress-history-options",
  );
  const historyMenu = element("summary", "⋯");
  historyMenu.setAttribute("aria-label", "History options");
  historyOptions.append(
    historyMenu,
    control("Show removed records", showRemoved),
  );
  root.addEventListener("click", (event) => {
    if (!event.composedPath().includes(historyOptions))
      historyOptions.open = false;
  });
  historyOptions.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      historyOptions.open = false;
      historyMenu.focus();
    }
  });
  actions.append(element("h3", "History"), add, undo, historyOptions);
  const editorHost = element("section", undefined, "progress-editor");
  editorHost.dataset.progressEditor = "";
  editorHost.hidden = true;
  $("player-form").prepend(editorHost);
  const editor = createProgressEditor({
    host: editorHost,
    canEdit,
    getProgress: () => progress,
    historical,
    getMetrics: selectedMetrics,
    onDraft: () =>
      host.dispatchEvent(new Event("progressdraftchange", { bubbles: true })),
    onSave: (record) => {
      progress[record.id] = record;
      initialized = true;
      if (
        !selectedMetrics().some((metric) =>
          Object.hasOwn(record.values, metric.key),
        )
      ) {
        const metric = PROGRESS_METRIC_BY_KEY.get(
          Object.keys(record.values)[0],
        );
        category.value = metric.group;
        if (metric.type) troop.value = metric.type;
        if (metric.context) context.value = metric.context;
      }
      chosenMetrics = true;
      if (since() && record.observedAt < since()) range.value = "all";
      paint();
      persist();
      focusRecord(record.id);
    },
    onCancel: () => {
      paint();
      add.focus();
    },
  });
  const list = element("div", undefined, "progress-records");
  const more = button("Show more entries", () => {
    limit += 25;
    paintList();
  });
  more.dataset.progressView = "More entries";
  host.append(title, filters, chartOptions, chart, actions, list, more);
  for (const input of [category, troop, context, range, frequency])
    input.onchange = () => {
      if ([category, troop, context].includes(input)) chosenMetrics = true;
      revealedId = null;
      limit = 25;
      paint();
    };
  showRemoved.onchange = paintList;
  let chartWidth = 0;
  new ResizeObserver(([entry]) => {
    if (entry.contentRect.width > 0 && entry.contentRect.width !== chartWidth) {
      chartWidth = entry.contentRect.width;
      paintChart();
    }
  }).observe(host);
  function selectedMetrics() {
    return PROGRESS_METRICS.filter(
      (metric) =>
        metric.group === category.value &&
        (!metric.type || metric.type === troop.value) &&
        (!metric.context || metric.context === context.value),
    );
  }
  function paintChart() {
    troopLabel.hidden = !["buffs", "debuffs", "march-size"].includes(
      category.value,
    );
    contextLabel.hidden = category.value !== "buffs";
    title.textContent =
      category.value === "buffs"
        ? `${context.selectedOptions[0].textContent} ${TROOP_NAMES[troop.value]} buffs`
        : category.value === "debuffs"
          ? `${TROOP_NAMES[troop.value]} debuffs`
          : category.value === "march-size"
            ? `${TROOP_NAMES[troop.value]} march size`
            : category.selectedOptions[0].textContent;
    renderProgressChart(
      chart,
      progressSeries(
        progress,
        selectedMetrics().map((metric) => metric.key),
        { daily: frequency.value === "daily", since: since() },
      ),
      focusRecord,
      { daily: frequency.value === "daily" },
    );
  }
  function since() {
    return range.value === "all"
      ? null
      : new Date(Date.now() - Number(range.value) * 86400000).toISOString();
  }
  function visibleRecords() {
    const keys = selectedMetrics().map((metric) => metric.key),
      start = since();
    return orderedProgress(progress, showRemoved.checked)
      .reverse()
      .filter(
        (record) =>
          keys.some((key) => record.values[key] != null) &&
          (!start || record.observedAt >= start || record.id === revealedId),
      );
  }
  function focusRecord(id) {
    revealedId = id;
    const records = visibleRecords();
    limit = Math.max(
      limit,
      records.findIndex((record) => record.id === id) + 1,
    );
    paintList();
    const row = [...list.children].find(
      (node) => node.dataset.progressRecord === id,
    );
    if (row) {
      row.open = true;
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
      row.querySelector("summary").focus();
    }
  }
  function paintList() {
    const open = new Set(
      [...list.querySelectorAll(":scope > details[open]")].map(
        (row) => row.dataset.progressRecord,
      ),
    );
    const records = visibleRecords(),
      keys = new Set(selectedMetrics().map((metric) => metric.key));
    const previous = new Map(),
      current = {};
    for (const record of orderedProgress(progress, true)) {
      previous.set(record.id, { ...current });
      if (!record.deletedAt)
        Object.assign(
          current,
          Object.fromEntries(
            Object.entries(record.values).filter(([, value]) => value !== null),
          ),
        );
    }
    list.replaceChildren();
    if (!records.length)
      list.append(
        element(
          "p",
          since()
            ? "No recorded changes in this period."
            : "No records for these stats.",
          "muted",
        ),
      );
    const timed = progressRecordsWithTime(progress, [...keys]);
    for (const record of records.slice(0, limit)) {
      const row = element("details", undefined, "progress-record");
      row.dataset.progressRecord = record.id;
      row.open = open.has(record.id);
      const summary = element("summary");
      summary.append(
        element(
          "strong",
          progressDate(record.observedAt, { showTime: timed.has(record.id) }),
        ),
        element(
          "span",
          `${record.deletedAt ? "Removed · " : ""}${{ baseline: "Initial snapshot", automatic: "Automatic update", manual: "Past entry" }[record.kind]}`,
          "muted",
        ),
      );
      const preview = element("div", undefined, "progress-record-preview");
      for (const [key, value] of Object.entries(record.values).filter(
        ([key, value]) => keys.has(key) && value !== null,
      )) {
        const metric = PROGRESS_METRIC_BY_KEY.get(key),
          before = previous.get(record.id)[key];
        preview.append(
          element(
            "span",
            `${metric.label}: ${before === undefined || before === value ? "" : `${progressValue(before, metric.unit)} → `}${progressValue(value, metric.unit)}`,
          ),
        );
      }
      const others = Object.keys(record.values).filter(
        (key) => !keys.has(key) && record.values[key] !== null,
      ).length;
      if (others)
        preview.append(
          element(
            "span",
            `+${others} other ${others === 1 ? "stat" : "stats"}`,
            "muted",
          ),
        );
      summary.append(preview);
      if (since() && record.observedAt < since())
        summary.append(element("span", "Before selected period", "muted"));
      row.append(summary);
      if (record.note) row.append(element("p", record.note));
      const audit = element("details", undefined, "progress-audit");
      audit.append(
        element("summary", "Record details"),
        element(
          "p",
          `Added ${progressDate(record.recordedAt, { showTime: true })} by ${record.account}${record.editedBy ? ` · Edited ${progressDate(record.updatedAt, { showTime: true })} by ${record.editedBy}` : ""}`,
          "muted",
        ),
      );
      const values = element("dl");
      for (const [key, value] of Object.entries(record.values)) {
        if (value === null) continue;
        const metric = PROGRESS_METRIC_BY_KEY.get(key);
        values.append(
          element("dt", metric.label),
          element("dd", progressValue(value, metric.unit)),
        );
      }
      row.append(values);
      if (record.deletedAt) {
        const restore = button(
          "Restore entry",
          () => restoreRecord(record),
          true,
        );
        restore.hidden = editor.isEditing();
        row.append(restore);
      } else {
        const rowActions = element("div", undefined, "progress-actions");
        rowActions.hidden = editor.isEditing();
        const edit = button("Edit record", () => openEditor(record), true);
        const pending = editor.draft();
        edit.disabled = !!pending && pending.id !== record.id;
        rowActions.append(
          edit,
          button(
            "Remove entry",
            () => {
              progress[record.id] = {
                ...record,
                deletedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                revision: record.revision + 1,
                applyToCurrent: false,
                currentCorrections: [],
              };
              removedId = record.id;
              paint();
              persist();
            },
            true,
          ),
        );
        row.append(rowActions);
      }
      row.append(audit);
      list.append(row);
    }
    more.hidden = records.length <= limit;
  }
  function paint() {
    add.hidden = editor.isEditing();
    add.textContent = editor.draft()
      ? "Resume historical entry"
      : "Add past stats";
    undo.hidden =
      editor.isEditing() || !removedId || !progress[removedId]?.deletedAt;
    paintChart();
    paintList();
  }
  function restoreRecord(record) {
    const restored = {
      ...record,
      revision: record.revision + 1,
      updatedAt: new Date().toISOString(),
      applyToCurrent: false,
      currentCorrections: [],
    };
    delete restored.deletedAt;
    progress[record.id] = restored;
    if (removedId === record.id) removedId = null;
    paint();
    persist();
  }
  function openEditor(record = null, draft = null) {
    if (draft) editor.open(record, draft);
    else editor.resume(record);
    paint();
  }
  return {
    render(next, { draft = null } = {}) {
      const changedPlayer = player?.id !== next.id;
      const pending = draft || (!changedPlayer ? editor.draft() : null);
      const preserveEditor = !changedPlayer && editor.isEditing();
      player = next;
      progress = structuredClone(next.details?.progress || {});
      initialized = next.details?.progress !== undefined;
      if (changedPlayer) {
        limit = 25;
        removedId = null;
        revealedId = null;
        range.value = "all";
        showRemoved.checked = false;
        chosenMetrics = false;
      }
      if (!chosenMetrics) {
        const measured = new Set(
          orderedProgress(progress).flatMap((entry) =>
            Object.entries(entry.values)
              .filter(([, value]) => value !== null)
              .map(([key]) => key),
          ),
        );
        const metric = ["buffs", "debuffs", "march-size", "rally", "level"]
          .flatMap((group) =>
            PROGRESS_METRICS.filter((item) => item.group === group),
          )
          .find((item) => measured.has(item.key));
        if (metric) {
          category.value = metric.group;
          if (metric.type) troop.value = metric.type;
          if (metric.context) context.value = metric.context;
        }
      }
      if (!preserveEditor) editor.close();
      paint();
      if (pending && !preserveEditor)
        openEditor(progress[pending.id] || null, pending);
    },
    read: () => (initialized ? { progress: structuredClone(progress) } : {}),
    editorDraft: editor.draft,
    saveHistorical: editor.save,
    isEditing: editor.isEditing,
    show({ group, type, context: buffContext } = {}) {
      if (group) category.value = group;
      if (type) troop.value = type;
      if (buffContext) context.value = buffContext;
      chosenMetrics = true;
      revealedId = null;
      paint();
    },
  };
}
