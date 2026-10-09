import { drawSubcities } from "./subcity-painter.js";
import { drawTerrain, drawMoatOverlay } from "./terrain-painter.js";
import { drawEntity } from "./entity-painter.js";
import { ImageCache } from "./image-cache.js";
import { project, unproject } from "../domain/geometry.js";
export class MapRenderer {
  constructor(
    canvas,
    assets,
    getPlan,
    {
      onDraw = () => {},
      subcityTypes = [],
      terrainFor = () => undefined,
      selection = { id: null, ids: new Set() },
    } = {},
  ) {
    this.onDraw = onDraw;
    this.subcityTypes = subcityTypes;
    this.subcityHits = [];
    this.terrainFor = terrainFor;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.assets = assets;
    this.getPlan = getPlan;
    this.images = new ImageCache(() => this.draw());
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.selection = selection;
    this.selectionBox = null;
    this.preview = null;
    this.hits = [];
    this.width = 0;
    this.height = 0;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement);
  }
  get selected() {
    return this.selection?.id;
  }
  get selectedIds() {
    return this.selection?.ids;
  }
  resize() {
    const box = this.canvas.getBoundingClientRect();
    this.width = box.width;
    this.height = box.height;
    const dpr = devicePixelRatio || 1;
    this.canvas.width = Math.round(box.width * dpr);
    this.canvas.height = Math.round(box.height * dpr);
    this.draw();
  }
  image(src) {
    return this.images.get(src);
  }
  screen(x, y) {
    const p = project(x, y, this.getPlan().grid);
    return {
      x: (p.x - this.camera.x) * this.camera.zoom + this.width / 2,
      y: (p.y - this.camera.y) * this.camera.zoom + this.height / 2,
    };
  }
  world(x, y) {
    return unproject(
      (x - this.width / 2) / this.camera.zoom + this.camera.x,
      (y - this.height / 2) / this.camera.zoom + this.camera.y,
      this.getPlan().grid,
    );
  }
  center(x, y) {
    const p = project(x, y, this.getPlan().grid);
    this.camera.x = p.x;
    this.camera.y = p.y;
    this.draw();
  }
  zoom(factor, sx = this.width / 2, sy = this.height / 2) {
    const before = this.world(sx, sy);
    this.camera.zoom = Math.max(0.002, Math.min(3, this.camera.zoom * factor));
    const after = this.world(sx, sy);
    const delta = project(
      after.x - before.x,
      after.y - before.y,
      this.getPlan().grid,
    );
    this.camera.x -= delta.x;
    this.camera.y -= delta.y;
    this.draw();
  }
  fit(whole = false) {
    const p = this.getPlan();
    const extent = this.terrainFor(p.map)?.extent ?? p.extent;
    const list = [...p.keeps, ...p.structures, ...p.obstacles].filter(
      (e) => e.x !== null,
    );
    let points = [];
    if (whole)
      points = [
        [0, 0],
        [extent, 0],
        [0, extent],
        [extent, extent],
      ].map(([x, y]) => project(x, y, p.grid));
    else if (list.length)
      points = list.flatMap((e) =>
        [
          [e.x, e.y],
          [e.x + e.w, e.y + e.h],
          [e.x, e.y + e.h],
          [e.x + e.w, e.y],
        ].map(([x, y]) => project(x, y, p.grid)),
      );
    else {
      this.camera.zoom = 1;
      this.center(p.center.x, p.center.y);
      return;
    }
    const xs = points.map((v) => v.x),
      ys = points.map((v) => v.y);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys);
    this.camera = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2 - 30,
      zoom: Math.max(
        0.002,
        Math.min(
          1.1,
          (this.width - 130) / (maxX - minX + 180),
          (this.height - 220) / (maxY - minY + 180),
        ),
      ),
    };
    this.draw();
  }
  path(e) {
    const pts = [
      [e.x, e.y],
      [e.x + e.w, e.y],
      [e.x + e.w, e.y + e.h],
      [e.x, e.y + e.h],
    ].map(([x, y]) => this.screen(x, y));
    const c = this.ctx;
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
    return pts;
  }
  drawTerrain(...args) {
    drawTerrain(this, ...args);
  }
  drawMoatOverlay(...args) {
    drawMoatOverlay(this, ...args);
  }
  draw() {
    if (!this.width || !this.height) return;
    const c = this.ctx,
      p = this.getPlan(),
      z = this.camera.zoom,
      dpr = devicePixelRatio || 1;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const map = p.mapPresets.find((m) => m.id === p.map);
    c.fillStyle = map?.color || "#647947";
    c.fillRect(0, 0, this.width, this.height);
    const terrain = this.terrainFor(p.map);
    const extent = terrain?.extent ?? p.extent;
    const corners = [
      [0, 0],
      [this.width, 0],
      [0, this.height],
      [this.width, this.height],
    ].map(([x, y]) => this.world(x, y));
    const minX = Math.max(
        0,
        Math.floor(Math.min(...corners.map((q) => q.x))) - 2,
      ),
      maxX = Math.min(
        extent,
        Math.ceil(Math.max(...corners.map((q) => q.x))) + 2,
      );
    const minY = Math.max(
        0,
        Math.floor(Math.min(...corners.map((q) => q.y))) - 2,
      ),
      maxY = Math.min(
        extent,
        Math.ceil(Math.max(...corners.map((q) => q.y))) + 2,
      );
    c.save();
    c.translate(
      this.width / 2 - this.camera.x * z,
      this.height / 2 - this.camera.y * z,
    );
    c.scale(z, z);
    if (terrain) this.drawTerrain(terrain, minX, minY, maxX, maxY, p.grid);
    const bg = p.backgrounds[p.map];
    if (bg) {
      const im = this.image(bg.src);
      if (im) {
        const anchor = project(bg.x, bg.y, p.grid);
        c.globalAlpha = bg.opacity;
        c.drawImage(im, anchor.x, anchor.y, bg.width, bg.height);
        c.globalAlpha = 1;
      }
    }
    c.restore();
    if (p.showGrid) {
      c.strokeStyle = "#17261b35";
      c.lineWidth = 0.6;
      const stride = z < 0.25 ? 10 : 1;
      c.beginPath();
      for (let x = minX; x <= maxX; x += stride) {
        const a = this.screen(x, minY),
          b = this.screen(x, maxY);
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
      }
      for (let y = minY; y <= maxY; y += stride) {
        const a = this.screen(minX, y),
          b = this.screen(maxX, y);
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
      }
      c.stroke();
    }
    c.strokeStyle = "#e1d2a255";
    c.lineWidth = 1;
    this.path({ x: 0, y: 0, w: extent, h: extent });
    c.stroke();
    const all = [
      ...(terrain?.landmarks || []),
      ...p.obstacles,
      ...p.structures,
      ...p.keeps,
    ]
      .filter((e) => e.x !== null)
      .sort(
        (a, b) =>
          project(a.x + a.w, a.y + a.h, p.grid).y -
          project(b.x + b.w, b.y + b.h, p.grid).y,
      );
    for (const landmark of terrain?.landmarks || [])
      this.drawMoatOverlay(landmark, p, z);
    this.hits = [];
    const landmarks = new Set(terrain?.landmarks || []);
    for (const e of all) this.entity(e, p, z, landmarks.has(e));
    drawSubcities(this, p, this.subcityTypes);
    for (const e of this.previews || (this.preview ? [this.preview] : [])) {
      this.path(e);
      c.fillStyle = e.valid ? "#cfe3a944" : "#e85e4a66";
      c.fill();
      c.strokeStyle = e.valid ? "#e4f7b4" : "#ffad98";
      c.lineWidth = 2;
      c.stroke();
    }
    const vignette = c.createRadialGradient(
      this.width / 2,
      this.height / 2,
      50,
      this.width / 2,
      this.height / 2,
      Math.max(this.width, this.height) * 0.65,
    );
    vignette.addColorStop(0, "#16271a00");
    vignette.addColorStop(1, "#14241b55");
    c.fillStyle = vignette;
    c.fillRect(0, 0, this.width, this.height);
    if (this.selectionBox) {
      const { x, y, w, h } = this.selectionBox;
      c.fillStyle = "#e7d59722";
      c.strokeStyle = "#e7d597";
      c.lineWidth = 1;
      c.fillRect(x, y, w, h);
      c.strokeRect(x, y, w, h);
    }
    this.onDraw({ zoom: z });
  }
  entity(e, p, z, fixed = false) {
    drawEntity(this, e, p, z, fixed);
  }
  hitSubcity(x, y) {
    return (
      [...this.subcityHits]
        .reverse()
        .find(
          (hit) =>
            x >= hit.left && x <= hit.right && y >= hit.top && y <= hit.bottom,
        )?.id || null
    );
  }
  hit(x, y) {
    return (
      [...this.hits]
        .reverse()
        .find((h) => x >= h.left && x <= h.right && y >= h.top && y <= h.bottom)
        ?.id || null
    );
  }
}
