import { Router } from "express";
import { roomPhotoFile } from "../lib/catalog-storage";

const router = Router();
const names = new Set(["living.webp", "bedroom.webp", "bedroom-2.webp", "lobby.webp", "kitchen.webp", "office.webp"]);
const maskNames = new Set(["living-mask.png", "bedroom-mask.png", "lobby-mask.png", "dining-mask.png", "loft-mask.png"]);
const cache = new Map<string, Promise<Buffer>>();

router.get("/room-photos/:filename", async (req, res) => {
  const filename = String(req.params.filename);
  if (!names.has(filename) && !maskNames.has(filename)) {
    res.status(404).json({ error: "Room photograph not found" });
    return;
  }
  try {
    let pending = cache.get(filename);
    if (!pending) {
      pending = roomPhotoFile(filename).download().then(([bytes]) => bytes);
      cache.set(filename, pending);
      pending.catch(() => cache.delete(filename));
    }
    const bytes = await pending;
    res.setHeader("Content-Type", maskNames.has(filename) ? "image/png" : "image/webp");
    res.setHeader("Cache-Control", maskNames.has(filename) ? "public, max-age=3600" : "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(bytes);
  } catch (err) {
    req.log.error({ err }, "Room photograph unavailable");
    res.status(503).json({ error: "Room photograph could not be loaded. Please retry." });
  }
});

export default router;
