import { CANVAS_H, CANVAS_W, CROP_Y, type Pt, type Scene } from "./scenes";
import { FLOOR_MASKS, isVisibleFloor, registerFloorPixels } from "./floor-masks";

export interface RugPlacement {
  wCm: number;
  hCm: number;
  x: number; // meters across floor
  y: number; // meters deep (from far edge)
  rot: number; // degrees
}

export type TexSource = HTMLCanvasElement | HTMLImageElement;

type H = [number, number, number, number, number, number, number, number, number];

export function squareToQuad(q: [Pt, Pt, Pt, Pt]): H {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const det = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / det;
    h = (dx1 * dy3 - dx3 * dy1) / det;
  }
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}

function invert(m: H): H {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det,
  ];
}

function apply(m: H, u: number, v: number): Pt {
  const w = m[6] * u + m[7] * v + m[8];
  return [(m[0] * u + m[1] * v + m[2]) / w, (m[3] * u + m[4] * v + m[5]) / w];
}

const hCache = new Map<string, { h: H; inv: H }>();
function homo(scene: Scene) {
  let e = hCache.get(scene.id);
  if (!e) {
    const h = squareToQuad(scene.floor);
    e = { h, inv: invert(h) };
    hCache.set(scene.id, e);
  }
  return e;
}

/** floor meters -> canvas px */
export function project(scene: Scene, xm: number, ym: number): Pt {
  const [x, y] = apply(homo(scene).h, xm / scene.widthM, ym / scene.depthM);
  return [x, y - CROP_Y];
}

/** canvas px -> floor meters */
export function unproject(scene: Scene, px: number, py: number): Pt {
  const [u, v] = apply(homo(scene).inv, px, py + CROP_Y);
  return [u * scene.widthM, v * scene.depthM];
}

/** Include the entire photographed floor, not just the calibration rectangle. */
export function movementBounds(scene: Scene) {
  const outline = FLOOR_MASKS[scene.id]?.outline;
  const points = outline?.map(([x, y]) => unproject(scene, x, y - CROP_Y))
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)) ?? [];
  return {
    minX: Math.min(0, ...points.map(([x]) => x)),
    maxX: Math.max(scene.widthM, ...points.map(([x]) => x)),
    minY: Math.min(0, ...points.map(([, y]) => y)),
    maxY: Math.max(scene.depthM, ...points.map(([, y]) => y)),
  };
}

export function rugCorners(scene: Scene, p: RugPlacement): Pt[] {
  const w = p.wCm / 100, h = p.hCm / 100, t = (p.rot * Math.PI) / 180;
  return [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([a, b]) => {
    const lx = a * w, ly = b * h;
    return project(scene, p.x + lx * Math.cos(t) - ly * Math.sin(t), p.y + lx * Math.sin(t) + ly * Math.cos(t));
  });
}

function drawTri(c: CanvasRenderingContext2D, tex: TexSource, s: Pt[], d: Pt[]) {
  const [[s0x, s0y], [s1x, s1y], [s2x, s2y]] = s;
  const cx = (d[0][0] + d[1][0] + d[2][0]) / 3, cy = (d[0][1] + d[1][1] + d[2][1]) / 3;
  const e = d.map(([x, y]) => {
    const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1;
    return [x + (dx / l) * 0.7, y + (dy / l) * 0.7] as Pt;
  });
  const [[d0x, d0y], [d1x, d1y], [d2x, d2y]] = d;
  const denom = s0x * (s2y - s1y) - s1x * s2y + s2x * s1y + (s1x - s2x) * s0y;
  if (Math.abs(denom) < 1e-9) return;
  const m11 = -(s0y * (d2x - d1x) - s1y * d2x + s2y * d1x + (s1y - s2y) * d0x) / denom;
  const m12 = (s1y * d2y + s0y * (d1y - d2y) - s2y * d1y + (s2y - s1y) * d0y) / denom;
  const m21 = (s0x * (d2x - d1x) - s1x * d2x + s2x * d1x + (s1x - s2x) * d0x) / denom;
  const m22 = -(s1x * d2y + s0x * (d1y - d2y) - s2x * d1y + (s2x - s1x) * d0y) / denom;
  const dx = (s0x * (s2y * d1x - s1y * d2x) + s0y * (s1x * d2x - s2x * d1x) + (s2x * s1y - s1x * s2y) * d0x) / denom;
  const dy = (s0x * (s2y * d1y - s1y * d2y) + s0y * (s1x * d2y - s2x * d1y) + (s2x * s1y - s1x * s2y) * d0y) / denom;
  c.save();
  c.beginPath();
  c.moveTo(e[0][0], e[0][1]); c.lineTo(e[1][0], e[1][1]); c.lineTo(e[2][0], e[2][1]);
  c.closePath();
  c.clip();
  c.transform(m11, m12, m21, m22, dx, dy);
  c.drawImage(tex, 0, 0);
  c.restore();
}

