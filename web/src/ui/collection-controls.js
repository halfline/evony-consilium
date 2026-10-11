import { icon, labelWithIcon } from "./icons.js";

export function createCollectionControls({
  root,
  title,
  description,
  add,
  label,
  kind,
  grid,
  views = false,
  emptyTitle,
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
  if (views) {
    const toggle = document.createElement("div");
    toggle.className = "view-toggle";
    toggle.setAttribute("role", "group");
    toggle.setAttribute("aria-label", `${title} layout`);
    let current = "grid";
    try {
      current = localStorage.getItem(`consilium-${kind}-view`) || "grid";
    } catch {
      /* Storage is optional. */
    }
    const buttons = ["grid", "list"].map((mode) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.collectionView = mode;
      button.setAttribute(
        "aria-label",
        mode === "grid" ? "Portrait grid" : "Compact list",
      );
      button.title = button.getAttribute("aria-label");
      button.append(icon(mode));
      button.onclick = () => {
        setView(mode);
        try {
          localStorage.setItem(`consilium-${kind}-view`, mode);
        } catch {
          /* Storage is optional. */
        }
      };
      toggle.append(button);
      return button;
    });
    function setView(mode) {
      grid.classList.toggle("compact-list", mode === "list");
      for (const button of buttons)
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.collectionView === mode),
        );
    }
    setView(current === "list" ? "list" : "grid");
    actions.append(toggle);
  }
  add.className = "primary collection-add";
  labelWithIcon(add, "plus", label);
  actions.append(add);
  heading.append(copy, actions);
  root.prepend(heading);
  const empty = root.querySelector(".collection-actions");
  empty.classList.add("collection-empty");
  const art = document.createElement("div");
  art.className = "empty-emblem";
  art.append(
    icon(kind === "maps" ? "map" : kind === "subcities" ? "castle" : "people"),
  );
  art.setAttribute("aria-hidden", "true");
  const help = document.createElement("p");
  help.className = "empty-description";
  empty.prepend(art);
  empty.append(help);
  const clear = document.createElement("button");
  clear.type = "button";
  clear.textContent = "Clear filters";
  clear.className = "text-button";
  clear.hidden = true;
  empty.append(clear);
  return {
    render({
      count,
      total,
      filtered = false,
      help: message,
      clear: reset,
      emptyTitle: titleText,
    }) {
      const singular =
        kind === "subcities"
          ? "subcity"
          : title.toLowerCase().replace(/s$/, "");
      summary.textContent = `${count}${filtered ? ` of ${total}` : ""} ${count === 1 ? singular : title.toLowerCase()} · ${description}`;
      help.textContent = message;
      empty.hidden = count > 0;
      if (emptyTitle) {
        emptyTitle.hidden = count > 0 || titleText == null;
        if (titleText != null) emptyTitle.textContent = titleText;
      }
      art.replaceChildren(
        icon(
          filtered
            ? "search"
            : kind === "maps"
              ? "map"
              : kind === "subcities"
                ? "castle"
                : "people",
        ),
      );
      clear.hidden = !filtered;
      clear.onclick = reset;
    },
  };
}
