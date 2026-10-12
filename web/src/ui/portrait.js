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

// Roster identities use a monogram until a player has an assigned portrait.
// The same name keeps its color in every collection and dashboard preview.
export function renderPlayerPortrait(root, catalog, player) {
  const avatar = catalog.avatars.find((item) => item.id === player.avatarId);
  const custom = Boolean(avatar);
  root.classList.toggle("monogram-portrait", !custom);
  if (custom) {
    root.style.removeProperty("--identity-hue");
    renderPortrait(root, avatar.previewSrc || avatar.src, { lazy: true });
    return;
  }
  let hash = 0;
  for (const character of player.name)
    hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  root.style.setProperty("--identity-hue", [155, 205, 30, 265][hash % 4]);
  const monogram = document.createElement("span");
  monogram.className = "portrait-monogram";
  monogram.textContent = initialsFor(player.name) || "?";
  monogram.setAttribute("aria-hidden", "true");
  root.replaceChildren(monogram);
}
