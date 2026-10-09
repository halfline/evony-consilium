import { MarchDraft } from "../application/march-draft.js";
import { element } from "./player-fields.js";
import { view } from "./dom.js";

export function createPlayerMarches({ root, getSizes }) {
  const $ = view(root);
  const draft = new MarchDraft(getSizes);
  function showList() {
    const list = $("player-march-list");
    list.hidden = false;
    $("player-march-editor").hidden = true;
    list.replaceChildren();
    draft.marches.forEach((march, index) => {
      const row = element("div", undefined, "march-card");
      const select = element("button", march.name);
      select.dataset.march = march.id;
      select.onclick = () => {
        draft.currentIndex = index;
        showList();
      };
      const remove = element("button", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove ${march.name}`);
      remove.onclick = () => {
        draft.currentIndex = index;
        draft.remove();
        showList();
      };
      row.append(select, remove);
      list.append(row);
    });
    const add = element("button", "＋", "march-add");
    add.id = "player-add-march";
    add.type = "button";
    add.setAttribute("aria-label", "Add attack march");
    add.onclick = () => {
      if (draft.add()) showList();
    };
    list.append(add);
  }
  function render(details, level) {
    draft.load(details, level);
    showList();
  }
  return {
    render,
    read: () => draft.read(),
    syncSizes: () => {
      draft.syncSizes();
      showList();
    },
  };
}
