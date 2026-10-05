import "server-only";
import { analyticsDayKey } from "@/lib/analytics-day";
import { ensureBookingContract } from "@/lib/booking-contract";
import type { BookingContractPreviousVersion } from "@/lib/booking-contract-types";
import { LISTING_ENGINE_OFF_ERROR, listingAcceptsBookings } from "@/lib/booking-engine-slots";
import { countNights, nightsBlockedByListing } from "@/lib/booking-helpers";
import { transitionBooking } from "@/lib/booking-machine";
import { mysqlApplyBookingOccupancy } from "@/lib/booking-nights";
import { paymentWindowEnd } from "@/lib/booking-payment-window";
import { bookingChargesTax, bookingTaxFields, quoteBookingMxn } from "@/lib/booking-quote";
import type { BookingRecord } from "@/lib/booking-types";
import { getBookingById, hasOverlappingActiveBooking, patchBookingRecord } from "@/lib/bookings-store";
import { fullMonthsBetween, stayLengthError } from "@/lib/listing-pricing";
import { getListingById } from "@/lib/marketplace-store";
import { notifyUser } from "@/lib/push";

type Result = { ok: true; booking: BookingRecord } | { ok: false; error: string; status: number };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function titleOf(b: BookingRecord) {
  return getListingById(b.hostAdjustedListingId ?? b.listingId)?.title || "la reserva";
}

function dueLabel(iso: string) {
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });
}

/** El huésped ya firmó y quiere pagar, pero falta la firma del anfitrión. */
export function notifyHostContractToSign(b: BookingRecord) {
  notifyUser(b.hostId, {
    kind: "contract",
    title: "Firma el contrato para que tu huésped pueda pagar",
    body: "{guest} ya firmó el contrato de {listing}. El pago se habilita en cuanto tú firmes.",
    vars: { guest: b.guestName, listing: titleOf(b) },
    url: "/host/requests",
    tag: `host-sign:${b.id}`,
  });
}

/** El anfitrión firmó y el huésped ya había firmado: ya puede pagar. */
export function notifyGuestCanPay(b: BookingRecord) {
  if (!b.guestUserId || b.status !== "AWAITING_PAYMENT" || !b.contract?.guestAcceptedAt) return;
  notifyUser(b.guestUserId, {
    kind: "contract",
    title: "El anfitrión firmó: ya puedes pagar",
    body: "{listing}: paga antes del {when} para que el contrato surta efectos.",
    vars: { listing: titleOf(b), when: dueLabel(b.paymentDueAt ?? b.contract.paymentDueAt ?? new Date().toISOString()) },
    url: `/contrato/${b.token}?pay=1`,
    tag: `can-pay:${b.id}`,
  });
}

function voidedForNonPayment(b: BookingRecord): boolean {
  const last = [...(b.lifecycle ?? [])].reverse().find((e) => e.to === "EXPIRED");
  return b.status === "EXPIRED" && (!last || last.reason === "unpaid_timeout" || last.reason === "payment_failed_timeout");
}

export function canReopenBooking(b: BookingRecord): boolean {
  return !b.archivedAt && voidedForNonPayment(b);
}

/**
 * Reabre una reserva anulada por falta de pago, con las mismas fechas o con otras.
 * El contrato anulado queda archivado (con sus sellos) y se genera uno nuevo que las dos partes firman otra vez.
 */
