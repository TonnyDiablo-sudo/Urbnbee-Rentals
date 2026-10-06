import "server-only";
import webpush from "web-push";
import { alarmCategoryOf } from "@/lib/alarm-categories";
import { alarmOn } from "@/lib/notification-prefs-store";
import type { BookingRecord } from "@/lib/booking-types";
import { isLang, makeT } from "@/lib/i18n";
import { findUserById, getListingById } from "@/lib/marketplace-store";
import { localizeVars } from "@/lib/notification-vars";
import { addNotification, type NotificationKind } from "@/lib/notifications-store";
import { removeSubscription, subscriptionsForUser } from "@/lib/push-store";

export type PushPayload = {
  title: string;
  body: string;
  /** Ruta dentro de la app que se abre al tocar la notificación. */
  url: string;
  /** Notificaciones con el mismo tag se reemplazan en vez de apilarse. */
  tag?: string;
};

let vapidReady: boolean | null = null;

export function pushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

function ensureVapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const publicKey = pushPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:soporte@cabibee.com";
  if (!publicKey || !privateKey) {
    vapidReady = false;
    return false;
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidReady = true;
  } catch (e) {
    console.warn("[push] invalid VAPID config:", e instanceof Error ? e.message : e);
    vapidReady = false;
  }
  return vapidReady;
}

export function pushConfigured(): boolean {
  return ensureVapid();
}

/**
 * Envía a todos los dispositivos del usuario. Nunca lanza: una notificación
 * fallida no debe tumbar el mensaje o la reserva que la originó.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!userId || !ensureVapid()) return;
  const subs = subscriptionsForUser(userId);
  if (!subs.length) return;
  const data = JSON.stringify({ ...payload, body: payload.body.slice(0, 180) });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, data, { TTL: 60 * 60 * 24 });
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          removeSubscription(s.endpoint);
        } else {
          console.warn("[push] send failed:", status ?? (e instanceof Error ? e.message : e));
        }
      }
    })
  );
}

type NotifyInput = {
  kind: NotificationKind;
  /** Texto en español con `{placeholders}`; la app lo traduce con `vars`. */
  title: string;
  body: string;
  vars?: Record<string, string | number>;
  /** El cuerpo es texto del usuario (un mensaje de chat): no se traduce. */
  rawBody?: boolean;
  url: string;
  tag?: string;
};

/** Guarda el aviso en el centro de notificaciones y además lo manda como push. */
export function notifyUser(userId: string, n: NotifyInput): void {
  if (!userId) return;
  if (!alarmOn(userId, alarmCategoryOf(n.kind, n.tag))) return;
  try {
    addNotification({
      userId,
      kind: n.kind,
      title: n.title,
      body: n.body,
      vars: n.vars,
      rawBody: n.rawBody || undefined,
      url: n.url,
      groupKey: n.tag,
    });
  } catch (e) {
    console.warn("[notifications] add failed:", e);
  }
  const userLang = findUserById(userId)?.lang;
  const lang = isLang(userLang) ? userLang : "es";
  const t = makeT(lang);
  const vars = localizeVars(n.vars, lang);
  void sendPushToUser(userId, {
    title: t(n.title, vars),
    body: n.rawBody ? n.body : t(n.body, vars),
    url: n.url,
    tag: n.tag,
  });
}

function listingTitle(listingId: string): string {
  return getListingById(listingId)?.title?.trim() || "tu alojamiento";
}

export function notifyHostNewMessage(p: {
  hostId: string;
  listingId: string;
  guestSessionId: string;
  guestName: string;
  body: string;
  /** El cuerpo es un texto fijo nuestro («📷 Foto»), no lo que escribió alguien. */
  translatable?: boolean;
}): void {
  notifyUser(p.hostId, {
    kind: "message",
    title: "{name} · {listing}",
    vars: { name: p.guestName, listing: listingTitle(p.listingId) },
    body: p.body,
    rawBody: !p.translatable,
    url: `/host/mensajes/${encodeURIComponent(p.listingId)}/${encodeURIComponent(p.guestSessionId)}`,
    tag: `h:${p.listingId}:${p.guestSessionId}`,
  });
}

