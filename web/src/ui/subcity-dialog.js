import { createChoiceControl } from "./choice-control.js";
import { view } from "./dom.js";
import { SUBCITY_COLORS, saveSubcity } from "../domain/subcities.js";
import { renderSubcityArt } from "./subcity-browser.js";

// Owns a subcity draft and checks its team context before saving.
export function createSubcityDialog({
  dialog,
  getPlan,
  types,
  browse,
  closeBrowser,
  canEdit,
  commit,
  context,
}) {
  const $ = view(dialog);
  let editing = null, openedContext, selected, selectedOwner = null;
  const castleControl = createChoiceControl({
    root: dialog,
    button: $("subcity-castle"),
    caption: $("subcity-choice-name"),
    tileSelector: ".subcity-castle-choice",
    canEdit,
    choose: chooseCastle,
  });
  function renderChoice() {
    const color = SUBCITY_COLORS.find((item) => item.id === selected?.color)?.name || "";
    const label = selected ? `${selected.name} · ${color}` : "Choose a subcity";
    castleControl.render({
      label,
      ariaLabel: `Choose subcity: ${label}`,
      paint: (button) => renderSubcityArt(button, selected),
    });
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
  function refreshAccess() {
    if (!dialog.open) return;
    if (openedContext !== context()) {
      closeBrowser();
      dialog.close();
      return;
    }
    for (const field of dialog.querySelectorAll("input")) field.readOnly = !canEdit();
    castleControl.access();
    $("subcity-save").hidden = !canEdit();
    if (!canEdit()) closeBrowser();
  }
  function open(city = null) {
    if (!city && !canEdit()) return;
    editing = city?.id || null;
    openedContext = context();
    selectedOwner = city?.ownerId || null;
    selected = city
      ? types().find((type) => city.color === "red"
        ? type.id === city.cityType
        : type.color === city.color && type.culture === city.culture)
      : types().find((type) => type.culture === "Europe" && type.color === "gold");
    $("subcity-title").textContent = city ? canEdit() ? "Edit subcity" : "Subcity" : "Add subcity";
    $("subcity-name").value = city?.name || "";
    $("subcity-x").value = city?.x ?? "";
    $("subcity-y").value = city?.y ?? "";
    $("subcity-error").textContent = "";
    $("subcity-owner").closest(".subcity-owner-choice").hidden = true;
    $("subcity-locate").hidden = true;
    renderChoice();
    dialog.showModal();
    refreshAccess();
  }
  $("subcity-form").onsubmit = (event) => {
    event.preventDefault();
    try {
      if (!canEdit() || openedContext !== context())
        throw new Error("Reopen this subcity with team write access to save changes.");
      if (!selected) throw new Error("Choose a subcity.");
      const coordinate = (id) => $(id).value === "" ? null : Number($(id).value);
      commit(saveSubcity(getPlan(), {
        name: $("subcity-name").value,
        ownerId: selectedOwner,
        culture: selected.culture,
        color: selected.color,
        cityType: selected.color === "red" ? selected.id : null,
        x: coordinate("subcity-x"),
        y: coordinate("subcity-y"),
      }, editing, types()));
      dialog.close();
    } catch (error) {
      $("subcity-error").textContent = error.message;
    }
  };
  return { open, refreshAccess };
}
