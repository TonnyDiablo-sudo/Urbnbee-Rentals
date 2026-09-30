import "server-only";
import type Stripe from "stripe";
import type { BookingRecord, BookingRefundReason } from "@/lib/booking-types";
import { enqueueBookingOutbound } from "@/lib/beeagent-outbound";
import { getBookingById, patchBookingRecord } from "@/lib/bookings-store";
import { platformBookingFeeMxn } from "@/lib/platform-fees";
import { getHostStripe } from "@/lib/host-stripe";
import { cabibeeMeta } from "@/lib/stripe-app-meta";
import { allowSimulatedBookingPayment, getStripe } from "@/lib/stripe-server";

function stripeForBookingRefund(booking: BookingRecord) {
  if (booking.chargedVia === "host") return getHostStripe(booking.hostId);
  return getStripe();
}

/** Qué pasó con el dinero: nada que devolver, devuelto ahora, ya estaba devuelto, o demo. */
export type BookingRefundKind = "not_needed" | "created" | "already_refunded" | "simulated";

export type BookingRefundResult =
  | { ok: true; kind: BookingRefundKind; booking: BookingRecord }
  | { ok: false; status: number; error: string };

function totalPaidMxn(booking: BookingRecord): number {
  const fee = booking.platformFeeMxn ?? platformBookingFeeMxn(booking.estimatedTotalMxn);
  return booking.estimatedTotalMxn + fee;
}

/** El cobro se guarda como sesión de Checkout; el PaymentIntent se resuelve la primera vez. */
async function resolvePaymentIntentId(
  stripe: Stripe,
  booking: BookingRecord
): Promise<string | null> {
  if (booking.stripePaymentIntentId) return booking.stripePaymentIntentId;

  const sessionId = booking.stripeCheckoutSessionId;
  if (!sessionId || !sessionId.startsWith("cs_")) return null;

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const pi =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  if (!pi) return null;

  patchBookingRecord(booking.id, { stripePaymentIntentId: pi });
  return pi;
}

function stripeErrorCode(e: unknown): string | undefined {
  if (typeof e === "object" && e && "code" in e) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

/**
 * Devuelve el total cobrado al huésped (estancia + cargo de servicio) de una reserva pagada.
 * Idempotente: repetirla no genera un segundo reembolso.
 */
export async function refundBookingPayment(
  bookingId: string,
  reason: BookingRefundReason
): Promise<BookingRefundResult> {
  const booking = getBookingById(bookingId);
  if (!booking) return { ok: false, status: 404, error: "Reserva no encontrada." };

  if (!booking.paidAt) return { ok: true, kind: "not_needed", booking };
  if (booking.refundedAt) return { ok: true, kind: "already_refunded", booking };

  function recorded(next: BookingRecord, kind: BookingRefundKind): BookingRefundResult {
    enqueueBookingOutbound("booking.refunded", next);
    return { ok: true, kind, booking: next };
  }

  // Modo demo: el pago nunca existió en Stripe, así que el reembolso solo se registra.
  if (booking.stripeCheckoutSessionId === "simulated" || allowSimulatedBookingPayment()) {
    const next = patchBookingRecord(bookingId, {
      refundedAt: new Date().toISOString(),
      refundAmountMxn: totalPaidMxn(booking),
      refundReason: reason,
      stripeRefundId: "simulated",
      paymentStatus: "refunded",
    });
    return next
      ? recorded(next, "simulated")
      : { ok: false, status: 500, error: "No se pudo registrar el reembolso." };
  }

  const stripe = stripeForBookingRefund(booking);
  if (!stripe) {
    return {
      ok: false,
      status: 503,
      error:
        booking.chargedVia === "host"
          ? "Esta estancia se cobró en el Stripe del anfitrión y ya no está conectado."
          : "Reembolso no disponible: Stripe no está configurado.",
    };
  }

  let paymentIntentId: string | null = null;
  try {
    paymentIntentId = await resolvePaymentIntentId(stripe, booking);
  } catch (e) {
    console.warn("[refund] resolve payment intent", bookingId, e);
    return { ok: false, status: 502, error: "No se pudo localizar el cobro en Stripe." };
  }
  if (!paymentIntentId) {
    return {
      ok: false,
      status: 409,
      error: "Esta reserva está marcada como pagada pero no tiene un cobro localizable en Stripe.",
    };
  }

  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        reason: "requested_by_customer",
        metadata: cabibeeMeta({ bookingId: booking.id, refundReason: reason }),
      },
      { idempotencyKey: `booking_refund_${booking.id}` }
    );
  } catch (e) {
    // Si ya se devolvió por fuera (panel de Stripe), no es un error: solo hay que registrarlo.
    if (stripeErrorCode(e) === "charge_already_refunded") {
      const next = patchBookingRecord(bookingId, {
        refundedAt: new Date().toISOString(),
        refundAmountMxn: totalPaidMxn(booking),
        refundReason: reason,
        paymentStatus: "refunded",
      });
      return next
        ? recorded(next, "already_refunded")
        : { ok: false, status: 500, error: "No se pudo registrar el reembolso." };
    }
    console.warn("[refund] create", bookingId, e);
    return { ok: false, status: 502, error: "Stripe rechazó el reembolso." };
  }

  if (refund.status === "failed" || refund.status === "canceled") {
    console.warn("[refund] status", bookingId, refund.id, refund.status);
    return { ok: false, status: 502, error: "El reembolso no se pudo completar en Stripe." };
  }

  const next = patchBookingRecord(bookingId, {
    refundedAt: new Date().toISOString(),
    refundAmountMxn: Math.round(refund.amount) / 100,
    stripeRefundId: refund.id,
    refundReason: reason,
    paymentStatus: "refunded",
  });

  return next
    ? recorded(next, "created")
    : { ok: false, status: 500, error: "El reembolso se hizo pero no se pudo guardar." };
}
