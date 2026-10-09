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
  let spriteWidth = width;
  let spriteHeight = height;
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
  } else if (selected || rally || entity.locked) {
    view.path(entity);
    ctx.fillStyle = selected ? "#e7d59728" : "#22372620";
    ctx.fill();
    ctx.strokeStyle = selected ? "#fff0b4" : rally ? "#e1c678" : "#b1d0ba";
    ctx.lineWidth = selected ? 2 : 1.2;
    ctx.stroke();
  }
  if (image) {
    spriteWidth = (Math.abs(plan.grid.ax) + Math.abs(plan.grid.bx)) *
      Math.max(entity.w, entity.h) * 0.87 * zoom;
    spriteHeight = spriteWidth * asset.height / asset.width;
    spriteTop = center.y - spriteHeight +
      Math.abs(plan.grid.ay + plan.grid.by) * entity.h * 0.35 * zoom;
    let spriteLeft = center.x - spriteWidth / 2;
    if (asset.mapAnchor) {
      const anchor = asset.mapAnchor;
      const gridWidth = Math.abs(plan.grid.ax) + Math.abs(plan.grid.bx);
      const scale = anchor.footprintFill
        ? gridWidth * Math.max(entity.w, entity.h) *
          anchor.footprintFill * zoom / (anchor.footprintWidth || asset.width)
        : (gridWidth / 256 * zoom) / anchor.pixelScale;
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
    ctx.drawImage(image, spriteLeft, spriteTop, spriteWidth, spriteHeight);
  } else if (!obstacle) {
    view.path(entity);
    ctx.fillStyle = "#d1ba7c";
    ctx.fill();
    ctx.strokeStyle = "#233529";
    ctx.stroke();
  }
  if (rally) {
    ctx.strokeStyle = "#e6cf86";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y + 7 * zoom,
      Math.max(10, 75 * zoom), Math.max(5, 18 * zoom),
      0, 0, Math.PI * 2);
    ctx.stroke();
  }
  view.hits.push({
    id: entity.id,
    left: center.x - Math.max(spriteWidth / 2, 10),
    right: center.x + Math.max(spriteWidth / 2, 10),
    top: spriteTop - 10,
    bottom: center.y + Math.max(25, 35 * zoom),
  });
  if (plan.labels && zoom > 0.16) {
    const label = (rally ? "★ " : "") +
      (entity.allianceTag ? `[${entity.allianceTag}] ` : "") + entity.name;
    ctx.font = `500 ${Math.max(9, Math.min(12, 12 * zoom))}px "DM Sans", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = label.length > 32 ? label.slice(0, 31) + "…" : label;
    const textWidth = ctx.measureText(text).width;
    const labelY = center.y + 24 * zoom;
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
