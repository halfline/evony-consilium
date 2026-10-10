// Independent changes are already merged; these choices apply only to conflicts.
export function createTeamConflictControls(dialog, getPlan = () => ({})) {
  let finish = null;
  const cancel = () => finish?.(null);
  function resolve(conflicts) {
    cancel();
    const root = dialog.querySelector("#team-conflict-values");
    root.replaceChildren(
      ...conflicts.map((conflict) => {
        const row = document.createElement("div");
        const label = document.createElement("strong");
        const plan = getPlan(),
          names = new Map(
            [
              ...(plan.keeps || []),
              ...(plan.maps || []),
              ...(plan.subcities || []),
            ].map((item) => [item.id, item.name || item.id]),
          );
        label.textContent = conflict.path
          .replace(/\[([^\]]+)\]/g, (_match, id) => ` › ${names.get(id) || id}`)
          .replaceAll(".", " › ")
          .replace(/^title$/, "Team name")
          .replace(/^discordUrl$/, "Discord link")
          .replace(/^projectLogo$/, "Team logo");
        const values = document.createElement("pre");
        const display = (value) =>
          value === undefined ? "Removed" : JSON.stringify(value, null, 2);
        values.textContent = `Your value: ${display(conflict.local)}\nShared value: ${display(conflict.remote)}`;
        row.append(label, values);
        return row;
      }),
    );
    return new Promise((done) => {
      finish = (value) => {
        finish = null;
        dialog.close();
        done(value);
      };
      dialog.showModal();
    });
  }
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    cancel();
  });
  for (const button of dialog.querySelectorAll("[data-team-resolution]")) {
    button.onclick = () =>
      finish?.(
        button.dataset.teamResolution === "cancel"
          ? null
          : button.dataset.teamResolution,
      );
  }
  return { resolve, cancel };
}
