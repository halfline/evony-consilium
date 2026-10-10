import { createChoiceControl } from "./choice-control.js";
import { view } from "./dom.js";
import { SUBCITY_COLORS, saveSubcity } from "../domain/subcities.js";
import { renderSubcityArt } from "./subcity-browser.js";

// Owns the form draft and checks the team context before applying it.
export function createSubcityDialog({
  dialog,
  getPlan,
  types,
  browse,
  browseOwner,
  renderOwner,
  locate,
  closeBrowser,
  canEdit,
  commit,
  context,
}) {
  const $ = view(dialog);
  let editing = null,
    openedContext,
    selected,
    selectedOwner = null,
    ownerLocked = false;
  const castleControl = createChoiceControl({
    root: dialog,
    button: $("subcity-castle"),
    caption: $("subcity-choice-name"),
    tileSelector: ".subcity-castle-choice",
    canEdit,
    choose: chooseCastle,
  });
  const ownerControl = createChoiceControl({
    root: dialog,
    button: $("subcity-owner"),
    caption: $("subcity-owner-name"),
    clear: $("subcity-owner-clear"),
    tileSelector: ".subcity-owner-choice",
    canEdit,
    choose: chooseOwner,
    remove: () => {
      if (openedContext !== context()) return;
      selectedOwner = null;
      refreshOwner();
    },
  });
  function renderChoice() {
    const color =
      SUBCITY_COLORS.find((color) => color.id === selected?.color)?.name || "";
    const label = selected ? `${selected.name} · ${color}` : "Choose a subcity";
    castleControl.render({
      label,
      ariaLabel: `Choose subcity: ${label}`,
      paint: (button) => renderSubcityArt(button, selected),
    });
    $("subcity-name-field").hidden = selected?.color === "red";
  }
  function chooseCastle() {
    if (!canEdit()) return;
    const current = openedContext;
    browse(selected?.id, (type) => {
      if (!dialog.open || current !== context() || !canEdit()) return;
      selected = type;
      renderChoice();
    });
  }
  function refreshOwner() {
    const player = getPlan().keeps.find(
      (player) => player.id === selectedOwner,
    );
    $("subcity-owner").dataset.owner = selectedOwner || "";
    const label = player
      ? `${player.allianceTag ? `[${player.allianceTag}] ` : ""}${player.name}`
      : "Unowned";
    ownerControl.render({
      label,
      ariaLabel: `Choose owner: ${player?.name || "Unowned"}`,
      locked: ownerLocked,
      removable: !!selectedOwner,
      paint: (button) => renderOwner(button, player),
    });
  }
  function chooseOwner() {
    if (!canEdit() || ownerLocked) return;
    const current = openedContext;
    browseOwner(selectedOwner, (id) => {
      if (!dialog.open || current !== context() || !canEdit() || ownerLocked)
        return;
      selectedOwner = id;
      refreshOwner();
    });
  }
  $("subcity-locate").onclick = () => {
    const city = getPlan().subcities.find((city) => city.id === editing);
    if (
      !city ||
      city.x === null ||
      city.y === null ||
      openedContext !== context()
    )
      return;
    dialog.close();
    locate(city);
  };
  function refreshAccess() {
    if (!dialog.open) return;
    if (openedContext !== context()) {
      closeBrowser();
      dialog.close();
      return;
    }
    for (const field of dialog.querySelectorAll("input"))
      field.readOnly = !canEdit();
    castleControl.access();
    refreshOwner();
    $("subcity-save").hidden = !canEdit();
    if (!canEdit()) closeBrowser();
  }
  function open(city = null, ownerId = null, { lockOwner = false } = {}) {
    if (!city && !canEdit()) return;
    ownerLocked = lockOwner;
    editing = city?.id || null;
    openedContext = context();
    selected = city
      ? types().find((type) =>
          city.color === "red"
            ? type.id === city.cityType
            : type.color === city.color && type.culture === city.culture,
        )
      : types().find(
          (type) => type.culture === "Europe" && type.color === "gold",
        );
    $("subcity-title").textContent = city
      ? canEdit()
        ? "Edit subcity"
        : "Subcity"
      : "Add subcity";
    $("subcity-name").value = city?.name || "";
    ownerControl.reset();
    selectedOwner = city?.ownerId || ownerId || null;
    refreshOwner();
    $("subcity-x").value = city?.x ?? "";
    $("subcity-y").value = city?.y ?? "";
    $("subcity-error").textContent = "";
    $("subcity-locate").hidden = !city || city.x === null || city.y === null;
    renderChoice();
    dialog.showModal();
    refreshAccess();
  }
  $("subcity-form").onsubmit = (event) => {
    event.preventDefault();
    try {
      if (!canEdit() || openedContext !== context())
        throw new Error(
          "Reopen this subcity with team write access to save changes.",
        );
      if (!selected) throw new Error("Choose a subcity.");
      const coordinate = (id) =>
        $(id).value === "" ? null : Number($(id).value);
      commit(
        saveSubcity(
          getPlan(),
          {
            name: selected.color === "red" ? "" : $("subcity-name").value,
            ownerId: selectedOwner,
            culture: selected.culture,
            color: selected.color,
            cityType: selected.color === "red" ? selected.id : null,
            x: coordinate("subcity-x"),
            y: coordinate("subcity-y"),
          },
          editing,
          types(),
        ),
      );
      dialog.close();
    } catch (error) {
      $("subcity-error").textContent = error.message;
    }
  };
  return { open, refreshAccess };
}
