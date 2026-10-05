import "server-only";
import type {
  BookingActor,
  BookingContractStatus,
  BookingPaymentStatus,
  BookingRecord,
  BookingStatus,
  BookingTransitionEvent,
  PayConfirmation,
} from "@/lib/booking-types";
import { enqueueBookingOutbound } from "@/lib/beeagent-outbound";
import { addContractStamp } from "@/lib/booking-contract-stamps";
import { mysqlApplyBookingOccupancy } from "@/lib/booking-nights";
import { PAYMENT_WINDOW_MS, paymentDueOf, paymentWindowClosed, paymentWindowEnd } from "@/lib/booking-payment-window";
import { getBookingById, patchBookingRecord } from "@/lib/bookings-store";
import { getListingById } from "@/lib/marketplace-store";
import { scheduleMysql } from "@/lib/mysql-sync";
import { notifyBookingConfirmed, notifyUser } from "@/lib/push";

/** Sin pagar dentro del plazo → EXPIRED (contrato anulado) y se sueltan las noches. */
export const UNPAID_EXPIRE_MS = PAYMENT_WINDOW_MS;

/** Volver a AWAITING_PAYMENT sólo pasa si el pago se rechaza, o al reabrir una reserva anulada. */
const ALLOWED: Record<BookingStatus, BookingStatus[]> = {
  AWAITING_PAYMENT: ["PENDING_HOST", "AWAITING_DETAILS", "CONFIRMED", "EXPIRED", "CANCELLED"],
  PENDING: ["AWAITING_DETAILS", "REJECTED", "CANCELLED", "PENDING_HOST", "AWAITING_PAYMENT"],
  PENDING_HOST: ["AWAITING_DETAILS", "REJECTED", "CANCELLED", "AWAITING_PAYMENT"],
  AWAITING_DETAILS: ["CONFIRMED", "CANCELLED", "AWAITING_PAYMENT"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "AWAITING_PAYMENT"],
  REJECTED: [],
  CANCELLED: [],
  COMPLETED: [],
  EXPIRED: ["AWAITING_PAYMENT"],
};

export function canonicalBookingStatus(status: BookingStatus): BookingStatus {
  return status === "PENDING" ? "PENDING_HOST" : status;
}

export function isPendingHostApproval(status: BookingStatus): boolean {
  return status === "PENDING" || status === "PENDING_HOST";
}

export function bookingHoldsNights(status: BookingStatus): boolean {
  const s = canonicalBookingStatus(status);
  return s === "AWAITING_PAYMENT" || s === "PENDING_HOST" || s === "AWAITING_DETAILS" || s === "CONFIRMED";
}

export function paymentStatusOf(booking: BookingRecord): BookingPaymentStatus {
  if (booking.paymentStatus) return booking.paymentStatus;
  if (booking.refundedAt) return "refunded";
  if (booking.paidAt) return "paid";
  return "unpaid";
}

export function contractStatusOf(booking: BookingRecord): BookingContractStatus {
  if (booking.contractStatus) return booking.contractStatus;
  const c = booking.contract;
  if (!c) return "pending";
  if (c.hostAcceptedAt && c.guestAcceptedAt) return "signed";
  return "pending";
}

function nowIso() {
  return new Date().toISOString();
}

function pushEvent(
  booking: BookingRecord,
  actor: BookingActor,
  from: BookingStatus,
  to: BookingStatus,
  reason?: string
): BookingTransitionEvent[] {
  return [
    ...(booking.lifecycle ?? []),
    { at: nowIso(), actor, from, to, reason },
  ];
}

function syncNights(bookingId: string) {
  scheduleMysql(async () => {
    const live = getBookingById(bookingId);
    if (live) await mysqlApplyBookingOccupancy(live);
  });
}

