import "server-only";
import { randomBytes } from "crypto";
import type Stripe from "stripe";
import type { BookingAdjustment, BookingRecord } from "@/lib/booking-types";
import { confirmBookingAfterGuestContract } from "@/lib/booking-machine";
import { recordBookingTransaction } from "@/lib/booking-transactions";
import { getBookingById, patchBookingRecord } from "@/lib/bookings-store";
import { getHostStripe } from "@/lib/host-stripe";
import { getListingById } from "@/lib/marketplace-store";
import { platformBookingFeeMxn } from "@/lib/platform-fees";
import { notifyGuestDifferenceRefunded, notifyHostDifferencePaid } from "@/lib/push";
import { cabibeeMeta } from "@/lib/stripe-app-meta";
import { allowSimulatedBookingPayment, getStripe } from "@/lib/stripe-server";

function nowIso() {
  return new Date().toISOString();
}

/** Lo que el huésped ya pagó de la estancia (sin cargo de plataforma). */
export function paidStayOf(b: BookingRecord): number {
  if (!b.paidAt) return 0;
  return b.paidStayMxn ?? b.estimatedTotalMxn;
}

export function pendingAdjustment(b: BookingRecord): BookingAdjustment | undefined {
  return b.adjustments?.find((a) => a.kind === "charge" && a.status === "pending");
}

/** Total que falta pagar por cambio de fechas (diferencia + cargo de plataforma). */
export function bookingBalanceDueMxn(b: BookingRecord): number {
  if (!b.paidAt || b.refundedAt) return 0;
  const a = pendingAdjustment(b);
  return a ? a.amountMxn + a.feeMxn : 0;
}

/** El cargo de plataforma del nuevo total menos el ya cobrado (así el mínimo no se cobra dos veces). */
function feeForDifference(b: BookingRecord): number {
  if (b.chargedVia === "host" || !(b.platformFeeMxn && b.platformFeeMxn > 0)) return 0;
  return Math.max(0, platformBookingFeeMxn(b.estimatedTotalMxn) - b.platformFeeMxn);
}

function stripeFor(b: BookingRecord) {
  return b.chargedVia === "host" ? getHostStripe(b.hostId) : getStripe();
}

function isSimulated(b: BookingRecord) {
  return b.stripeCheckoutSessionId === "simulated" || allowSimulatedBookingPayment();
}

function adjId() {
  return `adj_${randomBytes(6).toString("hex")}`;
}

async function paymentIntentOf(stripe: Stripe, b: BookingRecord): Promise<string | null> {
  if (b.stripePaymentIntentId) return b.stripePaymentIntentId;
  if (!b.stripeCheckoutSessionId?.startsWith("cs_")) return null;
  const s = await stripe.checkout.sessions.retrieve(b.stripeCheckoutSessionId);
  const pi = typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null);
  if (pi) patchBookingRecord(b.id, { stripePaymentIntentId: pi });
  return pi;
}

/**
 * Tras cambiar fechas/alojamiento de una reserva pagada: si sube, deja un cobro pendiente
 * (la reserva no se confirma hasta pagarlo); si baja, devuelve la diferencia.
 * `paidStayMxn` debe reflejar lo cobrado antes del cambio.
 */
