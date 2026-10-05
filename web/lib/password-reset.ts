import "server-only";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { isPlaceholderEmail } from "@/lib/associate-provision";
import { notifyPasswordChanged } from "@/lib/account-notices";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { findUserByEmail, listAllUsers, updateUserAuth } from "@/lib/marketplace-store";
import { SUPPORT_EMAIL } from "@/lib/support-contact";

const TTL_MS = 60 * 60 * 1000;
const COOLDOWN_MS = 2 * 60 * 1000;

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Manda el enlace de recuperación. No revela si el correo existe.
 * No se manda a correos internos de cuentas creadas por asociados.
 */
export async function requestPasswordReset(emailRaw: string, origin: string): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || isPlaceholderEmail(email)) return;
  const user = findUserByEmail(email);
  if (!user || user.placeholderEmail) return;
  const last = user.passwordResetRequestedAt ? Date.parse(user.passwordResetRequestedAt) : 0;
  if (last && Date.now() - last < COOLDOWN_MS) return;

  const token = randomBytes(24).toString("hex");
  updateUserAuth(user.id, {
    passwordResetTokenHash: hash(token),
    passwordResetExpiresAt: new Date(Date.now() + TTL_MS).toISOString(),
  });
  const link = `${origin.replace(/:\/\/app\./i, "://")}/recuperar/nueva?token=${token}`;
  const sent = await sendEmail({
    mailbox: "noreply",
    to: user.email,
    subject: "Restablece tu contraseña de Cabibee",
    text: `Hola ${user.fullName}, pediste restablecer la contraseña de tu cuenta de Cabibee.\n${link}\n\nEl enlace vence en 1 hora. Si no fuiste tú, ignora este correo o escríbenos a ${SUPPORT_EMAIL}.`,
    html: emailLayout({
      title: "Restablece tu contraseña",
      paragraphs: [
        `Hola ${escapeHtml(user.fullName)},`,
        "Pediste restablecer la contraseña de tu cuenta de Cabibee. El enlace vence en 1 hora.",
        `<span style="color:#888">Si no fuiste tú, ignora este correo o escríbenos a ${SUPPORT_EMAIL}.</span>`,
      ],
      button: { href: link, label: "Elegir contraseña nueva" },
    }),
  });
  if (sent) updateUserAuth(user.id, { passwordResetRequestedAt: new Date().toISOString() });
}

export async function consumePasswordReset(
  token: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[a-f0-9]{48}$/.test(token)) return { ok: false, error: "El enlace no es válido o ya venció." };
  if (newPassword.length < 8) return { ok: false, error: "La contraseña nueva debe tener al menos 8 caracteres." };
  const h = hash(token);
  const user = listAllUsers().find((u) => u.passwordResetTokenHash === h);
  if (!user || !user.passwordResetExpiresAt || Date.parse(user.passwordResetExpiresAt) < Date.now()) {
    return { ok: false, error: "El enlace no es válido o ya venció." };
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    return { ok: false, error: "La contraseña nueva debe ser distinta a la anterior." };
  }
  updateUserAuth(user.id, {
    passwordHash: await bcrypt.hash(newPassword, 11),
    passwordChangedAt: new Date().toISOString(),
    passwordResetTokenHash: undefined,
    passwordResetExpiresAt: undefined,
    mustChangePassword: undefined,
    ...(user.provisionedBy && !user.claimedAt ? { claimedAt: new Date().toISOString() } : {}),
  });
  void notifyPasswordChanged({ email: user.email, fullName: user.fullName, viaReset: true });
  return { ok: true };
}
