// Shared portrait content for pickers and their selected-value controls.
export function initialsFor(name) {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0] || "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function renderPortrait(root, src, { lazy = false } = {}) {
  const content = document.createElement(src ? "img" : "span");
  if (src) {
    content.src = src;
    content.alt = "";
    if (lazy) content.loading = "lazy";
  } else {
    content.textContent = "+";
    content.setAttribute("aria-hidden", "true");
  }
  root.replaceChildren(content);
}
