import mndDesigns from "./mnd-catalog.json";

export type Pattern = "kilim" | "medallion" | "berber" | "stripe" | "check" | "abrash" | "arcs" | "terrazzo";
export type Category = "MND Nepal" | "Flatweave" | "Persian-inspired" | "Berber" | "Modern" | "Solid" | "Uploads";
export type ColorFamily = "warm" | "cool" | "neutral" | "bold";

export interface Rug {
  id: string;
  name: string;
  maker: string;
  category: Category;
  family: ColorFamily;
  pattern?: Pattern;
  palette: string[];
  wCm: number;
  hCm: number;
  fringe?: boolean;
  seed?: number;
  upload?: boolean;
  imageSrc?: string;
  thumbnailSrc?: string;
  sourcePage?: number;
  sourceUrl?: string;
}

const SAMPLE_CATALOG: Rug[] = [
  { id: "ember-kilim", name: "Ember Kilim", maker: "Atelier Sivas", category: "Flatweave", family: "warm", pattern: "kilim", palette: ["#b23a2b", "#1f2a44", "#e9d9b8", "#d99a2b", "#5c1f1a"], wCm: 240, hCm: 170, fringe: true, seed: 11 },
  { id: "tabriz-night", name: "Tabriz Night", maker: "House of Varzaneh", category: "Persian-inspired", family: "cool", pattern: "medallion", palette: ["#1f2a44", "#8e2b24", "#e7d6b0", "#c48a3a", "#3e5a6b"], wCm: 300, hCm: 200, fringe: true, seed: 4 },
  { id: "atlas-cream", name: "Atlas Cream", maker: "Ourika Loom Co.", category: "Berber", family: "neutral", pattern: "berber", palette: ["#efe6d4", "#2b2620", "#d9ccb3"], wCm: 280, hCm: 190, fringe: true, seed: 7 },
  { id: "saffron-run", name: "Saffron Run", maker: "Muro Textiles", category: "Modern", family: "bold", pattern: "stripe", palette: ["#e1a02a", "#efe2c6", "#a33b23", "#2e3550", "#7c8f6a"], wCm: 250, hCm: 160, seed: 21 },
  { id: "rosewood-check", name: "Rosewood Check", maker: "Studio Halde", category: "Modern", family: "warm", pattern: "check", palette: ["#c97a63", "#ead8c2", "#6e3a2e"], wCm: 230, hCm: 230, seed: 2 },
  { id: "tide-abrash", name: "Tide Abrash", maker: "Kerman & Daughter", category: "Solid", family: "cool", pattern: "abrash", palette: ["#4b6475", "#6d8796", "#d7cdb7"], wCm: 270, hCm: 180, seed: 9 },
  { id: "dune-arcs", name: "Dune Arcs", maker: "Muro Textiles", category: "Modern", family: "neutral", pattern: "arcs", palette: ["#d9c6a5", "#b07a4f", "#efe4cf", "#3f3a33"], wCm: 260, hCm: 180, seed: 5 },
  { id: "pebble-terrazzo", name: "Pebble Terrazzo", maker: "Studio Halde", category: "Modern", family: "bold", pattern: "terrazzo", palette: ["#e8dccb", "#b8442e", "#2f4058", "#d9a441", "#7d8b6a"], wCm: 220, hCm: 160, seed: 13 },
  { id: "madder-medallion", name: "Madder Medallion", maker: "House of Varzaneh", category: "Persian-inspired", family: "warm", pattern: "medallion", palette: ["#9b2f25", "#22304a", "#ead9b5", "#d49a3a", "#5a7a6a"], wCm: 280, hCm: 190, fringe: true, seed: 17 },
  { id: "moss-kilim", name: "Moss Kilim", maker: "Atelier Sivas", category: "Flatweave", family: "cool", pattern: "kilim", palette: ["#56684f", "#e7dcc2", "#2a2e2b", "#c2893d", "#8e3b2b"], wCm: 200, hCm: 140, fringe: true, seed: 31 },
  { id: "ink-berber", name: "Ink Lattice", maker: "Ourika Loom Co.", category: "Berber", family: "cool", pattern: "berber", palette: ["#24304a", "#e9dfc9", "#1b2438"], wCm: 260, hCm: 180, fringe: true, seed: 3 },
  { id: "oat-solid", name: "Oat Boucle", maker: "Kerman & Daughter", category: "Solid", family: "neutral", pattern: "abrash", palette: ["#d8c9ad", "#cbb995", "#8a7656"], wCm: 250, hCm: 170, seed: 8 },
  { id: "garnet-stripe", name: "Garnet Ticking", maker: "Atelier Sivas", category: "Flatweave", family: "bold", pattern: "stripe", palette: ["#7d2230", "#e8dcc2", "#c4602f", "#1f2a44"], wCm: 210, hCm: 150, fringe: true, seed: 41 },
];

