import { bindTileActions } from "./tile-actions.js";
import { MAP_ICONS } from "../domain/maps.js";
import { view, option } from "./dom.js";
import { defaultFormationName } from "../domain/map-plans.js";
import { createCollectionControls } from "./collection-controls.js";
import { icon } from "./icons.js";
import { createRemoveButton } from "./remove-button.js";
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
  const addButton = $("add-map");
  const collection = createCollectionControls({
    root,
    grid: $("maps-list"),
    add: addButton,
    title: "Maps",
    description: "A place for every plan",
    label: "Add map",
    kind: "maps",
  });
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
  addButton.onclick = newMap;
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
    $("maps-empty").hidden = !!plan.maps?.length;
    collection.render({
      count: plan.maps?.length || 0,
      total: plan.maps?.length || 0,
      help: "Create a hive or battlefield map, then bring your formation together.",
    });
    $("maps-list").replaceChildren(
      ...(plan.maps || []).map((map) => {
        const row = document.createElement("div");
        row.className = "map-list-row";
        const button = document.createElement("button");
        button.className =
          "map-row" + (map.id === plan.activeMapId ? " selected" : "");
        const name = document.createElement("strong");
        name.textContent = map.name;
        name.title = map.name;
        const arrow = icon("forward");
        const portrait = document.createElement("span");
        portrait.className = "map-portrait";
        const mapIcon = MAP_ICONS[map.type];
        if (mapIcon) {
          const image = document.createElement("img");
          image.src = mapIcon;
          image.alt = "";
          portrait.append(image);
        } else portrait.classList.add("blank-map-portrait");
        const caption = document.createElement("span");
        caption.className = "map-caption";
        caption.append(name, arrow);
        button.append(portrait, caption);
        const detail = document.createElement("span");
        detail.className = "map-detail";
        detail.textContent =
          plan.mapPresets.find((preset) => preset.id === map.type)?.name ||
          "Custom map";
        button.append(detail);
        button.onclick = () => openMap(map.id);
        const forget = createRemoveButton({
          className: "map-forget",
          label: `Forget ${map.name}`,
          remove: () => {
            try {
              remove(map.id);
            } catch (error) {
              status(error.message, true);
            }
          },
        });
        row.append(button, forget);
        return row;
      }),
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
