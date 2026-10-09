export function drawEntity(view, entity, plan, zoom) {
  const ctx = view.ctx;
  const center = view.screen(entity.x + entity.w / 2, entity.y + entity.h / 2);
  if (zoom < 0.16) {
    const selected = view.selected === entity.id || view.selectedIds?.has(entity.id);
    const rally = entity.id === plan.rallyId;
    ctx.beginPath();
    ctx.arc(center.x, center.y, selected ? 6 : rally ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = plan.obstacles?.some(({ id }) => id === entity.id)
      ? "#e5a887" : rally ? "#f4d386" : "#e0e9ce";
    ctx.fill();
    ctx.strokeStyle = "#233529";
    ctx.lineWidth = 1;
    ctx.stroke();
    view.hits.push({
      id: entity.id,
      left: center.x - 7,
      right: center.x + 7,
      top: center.y - 7,
      bottom: center.y + 7,
    });
    return;
  }
  const width = (Math.abs(plan.grid.ax) + Math.abs(plan.grid.bx)) * entity.w * zoom;
  const height = (Math.abs(plan.grid.ay) + Math.abs(plan.grid.by)) * entity.h * zoom;
  const asset = view.assets.get(entity.skin);
  const image = asset && view.image(asset.src);
  const selected = view.selected === entity.id || view.selectedIds?.has(entity.id);
  const rally = entity.id === plan.rallyId;
  const obstacle = plan.obstacles?.some(({ id }) => id === entity.id);
  if (obstacle) {
    view.path(entity);
    ctx.fillStyle = "#513e37aa";
    ctx.fill();
    ctx.strokeStyle = "#e6b19788";
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (selected || rally || entity.locked) {
    view.path(entity);
    ctx.fillStyle = selected ? "#e7d59728" : "#22372620";
    ctx.fill();
    ctx.strokeStyle = selected ? "#fff0b4" : rally ? "#e1c678" : "#b1d0ba";
    ctx.lineWidth = selected ? 2 : 1.2;
    ctx.stroke();
  }
  if (image) {
    const spriteHeight = width * asset.height / asset.width;
    ctx.drawImage(image, center.x - width / 2, center.y - spriteHeight, width, spriteHeight);
  } else if (!obstacle) {
    view.path(entity);
    ctx.fillStyle = "#d1ba7c";
    ctx.fill();
    ctx.strokeStyle = "#233529";
    ctx.stroke();
  }
  view.hits.push({
    id: entity.id,
    left: center.x - width / 2,
    right: center.x + width / 2,
    top: center.y - Math.max(height, 10),
    bottom: center.y + Math.max(height / 2, 10),
  });
  if (plan.labels && zoom > 0.16) {
    const label = (entity.id === plan.rallyId ? "★ " : "") + entity.name;
    ctx.font = `500 ${Math.max(9, Math.min(12, 12 * zoom))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = entity.id === plan.rallyId ? "#f1d28b" : "#e9f0db";
    ctx.fillText(
      label.length > 32 ? label.slice(0, 31) + "…" : label,
      center.x,
      center.y + 24 * zoom,
    );
  }
}
