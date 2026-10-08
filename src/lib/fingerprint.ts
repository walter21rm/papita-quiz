function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// crypto.subtle only exists in secure contexts (https or localhost). When the app is opened from
// another device through a LAN IP, fall back to a fast non-cryptographic hash.
function fallbackHash(bytes: Uint8Array): string {
  let h1 = 0xdeadbeef ^ bytes.length;
  let h2 = 0x41c6ce57 ^ bytes.length;
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 2654435761);
    h2 = Math.imul(h2 ^ bytes[i], 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0).toString(16).padStart(8, "0")}-${bytes.length}`;
}

async function digest(bytes: Uint8Array): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hash = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
    return toHex(new Uint8Array(hash));
  }
  return fallbackHash(bytes);
}

export async function hashFile(file: File): Promise<string> {
  return digest(new Uint8Array(await file.arrayBuffer()));
}

export async function fingerprintFiles(files: File[]): Promise<{ fingerprint: string; hashes: string[] }> {
  const hashes = await Promise.all(files.map(hashFile));
  const combined = new TextEncoder().encode([...hashes].sort().join(":"));
  return { fingerprint: await digest(combined), hashes };
}

export function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}
