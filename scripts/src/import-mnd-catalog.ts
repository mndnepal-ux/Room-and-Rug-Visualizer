/**
 * Re-import the public collection requested by the user (pages 1–5).
 * Optimized image bytes go to App Storage, never into Git.
 */
import { Storage } from "@google-cloud/storage";
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const origin = "https://modernnaturedesignnepal.com";
const source = `${origin}/collections`;
const imageOrigin = "https://pub-c2cf1f77f6a849c7a4b53fbc7d6573d1.r2.dev";
const temp = "/tmp/room-studio-mnd";
const manifest = path.resolve(import.meta.dirname, "../../artifacts/room-studio/src/lib/mnd-catalog.json");
const publicRoot = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(",")[0]?.trim();
if (!publicRoot) throw new Error("App Storage must be set up before importing.");
const [bucketName, ...objectParts] = publicRoot.replace(/^\/+/, "").split("/");
const objectRoot = objectParts.join("/");
const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: "http://127.0.0.1:1106/token",
    type: "external_account",
    credential_source: {
      url: "http://127.0.0.1:1106/credential",
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

async function get(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Source returned HTTP ${res.status}: ${url}`);
  return res;
}

await mkdir(temp, { recursive: true });
const html = await (await get(source)).text();
const entryPath = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
if (!entryPath) throw new Error("Cannot locate collection entry script.");
const entry = await (await get(origin + entryPath)).text();
const collectionPath = entry.match(/(?:\.\/|assets\/)(AllCollections-[\w-]+\.js)/)?.[1];
if (!collectionPath) throw new Error("Cannot locate public collection data.");
const bundle = await (await get(`${origin}/assets/${collectionPath}`)).text();
const products = [...bundle.matchAll(/\{id:"([^"]+)",name:"([^"]+)",imageUrl:"([^"]+)"\}/g)]
  .map((m, index) => ({ sourceId: m[1], name: m[2], sourceImage: m[3], sourcePage: Math.floor(index / 20) + 1 }));
if (products.length !== 81 || new Set(products.map(p => p.sourceId)).size !== 81)
  throw new Error("Collection changed: review pagination before importing.");
if (products.some(p => !p.sourceImage.startsWith(`${imageOrigin}/products/`)))
  throw new Error("Unexpected product image host.");

type Entry = {
  id: string; name: string; maker: string; category: "MND Nepal";
  family: "warm" | "cool" | "neutral" | "bold"; palette: string[];
  wCm: number; hCm: number; imagePath: string; thumbnailPath: string;
  sourcePage: number; sourceUrl: string; sourceImage: string;
};
const results: Entry[] = new Array(products.length);
let cursor = 0, bytes = 0;
async function worker() {
  while (cursor < products.length) {
    const index = cursor++;
    const product = products[index];
    const id = `mnd-${product.sourceId}`;
    const cache = path.join(temp, `${id}.webp`);
    let image: Buffer;
    try { image = await readFile(cache); }
    catch {
      const input = Buffer.from(await (await get(product.sourceImage)).arrayBuffer());
      image = await sharp(input, { limitInputPixels: 200_000_000 }).rotate()
        .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85, effort: 4 }).toBuffer();
      await writeFile(cache, image);
    }
    const meta = await sharp(image).metadata();
    const thumbnail = await sharp(image).resize({ width: 240, height: 240, fit: "inside" }).webp({ quality: 76 }).toBuffer();
    const { data } = await sharp(image).removeAlpha().resize(24, 24).raw().toBuffer({ resolveWithObject: true });
    let saturation = 0, warm = 0, cool = 0, count = 0;
    const colors = new Map<string, number>();
    for (let i = 0; i < data.length; i += 3) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const sat = max ? (max - min) / max : 0;
      saturation += sat;
      if (sat > .25) { if (r > b * 1.12) warm++; else cool++; }
      const key = [r, g, b].map(v => Math.min(255, Math.round(v / 32) * 32).toString(16).padStart(2, "0")).join("");
      colors.set(key, (colors.get(key) ?? 0) + 1);
      count++;
    }
    const average = saturation / count;
    const family = average < .2 ? "neutral" : average > .55 ? "bold" : warm > cool ? "warm" : "cool";
    const palette = [...colors].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([hex]) => `#${hex}`);
    const imagePath = `catalog/mnd/${id}.webp`;
    const thumbnailPath = `catalog/mnd/${id}-thumb.webp`;
    await Promise.all([
      storage.bucket(bucketName).file(`${objectRoot}/${imagePath}`).save(image, { resumable: false, metadata: { contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" } }),
      storage.bucket(bucketName).file(`${objectRoot}/${thumbnailPath}`).save(thumbnail, { resumable: false, metadata: { contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" } }),
    ]);
    bytes += image.length + thumbnail.length;
    const ratio = meta.width! / meta.height!;
    // Source gives design images, not certified physical dimensions.
    const hCm = 240, wCm = Math.round(hCm * ratio);
    results[index] = {
      id, name: product.name, maker: "Modern Nature Design Nepal", category: "MND Nepal",
      family, palette, wCm, hCm, imagePath, thumbnailPath,
      sourcePage: product.sourcePage, sourceUrl: source, sourceImage: product.sourceImage,
    };
    console.log(`${index + 1}/81 ${product.name}: ${meta.width}x${meta.height}, ${image.length} bytes`);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
await writeFile(manifest, JSON.stringify(results, null, 2) + "\n");
console.log(`Imported ${results.length} designs, ${(bytes / 1024 / 1024).toFixed(2)} MB optimized assets in App Storage.`);
