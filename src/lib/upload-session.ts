import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { assertApiKey } from "./gemini";
import { AppError } from "./errors";

function key(): Buffer {
  return createHash("sha256").update(`papita-upload:${assertApiKey()}`).digest();
}

/** Opaque token so the browser never sees the Gemini resumable URL (it can include secrets). */
export function encodeUploadHandle(uploadUrl: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(uploadUrl, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function decodeUploadHandle(handle: string): string {
  try {
    const packed = Buffer.from(handle, "base64url");
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const encrypted = packed.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    throw new AppError("bad_request", "La subida se interrumpió. Vuelve a intentar analizar el archivo.");
  }
}
