import { Storage } from "@google-cloud/storage";
import sharp from "sharp";
import path from "node:path";

// Explicitly keep both Bedroom uploads, but only one Lobby as requested.
const rooms = [
  ["living", "Living_Room_1793697570495.jpeg"],
  ["bedroom", "Bedroom_1793697563423.png"],
  ["bedroom-2", "Bedroom_1793697570495.png"],
  ["lobby", "Lobby_1793697563423.jpeg"],
  ["kitchen", "Kitchen_1793697570496.jpeg"],
  ["office", "Office_1793697570496.jpeg"],
];
const root = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(",")[0]?.trim();
if (!root) throw new Error("App Storage is not configured.");
const [bucket, ...parts] = root.replace(/^\/+/, "").split("/");
const client = new Storage({
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
for (const [id, name] of rooms) {
  const source = path.resolve(import.meta.dirname, "../../attached_assets", name);
  const bytes = await sharp(source).rotate().resize(1024, 683, { fit: "fill" }).webp({ quality: 90 }).toBuffer();
  await client.bucket(bucket).file(`${parts.join("/")}/rooms/user-rooms/${id}.webp`).save(bytes, {
    resumable: false,
    metadata: { contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" },
  });
  console.log(`Stored room ${id}: ${bytes.length} bytes, 1024 × 683`);
}
