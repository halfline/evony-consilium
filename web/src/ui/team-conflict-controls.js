// Independent changes are already merged; these choices apply only to conflicts.
export function createTeamConflictControls(dialog, getPlan = () => ({})) {
  let finish = null;
  const cancel = () => finish?.(null);
  function resolve(conflicts) {
    cancel();
    const root = dialog.querySelector("#team-conflict-values");
    const plan = getPlan(),
      names = new Map(
        [
          ...(plan.keeps || []),
          ...(plan.maps || []),
          ...(plan.subcities || []),
        ].map((item) => [item.id, item.name || item.id]),
      );
    const display = (value) => {
      if (value === undefined) return "Removed";
      if (value === null || value === "") return "Empty";
      if (typeof value === "string")
        return value.startsWith("data:image/") ? "Uploaded image" : value;
      return typeof value === "object"
        ? JSON.stringify(value, null, 2)
        : String(value);
    };
    root.replaceChildren(
      ...conflicts.map((conflict, index) => {
        const row = document.createElement("fieldset");
        row.className = "team-conflict-row";
        const label = document.createElement("legend");
        const path = conflict.path
          .replace(/\[([^\]]+)\]/g, (_match, id) => ` › ${names.get(id) || id}`)
          .replaceAll(".", " › ")
          .replace(/^title$/, "Team name")
          .replace(/^discordUrl$/, "Discord link")
          .replace(/^projectLogo$/, "Team logo")
          .replace(/([a-z])([A-Z])/g, "$1 $2");
        label.textContent = path.charAt(0).toUpperCase() + path.slice(1);
        row.append(label);
        for (const [side, title] of [
          ["local", "Mine"],
          ["remote", "Shared"],
        ]) {
          const option = document.createElement("label");
          option.className = "team-conflict-option";
          const input = document.createElement("input");
          input.type = "radio";
          input.name = `team-conflict-${index}`;
          input.value = side;
          input.dataset.path = conflict.path;
          input.checked = side === "local";
          const heading = document.createElement("strong");
          heading.textContent = title;
          const value = document.createElement("span");
          value.className = "team-conflict-value";
          value.textContent = display(conflict[side]);
          option.append(input, heading, value);
          row.append(option);
        }
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
  dialog.querySelector('[data-team-resolution="cancel"]').onclick = cancel;
  dialog.querySelector('[data-team-resolution="apply"]').onclick = () => {
    const choices = Object.fromEntries(
      [...dialog.querySelectorAll(".team-conflict-option input:checked")].map(
        (input) => [input.dataset.path, input.value],
      ),
    );
    finish?.(choices);
  };
  return { resolve, cancel };
}
