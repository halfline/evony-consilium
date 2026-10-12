// Owns shared search, selection, and dialog behavior; callers supply cards and filters.
export function createSearchablePicker({
  dialog,
  search,
  grid,
  empty,
  items,
  matches,
  compare,
  renderCard,
  closeOnSelect = true,
  prepare = () => {},
  filters = [],
}) {
  let selectedId, choose;
  function render() {
    const query = search.value.trim().toLowerCase();
    const choices = items().filter((item) => matches(item, query));
    if (compare) choices.sort((a, b) => compare(a, b, query));
    grid.replaceChildren(
      ...choices.map((item) => {
        const button = renderCard(item, query);
        const selected = item.id === selectedId;
        button.type = "button";
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
        button.onclick = () => {
          selectedId = item.id;
          if (closeOnSelect) dialog.close();
          else
            for (const card of grid.querySelectorAll("button")) {
              const active = card === button;
              card.classList.toggle("selected", active);
              card.setAttribute("aria-pressed", String(active));
            }
          choose(item);
        };
        return button;
      }),
    );
    if (empty) empty.hidden = choices.length > 0;
  }
  search.oninput = render;
  for (const filter of filters) filter.onchange = render;
  return {
    open(id, callback) {
      selectedId = id;
      choose = callback;
      search.value = "";
      prepare();
      render();
      dialog.showModal();
      search.focus();
    },
    render,
    close: () => dialog.close(),
  };
}