export async function reconcileBookingTotal(bookingId: string): Promise<{
  booking: BookingRecord | undefined;
  dueMxn: number;
  refundedMxn: number;
}> {
  const b = getBookingById(bookingId);
  if (!b || !b.paidAt || b.refundedAt) return { booking: b, dueMxn: 0, refundedMxn: 0 };

  const adjustments = (b.adjustments ?? []).map((a) =>
    a.kind === "charge" && a.status === "pending" ? { ...a, status: "void" as const, settledAt: nowIso() } : a
  );
  const diff = b.estimatedTotalMxn - paidStayOf(b);

  if (diff > 0) {
    const charge: BookingAdjustment = {
      id: adjId(),
      kind: "charge",
      amountMxn: diff,
      feeMxn: feeForDifference(b),
      status: "pending",
      reason: "dates_changed",
      createdAt: nowIso(),
    };
    const next = patchBookingRecord(b.id, { adjustments: [...adjustments, charge] });
    return { booking: next, dueMxn: charge.amountMxn + charge.feeMxn, refundedMxn: 0 };
  }

  if (diff < 0) {
    const stayBack = -diff;
    const oldFee = b.platformFeeMxn ?? 0;
    const newFee = b.chargedVia === "host" || oldFee <= 0 ? oldFee : platformBookingFeeMxn(b.estimatedTotalMxn);
    const feeBack = Math.max(0, oldFee - newFee);
    const refund: BookingAdjustment = {
      id: adjId(),
      kind: "refund",
      amountMxn: stayBack,
      feeMxn: feeBack,
      status: "refunded",
      reason: "dates_changed",
      createdAt: nowIso(),
      settledAt: nowIso(),
    };

    if (isSimulated(b)) {
      refund.stripeRefundId = "simulated";
    } else {
      const stripe = stripeFor(b);
      try {
        const pi = stripe ? await paymentIntentOf(stripe, b) : null;
        if (!stripe || !pi) throw new Error("sin cobro localizable");
        const r = await stripe.refunds.create(
          {
            payment_intent: pi,
            amount: Math.round((stayBack + feeBack) * 100),
            reason: "requested_by_customer",
            metadata: cabibeeMeta({ bookingId: b.id, refundReason: "dates_changed" }),
          },
          { idempotencyKey: `booking_diff_refund_${b.id}_${b.estimatedTotalMxn}` }
        );
        if (r.status === "failed" || r.status === "canceled") throw new Error(`refund ${r.status}`);
        refund.stripeRefundId = r.id;
      } catch (e) {
        console.warn("[adjustments] partial refund failed", b.id, e);
        refund.status = "failed";
      }
    }

    const ok = refund.status === "refunded";
    const next = patchBookingRecord(b.id, {
      adjustments: [...adjustments, refund],
      ...(ok ? { paidStayMxn: b.estimatedTotalMxn, platformFeeMxn: newFee } : {}),
    });
    if (ok && next) notifyGuestDifferenceRefunded(next, stayBack + feeBack);
    return { booking: next, dueMxn: 0, refundedMxn: ok ? stayBack + feeBack : 0 };
  }

  const voided = adjustments.some((a, i) => a !== b.adjustments?.[i]);
  return { booking: voided ? patchBookingRecord(b.id, { adjustments }) : b, dueMxn: 0, refundedMxn: 0 };
}

/** Marca pagada la diferencia y, si ya firmaron ambos, confirma la reserva. Idempotente. */
export function markAdjustmentPaid(
  bookingId: string,
  adjustmentId: string,
  opts: { sessionId?: string; paymentIntentId?: string }
): BookingRecord | undefined {
  const b = getBookingById(bookingId);
  const a = b?.adjustments?.find((x) => x.id === adjustmentId);
  if (!b || !a) return undefined;
  if (a.status === "paid") return b;
  const adjustments = b.adjustments!.map((x) =>
    x.id === adjustmentId
      ? {
          ...x,
          status: "paid" as const,
          settledAt: nowIso(),
          stripeCheckoutSessionId: opts.sessionId ?? x.stripeCheckoutSessionId,
          stripePaymentIntentId: opts.paymentIntentId ?? x.stripePaymentIntentId,
        }
      : x
  );
  const saved = patchBookingRecord(bookingId, {
    adjustments,
    paidStayMxn: paidStayOf(b) + a.amountMxn,
    platformFeeMxn: (b.platformFeeMxn ?? 0) + a.feeMxn,
  });
  if (!saved) return undefined;
  notifyHostDifferencePaid(saved, a.amountMxn + a.feeMxn);
  return confirmBookingAfterGuestContract(saved.id) ?? saved;
}

export type StartAdjustmentResult =
  | { ok: true; checkoutUrl: string }
  | { ok: true; simulated: true; booking: BookingRecord }
  | { ok: false; status: number; error: string };

