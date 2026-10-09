export function drawEntity(view, entity, plan, zoom, fixed = false) {
  const ctx = view.ctx;
  const center = view.screen(entity.x + entity.w / 2, entity.y + entity.h / 2);
  const major = fixed &&
    (entity.skin === "map-kingdom" || entity.skin.endsWith("shrin"));
  const spriteZoom = major ? Math.max(zoom, 0.18) : zoom;
  if (center.x < -250 * spriteZoom || center.y < -300 * spriteZoom ||
      center.x > view.width + 250 * spriteZoom ||
      center.y > view.height + 300 * spriteZoom) return;
  if (zoom < 0.16 && !major) {
    if (fixed) return;
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
  const asset = view.assets.get(entity.skin);
  const image = asset && view.image(asset.src);
  let spriteWidth = 0;
  let spriteHeight = 0;
  let spriteTop = center.y;
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
  } else if (!fixed && (selected || rally || entity.locked)) {
    view.path(entity);
    ctx.fillStyle = selected ? "#e7d59728" : "#22372620";
    ctx.fill();
    ctx.strokeStyle = selected ? "#fff0b4" : rally ? "#e1c678" : "#b1d0ba";
    ctx.lineWidth = selected ? 2 : 1.2;
    ctx.stroke();
  }
  if (asset) {
    spriteWidth = (Math.abs(plan.grid.ax) + Math.abs(plan.grid.bx)) *
      Math.max(entity.w, entity.h) * 0.87 * spriteZoom;
    spriteHeight = spriteWidth * asset.height / asset.width;
    spriteTop = center.y - spriteHeight +
      Math.abs(plan.grid.ay + plan.grid.by) * entity.h * 0.35 * spriteZoom;
    let spriteLeft = center.x - spriteWidth / 2;
    if (asset.mapAnchor) {
      const anchor = asset.mapAnchor;
      const gridWidth = Math.abs(plan.grid.ax) + Math.abs(plan.grid.bx);
      const scale = anchor.footprintFill
        ? gridWidth * Math.max(entity.w, entity.h) *
          anchor.footprintFill * spriteZoom / (anchor.footprintWidth || asset.width)
        : (gridWidth / 256 * spriteZoom) / anchor.pixelScale;
      spriteWidth = asset.width * scale;
      spriteHeight = asset.height * scale;
      if (anchor.footprintFill) {
        const front = view.screen(entity.x + entity.w, entity.y + entity.h);
        spriteLeft = front.x - anchor.pivotX * scale;
        spriteTop = front.y - (anchor.groundPivotY ?? asset.height) * scale;
      } else {
        spriteLeft = center.x - anchor.pivotX * scale;
        spriteTop = center.y - anchor.pivotY * scale;
      }
    }
    if (image) ctx.drawImage(image, spriteLeft, spriteTop, spriteWidth, spriteHeight);
    else {
      ctx.fillStyle = "#d1ba7c";
      ctx.font = `${Math.max(14, 30 * zoom)}px serif`;
      ctx.textAlign = "center";
      ctx.fillText("♜", center.x, center.y);
    }
  }
  if (rally && !fixed) {
    ctx.strokeStyle = "#e6cf86";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y + 7 * zoom,
      Math.max(10, 75 * zoom), Math.max(5, 18 * zoom),
      0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (!fixed) view.hits.push({
    id: entity.id,
    left: center.x - Math.max(spriteWidth / 2, 10),
    right: center.x + Math.max(spriteWidth / 2, 10),
    top: spriteTop - 10,
    bottom: center.y + Math.max(25, 35 * zoom),
  });
  if (plan.labels && (zoom > 0.16 || major)) {
    const label = (rally ? "★ " : "") +
      (entity.allianceTag ? `[${entity.allianceTag}] ` : "") + entity.name;
    ctx.font = `500 ${Math.max(9, Math.min(12, 12 * zoom))}px "DM Sans", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = label.length > 32 ? label.slice(0, 31) + "…" : label;
    const textWidth = ctx.measureText(text).width;
    const labelY = center.y + 24 * spriteZoom;
    ctx.fillStyle = "#132218dd";
    ctx.fillRect(center.x - textWidth / 2 - 7, labelY - 8,
      textWidth + 14, 17);
    ctx.fillStyle = rally ? "#f1d28b" : "#e9f0db";
    ctx.fillText(
      text,
      center.x,
      labelY + 0.5,
    );
    if ("level" in entity) {
      ctx.font = `600 ${Math.max(8, 10 * zoom)}px "DM Sans", sans-serif`;
      ctx.fillStyle = "#efe3b5";
      ctx.strokeStyle = "#18251d";
      ctx.lineWidth = 3;
      ctx.strokeText(`K${entity.level}`, center.x, spriteTop + 7);
      ctx.fillText(`K${entity.level}`, center.x, spriteTop + 7);
    }
  }
}
