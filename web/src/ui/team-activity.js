export function bindTeamActivity({ button, dialog, content, getWorkspace }) {
  dialog.querySelector('[data-close="team-activity-dialog"]').onclick = () =>
    dialog.close();
  button.onclick = async () => {
    content.textContent = "Loading activity…";
    dialog.showModal();
    try {
      const entries = await getWorkspace().activity();
      if (!dialog.open) return;
      content.replaceChildren();
      if (!entries.length) {
        content.textContent = "No activity yet.";
        return;
      }
      const list = document.createElement("ol");
      for (const entry of [...entries].reverse()) {
        const item = document.createElement("li");
        const heading = document.createElement("div");
        heading.className = "activity-entry-heading";
        const actor = document.createElement("strong");
        actor.textContent = entry.account;
        const time = document.createElement("time");
        time.dateTime = entry.at;
        time.textContent = new Date(entry.at).toLocaleString();
        heading.append(actor, time);
        const changes = document.createElement("ul");
        for (const summary of entry.changes) {
          const line = document.createElement("li");
          line.textContent = summary;
          changes.append(line);
        }
        item.append(heading, changes);
        list.append(item);
      }
      content.append(list);
    } catch (error) {
      if (dialog.open) content.textContent = error.message;
    }
  };
}
