import { Storage } from "@google-cloud/storage";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const assetRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets");
let storageClient: Storage | undefined;

export function loadCatalogAsset(filename: string): Promise<Buffer> {
  return loadPublicAsset("catalog/mnd", filename);
}

export function loadRoomPhoto(filename: string): Promise<Buffer> {
  return loadPublicAsset("rooms/user-rooms", filename);
}

async function loadPublicAsset(folder: string, filename: string): Promise<Buffer> {
  // Cursor and other local clones use the tracked assets and need no Replit
  // credentials. Replit keeps using the existing public App Storage objects.
  if (!process.env.REPL_ID) {
    return readFile(path.join(assetRoot, folder, filename));
  }

  const root = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(",")[0]?.trim();
  if (!root) throw new Error("Public catalogue storage is not configured.");
  const [bucket, ...parts] = root.replace(/^\/+/, "").split("/");
  storageClient ??= new Storage({
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

  const objectPath = path.posix.join(parts.join("/"), folder, filename);
  const [bytes] = await storageClient.bucket(bucket).file(objectPath).download();
  return bytes;
}