const assetUrl = (objectPath: string) =>
  `${import.meta.env.BASE_URL}api/catalog/mnd/${objectPath.split("/").pop()}`;

export const MND_CATALOG: Rug[] = mndDesigns.map((design) => ({
  id: design.id,
  name: design.name,
  maker: design.maker,
  category: "MND Nepal",
  family: design.family as ColorFamily,
  palette: design.palette,
  wCm: design.wCm,
  hCm: design.hCm,
  imageSrc: assetUrl(design.imagePath),
  thumbnailSrc: assetUrl(design.thumbnailPath),
  sourcePage: design.sourcePage,
  sourceUrl: design.sourceUrl,
}));

// Keep sample IDs compatible with designs previously saved in this browser.
export const CATALOG: Rug[] = [...MND_CATALOG, ...SAMPLE_CATALOG];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D;

function diamond(c: Ctx, x: number, y: number, rx: number, ry: number, col: string) {
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(x, y - ry);
  c.lineTo(x + rx, y);
  c.lineTo(x, y + ry);
  c.lineTo(x - rx, y);
  c.closePath();
  c.fill();
}

function paint(c: Ctx, W: number, H: number, rug: Rug) {
  const p = rug.palette;
  const r = rng(rug.seed ?? 1);
  const m = Math.min(W, H);
  c.fillStyle = p[0];
  c.fillRect(0, 0, W, H);
  switch (rug.pattern) {
    case "kilim": {
      const b = m * 0.08;
      c.fillStyle = p[1]; c.fillRect(0, 0, W, H);
      c.fillStyle = p[2]; c.fillRect(b * 0.35, b * 0.35, W - b * 0.7, H - b * 0.7);
      c.fillStyle = p[0]; c.fillRect(b, b, W - 2 * b, H - 2 * b);
      // border teeth
      const n = Math.round(W / (b * 0.9));
      for (let i = 0; i < n; i++) {
        const x = b + ((W - 2 * b) / n) * (i + 0.5);
        diamond(c, x, b * 0.67, b * 0.28, b * 0.28, p[3]);
        diamond(c, x, H - b * 0.67, b * 0.28, b * 0.28, p[3]);
      }
      const cols = 3, rows = 2;
      const fw = (W - 2 * b) / cols, fh = (H - 2 * b) / rows;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const x = b + fw * (i + 0.5), y = b + fh * (j + 0.5);
        const rx = fw * 0.42, ry = fh * 0.42;
        diamond(c, x, y, rx, ry, p[1]);
        diamond(c, x, y, rx * 0.78, ry * 0.78, p[2]);
        diamond(c, x, y, rx * 0.56, ry * 0.56, (i + j) % 2 ? p[3] : p[4]);
        diamond(c, x, y, rx * 0.22, ry * 0.22, p[1]);
        // hooks
        for (const s of [-1, 1]) {
          diamond(c, x + s * rx * 0.98, y, rx * 0.1, ry * 0.18, p[2]);
        }
      }
      // weft lines
      c.fillStyle = p[4];
      for (let y = b; y < H - b; y += fh) c.fillRect(b, y - 1.5, W - 2 * b, 3);
      break;
    }
    case "medallion": {
      const b = m * 0.12;
      c.fillStyle = p[1]; c.fillRect(0, 0, W, H);
      c.fillStyle = p[2]; c.fillRect(b * 0.15, b * 0.15, W - b * 0.3, H - b * 0.3);
      c.fillStyle = p[1]; c.fillRect(b * 0.25, b * 0.25, W - b * 0.5, H - b * 0.5);
      const step = b * 0.6;
      for (let x = b * 0.5; x < W - b * 0.3; x += step) {
        diamond(c, x, b * 0.6, step * 0.32, b * 0.26, p[3]);
        diamond(c, x, H - b * 0.6, step * 0.32, b * 0.26, p[3]);
        diamond(c, x, b * 0.6, step * 0.12, b * 0.1, p[0]);
        diamond(c, x, H - b * 0.6, step * 0.12, b * 0.1, p[0]);
      }
      for (let y = b * 0.5 + step; y < H - b * 0.5; y += step) {
        diamond(c, b * 0.6, y, b * 0.26, step * 0.32, p[3]);
        diamond(c, W - b * 0.6, y, b * 0.26, step * 0.32, p[3]);
      }
      c.fillStyle = p[2]; c.fillRect(b - 3, b - 3, W - 2 * b + 6, H - 2 * b + 6);
      c.fillStyle = p[0]; c.fillRect(b, b, W - 2 * b, H - 2 * b);
      // field florets
      for (let k = 0; k < 140; k++) {
        const x = b + r() * (W - 2 * b), y = b + r() * (H - 2 * b);
        diamond(c, x, y, m * 0.012, m * 0.016, k % 3 ? p[4] : p[3]);
      }
      const cx = W / 2, cy = H / 2;
      diamond(c, cx, cy, W * 0.3, H * 0.34, p[2]);
      diamond(c, cx, cy, W * 0.27, H * 0.3, p[1]);
      diamond(c, cx, cy, W * 0.19, H * 0.22, p[3]);
      c.save(); c.translate(cx, cy);
      for (let i = 0; i < 8; i++) {
        c.rotate(Math.PI / 4);
        diamond(c, 0, -m * 0.09, m * 0.03, m * 0.08, p[0]);
      }
      c.restore();
      c.fillStyle = p[2]; c.beginPath(); c.arc(cx, cy, m * 0.045, 0, Math.PI * 2); c.fill();
      for (const [x, y] of [[b, b], [W - b, b], [b, H - b], [W - b, H - b]]) {
        c.save(); c.beginPath(); c.rect(b, b, W - 2 * b, H - 2 * b); c.clip();
        diamond(c, x, y, W * 0.14, H * 0.18, p[1]);
        diamond(c, x, y, W * 0.1, H * 0.13, p[3]);
        c.restore();
      }
      break;
    }
    case "berber": {
      c.strokeStyle = p[1];
      c.lineCap = "round";
      const cell = m * 0.26;
      for (let x = -H; x < W + H; x += cell) {
        for (const dir of [1, -1]) {
          c.lineWidth = m * 0.012 + r() * m * 0.008;
          c.beginPath();
          let px = x, py = 0;
          c.moveTo(px, py);
          while (py < H) {
            py += cell * 0.25;
            px += dir * cell * 0.25 + (r() - 0.5) * m * 0.01;
            c.lineTo(px, py);
          }
          c.stroke();
        }
      }
      c.globalAlpha = 0.5;
      for (let k = 0; k < 18; k++) diamond(c, r() * W, r() * H, m * 0.02, m * 0.03, p[1]);
      c.globalAlpha = 1;
      break;
    }
    case "stripe": {
      let y = 0;
      while (y < H) {
        const h = m * (0.02 + r() * 0.1);
        c.fillStyle = p[Math.floor(r() * p.length)];
        c.fillRect(0, y, W, h);
        if (r() > 0.6) { c.fillStyle = p[1]; c.fillRect(0, y + h * 0.45, W, Math.max(2, h * 0.08)); }
        y += h;
      }
      break;
    }
    case "check": {
      const n = 6;
      const s = (W - m * 0.1) / n, t = (H - m * 0.1) / n;
      c.fillStyle = p[2]; c.fillRect(0, 0, W, H);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        c.fillStyle = (i + j) % 2 ? p[0] : p[1];
        const jx = (r() - 0.5) * 3, jy = (r() - 0.5) * 3;
        c.fillRect(m * 0.05 + i * s + jx, m * 0.05 + j * t + jy, s + 1, t + 1);
      }
      break;
    }
    case "abrash": {
      for (let y = 0; y < H; y += 3) {
        c.globalAlpha = 0.05 + 0.25 * Math.pow(Math.sin(y * 0.013 + r()), 4) * r();
        c.fillStyle = p[1];
        c.fillRect(0, y, W, 3);
      }
      c.globalAlpha = 1;
      c.strokeStyle = p[2];
      c.lineWidth = m * 0.012;
      c.strokeRect(m * 0.05, m * 0.05, W - m * 0.1, H - m * 0.1);
      break;
    }
    case "arcs": {
      c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip();
      const shapes: [number, number, number, string][] = [
        [W * 0.15, H * 1.05, H * 0.75, p[1]], [W * 0.15, H * 1.05, H * 0.52, p[2]], [W * 0.15, H * 1.05, H * 0.3, p[1]],
        [W * 0.88, -H * 0.05, H * 0.55, p[3]], [W * 0.88, -H * 0.05, H * 0.36, p[0]],
        [W * 0.62, H * 0.62, H * 0.1, p[1]],
      ];
      for (const [x, y, rad, col] of shapes) { c.fillStyle = col; c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill(); }
      c.restore();
      break;
    }
    case "terrazzo": {
      for (let k = 0; k < 90; k++) {
        c.fillStyle = p[1 + Math.floor(r() * (p.length - 1))];
        const x = r() * W, y = r() * H, s = m * (0.015 + r() * 0.05);
        c.beginPath();
        for (let a = 0; a < 7; a++) {
          const ang = (a / 7) * Math.PI * 2, rr = s * (0.6 + r() * 0.5);
          const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr;
          if (a === 0) c.moveTo(px, py); else c.lineTo(px, py);
        }
        c.closePath(); c.fill();
      }
      break;
    }
  }
}

