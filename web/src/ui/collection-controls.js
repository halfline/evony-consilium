import { labelWithIcon } from "./icons.js";

export function createCollectionControls({
  root,
  title,
  description,
  add,
  label,
  kind,
}) {
  const heading = document.createElement("header");
  heading.className = "collection-heading";
  const copy = document.createElement("div");
  const name = document.createElement("h1");
  name.textContent = title;
  const summary = document.createElement("p");
  summary.className = "muted collection-summary";
  summary.textContent = description;
  copy.append(name, summary);
  const actions = document.createElement("div");
  actions.className = "collection-toolbar";
  actions.id = `${kind}-actions`;
  add.className = "primary collection-add";
  labelWithIcon(add, "plus", label);
  actions.append(add);
  heading.append(copy, actions);
  root.prepend(heading);
  return {
    render({ count, total, filtered = false }) {
      const singular =
        kind === "subcities"
          ? "subcity"
          : title.toLowerCase().replace(/s$/, "");
      summary.textContent = `${count}${filtered ? ` of ${total}` : ""} ${count === 1 ? singular : title.toLowerCase()} · ${description}`;
    },
  };
}
