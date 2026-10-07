import "server-only";
import { listBookingsForHost } from "@/lib/bookings-store";
import type { BookingRecord } from "@/lib/booking-types";
import { bookingPhaseOf, localTodayIso, type BookingPhase } from "@/lib/booking-phase";

export type ChatBookingPhase = BookingPhase;

export type ChatThreadBooking = {
  id: string;
  checkIn: string;
  checkOut: string;
  phase: ChatBookingPhase;
};

const PHASE_ORDER: Record<ChatBookingPhase, number> = { current: 0, upcoming: 1, requested: 2, past: 3 };

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
  const today = localTodayIso();
  const candidates = listBookingsForHost(hostId)
    .filter((b) => (b.hostAdjustedListingId ?? b.listingId) === listingId)
    .filter((b) => (guestUserId && b.guestUserId === guestUserId) || (email && b.guestEmail.trim().toLowerCase() === email))
    .map((b) => ({ b, phase: bookingPhaseOf(b, today) }))
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
