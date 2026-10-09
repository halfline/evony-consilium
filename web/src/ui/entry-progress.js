import { view } from "./dom.js";
// Return a cleanup function that restores each control's previous disabled state.
export function showEntryProgress(entry, message) {
  const $ = view(entry);
  const controls = [...entry.querySelectorAll("button, input")];
  const disabled = controls.map((control) => control.disabled);
  controls.forEach((control) => {
    control.disabled = true;
  });
  const accountMenu = entry.querySelector("#account-menu");
  if (accountMenu) accountMenu.open = false;
  $("entry-progress").hidden = false;
  $("entry-progress-text").textContent = message;
  entry.setAttribute("aria-busy", "true");
  $("entry-error").textContent = "";
  return () => {
    controls.forEach((control, index) => {
      control.disabled = disabled[index];
    });
    $("entry-progress").hidden = true;
    entry.removeAttribute("aria-busy");
  };
}
