import "server-only";
import { isFacebookUrl } from "@/lib/associate-link-utils";
import {
  addOutreachSend,
  ensureOutreach,
  findOutreachByToken,
  getOutreach,
  listOutreach,
  outreachPassword,
  updateOutreach,
  type OutreachChannel,
  type OutreachManualStatus,
  type OutreachRecord,
} from "@/lib/associate-outreach-store";
import { associateCanManageHost, isPlaceholderEmail, loginNameFor, resetTempPassword } from "@/lib/associate-provision";
import { mxDay } from "@/lib/associate-stats";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import {
  findUserById,
  getHostProfile,
  listAllUsers,
  listListingsForHost,
  listUsersProvisionedBy,
  updateListing,
} from "@/lib/marketplace-store";
import type { UserRecord } from "@/lib/marketplace-types";

/**
 * Topes por asociado y por día, y espera mínima entre mensajes. WhatsApp y Facebook bloquean
 * números y perfiles que mandan muchos mensajes iguales a desconocidos en poco tiempo.
 */
export const OUTREACH_RULES: Record<OutreachChannel, { perDay: number; minGapSec: number }> = {
  whatsapp: { perDay: 25, minGapSec: 45 },
  messenger: { perDay: 20, minGapSec: 60 },
  email: { perDay: 80, minGapSec: 8 },
  whatsapp_api: { perDay: 200, minGapSec: 5 },
};

/** A un mismo dueño no se le repite el mensaje por el mismo canal antes de esto. */
const RESEND_AFTER_MS = 48 * 3600_000;

export type OutreachState = OutreachManualStatus | "reclamo";

export type OutreachRow = {
  hostId: string;
  hostName: string;
  associateId: string;
  associateName?: string;
  createdAt: string;
  login: string;
  listings: { title: string; slug: string }[];
  phone?: string;
  whatsapp?: string;
  email?: string;
  facebookUrl?: string;
  state: OutreachState;
  lastSent: Partial<Record<OutreachChannel, string>>;
};

export function whatsappApiConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_CLOUD_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() && process.env.WHATSAPP_TEMPLATE_NAME?.trim()
  );
}

function contactOf(host: UserRecord) {
  const p = getHostProfile(host.id);
  const email = p?.email || (!isPlaceholderEmail(host.email) ? host.email : undefined);
  return {
    phone: p?.phone,
    whatsapp: p?.whatsapp || p?.phone,
    email: email || undefined,
    facebookUrl: p?.airbnbUrl && isFacebookUrl(p.airbnbUrl) ? p.airbnbUrl : undefined,
  };
}

/** Número para wa.me: México sin lada de país se completa con 52. */
export function waNumber(raw: string | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 10) return `52${d}`;
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

function stateOf(host: UserRecord, rec: OutreachRecord | undefined): OutreachState {
  if (host.claimedAt) return "reclamo";
  if (rec?.optedOutAt) return "no_quiere";
  return rec?.status ?? "pendiente";
}

function lastSentByChannel(rec: OutreachRecord | undefined): Partial<Record<OutreachChannel, string>> {
  const out: Partial<Record<OutreachChannel, string>> = {};
  for (const s of rec?.sends ?? []) if (s.ok) out[s.channel] = s.at;
  return out;
}

function hostsFor(viewer: UserRecord): UserRecord[] {
  return viewer.role === "admin" ? listAllUsers().filter((u) => u.provisionedBy) : listUsersProvisionedBy(viewer.id);
}

export function outreachRows(viewer: UserRecord): OutreachRow[] {
  const names = new Map<string, string | undefined>();
  return hostsFor(viewer).map((host) => {
    const rec = getOutreach(host.id);
    const by = host.provisionedBy!;
    if (!names.has(by)) names.set(by, findUserById(by)?.fullName);
    return {
      hostId: host.id,
      hostName: host.fullName,
      associateId: by,
      associateName: names.get(by),
      createdAt: host.createdAt,
      login: loginNameFor(host.email),
      listings: listListingsForHost(host.id)
        .filter((l) => l.published)
        .map((l) => ({ title: l.title, slug: l.slug })),
      ...contactOf(host),
      state: stateOf(host, rec),
      lastSent: lastSentByChannel(rec),
    };
  });
}

