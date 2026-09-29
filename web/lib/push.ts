import "server-only";
import webpush from "web-push";
import type { BookingRecord } from "@/lib/booking-types";
import { getListingById } from "@/lib/marketplace-store";
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

function listingTitle(listingId: string): string {
  return getListingById(listingId)?.title?.trim() || "tu alojamiento";
}

export function notifyHostNewMessage(p: {
  hostId: string;
  listingId: string;
  guestSessionId: string;
  guestName: string;
  body: string;
}): void {
  void sendPushToUser(p.hostId, {
    title: `${p.guestName} · ${listingTitle(p.listingId)}`,
    body: p.body,
    url: `/app/host/mensajes/${encodeURIComponent(p.listingId)}/${encodeURIComponent(p.guestSessionId)}`,
    tag: `h:${p.listingId}:${p.guestSessionId}`,
  });
}

/** Sólo los huéspedes con cuenta tienen sesión `gu_<userId>`; los hilos anónimos viejos no reciben push. */
export function notifyGuestHostReply(p: { listingId: string; guestSessionId: string; body: string }): void {
  const m = /^gu_(.+)$/.exec(p.guestSessionId);
  if (!m) return;
  void sendPushToUser(m[1], {
    title: `Respuesta del anfitrión · ${listingTitle(p.listingId)}`,
    body: p.body,
    url: `/app/mensajes/${encodeURIComponent(p.listingId)}`,
    tag: `g:${p.listingId}`,
  });
}

export function notifyHostBookingPaid(booking: BookingRecord): void {
  const instant = booking.status === "AWAITING_DETAILS" || booking.status === "CONFIRMED";
  void sendPushToUser(booking.hostId, {
    title: instant ? "Nueva reserva confirmada" : "Nueva solicitud de reserva",
    body: `${booking.guestName} · ${listingTitle(booking.listingId)} · ${booking.nights} noche${booking.nights === 1 ? "" : "s"}`,
    url: "/app/host",
    tag: `b:${booking.id}`,
  });
}

export function notifyGuestBookingDecision(booking: BookingRecord, accepted: boolean): void {
  if (!booking.guestUserId) return;
  void sendPushToUser(booking.guestUserId, {
    title: accepted ? "¡Tu reserva fue aceptada!" : "Tu solicitud no fue aceptada",
    body: accepted
      ? `${listingTitle(booking.listingId)}: completa tus datos para cerrar la reserva.`
      : `${listingTitle(booking.listingId)}: el anfitrión no pudo recibirte en esas fechas.`,
    url: "/app/viajes",
    tag: `b:${booking.id}`,
  });
}
