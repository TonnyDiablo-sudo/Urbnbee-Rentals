import "server-only";
import { isPlaceholderEmail } from "@/lib/associate-provision";
import { emailLayout, emailT, escapeHtml, sendEmail } from "@/lib/email";
import type { Lang } from "@/lib/i18n";
import { SUPPORT_EMAIL } from "@/lib/support-contact";

const NOT_YOU = "Si no fuiste tú, escríbenos de inmediato a {support} para proteger tu cuenta.";

function realEmail(email: string | undefined): email is string {
  return Boolean(email) && !isPlaceholderEmail(email!);
}

/** Aviso al correo anterior: si alguien tomó la cuenta, el dueño se entera. */
export async function notifyEmailChanged(opts: { oldEmail: string; newEmail: string; fullName: string; lang?: Lang }) {
  if (!realEmail(opts.oldEmail)) return false;
  const lang = opts.lang ?? "es";
  const t = emailT(lang);
  const masked = opts.newEmail.replace(/^(.{2}).*(@.*)$/, "$1•••$2");
  const notYou = t(NOT_YOU, { support: SUPPORT_EMAIL });
  return sendEmail({
    mailbox: "noreply",
    to: opts.oldEmail,
    subject: t("Cambiaron el correo de tu cuenta Cabibee"),
    text: `${t("Hola {name},", { name: opts.fullName })} ${t("El correo para entrar a tu cuenta de Cabibee ahora es {email}. Este correo ya no sirve para iniciar sesión.", { email: masked })} ${notYou}`,
    html: emailLayout({
      lang,
      title: t("Cambió el correo de tu cuenta"),
      paragraphs: [
        t("Hola {name},", { name: escapeHtml(opts.fullName) }),
        t("El correo para entrar a tu cuenta de Cabibee ahora es {email}. Este correo ya no sirve para iniciar sesión.", {
          email: `<b>${escapeHtml(masked)}</b>`,
        }),
        notYou,
      ],
    }),
  });
}

export async function notifyPasswordChanged(opts: { email: string; fullName: string; viaReset?: boolean; lang?: Lang }) {
  if (!realEmail(opts.email)) return false;
  const lang = opts.lang ?? "es";
  const t = emailT(lang);
  const body = opts.viaReset
    ? t("La contraseña de tu cuenta de Cabibee se cambió con el enlace de recuperación. Cerramos las sesiones abiertas en otros dispositivos.")
    : t("La contraseña de tu cuenta de Cabibee se cambió desde tu cuenta. Cerramos las sesiones abiertas en otros dispositivos.");
  const notYou = t(NOT_YOU, { support: SUPPORT_EMAIL });
  return sendEmail({
    mailbox: "noreply",
    to: opts.email,
    subject: t("Tu contraseña de Cabibee cambió"),
    text: `${t("Hola {name},", { name: opts.fullName })} ${body} ${notYou}`,
    html: emailLayout({
      lang,
      title: t("Tu contraseña cambió"),
      paragraphs: [t("Hola {name},", { name: escapeHtml(opts.fullName) }), body, notYou],
    }),
  });
}
