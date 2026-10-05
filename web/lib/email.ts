import "server-only";
import nodemailer from "nodemailer";
import { getMailboxAuth, markMailboxError, markMailboxOk, type MailboxId } from "@/lib/mailboxes-store";
import { isLang, makeT, type Lang, type TFn } from "@/lib/i18n";
import { NOREPLY_EMAIL, SUPPORT_EMAIL, SUPPORT_FROM } from "@/lib/support-contact";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Por defecto support@: las respuestas de los usuarios llegan al buzón de soporte. */
  replyTo?: string;
  /** Buzón preferido. Si no está conectado sale por el otro buzón conectado. */
  mailbox?: MailboxId;
  /** Sólo ese buzón, sin respaldo (para probar que un buzón en concreto funciona). */
  strict?: boolean;
};

function envFromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || SUPPORT_FROM;
}

type SmtpAuth = { host: string; port: number; secure: boolean; user?: string; pass?: string };

function envSmtp(): SmtpAuth | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT) || 465;
  return {
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    user: process.env.SMTP_USER?.trim(),
    pass: process.env.SMTP_PASS ?? "",
  };
}

export function smtpForMailbox(id: MailboxId): { auth: SmtpAuth; from: string } | null {
  const box = getMailboxAuth(id);
  if (box) {
    return {
      auth: { host: box.host, port: box.port, secure: box.secure, user: box.user, pass: box.pass },
      from: `Cabibee <${box.email}>`,
    };
  }
  if (id === "noreply") {
    const env = envSmtp();
    if (env) return { auth: env, from: envFromAddress() };
  }
  return null;
}

export async function verifySmtpAuth(auth: SmtpAuth): Promise<{ ok: true } | { ok: false; error: string }> {
  const transport = nodemailer.createTransport({
    host: auth.host,
    port: auth.port,
    secure: auth.secure,
    auth: auth.user ? { user: auth.user, pass: auth.pass ?? "" } : undefined,
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 15_000,
  });
  try {
    await transport.verify();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo conectar.";
    return { ok: false, error: msg };
  } finally {
    transport.close();
  }
}

async function sendWithSmtp(auth: SmtpAuth, msg: EmailMessage, from: string): Promise<boolean> {
  const transport = nodemailer.createTransport({
    host: auth.host,
    port: auth.port,
    secure: auth.secure,
    auth: auth.user ? { user: auth.user, pass: auth.pass ?? "" } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  try {
    await transport.sendMail({
      from,
      to: msg.to,
      replyTo: msg.replyTo || SUPPORT_EMAIL,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
    return true;
  } finally {
    transport.close();
  }
}

async function sendWithResend(msg: EmailMessage, from: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from,
      to: [msg.to],
      reply_to: msg.replyTo || SUPPORT_EMAIL,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) console.warn("[email] Resend respondió", res.status, await res.text().catch(() => ""));
  return res.ok;
}

async function trySmtp(id: MailboxId, auth: SmtpAuth, from: string, msg: EmailMessage): Promise<boolean> {
  try {
    const ok = await sendWithSmtp(auth, msg, from);
    if (ok) markMailboxOk(id);
    return ok;
  } catch (e) {
    const err = e instanceof Error ? e.message : "SMTP falló";
    console.warn(`[email] SMTP (${id}) falló:`, err);
    markMailboxError(id, err);
    return false;
  }
}

/**
 * Correo transaccional. Primero el buzón conectado en /admin/correo;
 * si no, SMTP del entorno; si no, Resend. Sin ninguno el texto queda en el log.
 */
export async function sendEmail(opts: EmailMessage): Promise<boolean> {
  const mailbox: MailboxId = opts.mailbox ?? "noreply";
  if (opts.strict) {
    const box = getMailboxAuth(mailbox);
    if (!box) return false;
    return trySmtp(mailbox, { host: box.host, port: box.port, secure: box.secure, user: box.user, pass: box.pass }, `Cabibee <${box.email}>`, opts);
  }

  const order: MailboxId[] = mailbox === "noreply" ? ["noreply", "support"] : ["support", "noreply"];
  for (const id of order) {
    const wired = smtpForMailbox(id);
    if (wired && (await trySmtp(id, wired.auth, wired.from, opts))) return true;
  }

  if (await sendWithResend(opts, envFromAddress()).catch(() => false)) return true;
  if (!process.env.RESEND_API_KEY?.trim()) {
    console.info(`[email] Sin buzón conectado. Para ${opts.to}: ${opts.subject}\n${opts.text}`);
  }
  return false;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Idioma de los correos de un usuario: el último con el que usó el sitio. */
export function userLang(user: { lang?: string } | null | undefined, fallback: Lang = "es"): Lang {
  const lang = user?.lang;
  return isLang(lang) ? lang : fallback;
}

export function emailT(lang: Lang): TFn {
  return makeT(lang);
}

/** Plantilla común: título, párrafos y botón opcional. Los textos ya deben venir escapados. */
export function emailLayout(opts: {
  title: string;
  paragraphs: string[];
  button?: { href: string; label: string };
  lang?: Lang;
}): string {
  const t = makeT(opts.lang ?? "es");
  const body = opts.paragraphs.map((p) => `<p style="margin:0 0 14px">${p}</p>`).join("");
  const button = opts.button
    ? `<p style="margin:22px 0"><a href="${opts.button.href}" style="background:#dcb81e;color:#000;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600">${opts.button.label}</a></p>`
    : "";
  return `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:520px">
<h2 style="font-size:20px;margin:0 0 16px">${opts.title}</h2>${body}${button}
<p style="margin:24px 0 0;font-size:12px;color:#888">Cabibee · ${SUPPORT_EMAIL}</p>
<p style="margin:6px 0 0;font-size:11px;color:#aaa">${t("Este aviso lo manda {from}. Si contestas, te leemos en {support}.", { from: NOREPLY_EMAIL, support: SUPPORT_EMAIL })}</p></div>`;
}