/** Sólo los huéspedes con cuenta tienen sesión `gu_<userId>`; los hilos anónimos viejos no reciben aviso. */
export function notifyGuestHostReply(p: { listingId: string; guestSessionId: string; body: string; translatable?: boolean }): void {
  const m = /^gu_(.+)$/.exec(p.guestSessionId);
  if (!m) return;
  notifyUser(m[1], {
    kind: "message",
    title: "Respuesta del anfitrión · {listing}",
    vars: { listing: listingTitle(p.listingId) },
    body: p.body,
    rawBody: !p.translatable,
    url: `/mensajes/${encodeURIComponent(p.listingId)}`,
    tag: `g:${p.listingId}`,
  });
}

export function notifyHostBookingPaid(booking: BookingRecord): void {
  const instant = booking.status === "AWAITING_DETAILS" || booking.status === "CONFIRMED";
  notifyUser(booking.hostId, {
    kind: instant ? "booking" : "request",
    title: instant ? "Nueva reserva confirmada" : "Nueva solicitud de reserva",
    body: booking.nights === 1 ? "{name} · {listing} · 1 noche" : "{name} · {listing} · {nights} noches",
    vars: { name: booking.guestName, listing: listingTitle(booking.hostAdjustedListingId ?? booking.listingId), nights: booking.nights },
    url: instant ? "/host/calendario" : "/host",
    tag: `b:${booking.id}`,
  });
}

export function notifyGuestBookingDecision(booking: BookingRecord, accepted: boolean, balanceDueMxn = 0): void {
  if (!booking.guestUserId) return;
  const listing = listingTitle(booking.hostAdjustedListingId ?? booking.listingId);
  notifyUser(booking.guestUserId, {
    kind: accepted ? "booking" : "request",
    title: accepted ? "¡Tu reserva fue aceptada!" : "Tu solicitud no fue aceptada",
    body: !accepted
      ? "{listing}: el anfitrión no pudo recibirte en esas fechas."
      : balanceDueMxn > 0
        ? "{listing}: el anfitrión ajustó la reserva (fechas o impuestos). Paga la diferencia de ${amount} y firma el contrato."
        : "{listing}: ya está el contrato. Si falta pagar o autorizar el historial crediticio, la liga está en tu viaje.",
    vars: { listing, amount: balanceDueMxn.toLocaleString("es-MX") },
    url: "/viajes",
    tag: `b:${booking.id}`,
  });
}

/** Ambos firmaron (y no queda saldo): la reserva quedó cerrada. */
export function notifyBookingConfirmed(booking: BookingRecord): void {
  const listing = listingTitle(booking.hostAdjustedListingId ?? booking.listingId);
  const checkIn = booking.hostAdjustedCheckIn ?? booking.checkIn;
  const checkOut = booking.hostAdjustedCheckOut ?? booking.checkOut;
  notifyUser(booking.hostId, {
    kind: "booking",
    title: "Reserva confirmada",
    body: "{name} firmó el contrato de {listing} ({checkIn} → {checkOut}).",
    vars: { name: booking.guestName, listing, checkIn, checkOut },
    url: "/host/calendario",
    tag: `b:${booking.id}`,
  });
  if (booking.guestUserId) {
    notifyUser(booking.guestUserId, {
      kind: "booking",
      title: "Reserva confirmada",
      body: "{listing}: {checkIn} → {checkOut}. ¡Buen viaje!",
      vars: { listing, checkIn, checkOut },
      url: "/viajes",
      tag: `b:${booking.id}`,
    });
  }
}

/** El agente de urbnbeeai hizo algo con una reserva en nombre del anfitrión. */
export function notifyHostBotBookingAction(booking: BookingRecord, action: "accepted" | "rejected" | "signed"): void {
  notifyUser(booking.hostId, {
    kind: action === "rejected" ? "request" : "booking",
    title:
      action === "accepted"
        ? "Tu agente IA aceptó una reserva"
        : action === "rejected"
          ? "Tu agente IA rechazó una solicitud"
          : "Tu agente IA firmó un contrato",
    body: "{name} · {listing}",
    vars: { name: booking.guestName, listing: listingTitle(booking.hostAdjustedListingId ?? booking.listingId) },
    url: action === "rejected" ? "/host" : "/host/calendario",
    tag: `b:${booking.id}`,
  });
}

export function notifyHostDifferencePaid(booking: BookingRecord, amountMxn: number): void {
  notifyUser(booking.hostId, {
    kind: "payment",
    title: "Diferencia pagada",
    body: "{name} pagó ${amount} por el ajuste de la reserva en {listing}.",
    vars: { name: booking.guestName, amount: amountMxn.toLocaleString("es-MX"), listing: listingTitle(booking.hostAdjustedListingId ?? booking.listingId) },
    url: "/host/calendario",
  });
}