export function transitionBooking(
  bookingId: string,
  to: BookingStatus,
  opts: {
    actor: BookingActor;
    reason?: string;
    paymentStatus?: BookingPaymentStatus;
    contractStatus?: BookingContractStatus;
    patch?: Partial<BookingRecord>;
  }
): BookingRecord | undefined {
  const prev = getBookingById(bookingId);
  if (!prev) return undefined;
  const from = prev.status;
  const fromCanon = canonicalBookingStatus(from);
  const toCanon = canonicalBookingStatus(to);
  if (fromCanon === toCanon && from !== "PENDING") {
    return prev;
  }
  const allowed = ALLOWED[from] ?? ALLOWED[fromCanon] ?? [];
  if (!allowed.includes(to) && !allowed.includes(toCanon)) {
    return undefined;
  }
  const next = patchBookingRecord(bookingId, {
    ...opts.patch,
    status: toCanon === "PENDING_HOST" && to === "PENDING_HOST" ? "PENDING_HOST" : toCanon,
    paymentStatus: opts.paymentStatus ?? prev.paymentStatus ?? paymentStatusOf(prev),
    contractStatus: opts.contractStatus ?? prev.contractStatus ?? contractStatusOf(prev),
    lifecycle: pushEvent(prev, opts.actor, from, toCanon, opts.reason),
  });
  if (next && bookingHoldsNights(from) !== bookingHoldsNights(next.status)) {
    syncNights(next.id);
  }
  if (next) {
    if (toCanon === "CONFIRMED") enqueueBookingOutbound("booking.confirmed", next);
    if (toCanon === "REJECTED") enqueueBookingOutbound("booking.rejected", next);
    if (toCanon === "CANCELLED") enqueueBookingOutbound("booking.cancelled", next);
    if (toCanon === "EXPIRED") enqueueBookingOutbound("booking.expired", next);
  }
  return next;
}

/** Pago de estancia. Idempotente: si ya hay paidAt / paymentStatus=paid, no mueve el estado. */
export function markBookingPaid(
  bookingId: string,
  opts?: {
    stripeCheckoutSessionId?: string;
    stripePaymentIntentId?: string;
    actor?: BookingActor;
    payConfirmation?: PayConfirmation;
  }
): BookingRecord | undefined {
  const prev = getBookingById(bookingId);
  if (!prev) return undefined;
  if (prev.paidAt || paymentStatusOf(prev) === "paid" || paymentStatusOf(prev) === "refunded") {
    return prev;
  }
  if (canonicalBookingStatus(prev.status) !== "AWAITING_PAYMENT") return undefined;
  if (paymentWindowClosed(prev)) return undefined;

  const listing = getListingById(prev.listingId);
  // Si el pago se había rechazado, la reserva vuelve a donde estaba (ya aceptada o confirmada).
  const to: BookingStatus =
    prev.resumeStatusAfterPay ?? (listing?.bookingApprovalMode === "instant" ? "CONFIRMED" : "PENDING_HOST");
  const at = opts?.payConfirmation?.at ?? nowIso();
  const payConfirmation: PayConfirmation = opts?.payConfirmation ?? { at, by: "stripe", method: "stripe" };
  const moved = transitionBooking(bookingId, to, {
    actor: opts?.actor ?? "system",
    reason: prev.resumeStatusAfterPay
      ? "payment_retried"
      : payConfirmation.by === "host"
        ? "manual_payment_confirmed"
        : "payment_received",
    paymentStatus: "paid",
    contractStatus: to === "CONFIRMED" || prev.resumeStatusAfterPay ? contractStatusOf(prev) : "pending",
    patch: {
      paidAt: at,
      payConfirmation,
      resumeStatusAfterPay: undefined,
      paymentFailedAt: undefined,
      stripeCheckoutSessionId: opts?.stripeCheckoutSessionId ?? prev.stripeCheckoutSessionId,
      stripePaymentIntentId: opts?.stripePaymentIntentId ?? prev.stripePaymentIntentId,
    },
  });
  const next = moved
    ? (addContractStamp(bookingId, {
        kind: "payment_received",
        amountMxn: prev.estimatedTotalMxn,
        method: opts?.stripeCheckoutSessionId === "simulated" ? "demo" : payConfirmation.method === "stripe" ? "tarjeta" : payConfirmation.method,
        ref: opts?.stripePaymentIntentId ?? opts?.stripeCheckoutSessionId,
      }) ?? moved)
    : moved;
  if (next) enqueueBookingOutbound("booking.paid", next);
  return next;
}

