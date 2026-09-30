import "server-only";
import type Stripe from "stripe";
import type { BookingRecord } from "@/lib/booking-types";
import { attachContractIfInstant } from "@/lib/booking-contract";
import { markBookingPaid, paymentStatusOf } from "@/lib/booking-machine";
import { getBookingById } from "@/lib/bookings-store";
import { platformBookingFeeMxn } from "@/lib/platform-fees";
import { notifyHostBookingPaid } from "@/lib/push";

export type SettleBookingPaymentResult =
  | { ok: true; kind: "completed" | "already_settled"; booking: BookingRecord }
  | { ok: false; status: number; error: string };

/**
 * Registra el pago de una reserva a partir de su sesión de Checkout.
 * La llaman el regreso del huésped y el webhook de Stripe, así que es idempotente:
 * quien llegue segundo encuentra la reserva ya liquidada.
 */
export function settleBookingCheckoutSession(
  session: Stripe.Checkout.Session
): SettleBookingPaymentResult {
  if (session.mode !== "payment" || typeof session.metadata?.kind === "string") {
    // `kind` sólo lo llevan los cobros de membresía: son pago único igual que la
    // estancia, así que sin esta guarda un pase se leería como reserva fantasma.
    return { ok: false, status: 400, error: "Esta sesión no corresponde al pago de una reserva." };
  }
  if (session.payment_status !== "paid") {
    return { ok: false, status: 409, error: "El pago no está completado." };
  }

  const bookingId = session.metadata?.bookingId ?? session.client_reference_id;
  if (!bookingId || typeof bookingId !== "string") {
    return { ok: false, status: 400, error: "Sesión sin reserva asociada." };
  }

  const booking = getBookingById(bookingId);
  if (!booking) {
    return { ok: false, status: 404, error: "Reserva no encontrada." };
  }
  if (booking.paidAt || paymentStatusOf(booking) === "paid" || paymentStatusOf(booking) === "refunded") {
    return { ok: true, kind: "already_settled", booking };
  }
  if (booking.status !== "AWAITING_PAYMENT") {
    return { ok: false, status: 409, error: "Reserva ya procesada o inválida." };
  }

  const chargedVia =
    session.metadata?.chargedVia === "host" || booking.chargedVia === "host" ? "host" : "platform";
  const fee =
    chargedVia === "host" ? 0 : (booking.platformFeeMxn ?? platformBookingFeeMxn(booking.estimatedTotalMxn));
  const expectedCents = Math.round((booking.estimatedTotalMxn + fee) * 100);
  const paidCents = session.amount_total ?? 0;
  if (paidCents > 0 && Math.abs(paidCents - expectedCents) > 2) {
    console.warn("[settle-booking] amount mismatch", { bookingId, paidCents, expectedCents });
    return { ok: false, status: 409, error: "El importe pagado no coincide con la reserva." };
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  const next = markBookingPaid(bookingId, {
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
  });
  if (!next) {
    return { ok: false, status: 409, error: "No se pudo actualizar la reserva." };
  }

  const settled = attachContractIfInstant(next);
  notifyHostBookingPaid(settled);
  return { ok: true, kind: "completed", booking: settled };
}
