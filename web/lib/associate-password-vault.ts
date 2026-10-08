import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { findUserById, updateUserAuth } from "@/lib/marketplace-store";
import type { UserRecord } from "@/lib/marketplace-types";

/**
 * Copia descifrable de la contraseña de los asociados, sólo para que el admin la consulte.
 * Las demás cuentas sólo guardan el hash. Al asociado se le avisa al cambiarla.
 */

const ALGO = "aes-256-gcm";

function keyBytes(): Buffer {
  const secret = process.env.SESSION_SECRET?.trim() || "urbnbee-dev-secret-change-in-production";
  return createHash("sha256").update(`cabibee-associate-passwords:${secret}`).digest();
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${enc.toString("base64")}`;
}

function decrypt(packed: string): string | null {
  try {
    const [ver, ivB64, tagB64, dataB64] = packed.split(":");
    if (ver !== "v1" || !ivB64 || !tagB64 || !dataB64) return null;
    const decipher = createDecipheriv(ALGO, keyBytes(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Llamar cada vez que un asociado fija o usa su contraseña (alta, login, cambio, recuperación). */
export function rememberAssociatePassword(userId: string, plain: string): void {
  const user = findUserById(userId);
  if (!user?.associate || user.role === "admin" || !plain) return;
  if (user.associatePasswordEnc && decrypt(user.associatePasswordEnc) === plain) return;
  updateUserAuth(userId, { associatePasswordEnc: encrypt(plain), associatePasswordAt: new Date().toISOString() });
}

export function forgetAssociatePassword(userId: string): void {
  updateUserAuth(userId, { associatePasswordEnc: undefined, associatePasswordAt: undefined });
}

export function revealAssociatePassword(user: UserRecord): { password: string; at?: string } | null {
  if (!user.associate || user.role === "admin" || !user.associatePasswordEnc) return null;
  const password = decrypt(user.associatePasswordEnc);
  return password ? { password, at: user.associatePasswordAt } : null;
}
