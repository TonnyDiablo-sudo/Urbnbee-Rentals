import "server-only";
import { openSecret, sealSecret } from "@/lib/secret-box";
import { findUserById, updateUserAuth } from "@/lib/marketplace-store";
import type { UserRecord } from "@/lib/marketplace-types";

/**
 * Copia descifrable de la contraseña de los asociados, sólo para que el admin la consulte.
 * Las demás cuentas sólo guardan el hash. Al asociado se le avisa al cambiarla.
 */

const PURPOSE = "cabibee-associate-passwords";
const encrypt = (plain: string) => sealSecret(PURPOSE, plain);
const decrypt = (packed: string) => openSecret(PURPOSE, packed);

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
