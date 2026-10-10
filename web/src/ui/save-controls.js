export function createSaveControls({ button, reload, status }) {
  return ({ disabled, label, saving, conflict, dirty, readOnly }) => {
    button.disabled = disabled;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.textContent = label;
    button.setAttribute("aria-busy", String(saving));
    reload.hidden = !conflict;
    if (status)
      status.textContent = conflict
        ? dirty
          ? "Team changes need review · Save team"
          : "New team version available"
        : saving
          ? "Saving team…"
          : dirty
            ? "Team changes unsaved"
            : readOnly
              ? "Team read-only"
              : "Team saved";
  };
}
