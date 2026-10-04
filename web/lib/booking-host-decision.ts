import "server-only";
import { reconcileBookingTotal, paidStayOf } from "@/lib/booking-adjustments";
import { deliverAfterHostAccept } from "@/lib/booking-acceptance";
import { syncContractWithBooking } from "@/lib/booking-contract";
import { LISTING_ENGINE_OFF_ERROR, listingAcceptsBookings } from "@/lib/booking-engine-slots";
import { countNights, nightsBlockedByListing } from "@/lib/booking-helpers";
import { acceptBookingByHost, isPendingHostApproval, rejectBookingByHost } from "@/lib/booking-machine";
import { mysqlApplyBookingOccupancy } from "@/lib/booking-nights";
import {
  bookingChargesTax,
  bookingQuoteDay,
  bookingTaxFields,
  quoteBookingMxn,
  retaxBookingMxn,
} from "@/lib/booking-quote";
import { refundBookingPayment } from "@/lib/booking-refunds";
import type { BookingRecord } from "@/lib/booking-types";
import { hasOverlappingActiveBooking } from "@/lib/bookings-store";
import { getListingById } from "@/lib/marketplace-store";
import type { HostListingRecord } from "@/lib/marketplace-types";
import { notifyGuestBookingDecision } from "@/lib/push";
import { memberCoversListing, type TeamMember } from "@/lib/team-store";
import { restoreBookingPass } from "@/lib/verification-store";

type Fail = { ok: false; error: string; status: number; code?: string };

export type HostSigner = { name: string; userId: string; ip?: string; signedBy?: string };

/** Rechaza una solicitud pendiente: primero devuelve el pago y el pase, luego suelta las noches. */
export async function rejectPendingBooking(
  booking: BookingRecord
): Promise<{ ok: true; booking: BookingRecord | undefined; refund: string } | Fail> {
  if (!isPendingHostApproval(booking.status)) {
    return { ok: false, error: "Solo se pueden rechazar solicitudes pendientes.", status: 409, code: "not_pending" };
  }
  if (booking.guestUserId && !booking.paidAt) {
    return { ok: false, error: "Esta reserva no tiene pago registrado.", status: 409, code: "not_paid" };
  }

  // El huésped ya pagó: se devuelve antes de rechazar, para que nunca quede
  // una reserva rechazada con el dinero retenido.
  const refund = await refundBookingPayment(booking.id, "host_rejected");
  if (!refund.ok) {
    return {
      ok: false,
      error: `No se rechazó la reserva porque no se pudo devolver el pago. ${refund.error}`,
      status: refund.status,
      code: "refund_failed",
    };
  }

  // El pase se gastó por una reserva que el anfitrión no aceptó: se devuelve,
  // porque el huésped pagó por reservar, no por pedir permiso.
  if (booking.usedMembershipPass && booking.guestUserId) {
    restoreBookingPass(booking.guestUserId);
  }

  const next = rejectBookingByHost(booking.id);
  if (next) {
    const occ = await mysqlApplyBookingOccupancy(next);
    if (occ === "error") {
      console.warn("[host/bookings] no se pudieron soltar las noches de", booking.id);
    }
    notifyGuestBookingDecision(next, false);
  }
  return { ok: true, booking: next, refund: refund.kind };
}

/**
 * Acepta una solicitud pendiente, opcionalmente con otras fechas o en otro anuncio del mismo anfitrión.
 * `signer` decide quién firma el contrato con el anuncio ya elegido; si devuelve un error, no se acepta.
 */
