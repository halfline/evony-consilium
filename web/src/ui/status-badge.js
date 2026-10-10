// The short label stays readable; the full save/access explanation remains available.
export function paintStatusBadge(node, label, state, detail = label) {
  node.textContent = label;
  node.dataset.status = state;
  node.title = detail;
  node.setAttribute("aria-label", detail);
}
