import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * AES-256-GCM for OAuth refresh tokens at rest. TOKEN_ENCRYPTION_KEY is either
 * 32 random bytes in base64, or any random passphrase of 32+ characters
 * (hashed to a 256-bit key) so it can be created without command-line tools.
 */
function key(): Buffer {
  const raw = env.tokenEncryptionKey();
  const b64 = Buffer.from(raw, "base64");
  if (b64.length === 32 && /^[A-Za-z0-9+/]{43}=$/.test(raw)) return b64;
  if (raw.length < 32) throw new Error("TOKEN_ENCRYPTION_KEY must be at least 32 characters");
  return createHash("sha256").update(raw, "utf8").digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

export function decryptSecret(blob: string): string {
  const [v, iv, tag, data] = blob.split(".");
  if (v !== "v1") throw new Error("unknown secret format");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}
