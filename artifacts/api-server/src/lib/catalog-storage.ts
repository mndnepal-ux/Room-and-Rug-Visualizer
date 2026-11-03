import { Storage } from "@google-cloud/storage";

// Replit App Storage sidecar authentication, as in the storage blueprint.
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

export function catalogFile(filename: string) {
  const root = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(",")[0]?.trim();
  if (!root) throw new Error("Public catalogue storage is not configured.");
  const [bucket, ...parts] = root.replace(/^\/+/, "").split("/");
  return client.bucket(bucket).file(`${parts.join("/")}/catalog/mnd/${filename}`);
}
