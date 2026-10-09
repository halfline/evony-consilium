export function renderCastleButton(button, asset) {
  const image = document.createElement("img");
  image.src = asset.previewSrc || asset.src;
  image.alt = "";
  button.replaceChildren(image);
  button.setAttribute("aria-label", "Choose castle: " + asset.name);
  button.title = "Choose castle";
}
