import { Router } from "express";
import { loadCatalogAsset } from "../lib/catalog-storage";

const router = Router();
// Fixed allowlist below bounds this to 162 small optimized assets (~28 MB).
// Deduplicate concurrent image requests and avoid a storage round-trip when
// users return to a previously viewed collection page.
const imageCache = new Map<string, Promise<Buffer>>();

function loadImage(filename: string) {
  let pending = imageCache.get(filename);
  if (!pending) {
    pending = loadCatalogAsset(filename);
    imageCache.set(filename, pending);
    pending.catch(() => imageCache.delete(filename));
  }
  return pending;
}

// Only the 81 imported collection assets can be served. No caller-supplied
// URLs, arbitrary storage paths, write operations, or private objects.
router.get("/catalog/mnd/:filename", async (req, res) => {
  const filename = String(req.params.filename);
  const match = /^mnd-rug-(\d{3})(-thumb)?\.webp$/.exec(filename);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 81) {
    res.status(404).json({ error: "Design image not found" });
    return;
  }
  try {
    const bytes = await loadImage(filename);
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(bytes);
  } catch (err) {
    req.log.error({ err }, "Catalogue storage unavailable");
    res.status(503).json({ error: "Catalogue storage is unavailable." });
  }
});

export default router;
