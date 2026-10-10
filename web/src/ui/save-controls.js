import { paintStatusBadge } from "./status-badge.js";
export function createSaveControls({ button, reload, status }) {
  return ({ disabled, label, saving, conflict, dirty, readOnly, error }) => {
    button.disabled = disabled;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.textContent = label;
    button.setAttribute("aria-busy", String(saving));
    reload.hidden = !conflict;
    if (status) {
      const state = conflict
        ? "warning"
        : saving
          ? "saving"
          : readOnly
            ? "readonly"
            : error
              ? "error"
              : dirty
                ? "draft"
                : "saved";
      const text = conflict
        ? "Team · Review"
        : saving
          ? "Team · Saving"
          : readOnly
            ? "Team · Read-only"
            : error
              ? "Team · Not saved"
              : dirty
                ? "Team · Draft"
                : "Team · Saved";
      const detail =
        error ||
        (conflict
          ? "Team changes need review. Use Save team to resolve them."
          : saving
            ? "Saving team to Drive."
            : readOnly
              ? "This team is read-only."
              : dirty
                ? "Team changes are autosaving every 30 seconds."
                : "Team saved to Drive.");
      paintStatusBadge(status, text, state, detail);
    }
  };
}
