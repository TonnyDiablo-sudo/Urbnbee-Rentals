import "server-only";
import { listBookingsForHost } from "@/lib/bookings-store";
import type { BookingRecord } from "@/lib/booking-types";

/** En qué punto va la reserva que liga a este chat. */
export type ChatBookingPhase = "requested" | "upcoming" | "current" | "past";

export type ChatThreadBooking = {
  id: string;
  checkIn: string;
  checkOut: string;
  phase: ChatBookingPhase;
};

const PHASE_ORDER: Record<ChatBookingPhase, number> = { current: 0, upcoming: 1, requested: 2, past: 3 };

function localIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function phaseOf(b: BookingRecord, today: string): ChatBookingPhase | null {
  const checkIn = b.hostAdjustedCheckIn ?? b.checkIn;
  const checkOut = b.hostAdjustedCheckOut ?? b.checkOut;
  switch (b.status) {
    case "COMPLETED":
      return "past";
    case "CONFIRMED":
    case "AWAITING_DETAILS":
      if (checkOut <= today) return "past";
      return checkIn <= today ? "current" : "upcoming";
    case "PENDING":
    case "PENDING_HOST":
    case "AWAITING_PAYMENT":
      return checkIn > today ? "requested" : null;
    default:
      return null;
  }
}

/**
 * La reserva más relevante del huésped en ese alojamiento (la que está en curso; si no, la que viene;
 * si no, la última que terminó). Sirve para que el anfitrión sepa de qué estancia le hablan.
 */
export function threadBooking(
  hostId: string,
  listingId: string,
  guestSessionId: string,
  guestEmail?: string
): ChatThreadBooking | undefined {
  const guestUserId = guestSessionId.startsWith("gu_") ? guestSessionId.slice(3) : "";
  const email = guestEmail?.trim().toLowerCase();
  if (!guestUserId && !email) return undefined;
  const today = localIso();
  const candidates = listBookingsForHost(hostId)
    .filter((b) => (b.hostAdjustedListingId ?? b.listingId) === listingId)
    .filter((b) => (guestUserId && b.guestUserId === guestUserId) || (email && b.guestEmail.trim().toLowerCase() === email))
    .map((b) => ({ b, phase: phaseOf(b, today) }))
    .filter((x): x is { b: BookingRecord; phase: ChatBookingPhase } => x.phase !== null)
    .sort((x, y) => {
      if (x.phase !== y.phase) return PHASE_ORDER[x.phase] - PHASE_ORDER[y.phase];
      const xi = x.b.hostAdjustedCheckIn ?? x.b.checkIn;
      const yi = y.b.hostAdjustedCheckIn ?? y.b.checkIn;
      // Próximas: la más cercana primero; pasadas: la más reciente primero.
      return x.phase === "past" ? yi.localeCompare(xi) : xi.localeCompare(yi);
    });
  const top = candidates[0];
  if (!top) return undefined;
  return {
    id: top.b.id,
    checkIn: top.b.hostAdjustedCheckIn ?? top.b.checkIn,
    checkOut: top.b.hostAdjustedCheckOut ?? top.b.checkOut,
    phase: top.phase,
  };
}
