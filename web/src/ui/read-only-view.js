// Presentation follows the same access state enforced by TeamStore.
const fields =
  ".project-settings [data-logo=upload], #player-castle, #player-avatar, #project-screen input, #subcity-form input, #player-form input:not([data-progress-view]), #player-form textarea, #player-form select:not(th select):not(#player-section-select):not([data-progress-view]), #player-form [data-progress-write], #player-march-settings select, #entity-form input:not(#entity-w):not(#entity-h), #entity-form select, #panel-formation input, #panel-formation select";
export function createReadOnlyView(
  root,
  isReadOnly,
  canEditPlayer = () => false,
) {
  const disabled = new WeakMap();
  function render() {
    const teamReadOnly = isReadOnly();
    root.classList.toggle("read-only", teamReadOnly);
    root.classList.toggle("player-profile-locked", !canEditPlayer());
    root.classList.toggle(
      "player-file-editable",
      teamReadOnly && canEditPlayer(),
    );
    for (const field of root.querySelectorAll(fields)) {
      const readOnly = field.closest("#player-screen")
        ? !canEditPlayer()
        : teamReadOnly;
      if (
        field.tagName === "SELECT" ||
        field.tagName === "BUTTON" ||
        ["checkbox", "file", "color"].includes(field.type)
      ) {
        if (readOnly && !disabled.has(field)) {
          disabled.set(field, field.disabled);
          field.disabled = true;
        } else if (!readOnly && disabled.has(field)) {
          field.disabled = disabled.get(field);
          disabled.delete(field);
        }
      } else if (field.readOnly !== readOnly) field.readOnly = readOnly;
    }
  }
  const observer = new MutationObserver(render);
  observer.observe(root, {
    childList: true,
    subtree: true,
  });
  return { render };
}