/** Abre el cobro de la diferencia en la misma cuenta de Stripe donde se pagó la estancia. */
export async function startAdjustmentCheckout(
  b: BookingRecord,
  urls: { successUrl: string; cancelUrl: string }
): Promise<StartAdjustmentResult> {
  const a = pendingAdjustment(b);
  if (!a) return { ok: false, status: 409, error: "No hay diferencia pendiente de pago." };

  if (isSimulated(b)) {
    const next = markAdjustmentPaid(b.id, a.id, { sessionId: "simulated" });
    return next
      ? { ok: true, simulated: true, booking: next }
      : { ok: false, status: 500, error: "No se pudo registrar el pago." };
  }

  const stripe = stripeFor(b);
  if (!stripe) {
    return {
      ok: false,
      status: 503,
      error:
        b.chargedVia === "host"
          ? "El Stripe del anfitrión ya no está conectado; pídele que lo reconecte."
          : "Pago no disponible: Stripe no está configurado.",
    };
  }

  const title = getListingById(b.hostAdjustedListingId ?? b.listingId)?.title ?? "Reserva Cabibee";
  const stayCents = Math.max(1, Math.round(a.amountMxn * 100));
  const feeCents = Math.max(0, Math.round(a.feeMxn * 100));
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "mxn",
            unit_amount: stayCents,
            product_data: {
              name: `${title.slice(0, 90)} — Diferencia por cambio de fechas`,
              description: `${b.hostAdjustedCheckIn ?? b.checkIn} → ${b.hostAdjustedCheckOut ?? b.checkOut}`,
            },
          },
        },
        ...(feeCents > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: "mxn" as const,
                  unit_amount: feeCents,
                  product_data: { name: "Cargo de servicio" },
                },
              },
            ]
          : []),
      ],
      success_url: urls.successUrl,
      cancel_url: urls.cancelUrl,
      metadata: cabibeeMeta({
        bookingId: b.id,
        bookingAdjustmentId: a.id,
        guestUserId: b.guestUserId ?? "",
        hostId: b.hostId,
        chargedVia: b.chargedVia ?? "platform",
      }),
      payment_intent_data: {
        metadata: cabibeeMeta({ bookingId: b.id, bookingAdjustmentId: a.id, hostId: b.hostId }),
      },
      client_reference_id: b.id,
    });
    patchBookingRecord(b.id, {
      adjustments: (b.adjustments ?? []).map((x) => (x.id === a.id ? { ...x, stripeCheckoutSessionId: session.id } : x)),
    });
    recordBookingTransaction({
      bookingId: b.id,
      hostId: b.hostId,
      chargedVia: b.chargedVia ?? "platform",
      providerRef: session.id,
      amountCents: stayCents + feeCents,
      currency: "mxn",
      status: "created",
    });
    if (!session.url) return { ok: false, status: 502, error: "Stripe no devolvió URL de pago." };
    return { ok: true, checkoutUrl: session.url };
  } catch (e) {
    console.warn("[adjustments] checkout", b.id, e);
    return { ok: false, status: 502, error: "No se pudo iniciar el pago con Stripe." };
  }
}

/** Liquida la sesión de Checkout de una diferencia (regreso del huésped o webhook). */
export function settleAdjustmentCheckoutSession(
  session: Stripe.Checkout.Session
): { ok: true; booking: BookingRecord } | { ok: false; status: number; error: string } {
  const bookingId = session.metadata?.bookingId;
  const adjustmentId = session.metadata?.bookingAdjustmentId;
  if (!bookingId || !adjustmentId) return { ok: false, status: 400, error: "Sesión sin diferencia asociada." };
  if (session.payment_status !== "paid") return { ok: false, status: 409, error: "El pago no está completado." };
  const b = getBookingById(bookingId);
  const a = b?.adjustments?.find((x) => x.id === adjustmentId);
  if (!b || !a) return { ok: false, status: 404, error: "Reserva no encontrada." };
  if (a.status === "paid") return { ok: true, booking: b };
  if (a.status !== "pending") return { ok: false, status: 409, error: "Este cobro ya no está vigente." };
  const expected = Math.round((a.amountMxn + a.feeMxn) * 100);
  const paid = session.amount_total ?? 0;
  if (paid > 0 && Math.abs(paid - expected) > 2) {
    console.warn("[adjustments] amount mismatch", { bookingId, paid, expected });
    return { ok: false, status: 409, error: "El importe pagado no coincide con la diferencia." };
  }
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const next = markAdjustmentPaid(bookingId, adjustmentId, { sessionId: session.id, paymentIntentId: pi });
  return next ? { ok: true, booking: next } : { ok: false, status: 500, error: "No se pudo actualizar la reserva." };
}
