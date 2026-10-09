import { bindTileActions } from "./tile-actions.js";
// Shared selected-value control: content/caption, choosing, and optional hover/hold removal.
export function createChoiceControl({
  root,
  button,
  caption,
  clear,
  tileSelector,
  canEdit,
  choose,
  remove,
  className = "player-actions-open",
}) {
  button.onclick = () => {
    if (!button.disabled) choose();
  };
  if (clear) {
    bindTileActions(root, {
      tileSelector,
      triggerSelector: `#${button.id}`,
      className,
      enabled: () => !button.disabled,
    });
    clear.onclick = () => {
      if (!button.disabled) remove();
    };
  }
  return {
    render({ label, ariaLabel, locked = false, removable = false, paint }) {
      paint(button);
      caption.textContent = label;
      button.setAttribute("aria-label", ariaLabel);
      button.disabled = !canEdit() || locked;
      if (clear) clear.hidden = !removable || button.disabled;
    },
    access(locked = false) {
      button.disabled = !canEdit() || locked;
      if (clear && button.disabled) clear.hidden = true;
    },
    reset() {
      button.closest(tileSelector)?.classList.remove(className);
    },
  };
}
