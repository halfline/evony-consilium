import { labelWithIcon } from "./icons.js";

export function createRemoveButton({
  className,
  label,
  title = label,
  remove,
}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  labelWithIcon(button, "close");
  button.title = title;
  button.setAttribute("aria-label", label);
  button.onclick = remove;
  return button;
}
