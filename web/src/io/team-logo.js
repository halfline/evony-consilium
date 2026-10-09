import { decodeImage } from "./files.js";
export async function readTeamLogo(file) {
  const source = await decodeImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const side = Math.min(source.naturalWidth, source.naturalHeight);
  canvas
    .getContext("2d")
    .drawImage(
      source,
      (source.naturalWidth - side) / 2,
      (source.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      128,
      128,
    );
  return canvas.toDataURL("image/webp", 0.85);
}
