import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/** Cifrado reversible para guardar contraseñas que alguien tiene que volver a ver. `purpose` separa las llaves. */
const ALGO = "aes-256-gcm";

function keyBytes(purpose: string): Buffer {
  const secret = process.env.SESSION_SECRET?.trim() || "urbnbee-dev-secret-change-in-production";
  return createHash("sha256").update(`${purpose}:${secret}`).digest();
}

export function sealSecret(purpose: string, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyBytes(purpose), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${enc.toString("base64")}`;
}

export function openSecret(purpose: string, packed: string): string | null {
  try {
    const [ver, ivB64, tagB64, dataB64] = packed.split(":");
    if (ver !== "v1" || !ivB64 || !tagB64 || !dataB64) return null;
    const decipher = createDecipheriv(ALGO, keyBytes(purpose), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
