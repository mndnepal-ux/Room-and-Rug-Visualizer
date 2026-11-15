import { Router } from "express";
import { createHash } from "node:crypto";
import { loadRoomPhoto } from "../lib/catalog-storage";

const router = Router();
const names = new Set(["living.webp", "bedroom.webp", "bedroom-2.webp", "lobby.webp", "kitchen.webp", "office.webp"]);
const maskNames = new Set(["living-mask.png", "bedroom-mask.png", "lobby-mask.png", "dining-mask.png", "loft-mask.png"]);
const immutableMaskPattern = /^(living|bedroom|lobby|dining|loft)-mask-([a-f0-9]{12})\.png$/;
const cache = new Map<string, Promise<Buffer>>();

router.get("/room-photos/:filename", async (req, res) => {
  const filename = String(req.params.filename);
  const immutableMask = immutableMaskPattern.exec(filename);
  const isMask = maskNames.has(filename) || !!immutableMask;
  if (!names.has(filename) && !isMask) {
    res.status(404).json({ error: "Room photograph not found" });
    return;
  }
  try {
    let pending = cache.get(filename);
    if (!pending) {
      pending = loadRoomPhoto(filename).then((bytes) => {
        if (immutableMask &&
            createHash("sha256").update(bytes).digest("hex").slice(0, 12) !== immutableMask[2])
          throw new Error("Room mask content does not match its immutable address.");
        return bytes;
      });
      cache.set(filename, pending);
      pending.catch(() => cache.delete(filename));
    }
    const bytes = await pending;
    res.setHeader("Content-Type", isMask ? "image/png" : "image/webp");
    res.setHeader("Cache-Control", maskNames.has(filename) ? "no-store" : "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(bytes);
  } catch (err) {
    req.log.error({ err }, "Room photograph unavailable");
    res.status(503).json({ error: "Room photograph could not be loaded. Please retry." });
  }
});

export default router;
