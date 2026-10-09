import { view, option } from "./dom.js";
import { renderPortrait } from "./portrait.js";
import { createSearchablePicker } from "./searchable-picker.js";
export function renderAvatarButton(button, catalog, id) {
  const avatar =
    catalog.avatars.find((item) => item.id === id) ||
    catalog.avatars.find((item) => item.id === catalog.defaultId);
  renderPortrait(button, avatar.src);
  button.setAttribute(
    "aria-label",
    "Choose avatar: " + (avatar.name || avatar.culture + " avatar"),
  );
  button.title = "Choose avatar";
}
export function createAvatarBrowser({ root, getCatalog }) {
  const $ = view(root);
  const picker = createSearchablePicker({
    dialog: $("avatar-dialog"),
    search: $("avatar-search"),
    grid: $("avatar-grid"),
    items: () => getCatalog().avatars,
    filters: [$("avatar-category")],
    matches: (avatar, query) =>
      (!$("avatar-category").value ||
        avatar.category === $("avatar-category").value) &&
      `${avatar.name} ${avatar.culture || ""}`.toLowerCase().includes(query),
    prepare() {
      $("avatar-category").replaceChildren(
        option("", "All avatars"),
        ...getCatalog().categories.map((category) =>
          option(category.id, category.name),
        ),
      );
      $("avatar-category").value = "";
    },
    renderCard(avatar) {
      const button = document.createElement("button");
      button.className = "castle-card avatar-card";
      button.dataset.avatar = avatar.id;
      button.setAttribute(
        "aria-label",
        avatar.name || avatar.culture + " avatar",
      );
      renderPortrait(button, avatar.src, { lazy: true });
      if (avatar.name) {
        const name = document.createElement("strong");
        name.textContent = avatar.name;
        button.append(name);
      }
      return button;
    },
  });
  return {
    open: (id, callback) => picker.open(id || getCatalog().defaultId, callback),
  };
}
