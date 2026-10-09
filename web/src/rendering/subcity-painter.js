import { SUBCITY_COLORS } from "../domain/subcities.js";
// Registry cities are fixed server markers, not editable formation entities.
export function drawSubcities(view, plan, types) {
  view.subcityHits = [];
  if (plan.map !== "server") return;
  const c = view.ctx,
    z = view.camera.zoom;
  for (const city of plan.subcities || []) {
    if (city.x === null || city.y === null) continue;
    const point = view.screen(city.x, city.y);
    if (
      point.x < -100 ||
      point.y < -100 ||
      point.x > view.width + 100 ||
      point.y > view.height + 100
    )
      continue;
    const color =
      SUBCITY_COLORS.find((item) => item.id === city.color)?.color || "#cbb477";
    const type = types.find((item) =>
      city.cityType
        ? item.id === city.cityType
        : item.culture === city.culture && item.color === city.color,
    );
    const image = type?.src && view.image(type.src);
    const size = Math.max(12, Math.min(64, 64 * z));
    if (image && z > 0.16)
      c.drawImage(image, point.x - size / 2, point.y - size, size, size);
    c.beginPath();
    c.arc(point.x, point.y, z > 0.16 ? 4 : 3, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
    c.strokeStyle = "#14241b";
    c.lineWidth = 1;
    c.stroke();
    view.subcityHits.push({
      id: city.id,
      left: point.x - Math.max(8, size / 2),
      right: point.x + Math.max(8, size / 2),
      top: point.y - size,
      bottom: point.y + 8,
    });
    if (plan.labels && z > 0.16) {
      const owner = plan.keeps.find((player) => player.id === city.ownerId);
      const text = `${city.name || type?.name || city.culture}${owner ? ` · ${owner.name}` : ""}`;
      c.font = '11px "DM Sans", sans-serif';
      c.textAlign = "center";
      c.textBaseline = "middle";
      const width = c.measureText(text).width;
      c.fillStyle = "#132218dd";
      c.fillRect(point.x - width / 2 - 5, point.y + 8, width + 10, 17);
      c.fillStyle = color;
      c.fillText(text, point.x, point.y + 17);
    }
  }
}
