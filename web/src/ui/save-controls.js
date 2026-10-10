export function createSaveControls({ button, reload, status }) {
  return ({ disabled, label, saving, conflict, dirty, readOnly, error }) => {
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
          : readOnly
            ? "Team read-only"
            : error
              ? "Team not saved · retrying automatically"
              : dirty
                ? "Team changes · autosaving every 30 seconds"
                : "Team saved";
    if (status) status.title = error || "";
  };
}
