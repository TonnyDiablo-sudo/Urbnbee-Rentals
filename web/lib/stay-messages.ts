import "server-only";
import { isPlaceholderEmail } from "@/lib/associate-provision";
import { arrivalMessageVars, fillArrivalTemplate } from "@/lib/arrival-message-template";
import { bridgeChatMessage } from "@/lib/beeagent-chat-bridge";
import { applyBookingLifecycle } from "@/lib/booking-deposit";
import { listingHasEngine } from "@/lib/booking-engine-slots";
import type { BookingRecord } from "@/lib/booking-types";
import { getBookingById, listAllBookings, patchBookingRecord } from "@/lib/bookings-store";
import { copyIntoChat, isAttachmentFileName, mimeOfAttachmentFile, prepareAttachment } from "@/lib/chat-attachments";
import { publicNameOf } from "@/lib/display-name";
import { emailLayout, emailT, escapeHtml, sendEmail, userLang } from "@/lib/email";
import type { ChatAttachment } from "@/lib/host-inbox-types";
import { appendMessage, guestSessionIdForUser } from "@/lib/host-inbox-store";
import { listingFullAddress } from "@/lib/listing-address";
import { pricingToday } from "@/lib/listing-pricing";
import { findUserById, getListingById } from "@/lib/marketplace-store";
import type { HostListingRecord } from "@/lib/marketplace-types";
import { getPrivateFile, putPrivateFile } from "@/lib/private-files";
import { notifyGuestHostReply } from "@/lib/push";
import {
  STAY_AUTO_FROM_HOUR,
  STAY_KIND_LABEL,
  STAY_MESSAGE_MAX,
  dueStayMessages,
  stayDayDiff,
  stayMessagesOf,
  stayRuleByKey,
} from "@/lib/stay-messages-template";

const RESEND_COOLDOWN_MS = 2 * 60 * 1000;
const SEGMENT = /^[A-Za-z0-9_-]{1,100}$/;

function fileKey(listingId: string, file: string): string {
  if (!SEGMENT.test(listingId) || !isAttachmentFileName(file)) throw new Error("bad key");
  return `staymsg/${listingId}/${file}`;
}

/** Foto o audio de la plantilla de un anuncio (todavía no va a ningún chat). */
export async function storeStayMessageFile(opts: {
  listingId: string;
  data: Buffer;
  mime: string;
  durationSec?: number;
}): Promise<{ attachment?: ChatAttachment; error?: string }> {
  const prepared = await prepareAttachment(opts);
  if ("error" in prepared) return { error: prepared.error };
  await putPrivateFile(fileKey(opts.listingId, prepared.attachment.file), prepared.data, prepared.attachment.mime);
  return { attachment: prepared.attachment };
}

export async function readStayMessageFile(listingId: string, file: string): Promise<{ data: Buffer; mime: string } | null> {
  let key: string;
  try {
    key = fileKey(listingId, file);
  } catch {
    return null;
  }
  const data = await getPrivateFile(key);
  return data ? { data, mime: mimeOfAttachmentFile(file) } : null;
}

function stayListingOf(b: BookingRecord): HostListingRecord | undefined {
  return getListingById(b.hostAdjustedListingId ?? b.listingId);
}

function stayDates(b: BookingRecord): { checkIn: string; checkOut: string } {
  return { checkIn: b.hostAdjustedCheckIn ?? b.checkIn, checkOut: b.hostAdjustedCheckOut ?? b.checkOut };
}

function guestEmailOf(b: BookingRecord): string | null {
  const user = b.guestUserId ? findUserById(b.guestUserId) : undefined;
  const valid = (e: string | undefined) => {
    const v = (e ?? "").trim();
    return v && !isPlaceholderEmail(v) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : "";
  };
  return valid(b.guestEmail) || (user?.placeholderEmail ? "" : valid(user?.email)) || null;
}

/** Reserva confirmada (o recién terminada, para el de salida) del motor de reservas. */
function eligibility(b: BookingRecord, listing: HostListingRecord | undefined, today: string): string | null {
  const { checkOut } = stayDates(b);
  const live = b.status === "CONFIRMED" || (b.status === "COMPLETED" && stayDayDiff(checkOut, today) <= 1);
  if (!live) return "Sólo se manda con la reserva confirmada.";
  if (!listing || !listingHasEngine(listing)) return "Este anuncio no tiene el motor de reservas activo.";
  if (!b.guestUserId && !guestEmailOf(b)) return "No tenemos cómo contactar a este huésped.";
  return null;
}

export type StaySendResult =
  | { ok: true; sentAt: string; chat: boolean; emailed: boolean }
  | { ok: false; error: string; status: number };

/**
 * Manda un mensaje de la estancia por el chat (texto y luego cada foto o audio) y el texto por correo.
 * `ruleKey`: welcome | checkout | mid:<id>. `sendKey` es con lo que se marca como enviado.
 */
