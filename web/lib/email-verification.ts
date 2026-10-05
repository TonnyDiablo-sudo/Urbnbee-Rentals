import "server-only";
import { createHash, randomBytes } from "crypto";
import { notifyEmailChanged } from "@/lib/account-notices";
import { isPlaceholderEmail } from "@/lib/associate-provision";
import { emailLayout, emailT, escapeHtml, sendEmail, userLang } from "@/lib/email";
import { SUPPORT_EMAIL } from "@/lib/support-contact";
import {
  findUserByEmail,
  findUserById,
  getHostProfile,
  listAllUsers,
  updateUserAuth,
  upsertHostProfile,
} from "@/lib/marketplace-store";

const TTL_MS = 48 * 60 * 60 * 1000;

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Manda el enlace de confirmación. Si hay un cambio de correo pendiente, va al correo nuevo
 * y al confirmarlo se hace el cambio.
 */
export async function sendVerificationEmail(userId: string, origin: string): Promise<boolean> {
  const user = findUserById(userId);
  if (!user) return false;
  const to = user.pendingEmail ?? (user.placeholderEmail ? null : user.email);
  if (!to) return false;
  const changing = Boolean(user.pendingEmail);
  const token = randomBytes(24).toString("hex");
  updateUserAuth(userId, {
    emailVerifyTokenHash: hash(token),
    emailVerifyExpiresAt: new Date(Date.now() + TTL_MS).toISOString(),
  });
  const link = `${origin}/api/account/verify-email?token=${token}`;
  const lang = userLang(user);
  const t = emailT(lang);
  const ignore = changing
    ? t("El enlace vence en 48 horas. Si tú no pediste este cambio, ignora este correo: tu cuenta sigue con el correo de antes. Dudas: {support}.", {
        support: SUPPORT_EMAIL,
      })
    : t("El enlace vence en 48 horas. Si no abriste una cuenta, ignora este correo o escríbenos a {support}.", {
        support: SUPPORT_EMAIL,
      });
  const body = changing
    ? t("Pediste usar este correo en tu cuenta de Cabibee. Confírmalo para terminar el cambio; hasta entonces seguimos usando el anterior.")
    : t("Confirma tu correo para asegurar tu cuenta de Cabibee. Con él podrás recuperar tu contraseña si la olvidas.");
  const inbox = t("Si este correo te llegó a spam, márcalo como «No es spam» o muévelo a tu bandeja de entrada para que los próximos avisos de Cabibee te lleguen directo.");
  return sendEmail({
    mailbox: "noreply",
    to,
    subject: changing ? t("Confirma tu nuevo correo en Cabibee") : t("Confirma tu correo en Cabibee"),
    text: `${t("Hola {name},", { name: user.fullName })} ${body}\n${link}\n\n${inbox}\n\n${ignore}`,
    html: emailLayout({
      lang,
      title: changing ? t("Confirma tu nuevo correo") : t("Confirma tu correo"),
      paragraphs: [
        t("Hola {name},", { name: escapeHtml(user.fullName) }),
        body,
        `<span style="color:#888">${inbox}</span>`,
        `<span style="color:#888">${ignore}</span>`,
      ],
      button: { href: link, label: t("Confirmar mi correo") },
    }),
  });
}

export function consumeVerificationToken(token: string): boolean {
  if (!/^[a-f0-9]{48}$/.test(token)) return false;
  const h = hash(token);
  const user = listAllUsers().find((u) => u.emailVerifyTokenHash === h);
  if (!user || !user.emailVerifyExpiresAt || new Date(user.emailVerifyExpiresAt).getTime() < Date.now()) return false;
  const done = {
    emailVerifiedAt: new Date().toISOString(),
    emailVerifyTokenHash: undefined,
    emailVerifyExpiresAt: undefined,
  };
  const next = user.pendingEmail;
  if (!next) {
    updateUserAuth(user.id, done);
    return true;
  }
  const owner = findUserByEmail(next);
  if (owner && owner.id !== user.id) {
    updateUserAuth(user.id, { pendingEmail: undefined, emailVerifyTokenHash: undefined, emailVerifyExpiresAt: undefined });
    return false;
  }
  const oldEmail = user.email;
  let updated;
  try {
    updated = updateUserAuth(user.id, {
      ...done,
      email: next,
      pendingEmail: undefined,
      placeholderEmail: undefined,
      passwordResetTokenHash: undefined,
      passwordResetExpiresAt: undefined,
    });
  } catch {
    return false;
  }
  if (!updated) return false;
  const profile = getHostProfile(user.id);
  if (!profile?.email || profile.email === oldEmail || isPlaceholderEmail(profile.email)) {
    upsertHostProfile(user.id, { email: next });
  }
  if (!isPlaceholderEmail(oldEmail)) {
    void notifyEmailChanged({ oldEmail, newEmail: next, fullName: updated.fullName, lang: userLang(updated) });
  }
  return true;
}