function addWool(c: Ctx, W: number, H: number, seed: number) {
  const img = c.getImageData(0, 0, W, H);
  const d = img.data;
  const r = rng(seed * 7 + 1);
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 22;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  c.putImageData(img, 0, 0);
  c.globalAlpha = 0.05;
  c.fillStyle = "#000";
  for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
  c.globalAlpha = 1;
  // pile edge depth
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(255,255,255,0.05)");
  g.addColorStop(1, "rgba(0,0,0,0.06)");
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.strokeStyle = "rgba(20,14,8,0.28)";
  c.lineWidth = 3;
  c.strokeRect(1.5, 1.5, W - 3, H - 3);
}

/** Generate a rug texture. Fringe sits on the left/right ends, transparent around it. */
export function makeRugTexture(rug: Rug, wCm = rug.wCm, hCm = rug.hCm): HTMLCanvasElement {
  const scale = Math.min(2.6, 900 / Math.max(wCm, hCm));
  const W = Math.round(wCm * scale), H = Math.round(hCm * scale);
  const fr = rug.fringe ? Math.round(W * 0.035) : 0;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d")!;
  const body = document.createElement("canvas");
  body.width = W - 2 * fr; body.height = H;
  const bc = body.getContext("2d", { willReadFrequently: true })!;
  paint(bc, body.width, H, rug);
  addWool(bc, body.width, H, rug.seed ?? 1);
  c.drawImage(body, fr, 0);
  if (fr) {
    c.strokeStyle = "#e9dfca";
    c.lineWidth = 1.6;
    for (let y = 3; y < H - 2; y += 4) {
      for (const side of [0, 1]) {
        const x0 = side ? W - fr : fr;
        const x1 = side ? W - 1 - Math.random() * 3 : 1 + Math.random() * 3;
        c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y + (Math.random() - 0.5) * 2); c.stroke();
      }
    }
  }
  return cv;
}

const thumbCache = new Map<string, string>();
export function rugThumb(rug: Rug): string {
  const k = rug.id;
  if (thumbCache.has(k)) return thumbCache.get(k)!;
  const t = makeRugTexture(rug, rug.wCm * 0.5, rug.hCm * 0.5);
  const url = t.toDataURL("image/png");
  thumbCache.set(k, url);
  return url;
}