function mk(w: number, h: number) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  return cv;
}

const lightCache = new Map<string, HTMLCanvasElement>();
function lightMap(scene: Scene, img: HTMLImageElement) {
  let l = lightCache.get(scene.id);
  if (!l) {
    l = mk(CANVAS_W, CANVAS_H);
    const c = l.getContext("2d")!;
    c.filter = "grayscale(1) contrast(0.75) brightness(1.5)";
    c.drawImage(img, 0, -CROP_Y, CANVAS_W, CANVAS_H);
    lightCache.set(scene.id, l);
  }
  return l;
}

let layer: HTMLCanvasElement | null = null;
let tmp: HTMLCanvasElement | null = null;
const floorMaskCache = new Map<string, HTMLCanvasElement>();

export function registerPhotoFloorMask(sceneId: string, image: HTMLImageElement) {
  if (image.naturalWidth !== CANVAS_W || image.naturalHeight !== CANVAS_H)
    throw new Error("The room mask does not match the photograph dimensions.");
  const mask = mk(CANVAS_W, CANVAS_H);
  const context = mask.getContext("2d")!;
  context.drawImage(image, 0, 0);
  registerFloorPixels(sceneId, context.getImageData(0, 0, CANVAS_W, CANVAS_H));
  floorMaskCache.set(sceneId, mask);
}

function floorMask(scene: Scene) {
  let mask = floorMaskCache.get(scene.id);
  if (mask) return mask;
  // Do not silently fall back to polygon clipping: it creates the visible
  // furniture-shaped floor cutouts this photo-aligned mask replaces.
  throw new Error(`The floor mask for ${scene.name} has not loaded.`);
}

export function drawRoom(c: CanvasRenderingContext2D, img: HTMLImageElement, scene: Scene, tex: TexSource | null, p: RugPlacement, showRug: boolean) {
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, CANVAS_W, CANVAS_H);
  c.drawImage(img, 0, -CROP_Y, CANVAS_W, CANVAS_H);
  if (!showRug || !tex) { c.restore(); return; }
  layer ??= mk(CANVAS_W, CANVAS_H);
  tmp ??= mk(CANVAS_W, CANVAS_H);
  const lc = layer.getContext("2d")!;
  lc.globalCompositeOperation = "source-over";
  lc.clearRect(0, 0, CANVAS_W, CANVAS_H);
  const N = 18;
  const tw = tex.width, th = tex.height;
  const w = p.wCm / 100, h = p.hCm / 100, t = (p.rot * Math.PI) / 180;
  const grid: Pt[][] = [];
  for (let i = 0; i <= N; i++) {
    grid[i] = [];
    for (let j = 0; j <= N; j++) {
      const lx = (i / N - 0.5) * w, ly = (j / N - 0.5) * h;
      grid[i][j] = project(scene, p.x + lx * Math.cos(t) - ly * Math.sin(t), p.y + lx * Math.sin(t) + ly * Math.cos(t));
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const s00: Pt = [(i / N) * tw, (j / N) * th], s10: Pt = [((i + 1) / N) * tw, (j / N) * th];
    const s01: Pt = [(i / N) * tw, ((j + 1) / N) * th], s11: Pt = [((i + 1) / N) * tw, ((j + 1) / N) * th];
    drawTri(lc, tex, [s00, s10, s11], [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1]]);
    drawTri(lc, tex, [s00, s11, s01], [grid[i][j], grid[i + 1][j + 1], grid[i][j + 1]]);
  }
  // transfer room lighting onto rug
  const tc = tmp.getContext("2d")!;
  tc.globalCompositeOperation = "source-over";
  tc.clearRect(0, 0, CANVAS_W, CANVAS_H);
  tc.drawImage(lightMap(scene, img), 0, 0);
  tc.globalCompositeOperation = "destination-in";
  tc.drawImage(layer, 0, 0);
  lc.globalCompositeOperation = "multiply";
  lc.globalAlpha = 0.85;
  lc.drawImage(tmp, 0, 0);
  lc.globalAlpha = 1;
  lc.globalCompositeOperation = "source-over";

  // Mask the complete rug + shadow, not just its texture. Otherwise shadows
  // can still darken furniture even when the textile itself is hidden.
  tc.globalCompositeOperation = "source-over";
  tc.clearRect(0, 0, CANVAS_W, CANVAS_H);
  tc.shadowColor = "rgba(30,18,8,0.38)";
  tc.shadowBlur = 10;
  tc.shadowOffsetY = 3;
  tc.drawImage(layer, 0, 0);
  tc.shadowColor = "transparent";
  tc.shadowBlur = 0;
  tc.shadowOffsetY = 0;
  tc.globalCompositeOperation = "destination-in";
  tc.drawImage(floorMask(scene), 0, 0);
  tc.globalCompositeOperation = "source-over";
  c.drawImage(tmp, 0, 0);
  c.restore();
}

