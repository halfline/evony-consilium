export function drawEntity(view, entity, plan, zoom) {
  const ctx = view.ctx;
  const center = view.screen(entity.x + entity.w / 2, entity.y + entity.h / 2);
  const width = (Math.abs(plan.grid.ax) + Math.abs(plan.grid.bx)) * entity.w * zoom;
  const height = (Math.abs(plan.grid.ay) + Math.abs(plan.grid.by)) * entity.h * zoom;
  const asset = view.assets.get(entity.skin);
  const image = asset && view.image(asset.src);
  if (view.selected === entity.id) {
    view.path(entity);
    ctx.strokeStyle = "#fff0b4";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (image) {
    const spriteHeight = width * asset.height / asset.width;
    ctx.drawImage(image, center.x - width / 2, center.y - spriteHeight, width, spriteHeight);
  } else {
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
}
