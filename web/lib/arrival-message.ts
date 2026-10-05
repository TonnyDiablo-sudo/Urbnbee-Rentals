import "server-only";
import { isPlaceholderEmail } from "@/lib/associate-provision";
import {
  ARRIVAL_MESSAGE_MAX,
  arrivalMessageOf,
  arrivalMessageVars,
  fillArrivalTemplate,
} from "@/lib/arrival-message-template";
import { bridgeChatMessage } from "@/lib/beeagent-chat-bridge";
import { applyBookingLifecycle } from "@/lib/booking-deposit";
import { listingHasEngine } from "@/lib/booking-engine-slots";
import type { BookingRecord } from "@/lib/booking-types";
import { getBookingById, listAllBookings, patchBookingRecord } from "@/lib/bookings-store";
import { publicNameOf } from "@/lib/display-name";
import { emailLayout, emailT, escapeHtml, sendEmail, userLang } from "@/lib/email";
import { appendMessage, guestSessionIdForUser } from "@/lib/host-inbox-store";
import { listingFullAddress } from "@/lib/listing-address";
import { pricingToday } from "@/lib/listing-pricing";
import { findUserById, getListingById } from "@/lib/marketplace-store";
import type { HostListingRecord } from "@/lib/marketplace-types";
import { notifyGuestHostReply } from "@/lib/push";

export {
  ARRIVAL_PLACEHOLDERS,
  DEFAULT_ARRIVAL_TEMPLATE,
  defaultArrivalMessage,
} from "@/lib/arrival-message-template";

const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

function stayListingOf(b: BookingRecord): HostListingRecord | undefined {
  return getListingById(b.hostAdjustedListingId ?? b.listingId);
}

/** La dirección exacta va siempre: sólo se manda con la reserva confirmada. */
export function renderArrivalMessage(listing: HostListingRecord, booking: BookingRecord, hostName: string): string {
  const vars = arrivalMessageVars({
    guestName: booking.guestName,
    listingTitle: listing.title,
    address: listingFullAddress(listing),
    checkIn: booking.hostAdjustedCheckIn ?? booking.checkIn,
    checkOut: booking.hostAdjustedCheckOut ?? booking.checkOut,
    guide: listing.arrivalGuide,
    hostName,
  });
  return fillArrivalTemplate(arrivalMessageOf(listing.arrivalMessage).template, vars).slice(0, ARRIVAL_MESSAGE_MAX);
}

function guestEmailOf(b: BookingRecord): string | null {
  const user = b.guestUserId ? findUserById(b.guestUserId) : undefined;
  const valid = (e: string | undefined) => {
    const v = (e ?? "").trim();
    return v && !isPlaceholderEmail(v) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : "";
  };
  return valid(b.guestEmail) || (user?.placeholderEmail ? "" : valid(user?.email)) || null;
}

export type ArrivalSendResult =
  | { ok: true; sentAt: string; chat: boolean; emailed: boolean }
  | { ok: false; error: string; status: number };

/** Puede recibir el mensaje: reserva confirmada del motor de reservas. */
function eligibility(b: BookingRecord, listing: HostListingRecord | undefined): string | null {
  if (b.status !== "CONFIRMED") return "Sólo se manda con la reserva confirmada.";
  if (!listing || !listingHasEngine(listing)) return "Este anuncio no tiene el motor de reservas activo.";
  if (!b.guestUserId && !guestEmailOf(b)) return "No tenemos cómo contactar a este huésped.";
  return null;
}

/**
 * Manda los datos de llegada por el chat de la reserva y, si el huésped tiene correo real,
 * por correo. `manual`: lo pidió el anfitrión y puede repetirse; el automático va una sola vez.
 */
export async function sendArrivalMessage(bookingId: string, opts: { manual: boolean }): Promise<ArrivalSendResult> {
  const found = getBookingById(bookingId);
  if (!found) return { ok: false, error: "Reserva no encontrada.", status: 404 };
  const b = applyBookingLifecycle(found);
  const listing = stayListingOf(b);
  const problem = eligibility(b, listing);
  if (problem || !listing) return { ok: false, error: problem ?? "Anuncio no encontrado.", status: 409 };
  if (!opts.manual && b.arrivalMessageSentAt) {
    return { ok: false, error: "El mensaje de llegada ya se mandó.", status: 409 };
  }
  if (opts.manual && b.arrivalMessageSentAt && Date.now() - Date.parse(b.arrivalMessageSentAt) < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "Acabas de mandarlo. Espera un par de minutos para volver a enviarlo.", status: 429 };
  }

  const host = findUserById(b.hostId);
  const hostName = publicNameOf(host) || "Tu anfitrión";
  const text = renderArrivalMessage(listing, b, hostName).replace(/[<>]/g, "");
  if (!text) return { ok: false, error: "La plantilla quedó vacía.", status: 400 };

  let chat = false;
  if (b.guestUserId) {
    const guestSessionId = guestSessionIdForUser(b.guestUserId);
    const msg = appendMessage({
      listingId: listing.id,
      hostId: listing.hostId,
      guestSessionId,
      sender: "host",
      guestName: "",
      body: text,
    });
    bridgeChatMessage(msg);
    notifyGuestHostReply({ listingId: listing.id, guestSessionId, body: text });
    chat = true;
  }

  let emailed = false;
  const to = guestEmailOf(b);
  if (to) {
    const lang = userLang(b.guestUserId ? findUserById(b.guestUserId) : undefined);
    const subject = emailT(lang)("Datos de llegada · {listing}", { listing: listing.title });
    emailed = await sendEmail({
      mailbox: "noreply",
      to,
      subject,
      text,
      html: emailLayout({
        lang,
        title: escapeHtml(subject),
        paragraphs: text.split(/\n{2,}/).map((p) => escapeHtml(p).replace(/\n/g, "<br>")),
      }),
    }).catch(() => false);
  }

  const sentAt = new Date().toISOString();
  patchBookingRecord(b.id, { arrivalMessageSentAt: sentAt, arrivalMessageSentBy: opts.manual ? "host" : "auto" });
  return { ok: true, sentAt, chat, emailed };
}

function daysUntil(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split("-").map(Number);
  const [y2, m2, d2] = toIso.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Manda los mensajes automáticos cuya llegada ya está dentro de los días que eligió el anfitrión. */
export async function sendDueArrivalMessages(today = pricingToday()): Promise<number> {
  let sent = 0;
  for (const raw of listAllBookings()) {
    if (raw.arrivalMessageSentAt || raw.status !== "CONFIRMED") continue;
    const listing = stayListingOf(raw);
    if (!listing) continue;
    const settings = arrivalMessageOf(listing.arrivalMessage);
    if (settings.mode !== "auto") continue;
    const left = daysUntil(today, raw.hostAdjustedCheckIn ?? raw.checkIn);
    if (!Number.isFinite(left) || left < 0 || left > settings.daysBefore) continue;
    const r = await sendArrivalMessage(raw.id, { manual: false });
    if (r.ok) sent++;
  }
  return sent;
}

let started = false;
export function startArrivalMessageWorker() {
  if (started) return;
  started = true;
  const tick = () => {
    sendDueArrivalMessages().catch((e) => console.warn("[arrival messages]", e));
  };
  setTimeout(tick, 60_000);
  setInterval(tick, 30 * 60 * 1000);
}
