import "server-only";
import { createHash, randomBytes } from "crypto";
import { sendEmail } from "@/lib/email";
import { findUserById, listAllUsers, updateUserAuth } from "@/lib/marketplace-store";

const TTL_MS = 48 * 60 * 60 * 1000;

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function sendVerificationEmail(userId: string, origin: string): Promise<boolean> {
  const user = findUserById(userId);
  if (!user || user.placeholderEmail) return false;
  const token = randomBytes(24).toString("hex");
  updateUserAuth(userId, {
    emailVerifyTokenHash: hash(token),
    emailVerifyExpiresAt: new Date(Date.now() + TTL_MS).toISOString(),
  });
  const link = `${origin}/api/account/verify-email?token=${token}`;
  return sendEmail({
    to: user.email,
    subject: "Confirma tu correo en Cabibee",
    text: `Hola ${user.fullName}, confirma tu correo para asegurar tu cuenta de Cabibee:\n${link}\n\nEl enlace vence en 48 horas.`,
    html: `<p>Hola ${user.fullName.replace(/[<>&]/g, "")},</p><p>Confirma tu correo para asegurar tu cuenta de Cabibee:</p><p><a href="${link}">Confirmar mi correo</a></p><p style="color:#888">El enlace vence en 48 horas.</p>`,
  });
}

export function consumeVerificationToken(token: string): boolean {
  if (!/^[a-f0-9]{48}$/.test(token)) return false;
  const h = hash(token);
  const user = listAllUsers().find((u) => u.emailVerifyTokenHash === h);
  if (!user || !user.emailVerifyExpiresAt || new Date(user.emailVerifyExpiresAt).getTime() < Date.now()) return false;
  updateUserAuth(user.id, {
    emailVerifiedAt: new Date().toISOString(),
    emailVerifyTokenHash: undefined,
    emailVerifyExpiresAt: undefined,
  });
  return true;
}