/**
 * El pago se rechazó o se revirtió (contracargo, pago diferido que falló).
 * Se imprime el sello de pago rechazado y se abre un plazo nuevo para pagar; si no se paga, se anula.
 */
export function markBookingPaymentFailed(
  bookingId: string,
  opts: { reason: string; ref?: string }
): BookingRecord | undefined {
  const prev = getBookingById(bookingId);
  if (!prev) return undefined;
  const status = canonicalBookingStatus(prev.status);
  if (status === "AWAITING_PAYMENT" && !prev.paidAt) {
    if (prev.contract?.stamps?.some((s) => s.kind === "payment_rejected" && !s.clearedAt && s.ref === opts.ref)) return prev;
    return addContractStamp(bookingId, { kind: "payment_rejected", reason: opts.reason, ref: opts.ref, dueAt: paymentDueOf(prev) });
  }
  if (!prev.paidAt || !["PENDING_HOST", "AWAITING_DETAILS", "CONFIRMED"].includes(status)) return prev;
  const dueAt = paymentWindowEnd(prev.hostAdjustedCheckIn ?? prev.checkIn);
  const moved = transitionBooking(bookingId, "AWAITING_PAYMENT", {
    actor: "system",
    reason: "payment_failed",
    paymentStatus: "failed",
    patch: {
      paidAt: undefined,
      payConfirmation: undefined,
      stripeCheckoutSessionId: undefined,
      resumeStatusAfterPay: status,
      paymentFailedAt: nowIso(),
      paymentDueAt: dueAt,
    },
  });
  if (!moved) return prev;
  const next = addContractStamp(bookingId, { kind: "payment_rejected", reason: opts.reason, ref: opts.ref, dueAt }) ?? moved;
  const listingTitle = getListingById(next.hostAdjustedListingId ?? next.listingId)?.title || "tu reserva";
  const when = new Date(dueAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });
  if (next.guestUserId) {
    notifyUser(next.guestUserId, {
      kind: "payment",
      title: "Se rechazó el pago de tu reserva",
      body: "{listing}: vuelve a pagar antes del {when} o la reserva se anula.",
      vars: { listing: listingTitle, when },
      url: `/contrato/${next.token}?pay=1`,
      tag: `payfail:${next.id}`,
    });
  }
  notifyUser(next.hostId, {
    kind: "payment",
    title: "Se rechazó el pago de una reserva",
    body: "{listing}: el huésped tiene hasta el {when} para volver a pagar; si no, se anula.",
    vars: { listing: listingTitle, when },
    url: "/host/requests",
    tag: `payfail:${next.id}`,
  });
  return next;
}

export function acceptBookingByHost(
  bookingId: string,
  patch: Partial<
    Pick<
      BookingRecord,
      | "nights"
      | "estimatedTotalMxn"
      | "hostAdjustedListingId"
      | "hostAdjustedCheckIn"
      | "hostAdjustedCheckOut"
      | "paidStayMxn"
      | "taxMxn"
      | "taxLines"
      | "taxIncluded"
      | "chargeTax"
    >
  >
): BookingRecord | undefined {
  const prev = getBookingById(bookingId);
  if (!prev || !isPendingHostApproval(prev.status)) return undefined;
  return transitionBooking(bookingId, "AWAITING_DETAILS", {
    actor: "host",
    reason: "host_accepted",
    paymentStatus: paymentStatusOf(prev),
    contractStatus: "pending",
    patch,
  });
}