/** Cuántos lleva hoy el asociado por ese canal y cuántos segundos le faltan para poder mandar otro. */
export function outreachQuota(associateId: string, channel: OutreachChannel, now = Date.now()) {
  const today = mxDay(new Date(now));
  let used = 0;
  let last = 0;
  for (const rec of listOutreach()) {
    for (const s of rec.sends) {
      if (s.by !== associateId || s.channel !== channel || !s.ok) continue;
      const at = new Date(s.at).getTime();
      if (mxDay(s.at) === today) used++;
      if (at > last) last = at;
    }
  }
  const rule = OUTREACH_RULES[channel];
  const waitSec = last ? Math.max(0, Math.ceil(rule.minGapSec - (now - last) / 1000)) : 0;
  return { used, perDay: rule.perDay, remaining: Math.max(0, rule.perDay - used), waitSec, minGapSec: rule.minGapSec };
}

async function credentialsFor(associate: UserRecord, host: UserRecord, rec: OutreachRecord) {
  const login = loginNameFor(host.email);
  // Si el dueño ya puso su propia contraseña no se la cambiamos.
  if (!host.mustChangePassword) return { login, password: null };
  const saved = outreachPassword(rec);
  if (saved) return { login, password: saved };
  // Cuentas creadas antes de guardar la contraseña: se genera una nueva (la anterior deja de servir).
  const reset = await resetTempPassword(associate, host.id);
  return { login, password: reset.ok ? reset.password : null };
}

type MessageParts = {
  hostName: string;
  associateName: string;
  listings: { title: string; url: string }[];
  loginUrl: string;
  login: string;
  password: string | null;
  optOutUrl: string;
};

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function buildOutreachText(m: MessageParts): string {
  const [first, ...more] = m.listings;
  const lines = [
    `Hola ${firstName(m.hostName)}, soy ${firstName(m.associateName)} de Cabibee.`,
    first
      ? `Publicamos gratis tu anuncio «${first.title}» en Cabibee para que más huéspedes te encuentren: ${first.url}`
      : "Te creamos gratis una cuenta en Cabibee para que más huéspedes te encuentren.",
    ...(more.length ? [`También: ${more.map((l) => l.url).join(" ")}`] : []),
    "",
    `Tu cuenta ya está lista para que tú lo administres (precio, fotos, fechas): ${m.loginUrl}`,
    `Usuario: ${m.login}`,
    m.password ? `Contraseña temporal: ${m.password} (te pedirá cambiarla)` : "Si no recuerdas tu contraseña, usa «¿Olvidaste tu contraseña?».",
    "",
    `Si no quieres aparecer en Cabibee, contesta BAJA o entra aquí y lo quitamos: ${m.optOutUrl}`,
  ];
  return lines.join("\n");
}

function buildOutreachEmail(m: MessageParts): { subject: string; html: string } {
  const [first] = m.listings;
  const html = emailLayout({
    title: "Publicamos tu anuncio en Cabibee",
    paragraphs: [
      `Hola ${escapeHtml(firstName(m.hostName))}, soy ${escapeHtml(firstName(m.associateName))} de Cabibee.`,
      first
        ? `Publicamos gratis tu anuncio <a href="${escapeHtml(first.url)}">«${escapeHtml(first.title)}»</a> para que más huéspedes te encuentren.`
        : "Te creamos gratis una cuenta en Cabibee para que más huéspedes te encuentren.",
      ...m.listings.slice(1).map((l) => `También: <a href="${escapeHtml(l.url)}">${escapeHtml(l.title)}</a>`),
      `Tu cuenta ya está lista para que tú lo administres (precio, fotos, fechas).<br>Usuario: <b>${escapeHtml(m.login)}</b>${
        m.password ? `<br>Contraseña temporal: <b>${escapeHtml(m.password)}</b> (te pedirá cambiarla)` : ""
      }`,
      `<span style="font-size:13px;color:#666">Si no quieres aparecer en Cabibee, <a href="${escapeHtml(m.optOutUrl)}">quítalo aquí</a> con un clic.</span>`,
    ],
    button: { href: m.loginUrl, label: "Entrar a mi cuenta" },
  });
  return { subject: first ? `Tu anuncio «${first.title}» ya está en Cabibee` : "Tu cuenta en Cabibee está lista", html };
}