export function drawDetail(c: CanvasRenderingContext2D, img: HTMLImageElement, scene: Scene, tex: TexSource | null, p: RugPlacement, showRug: boolean, zoom = 2.1) {
  const full = mk(CANVAS_W, CANVAS_H);
  drawRoom(full.getContext("2d")!, img, scene, tex, p, showRug);
  const [cx, cy] = project(scene, p.x, p.y);
  const sw = CANVAS_W / zoom, sh = CANVAS_H / zoom;
  const sx = Math.max(0, Math.min(CANVAS_W - sw, cx - sw / 2));
  const sy = Math.max(0, Math.min(CANVAS_H - sh, cy - sh / 2));
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.imageSmoothingQuality = "high";
  c.drawImage(full, sx, sy, sw, sh, 0, 0, CANVAS_W, CANVAS_H);
  c.restore();
}

export function drawPlan(c: CanvasRenderingContext2D, scene: Scene, tex: TexSource | null, p: RugPlacement, showRug: boolean) {
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = "#f1eadc";
  c.fillRect(0, 0, CANVAS_W, CANVAS_H);
  const pad = 90;
  const s = Math.min((CANVAS_W - pad * 2) / scene.widthM, (CANVAS_H - pad * 2) / scene.depthM);
  const ox = (CANVAS_W - scene.widthM * s) / 2, oy = (CANVAS_H - scene.depthM * s) / 2;
  c.fillStyle = scene.floorTone;
  c.globalAlpha = 0.35;
  c.fillRect(ox, oy, scene.widthM * s, scene.depthM * s);
  c.globalAlpha = 1;
  c.strokeStyle = "rgba(31,42,68,0.12)";
  c.lineWidth = 1;
  for (let x = 0; x <= scene.widthM + 1e-6; x += 0.5) { c.beginPath(); c.moveTo(ox + x * s, oy); c.lineTo(ox + x * s, oy + scene.depthM * s); c.stroke(); }
  for (let y = 0; y <= scene.depthM + 1e-6; y += 0.5) { c.beginPath(); c.moveTo(ox, oy + y * s); c.lineTo(ox + scene.widthM * s, oy + y * s); c.stroke(); }
  c.strokeStyle = "#1f2a44"; c.lineWidth = 6;
  c.beginPath(); c.moveTo(ox, oy + scene.depthM * s); c.lineTo(ox, oy); c.lineTo(ox + scene.widthM * s, oy); c.lineTo(ox + scene.widthM * s, oy + scene.depthM * s); c.stroke();
  c.fillStyle = "#1f2a44";
  c.font = "500 15px 'JetBrains Mono', monospace";
  c.textAlign = "center";
  c.fillText(`FLOOR AREA ${scene.widthM.toFixed(1)} x ${scene.depthM.toFixed(1)} M  /  BACK WALL`, CANVAS_W / 2, oy - 22);
  c.fillText("CAMERA", CANVAS_W / 2, oy + scene.depthM * s + 40);
  if (showRug && tex) {
    const w = (p.wCm / 100) * s, h = (p.hCm / 100) * s;
    c.save();
    c.translate(ox + p.x * s, oy + p.y * s);
    c.rotate((p.rot * Math.PI) / 180);
    c.shadowColor = "rgba(30,18,8,0.3)"; c.shadowBlur = 14; c.shadowOffsetY = 4;
    c.drawImage(tex, -w / 2, -h / 2, w, h);
    c.shadowColor = "transparent";
    c.strokeStyle = "#b23a2b"; c.lineWidth = 2; c.setLineDash([8, 6]);
    c.strokeRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16);
    c.setLineDash([]);
    c.fillStyle = "#b23a2b";
    c.font = "500 14px 'JetBrains Mono', monospace";
    c.fillText(`${Math.round(p.wCm)} CM`, 0, -h / 2 - 18);
    c.save(); c.translate(w / 2 + 22, 0); c.rotate(Math.PI / 2); c.fillText(`${Math.round(p.hCm)} CM`, 0, 0); c.restore();
    c.restore();
  }
  c.restore();
}

export function hitRug(scene: Scene, p: RugPlacement, px: number, py: number) {
  if (!isVisibleFloor(scene.id, px, py + CROP_Y)) return false;
  const [mx, my] = unproject(scene, px, py);
  const t = (-p.rot * Math.PI) / 180;
  const dx = mx - p.x, dy = my - p.y;
  const lx = dx * Math.cos(t) - dy * Math.sin(t), ly = dx * Math.sin(t) + dy * Math.cos(t);
  return Math.abs(lx) <= p.wCm / 200 && Math.abs(ly) <= p.hCm / 200;
}
