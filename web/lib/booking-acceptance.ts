import "server-only";
import type { BookingRecord, ManualPayMethod } from "@/lib/booking-types";
import { attachContractIfInstant } from "@/lib/booking-contract";
import { getBookingById, patchBookingRecord } from "@/lib/bookings-store";
import { getHostPayoutMethods, instructionFor, type HostPayoutMethods } from "@/lib/host-payout-methods";
import { getListingById } from "@/lib/marketplace-store";
import { notifyGuestPayInstructions } from "@/lib/push";
import { requestScreeningForBooking } from "@/lib/screening-service";

function firstSavedMethod(saved: HostPayoutMethods): ManualPayMethod | undefined {
  if (saved.clabe) return "clabe";
  if (saved.zelle) return "zelle";
  if (saved.cashapp) return "cashapp";
  if (saved.oxxo) return "oxxo";
  return undefined;
}

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

/**
 * El anfitrión aceptó a mano: manda cómo pagar si todavía no hay datos,
 * y la liga del crédito si el anuncio la exige.
 */
export function deliverAfterHostAccept(booking: BookingRecord): BookingRecord {
  let current = booking;
  if (current.payConfirmation?.by !== "stripe" && !current.payInstruction) {
    const saved = getHostPayoutMethods(current.hostId);
    const method = saved ? firstSavedMethod(saved) : undefined;
    if (saved && method) {
      const instruction = instructionFor(method, saved);
      if (!("error" in instruction)) {
        const patched = patchBookingRecord(current.id, { payInstruction: instruction });
        if (patched) {
          notifyGuestPayInstructions(patched);
          current = patched;
        }
      }
    }
  }
  requestCreditCheckIfRequired(current);
  return getBookingById(current.id) ?? current;
}