export async function sendStayMessage(
  bookingId: string,
  ruleKey: string,
  opts: { manual: boolean; sendKey?: string }
): Promise<StaySendResult> {
  const found = getBookingById(bookingId);
  if (!found) return { ok: false, error: "Reserva no encontrada.", status: 404 };
  const b = applyBookingLifecycle(found);
  const listing = stayListingOf(b);
  const today = pricingToday();
  const problem = eligibility(b, listing, today);
  if (problem || !listing) return { ok: false, error: problem ?? "Anuncio no encontrado.", status: 409 };
  const settings = stayMessagesOf(listing.stayMessages);
  const found2 = stayRuleByKey(settings, ruleKey);
  if (!found2 || !found2.rule.enabled) return { ok: false, error: "Ese mensaje está desactivado.", status: 409 };
  const { rule, kind } = found2;
  const sendKey = opts.sendKey ?? ruleKey;
  const sent = b.stayMessagesSent ?? {};
  if (!opts.manual && sent[sendKey]) return { ok: false, error: "Ya se mandó.", status: 409 };
  if (opts.manual && sent[ruleKey] && Date.now() - Date.parse(sent[ruleKey]) < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "Acabas de mandarlo. Espera un par de minutos para volver a enviarlo.", status: 429 };
  }

  const host = findUserById(b.hostId);
  const hostName = publicNameOf(host) || "Tu anfitrión";
  const { checkIn, checkOut } = stayDates(b);
  const text = fillArrivalTemplate(
    rule.text,
    arrivalMessageVars({
      guestName: b.guestName,
      listingTitle: listing.title,
      address: listingFullAddress(listing),
      checkIn,
      checkOut,
      guide: listing.arrivalGuide,
      hostName,
    })
  )
    .replace(/[<>]/g, "")
    .slice(0, STAY_MESSAGE_MAX);
  if (!text && rule.attachments.length === 0) return { ok: false, error: "El mensaje quedó vacío.", status: 400 };

  let chat = false;
  if (b.guestUserId) {
    const guestSessionId = guestSessionIdForUser(b.guestUserId);
    const post = (body: string, attachment?: ChatAttachment) => {
      const msg = appendMessage({ listingId: listing.id, hostId: listing.hostId, guestSessionId, sender: "host", guestName: "", body, attachment });
      bridgeChatMessage(msg);
    };
    if (text) post(text);
    for (const a of rule.attachments) {
      const src = await readStayMessageFile(listing.id, a.file).catch(() => null);
      if (!src) continue;
      const copy = await copyIntoChat({ listingId: listing.id, guestSessionId, data: src.data, attachment: a }).catch(() => null);
      if (copy) post("", copy);
    }
    notifyGuestHostReply({ listingId: listing.id, guestSessionId, body: text || (rule.attachments[0]?.kind === "audio" ? "🎤 Nota de voz" : "📷 Foto") });
    chat = true;
  }

  let emailed = false;
  const to = guestEmailOf(b);
  if (to && text) {
    const lang = userLang(b.guestUserId ? findUserById(b.guestUserId) : undefined);
    const tt = emailT(lang);
    const subject = `${tt(STAY_KIND_LABEL[kind])} · ${listing.title}`;
    const media = rule.attachments.length > 0 && chat ? [tt("Te dejamos fotos o audios en el chat de tu reserva en Cabibee.")] : [];
    emailed = await sendEmail({
      mailbox: "noreply",
      to,
      subject,
      text: [text, ...media].join("\n\n"),
      html: emailLayout({
        lang,
        title: escapeHtml(subject),
        paragraphs: [...text.split(/\n{2,}/).map((p) => escapeHtml(p).replace(/\n/g, "<br>")), ...media.map(escapeHtml)],
      }),
    }).catch(() => false);
  }

  const sentAt = new Date().toISOString();
  patchBookingRecord(b.id, { stayMessagesSent: { ...sent, [sendKey]: sentAt, [ruleKey]: sentAt } });
  return { ok: true, sentAt, chat, emailed };
}

/** Para la reservación: qué mensajes tiene activos el anuncio y cuándo salió cada uno. */
export function stayMessagesForBooking(b: BookingRecord): { key: string; kind: string; mode: string; everyDays?: number; sentAt?: string }[] {
  const listing = stayListingOf(b);
  if (!listing || !listingHasEngine(listing)) return [];
  const s = stayMessagesOf(listing.stayMessages);
  const sent = b.stayMessagesSent ?? {};
  const rows: { key: string; kind: string; mode: string; everyDays?: number; sentAt?: string }[] = [];
  if (s.welcome.enabled) rows.push({ key: "welcome", kind: "welcome", mode: s.welcome.mode, sentAt: sent.welcome });
  for (const m of s.mid) {
    if (m.enabled) rows.push({ key: `mid:${m.id}`, kind: "mid", mode: m.mode, everyDays: m.everyDays, sentAt: sent[`mid:${m.id}`] });
  }
  if (s.checkout.enabled) rows.push({ key: "checkout", kind: "checkout", mode: s.checkout.mode, sentAt: sent.checkout });
  return rows;
}

function mexicoHour(): number {
  return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Mexico_City" }).format(new Date()));
}

export async function sendDueStayMessages(today = pricingToday()): Promise<number> {
  if (mexicoHour() < STAY_AUTO_FROM_HOUR) return 0;
  let sent = 0;
  for (const raw of listAllBookings()) {
    if (raw.status !== "CONFIRMED" && raw.status !== "COMPLETED") continue;
    const listing = stayListingOf(raw);
    if (!listing?.stayMessages) continue;
    const { checkIn, checkOut } = stayDates(raw);
    for (const due of dueStayMessages(stayMessagesOf(listing.stayMessages), checkIn, checkOut, today)) {
      if (raw.stayMessagesSent?.[due.sendKey]) continue;
      const r = await sendStayMessage(raw.id, due.ruleKey, { manual: false, sendKey: due.sendKey });
      if (r.ok) sent++;
    }
  }
  return sent;
}

let started = false;
export function startStayMessageWorker() {
  if (started) return;
  started = true;
  const tick = () => {
    sendDueStayMessages().catch((e) => console.warn("[stay messages]", e));
  };
  setTimeout(tick, 90_000);
  setInterval(tick, 30 * 60 * 1000);
}
