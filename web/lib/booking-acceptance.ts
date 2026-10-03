import "server-only";
import type { BookingRecord } from "@/lib/booking-types";
import { attachContractIfInstant } from "@/lib/booking-contract";
import { getBookingById } from "@/lib/bookings-store";
import { getListingById } from "@/lib/marketplace-store";
import { requestScreeningForBooking } from "@/lib/screening-service";

/** Si el anuncio pide crédito, el huésped (o el anfitrión) recibe la liga para autorizar y pagar. */
export function requestCreditCheckIfRequired(booking: BookingRecord): void {
  const listing = getListingById(booking.hostAdjustedListingId ?? booking.listingId);
  if (!listing?.requireCreditCheck || !booking.guestUserId) return;
  const payer = listing.creditCheckPayer === "host" ? "host" : "guest";
  try {
    requestScreeningForBooking(booking, payer);
  } catch (e) {
    console.warn("[booking] credit check", e);
  }
}

/**
 * Pago ya visto por el sistema. En reservación inmediata queda confirmada y,
 * si el anuncio lo pide, arranca el historial crediticio sin que el anfitrión acepte.
 */
export function onBookingPaid(booking: BookingRecord): BookingRecord {
  const withContract = booking.status === "CONFIRMED" ? attachContractIfInstant(booking) : booking;
  if (withContract.status === "CONFIRMED") requestCreditCheckIfRequired(withContract);
  return getBookingById(withContract.id) ?? withContract;
}

/** El anfitrión aceptó a mano: manda la liga del crédito si el anuncio la exige. El huésped paga en línea. */
export function deliverAfterHostAccept(booking: BookingRecord): BookingRecord {
  requestCreditCheckIfRequired(booking);
  return getBookingById(booking.id) ?? booking;
}
