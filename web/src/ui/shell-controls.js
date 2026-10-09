import { view } from "./dom.js";

export function bindShellControls(root) {
  const $ = view(root);
  function showPanel(tab) {
    for (const button of root.querySelectorAll("[data-tab]"))
      button.classList.toggle("active", button.dataset.tab === tab);
    for (const name of ["formation", "hive"])
      $("panel-" + name).hidden = name !== tab;
  }
  for (const button of root.querySelectorAll("[data-tab]"))
    button.onclick = () => showPanel(button.dataset.tab);
  for (const button of root.querySelectorAll("[data-close]"))
    button.onclick = () => $(button.dataset.close).close();
  $("help").onclick = () => $("help-dialog").showModal();
}
