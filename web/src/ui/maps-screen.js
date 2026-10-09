import { bindTileActions } from "./tile-actions.js";
import { MAP_ICONS } from "../domain/maps.js";
import { view, option } from "./dom.js";
import { defaultFormationName } from "../domain/map-plans.js";
export function createMapsScreen({
  root,
  dialog,
  getPlan,
  add,
  open,
  remove,
  status,
  canEdit = () => true,
}) {
  const $ = view(root, dialog);
  bindTileActions($("maps-list"), {
    tileSelector: ".map-list-row",
    triggerSelector: ".map-row",
    className: "map-actions-open",
  });
  function presets(select) {
    select.replaceChildren(
      ...getPlan().mapPresets.map((preset) =>
        option(preset.id, preset.id === "server" ? "Server" : preset.name),
      ),
    );
  }
  function newMap() {
    if (!canEdit()) return;
    presets($("new-formation-type"));
    $("new-formation-type").value = "server";
    $("new-formation-name").value = "Hive";
    $("new-formation-error").textContent = "";
    dialog.showModal();
    $("new-formation-name").focus();
  }
  $("add-map").onclick = newMap;
  $("new-formation-type").onchange = () => {
    const name = $("new-formation-name");
    if (["", "Hive", "Rally", "Formation"].includes(name.value.trim()))
      name.value = defaultFormationName($("new-formation-type").value);
  };
  $("add-map-form").onsubmit = (event) => {
    event.preventDefault();
    try {
      add($("new-formation-type").value, $("new-formation-name").value);
      dialog.close();
    } catch (error) {
      $("new-formation-error").textContent = error.message;
    }
  };
  function openMap(id) {
    try {
      if (!getPlan().maps?.some((map) => map.id === id))
        throw new Error("Choose a map to open.");
      open(id);
    } catch (error) {
      status(error.message, true);
    }
  }
  function render() {
    const plan = getPlan();
    const addButton = $("add-map");
    $("maps-list").replaceChildren(
      ...(plan.maps || []).map((map) => {
        const row = document.createElement("div");
        row.className = "map-list-row";
        const button = document.createElement("button");
        button.className =
          "map-row" + (map.id === plan.activeMapId ? " selected" : "");
        const name = document.createElement("strong");
        name.textContent = map.name;
        const arrow = document.createElement("span");
        arrow.textContent = "→";
        arrow.setAttribute("aria-hidden", "true");
        const portrait = document.createElement("span");
        portrait.className = "map-portrait";
        const icon = MAP_ICONS[map.type];
        if (icon) {
          const image = document.createElement("img");
          image.src = icon;
          image.alt = "";
          portrait.append(image);
        } else portrait.classList.add("blank-map-portrait");
        const caption = document.createElement("span");
        caption.className = "map-caption";
        caption.append(name, arrow);
        button.append(portrait, caption);
        button.onclick = () => openMap(map.id);
        const forget = document.createElement("button");
        forget.className = "map-forget";
        forget.textContent = "×";
        forget.title = `Forget ${map.name}`;
        forget.setAttribute("aria-label", `Forget ${map.name}`);
        forget.onclick = () => {
          try {
            remove(map.id);
          } catch (error) {
            status(error.message, true);
          }
        };
        row.append(button, forget);
        return row;
      }),
      addButton,
    );
  }
  return {
    render,
    enter() {
      render();
      if (canEdit() && !getPlan().maps?.length && !dialog.open) newMap();
    },
  };
}
