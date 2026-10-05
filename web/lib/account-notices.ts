import "server-only";
import { isPlaceholderEmail } from "@/lib/associate-provision";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { SUPPORT_EMAIL } from "@/lib/support-contact";

const NOT_YOU = `Si no fuiste tú, escríbenos de inmediato a ${SUPPORT_EMAIL} para proteger tu cuenta.`;

function realEmail(email: string | undefined): email is string {
  return Boolean(email) && !isPlaceholderEmail(email!);
}

/** Aviso al correo anterior: si alguien tomó la cuenta, el dueño se entera. */
export async function notifyEmailChanged(opts: { oldEmail: string; newEmail: string; fullName: string }) {
  if (!realEmail(opts.oldEmail)) return false;
  const masked = opts.newEmail.replace(/^(.{2}).*(@.*)$/, "$1•••$2");
  return sendEmail({
    mailbox: "noreply",
    to: opts.oldEmail,
    subject: "Cambiaron el correo de tu cuenta Cabibee",
    text: `Hola ${opts.fullName}, el correo de tu cuenta de Cabibee cambió a ${masked}. ${NOT_YOU}`,
    html: emailLayout({
      title: "Cambió el correo de tu cuenta",
      paragraphs: [
        `Hola ${escapeHtml(opts.fullName)},`,
        `El correo para entrar a tu cuenta de Cabibee ahora es <b>${escapeHtml(masked)}</b>. Este correo ya no sirve para iniciar sesión.`,
        NOT_YOU,
      ],
    }),
  });
}

export async function notifyPasswordChanged(opts: { email: string; fullName: string; viaReset?: boolean }) {
  if (!realEmail(opts.email)) return false;
  const how = opts.viaReset ? "con el enlace de recuperación" : "desde tu cuenta";
  return sendEmail({
    mailbox: "noreply",
    to: opts.email,
    subject: "Tu contraseña de Cabibee cambió",
    text: `Hola ${opts.fullName}, la contraseña de tu cuenta de Cabibee se cambió ${how}. Cerramos las sesiones abiertas en otros dispositivos. ${NOT_YOU}`,
    html: emailLayout({
      title: "Tu contraseña cambió",
      paragraphs: [
        `Hola ${escapeHtml(opts.fullName)},`,
        `La contraseña de tu cuenta de Cabibee se cambió ${how}. Cerramos las sesiones abiertas en otros dispositivos.`,
        NOT_YOU,
      ],
    }),
  });
}
