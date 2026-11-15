import { Storage } from "@google-cloud/storage";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const workspace = path.resolve(import.meta.dirname, "../..");
const modulePath = path.join(workspace, "artifacts/room-studio/src/lib/floor-masks.ts");
const { FLOOR_MASKS } = await import(modulePath);
const output = "/tmp/room-studio-refined-masks";
await mkdir(output, { recursive: true });
await writeFile(`${output}/seeds.json`, JSON.stringify(FLOOR_MASKS));
const result = spawnSync("python", [
  path.join(import.meta.dirname, "refine-floor-masks.py"),
  `${output}/seeds.json`, path.join(workspace, "attached_assets"), output,
], { stdio: "inherit" });
if (result.status !== 0) throw new Error("Floor mask refinement failed.");
if (!process.argv.includes("--upload")) {
  console.log(`Review full-floor diagnostic images in ${output} before using --upload.`);
} else {
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
  const manifest: Record<string, string> = {};
  for (const id of ["living", "bedroom", "lobby", "dining", "loft"]) {
    const bytes = await readFile(`${output}/${id}-mask.png`);
    const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
    const filename = `${id}-mask-${digest}.png`;
    await client.bucket(bucket).file(`${parts.join("/")}/rooms/user-rooms/${filename}`).save(bytes, {
      resumable: false,
      metadata: { contentType: "image/png", cacheControl: "public, max-age=31536000, immutable" },
    });
    manifest[id] = filename;
    console.log(`Stored refined mask: ${id} (${bytes.length} bytes)`);
  }
  // Publish references only AFTER every immutable object exists. Previously
  // changing a query version before upload cached the old bytes under the new
  // URL in already-open browsers, while fresh screenshots saw different masks.
  await writeFile(
    path.join(workspace, "artifacts/room-studio/src/lib/room-mask-assets.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
}