async function sendWhatsappTemplate(to: string, params: string[]): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.WHATSAPP_CLOUD_TOKEN!.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!.trim();
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE_NAME!.trim(),
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG?.trim() || "es_MX" },
          components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text: text.replace(/\s+/g, " ").slice(0, 900) })) }],
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    return { ok: false, error: data.error?.message || `WhatsApp respondió ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sin conexión con WhatsApp" };
  }
}

export type OutreachSendResult =
  | { ok: true; channel: OutreachChannel; message: string; url?: string; quota: ReturnType<typeof outreachQuota> }
  | { ok: false; error: string; status: number; waitSec?: number; code?: "sent_recently" };

const CHANNEL_LABEL: Record<OutreachChannel, string> = {
  whatsapp: "WhatsApp",
  whatsapp_api: "WhatsApp Business",
  messenger: "Messenger",
  email: "correo",
};

/**
 * Prepara (y en correo y WhatsApp Business, manda) el aviso «te creamos tu anuncio».
 * En WhatsApp y Messenger con clic sólo regresa el texto y el enlace: el asociado lo manda desde su teléfono.
 */
export async function sendOutreach(
  viewer: UserRecord,
  hostId: string,
  channel: OutreachChannel,
  origin: string,
  opts: { force?: boolean } = {}
): Promise<OutreachSendResult> {
  const host = findUserById(hostId);
  if (!host?.provisionedBy || (viewer.role !== "admin" && host.provisionedBy !== viewer.id)) {
    return { ok: false, error: "Esa cuenta no es tuya.", status: 404 };
  }
  const rec = ensureOutreach(host.id, host.provisionedBy);
  const state = stateOf(host, rec);
  if (state === "reclamo") return { ok: false, error: "El dueño ya entró a su cuenta; no hace falta avisarle.", status: 409 };
  if (state === "no_quiere") return { ok: false, error: "El dueño pidió que no le escribamos.", status: 409 };
  if (!associateCanManageHost(viewer, host)) return { ok: false, error: "Esa cuenta no es tuya.", status: 404 };

  if (channel === "whatsapp_api" && !whatsappApiConfigured()) {
    return { ok: false, error: "WhatsApp Business todavía no está configurado en el servidor.", status: 400 };
  }
  const contact = contactOf(host);
  const wa = waNumber(contact.whatsapp);
  if ((channel === "whatsapp" || channel === "whatsapp_api") && !wa) return { ok: false, error: "No tiene WhatsApp.", status: 400 };
  if (channel === "messenger" && !contact.facebookUrl) return { ok: false, error: "No tiene enlace de Facebook.", status: 400 };
  if (channel === "email" && !contact.email) return { ok: false, error: "No tiene correo.", status: 400 };

  const quota = outreachQuota(viewer.id, channel);
  if (quota.remaining <= 0) {
    return { ok: false, error: `Ya mandaste ${quota.perDay} avisos por ${CHANNEL_LABEL[channel]} hoy. Sigue mañana para que no te bloqueen.`, status: 429 };
  }
  if (quota.waitSec > 0) {
    return { ok: false, error: `Espera ${quota.waitSec} s antes del siguiente por ${CHANNEL_LABEL[channel]}.`, status: 429, waitSec: quota.waitSec };
  }
  const last = lastSentByChannel(rec)[channel];
  if (last && !opts.force && Date.now() - new Date(last).getTime() < RESEND_AFTER_MS) {
    return { ok: false, error: `Ya le avisaste por ${CHANNEL_LABEL[channel]} hace menos de 2 días.`, status: 409, code: "sent_recently" };
  }

  const creds = await credentialsFor(viewer, host, getOutreach(host.id) ?? rec);
  const listings = listListingsForHost(host.id)
    .filter((l) => l.published)
    .map((l) => ({ title: l.title, url: `${origin}/listings/${l.slug}` }));
  const associate = findUserById(host.provisionedBy) ?? viewer;
  const parts: MessageParts = {
    hostName: host.fullName,
    associateName: associate.fullName,
    listings,
    loginUrl: `${origin}/login`,
    login: creds.login,
    password: creds.password,
    optOutUrl: `${origin}/baja/${rec.optOutToken}`,
  };
  const message = buildOutreachText(parts);
  const at = new Date().toISOString();

  if (channel === "whatsapp" || channel === "messenger") {
    addOutreachSend(host.id, { channel, at, by: viewer.id, ok: true });
    const url = channel === "whatsapp" ? `https://wa.me/${wa}?text=${encodeURIComponent(message)}` : contact.facebookUrl;
    return { ok: true, channel, message, url, quota: outreachQuota(viewer.id, channel) };
  }

  if (channel === "email") {
    const { subject, html } = buildOutreachEmail(parts);
    const sent = await sendEmail({ to: contact.email!, subject, html, text: message, mailbox: "support" });
    addOutreachSend(host.id, { channel, at, by: viewer.id, ok: sent, ...(sent ? {} : { error: "no se pudo mandar" }) });
    if (!sent) return { ok: false, error: "No se pudo mandar el correo. Revisa el buzón en Admin → Correo.", status: 502 };
    return { ok: true, channel, message, quota: outreachQuota(viewer.id, channel) };
  }

  const first = listings[0];
  const res = await sendWhatsappTemplate(wa!, [
    firstName(host.fullName),
    first?.url ?? `${origin}/login`,
    creds.login,
    creds.password ?? "la que ya pusiste",
  ]);
  addOutreachSend(host.id, { channel, at, by: viewer.id, ok: res.ok, ...(res.error ? { error: res.error.slice(0, 300) } : {}) });
  if (!res.ok) return { ok: false, error: `WhatsApp Business no lo mandó: ${res.error}`, status: 502 };
  return { ok: true, channel, message, quota: outreachQuota(viewer.id, channel) };
}