export async function acceptPendingBooking(
  booking: BookingRecord,
  opts: {
    hostId: string;
    member?: TeamMember;
    listingId?: string;
    checkIn?: string;
    checkOut?: string;
    chargeTax?: boolean;
    signer: (listing: HostListingRecord) => HostSigner | Fail;
  }
): Promise<{ ok: true; booking: BookingRecord | undefined; balanceDueMxn: number; refundedMxn: number } | Fail> {
  if (!listingAcceptsBookings(booking.hostAdjustedListingId ?? booking.listingId)) {
    return { ok: false, error: LISTING_ENGINE_OFF_ERROR, status: 403, code: "engine_off" };
  }
  if (!isPendingHostApproval(booking.status)) {
    return { ok: false, error: "Solo se pueden aceptar solicitudes pendientes.", status: 409, code: "not_pending" };
  }
  if (booking.guestUserId && !booking.paidAt) {
    return { ok: false, error: "Esta reserva no tiene pago registrado.", status: 409, code: "not_paid" };
  }

  const effListingId = opts.listingId || booking.listingId;
  const effIn = opts.checkIn || booking.checkIn;
  const effOut = opts.checkOut || booking.checkOut;

  const listing = getListingById(effListingId);
  if (
    !listing?.published ||
    listing.hostId !== opts.hostId ||
    (opts.member && !memberCoversListing(opts.member, listing.id))
  ) {
    return { ok: false, error: "El alojamiento elegido no está disponible.", status: 400, code: "listing_unavailable" };
  }

  const nights = countNights(effIn, effOut);
  if (nights < 1) {
    return { ok: false, error: "Las fechas deben dejar al menos una noche.", status: 400, code: "invalid_dates" };
  }
  if (nightsBlockedByListing(listing, effIn, effOut)) {
    return { ok: false, error: "Hay noches bloqueadas en ese rango.", status: 409, code: "blocked" };
  }
  if (hasOverlappingActiveBooking(effListingId, effIn, effOut, booking.id)) {
    return { ok: false, error: "Esas fechas ya tienen otra solicitud o reserva activa.", status: 409, code: "overlap" };
  }

  const currentTax = bookingChargesTax(booking);
  const chargeTax = typeof opts.chargeTax === "boolean" ? opts.chargeTax : currentTax;
  const datesChanged =
    effListingId !== booking.listingId || effIn !== booking.checkIn || effOut !== booking.checkOut;
  const quote = datesChanged
    ? quoteBookingMxn(listing, effIn, effOut, { today: bookingQuoteDay(booking), chargeTax })
    : retaxBookingMxn(booking, listing, chargeTax);
  const estimatedTotalMxn = quote.totalMxn;
  const taxChanged = quote.taxAvailable && chargeTax !== currentTax;
  // Sin cambios se respeta el precio con el que pagó el huésped, aunque el anfitrión haya
  // movido tarifas o impuestos después.
  const pricing =
    datesChanged || taxChanged
      ? { estimatedTotalMxn, ...bookingTaxFields(quote), chargeTax: quote.taxAvailable ? chargeTax : undefined }
      : { estimatedTotalMxn: booking.estimatedTotalMxn, chargeTax: quote.taxAvailable ? currentTax : undefined };

  const hostAdjustedListingId = effListingId !== booking.listingId ? effListingId : undefined;
  const hostAdjustedCheckIn = effIn !== booking.checkIn ? effIn : undefined;
  const hostAdjustedCheckOut = effOut !== booking.checkOut ? effOut : undefined;

  const signer = opts.signer(listing);
  if ("ok" in signer) return signer;
  if (signer.name.trim().length < 3) {
    return { ok: false, error: "Firma el contrato con tu nombre completo.", status: 400, code: "sign_name_required" };
  }

  const proposed = {
    ...booking,
    status: "AWAITING_DETAILS" as const,
    nights,
    ...pricing,
    hostAdjustedListingId,
    hostAdjustedCheckIn,
    hostAdjustedCheckOut,
  };
  const occ = await mysqlApplyBookingOccupancy(proposed);
  if (occ === "overlap") {
    return { ok: false, error: "Esas fechas ya tienen otra solicitud o reserva activa.", status: 409, code: "overlap" };
  }
  if (occ === "error") {
    return { ok: false, error: "No se pudieron reservar esas noches. Intenta de nuevo.", status: 500 };
  }

  const next = acceptBookingByHost(booking.id, {
    nights,
    ...pricing,
    paidStayMxn: booking.paidAt ? paidStayOf(booking) : undefined,
    hostAdjustedListingId,
    hostAdjustedCheckIn,
    hostAdjustedCheckOut,
  });

  // Si subió el total queda un cobro pendiente; si bajó, se devuelve la diferencia.
  const money = next ? await reconcileBookingTotal(next.id) : { booking: next, dueMxn: 0, refundedMxn: 0 };

  const withContract = next
    ? syncContractWithBooking(next.id, {
        role: "host",
        userId: signer.userId,
        ip: signer.ip,
        signName: signer.name,
        signedBy: signer.signedBy,
      }) ?? money.booking ?? next
    : next;
  const delivered = withContract ? deliverAfterHostAccept(withContract) : withContract;
  if (delivered) notifyGuestBookingDecision(delivered, true, money.dueMxn);

  return {
    ok: true,
    booking: delivered,
    balanceDueMxn: money.dueMxn,
    refundedMxn: money.refundedMxn,
  };
}