export async function reopenExpiredBooking(
  bookingId: string,
  by: "host" | "guest",
  input: { checkIn?: string; checkOut?: string; userId: string; ip?: string; signName?: string }
): Promise<Result> {
  const b = getBookingById(bookingId);
  if (!b) return { ok: false, error: "Reserva no encontrada.", status: 404 };
  if (b.archivedAt) return { ok: false, error: "Esta reserva ya se archivó.", status: 409 };
  if (!voidedForNonPayment(b)) {
    return { ok: false, error: "Sólo se reabren reservas anuladas por falta de pago.", status: 409 };
  }
  const listingId = b.hostAdjustedListingId ?? b.listingId;
  const listing = getListingById(listingId);
  if (!listing?.published) return { ok: false, error: "Este alojamiento ya no está disponible.", status: 400 };
  if (!listingAcceptsBookings(listingId)) return { ok: false, error: LISTING_ENGINE_OFF_ERROR, status: 403 };

  const checkIn = input.checkIn || (b.hostAdjustedCheckIn ?? b.checkIn);
  const checkOut = input.checkOut || (b.hostAdjustedCheckOut ?? b.checkOut);
  if (!DAY.test(checkIn.slice(0, 10)) || !DAY.test(checkOut.slice(0, 10))) {
    return { ok: false, error: "Las fechas deben ser AAAA-MM-DD.", status: 400 };
  }
  if (checkIn.slice(0, 10) < analyticsDayKey()) {
    return { ok: false, error: "Esas fechas ya pasaron. Elige otras para reabrir la reserva.", status: 400 };
  }
  const nights = countNights(checkIn, checkOut);
  if (nights < 1) return { ok: false, error: "Las fechas deben dejar al menos una noche.", status: 400 };
  const lengthErr = stayLengthError(listing, nights, fullMonthsBetween(checkIn, checkOut).months);
  if (lengthErr) return { ok: false, error: lengthErr.key.replace("{n}", String(lengthErr.n)), status: 400 };
  if (nightsBlockedByListing(listing, checkIn, checkOut)) {
    return { ok: false, error: "Hay noches bloqueadas en ese rango.", status: 409 };
  }
  if (hasOverlappingActiveBooking(listingId, checkIn, checkOut, b.id)) {
    return { ok: false, error: "Esas fechas ya tienen otra solicitud o reserva activa.", status: 409 };
  }

  const quote = quoteBookingMxn(listing, checkIn, checkOut, { chargeTax: bookingChargesTax(b) });
  const stay = {
    listingId,
    checkIn,
    checkOut,
    hostAdjustedListingId: undefined,
    hostAdjustedCheckIn: undefined,
    hostAdjustedCheckOut: undefined,
    nights,
    estimatedTotalMxn: quote.totalMxn,
    ...bookingTaxFields(quote),
    chargeTax: quote.taxAvailable ? quote.chargesTax : undefined,
  };
  const occ = await mysqlApplyBookingOccupancy({ ...b, ...stay, status: "AWAITING_PAYMENT" });
  if (occ === "overlap") return { ok: false, error: "Esas fechas ya tienen otra solicitud o reserva activa.", status: 409 };
  if (occ === "error") return { ok: false, error: "No se pudieron apartar esas noches. Intenta de nuevo.", status: 500 };

  const at = new Date().toISOString();
  const old = b.contract;
  const archived: BookingContractPreviousVersion[] | undefined = old
    ? [
        ...(old.previousVersions ?? []),
        {
          generatedAt: old.generatedAt,
          supersededAt: at,
          snapshot: old.snapshot,
          hostAcceptedAt: old.hostAcceptedAt,
          hostAcceptedName: old.hostAcceptedName,
          guestAcceptedAt: old.guestAcceptedAt,
          guestAcceptedName: old.guestAcceptedName,
          acceptedSha256: old.acceptedSha256,
          changes: [`anulado por falta de pago; reabierto por el ${by === "host" ? "anfitrión" : "huésped"}`],
          stamps: old.stamps,
        },
      ]
    : undefined;

  const moved = transitionBooking(b.id, "AWAITING_PAYMENT", {
    actor: by,
    reason: `reopened_by_${by}`,
    paymentStatus: "unpaid",
    contractStatus: "pending",
    patch: {
      ...stay,
      paymentDueAt: paymentWindowEnd(checkIn),
      paidAt: undefined,
      payConfirmation: undefined,
      stripeCheckoutSessionId: undefined,
      resumeStatusAfterPay: undefined,
      paymentFailedAt: undefined,
      contract: undefined,
    },
  });
  if (!moved) return { ok: false, error: "No se pudo reabrir la reserva.", status: 409 };

  const signName = input.signName?.trim();
  const fresh =
    ensureBookingContract(b.id, {
      role: by === "host" && signName && signName.length >= 3 ? "host" : "system",
      userId: by === "host" ? input.userId : b.hostId,
      ip: input.ip,
      signName: by === "host" ? signName : undefined,
    }) ?? moved;
  const saved =
    fresh.contract && archived
      ? (patchBookingRecord(b.id, {
          contract: {
            ...fresh.contract,
            previousVersions: archived,
            events: [
              ...(old?.events ?? []),
              {
                at,
                actor: by,
                action: "reopened",
                detail: `El ${by === "host" ? "anfitrión" : "huésped"} reabrió la reserva tras anularse por falta de pago; se generó un contrato nuevo.`,
                ip: input.ip,
              },
              ...fresh.contract.events,
            ],
          },
        }) ?? fresh)
      : fresh;

  const when = dueLabel(saved.paymentDueAt ?? at);
  if (by === "host" && saved.guestUserId) {
    notifyUser(saved.guestUserId, {
      kind: "contract",
      title: "El anfitrión reabrió tu reserva",
      body: "{listing}: firma el contrato nuevo y paga antes del {when}.",
      vars: { listing: titleOf(saved), when },
      url: `/contrato/${saved.token}?pay=1`,
      tag: `reopen:${saved.id}`,
    });
  }
  if (by === "guest") {
    notifyUser(saved.hostId, {
      kind: "contract",
      title: "Tu huésped reabrió una reserva anulada",
      body: saved.contract?.hostAcceptedAt
        ? "{listing}: el huésped tiene hasta el {when} para firmar y pagar."
        : "{listing}: firma el contrato nuevo para que el huésped pueda pagar antes del {when}.",
      vars: { listing: titleOf(saved), when },
      url: "/host/requests",
      tag: `reopen:${saved.id}`,
    });
  }
  return { ok: true, booking: saved };
}

/** Cerrar para siempre una reserva anulada: ya no se puede reabrir. */
export function archiveExpiredBooking(bookingId: string, by: "host" | "guest"): Result {
  const b = getBookingById(bookingId);
  if (!b) return { ok: false, error: "Reserva no encontrada.", status: 404 };
  if (b.status !== "EXPIRED") return { ok: false, error: "Sólo se archivan reservas anuladas.", status: 409 };
  if (b.archivedAt) return { ok: true, booking: b };
  const saved = patchBookingRecord(b.id, { archivedAt: new Date().toISOString(), archivedBy: by });
  return saved ? { ok: true, booking: saved } : { ok: false, error: "No se pudo archivar.", status: 500 };
}