export function rejectBookingByHost(bookingId: string): BookingRecord | undefined {
  const prev = getBookingById(bookingId);
  if (!prev || !isPendingHostApproval(prev.status)) return undefined;
  const paid = paymentStatusOf(prev) === "paid" || Boolean(prev.paidAt);
  const next = transitionBooking(bookingId, "REJECTED", {
    actor: "host",
    reason: "host_rejected",
    paymentStatus: paid ? "refunded" : paymentStatusOf(prev),
    patch: paid && !prev.refundedAt ? { refundedAt: nowIso(), refundReason: "host_rejected" } : undefined,
  });
  if (next && paid && !prev.refundedAt) enqueueBookingOutbound("booking.refunded", next);
  return next;
}

export function confirmBookingAfterGuestContract(bookingId: string): BookingRecord | undefined {
  const prev = getBookingById(bookingId);
  if (!prev) return undefined;
  const bothSigned = Boolean(prev.contract?.hostAcceptedAt && prev.contract?.guestAcceptedAt);
  const contractStatus: BookingContractStatus = bothSigned ? "signed" : "pending";
  if (canonicalBookingStatus(prev.status) === "CONFIRMED") {
    return patchBookingRecord(bookingId, { contractStatus }) ?? prev;
  }
  if (canonicalBookingStatus(prev.status) === "AWAITING_PAYMENT") {
    return patchBookingRecord(bookingId, { contractStatus }) ?? prev;
  }
  if (prev.status !== "AWAITING_DETAILS") return prev;
  // Con fechas cambiadas que subieron el total, se confirma hasta pagar la diferencia.
  const owesDifference = prev.adjustments?.some((a) => a.kind === "charge" && a.status === "pending");
  if (owesDifference) {
    return patchBookingRecord(bookingId, { contractStatus }) ?? prev;
  }
  const next = transitionBooking(bookingId, "CONFIRMED", {
    actor: "guest",
    reason: "guest_signed_contract",
    contractStatus,
    paymentStatus: paymentStatusOf(prev),
  });
  if (next) notifyBookingConfirmed(next);
  return next;
}

export function expireUnpaidIfDue(booking: BookingRecord, now = Date.now()): BookingRecord {
  if (canonicalBookingStatus(booking.status) !== "AWAITING_PAYMENT") return booking;
  if (paymentStatusOf(booking) === "paid" || booking.paidAt) return booking;
  if (!paymentWindowClosed(booking, now)) return booking;
  const expired = transitionBooking(booking.id, "EXPIRED", {
    actor: "system",
    reason: booking.resumeStatusAfterPay ? "payment_failed_timeout" : "unpaid_timeout",
    paymentStatus: booking.resumeStatusAfterPay ? "failed" : "unpaid",
    patch: { resumeStatusAfterPay: undefined },
  });
  if (!expired) return booking;
  return addContractStamp(booking.id, { kind: "voided" }) ?? expired;
}

export function completeStayIfDue(booking: BookingRecord, stayEnded: boolean): BookingRecord {
  if (canonicalBookingStatus(booking.status) !== "CONFIRMED" || !stayEnded) return booking;
  return (
    transitionBooking(booking.id, "COMPLETED", {
      actor: "system",
      reason: "stay_ended",
      paymentStatus: paymentStatusOf(booking),
      contractStatus: contractStatusOf(booking),
    }) ?? booking
  );
}

export function markBookingPaymentRefunded(bookingId: string): BookingRecord | undefined {
  const prev = getBookingById(bookingId);
  if (!prev) return undefined;
  if (paymentStatusOf(prev) === "refunded" || prev.refundedAt) return prev;
  const next = patchBookingRecord(bookingId, { paymentStatus: "refunded" });
  if (next) enqueueBookingOutbound("booking.refunded", next);
  return next;
}