function unpublishHost(hostId: string) {
  for (const l of listListingsForHost(hostId)) if (l.published) updateListing(l.id, hostId, { published: false });
}

export function setOutreachStatus(viewer: UserRecord, hostId: string, status: OutreachManualStatus): { ok: boolean; error?: string } {
  const host = findUserById(hostId);
  if (!host?.provisionedBy || (viewer.role !== "admin" && host.provisionedBy !== viewer.id)) return { ok: false, error: "Esa cuenta no es tuya." };
  ensureOutreach(host.id, host.provisionedBy);
  updateOutreach(host.id, { status });
  // Si el dueño dijo que no, su anuncio deja de verse (siempre que no haya tomado su cuenta).
  if (status === "no_quiere" && !host.claimedAt) unpublishHost(host.id);
  return { ok: true };
}

/** El dueño pide la baja desde el enlace del mensaje. */
export function optOutByToken(token: string): { ok: boolean; hostName?: string } {
  const rec = findOutreachByToken(token);
  const host = rec ? findUserById(rec.hostId) : undefined;
  if (!rec || !host) return { ok: false };
  if (!rec.optedOutAt) updateOutreach(rec.hostId, { optedOutAt: new Date().toISOString(), status: "no_quiere" });
  if (!host.claimedAt) unpublishHost(host.id);
  return { ok: true, hostName: host.fullName };
}
