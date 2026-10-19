import { element } from "./player-fields.js";
import {
  progressDay,
  progressRecord,
  progressStatisticsAt,
  historicalChanges,
  validateProgress,
} from "../domain/player-progress.js";
import { control } from "./player-progress-controls.js";

// The normal stat inputs are the historical editor. This controller owns only
// the date, draft, and save boundary; the live profile is held by the host.
export function createProgressEditor({
  host,
  canEdit,
  getProgress,
  historical,
  getMetrics,
  onSave,
  onCancel,
  onDraft,
}) {
  const footer = element("section", undefined, "historical-actions");
  footer.dataset.progressEditor = "";
  footer.hidden = true;
  host.parentNode.append(footer);
  let editor = null,
    suspended = null;
  const button = (label, action) => {
    const node = element("button", label);
    node.type = "button";
    node.onclick = action;
    return node;
  };
  function draft() {
    if (!editor) return suspended;
    return {
      version: 2,
      active: true,
      id: editor.record?.id || null,
      record: editor.record,
      date: editor.date.value,
      note: editor.note.value,
      baseline: editor.baseline,
      statistics: historical.read(),
    };
  }
  function close() {
    if (editor) historical.leave();
    editor = null;
    suspended = null;
    host.hidden = true;
    host.replaceChildren();
    footer.replaceChildren();
    footer.hidden = true;
  }
  function save() {
    if (!editor || !canEdit()) return;
    const { date, record, message } = editor;
    message.textContent = "";
    try {
      if (!date.reportValidity() || !historical.validate()) return;
      if (record && getProgress()[record.id]?.revision !== record.revision)
        throw new Error(
          "This record has changed. Discard this draft and reopen the record.",
        );
      const pending = draft();
      const values = historicalChanges(
        editor.baseline,
        pending.statistics,
        record,
      );
      if (!Object.keys(values).length)
        throw new Error("Change a stat before saving a historical entry.");
      const at = new Date().toISOString();
      const observedAt =
        record && date.value === progressDay(record.observedAt)
          ? record.observedAt
          : new Date(`${date.value}T23:59:59.999`).toISOString();
      const next = record
        ? {
            ...record,
            observedAt,
            dateOnly:
              record.dateOnly || date.value !== progressDay(record.observedAt),
            updatedAt: at,
            revision: record.revision + 1,
            note: pending.note.trim(),
            values,
            applyToCurrent: false,
            currentCorrections: [],
          }
        : progressRecord(values, { observedAt, note: pending.note.trim() });
      validateProgress({ [next.id]: next });
      close();
      onDraft();
      onSave(next);
    } catch (error) {
      message.textContent = error.message;
    }
  }
  function open(record = null, pending = null) {
    if (!canEdit() && !pending) return;
    pending ||= !record ? suspended : null;
    close();
    if (pending?.active === false) {
      suspended = pending;
      return;
    }
    record = pending?.record || record;
    const date = element("input");
    date.type = "date";
    date.required = true;
    date.max = progressDay(new Date().toISOString());
    date.value =
      pending?.date?.split("T")[0] ||
      progressDay(record?.observedAt || new Date().toISOString());
    date.setAttribute("aria-label", "Historical date");
    const baseline =
      pending?.baseline ||
      progressStatisticsAt(getProgress(), date.value, record);
    const statistics = pending?.statistics || { ...baseline };
    // Restore drafts made by the former separate entry form too.
    if (pending?.values)
      for (const [key, value] of Object.entries(pending.values))
        if (value.unknown || value.raw !== "")
          statistics[key] = value.unknown ? null : Number(value.raw);
    const note = element("textarea");
    note.rows = 2;
    note.maxLength = 1000;
    note.value = pending?.note ?? record?.note ?? "";
    note.setAttribute("aria-label", "Historical entry note");
    const notes = element("details");
    notes.append(element("summary", "Note"), note);
    const message = element("p", undefined, "progress-error");
    message.setAttribute("role", "alert");
    editor = { record, date, note, baseline, message };
    date.onchange = () => {
      if (!date.checkValidity()) return;
      const edits = historicalChanges(
        editor.baseline,
        historical.read(),
        record,
      );
      editor.baseline = progressStatisticsAt(getProgress(), date.value, record);
      historical.setBaseline(editor.baseline);
      historical.write({ ...editor.baseline, ...edits });
      onDraft();
    };
    const actions = element("div", undefined, "progress-actions");
    const submit = button("Save historical changes", save);
    submit.className = "primary";
    submit.dataset.progressWrite = "";
    const cancel = button("Return to current stats", () => {
      const pending = draft();
      close();
      suspended = { ...pending, active: false };
      onDraft();
      onCancel();
    });
    const discard = button("Discard historical changes", () => {
      close();
      onDraft();
      onCancel();
    });
    actions.append(submit, discard);
    host.append(
      element("strong", "Historical edit"),
      control("Date", date),
      cancel,
    );
    footer.append(notes, message, actions);
    host.hidden = false;
    footer.hidden = false;
    historical.enter(statistics, getMetrics()[0]);
    historical.setBaseline(baseline);
    if (!pending) {
      date.focus();
    }
    onDraft();
  }
  return {
    open,
    close,
    draft,
    save,
    resume(record) {
      const pending =
        suspended && (!record || suspended.id === record.id)
          ? { ...suspended, active: true }
          : null;
      open(record, pending);
    },
    isEditing: () => !!editor,
  };
}
