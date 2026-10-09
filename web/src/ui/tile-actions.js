// One delegated listener set per grid/control, so rebuilding tiles leaves no timers or listeners behind.
export function bindTileActions(
  root,
  {
    tileSelector,
    triggerSelector,
    className,
    enabled = () => true,
    delay = 550,
  },
) {
  let timer, start, trigger, tile, suppressed;
  const cancel = () => {
    clearTimeout(timer);
    timer = null;
  };
  function outside(event) {
    const selector = tileSelector + "." + className;
    const items = [...root.querySelectorAll(selector)];
    if (root.matches(selector)) items.push(root);
    for (const item of items)
      if (!item.contains(event.target)) item.classList.remove(className);
  }
  function down(event) {
    cancel();
    suppressed = null;
    trigger = event.target.closest(triggerSelector);
    tile = trigger?.closest(tileSelector);
    if (
      !trigger ||
      !tile ||
      !root.contains(tile) ||
      event.pointerType === "mouse" ||
      !enabled()
    )
      return;
    start = { x: event.clientX, y: event.clientY };
    const currentTile = tile,
      currentTrigger = trigger;
    timer = setTimeout(() => {
      if (!currentTile.isConnected) return;
      currentTile.classList.add(className);
      suppressed = currentTrigger;
    }, delay);
  }
  function move(event) {
    if (
      start &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8
    )
      cancel();
  }
  function click(event) {
    if (!suppressed?.contains(event.target)) return;
    suppressed = null;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  function contextMenu(event) {
    if (event.target.closest(tileSelector)?.classList.contains(className))
      event.preventDefault();
  }
  const listeners = {
    pointerdown: down,
    pointermove: move,
    pointerup: cancel,
    pointercancel: cancel,
    pointerleave: cancel,
    contextmenu: contextMenu,
  };
  for (const [name, handler] of Object.entries(listeners))
    root.addEventListener(name, handler);
  root.addEventListener("click", click, true);
  document.addEventListener("pointerdown", outside);
  return () => {
    cancel();
    for (const [name, handler] of Object.entries(listeners))
      root.removeEventListener(name, handler);
    root.removeEventListener("click", click, true);
    document.removeEventListener("pointerdown", outside);
  };
}
