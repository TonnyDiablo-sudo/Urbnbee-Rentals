import "server-only";
import { createHash, randomBytes } from "crypto";
import { emailLayout, emailT, escapeHtml, sendEmail, userLang } from "@/lib/email";
import { SUPPORT_EMAIL } from "@/lib/support-contact";
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
  const lang = userLang(user);
  const t = emailT(lang);
  const ignore = t("El enlace vence en 48 horas. Si no abriste una cuenta, ignora este correo o escríbenos a {support}.", {
    support: SUPPORT_EMAIL,
  });
  return sendEmail({
    mailbox: "noreply",
    to: user.email,
    subject: t("Confirma tu correo en Cabibee"),
    text: `${t("Hola {name},", { name: user.fullName })} ${t("Confirma tu correo para asegurar tu cuenta de Cabibee. Con él podrás recuperar tu contraseña si la olvidas.")}\n${link}\n\n${ignore}`,
    html: emailLayout({
      lang,
      title: t("Confirma tu correo"),
      paragraphs: [
        t("Hola {name},", { name: escapeHtml(user.fullName) }),
        t("Confirma tu correo para asegurar tu cuenta de Cabibee. Con él podrás recuperar tu contraseña si la olvidas."),
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
  updateUserAuth(user.id, {
    emailVerifiedAt: new Date().toISOString(),
    emailVerifyTokenHash: undefined,
    emailVerifyExpiresAt: undefined,
  });
  return true;
}
