import { isTeamLogo } from "../domain/team.js";
import { readTeamLogo } from "../io/team-logo.js";
import { bindTileActions } from "./tile-actions.js";
import { initialsFor } from "./portrait.js";
import { labelWithIcon } from "./icons.js";

export function createLogoPicker({
  root,
  uploadLabel,
  getValue,
  getName,
  change,
  status,
  context = () => null,
  run = (task) => task(),
}) {
  const template = document.createElement("template");
  template.innerHTML = `<div class="project-logo-controls">
    <button type="button" data-logo="upload"><span data-logo="placeholder" aria-hidden="true">＋</span><img data-logo="preview" alt="Team logo preview" hidden /></button>
    <button type="button" data-logo="remove" class="text-button" aria-label="Remove team logo" title="Remove team logo" hidden>×</button>
  </div><input data-logo="file" type="file" accept="image/png,image/jpeg,image/webp" hidden />`;
  root.replaceChildren(template.content);
  const nodes = Object.fromEntries(
    [...root.querySelectorAll("[data-logo]")].map((node) => {
      return [node.dataset.logo, node];
    }),
  );
  const { upload, preview, placeholder, file: fileInput, remove } = nodes;
  labelWithIcon(remove, "close");
  labelWithIcon(placeholder, "plus");
  upload.setAttribute("aria-label", uploadLabel);
  upload.title = uploadLabel;
  const controls = upload.parentElement;
  let generation = 0;
  bindTileActions(controls, {
    tileSelector: ".project-logo-controls",
    triggerSelector: "button:first-child",
    className: "logo-actions-open",
    enabled: () => isTeamLogo(getValue()),
  });
  upload.onclick = () => fileInput.click();
  fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (!file) return;
    const request = ++generation,
      team = context();
    return run(async () => {
      upload.disabled = true;
      try {
        const logo = await readTeamLogo(file);
        if (request === generation && team === context()) change(logo);
      } catch (error) {
        if (request === generation && team === context())
          status(error.message, true);
      } finally {
        fileInput.value = "";
        upload.disabled = false;
      }
    });
  };
  remove.onclick = () => {
    generation++;
    change("");
  };
  function render() {
    controls.classList.remove("logo-actions-open");
    const logo = isTeamLogo(getValue()) ? getValue() : "";
    preview.hidden = !logo;
    if (logo) preview.src = logo;
    else preview.removeAttribute("src");
    placeholder.hidden = !!logo;
    if (getName) {
      placeholder.textContent = initialsFor(getName()) || "EC";
      placeholder.classList.add("team-initials");
    }
    remove.hidden = !logo;
  }
  function reset() {
    generation++;
    fileInput.value = "";
    render();
  }
  return { render, reset };
}