export function notifyGuestDifferenceRefunded(booking: BookingRecord, amountMxn: number): void {
  if (!booking.guestUserId) return;
  notifyUser(booking.guestUserId, {
    kind: "payment",
    title: "Te devolvimos la diferencia",
    body: "{listing}: el nuevo total es menor; reembolsamos ${amount}.",
    vars: { listing: listingTitle(booking.hostAdjustedListingId ?? booking.listingId), amount: amountMxn.toLocaleString("es-MX") },
    url: "/viajes",
  });
}

/** El anfitrión pidió revisar el historial crediticio: el huésped autoriza (y paga si se lo cobran). */
export function notifyGuestScreeningRequested(booking: BookingRecord, guestPays: boolean): void {
  if (!booking.guestUserId) return;
  notifyUser(booking.guestUserId, {
    kind: "request",
    title: "Tu anfitrión pide revisar tu historial crediticio",
    body: guestPays
      ? "{listing}: autoriza y paga la consulta para que el anfitrión pueda continuar con tu reserva."
      : "{listing}: autoriza la consulta para continuar. La paga el anfitrión.",
    vars: { listing: listingTitle(booking.hostAdjustedListingId ?? booking.listingId) },
    url: "/viajes",
    tag: `s:${booking.id}`,
  });
}

export function notifyHostScreeningConsented(p: { hostId: string; guestName: string; hostPays: boolean }): void {
  notifyUser(p.hostId, {
    kind: "request",
    title: "{name} autorizó la revisión crediticia",
    body: p.hostPays ? "Paga la consulta para ver el resultado." : "Falta que el huésped pague la consulta.",
    vars: { name: p.guestName },
    url: "/host",
  });
}

export function notifyHostScreeningReady(p: { hostId: string; guestName: string }): void {
  notifyUser(p.hostId, {
    kind: "payment",
    title: "Resultado de crédito listo",
    body: "Ya puedes ver el resumen de {name} en la solicitud.",
    vars: { name: p.guestName },
    url: "/host",
  });
}

const starsOf = (rating: number) => "★".repeat(Math.max(1, Math.min(5, Math.round(rating))));

export function notifyHostNewReview(p: { hostId: string; listingId: string; bookingId: string; guestName: string; rating: number }): void {
  notifyUser(p.hostId, {
    kind: "review",
    title: "{name} te dejó una reseña · {stars}",
    body: "Calificó su estancia en {listing}. Toca para verla y reseñar tú también.",
    vars: { stars: starsOf(p.rating), name: p.guestName, listing: listingTitle(p.listingId) },
    url: `/host/resenas?b=${encodeURIComponent(p.bookingId)}`,
  });
}

/** El anfitrión calificó al huésped. */
export function notifyGuestNewReview(p: { guestUserId: string; listingId: string; hostName: string; rating: number }): void {
  notifyUser(p.guestUserId, {
    kind: "review",
    title: "{name} te dejó una reseña · {stars}",
    body: "Tu anfitrión en {listing} calificó tu estancia.",
    vars: { stars: starsOf(p.rating), name: p.hostName, listing: listingTitle(p.listingId) },
    url: "/viajes",
  });
}

export function notifyGuestReviewReminder(booking: BookingRecord): void {
  if (!booking.guestUserId) return;
  notifyUser(booking.guestUserId, {
    kind: "review",
    title: "Deja tu reseña",
    body: "¿Qué tal tu estancia en {listing}? Califícala y ayuda a otros viajeros.",
    vars: { listing: listingTitle(booking.hostAdjustedListingId ?? booking.listingId) },
    url: `/viajes?resena=${encodeURIComponent(booking.id)}`,
    tag: `r:${booking.id}`,
  });
}

export function notifyHostReviewReminder(booking: BookingRecord): void {
  notifyUser(booking.hostId, {
    kind: "review",
    title: "Deja una reseña de {name}",
    body: "Terminó su estancia en {listing}. Califica al huésped para que otros anfitriones lo conozcan.",
    vars: { name: booking.guestName, listing: listingTitle(booking.hostAdjustedListingId ?? booking.listingId) },
    url: `/host/resenas?b=${encodeURIComponent(booking.id)}`,
    tag: `r:${booking.id}`,
  });
}
