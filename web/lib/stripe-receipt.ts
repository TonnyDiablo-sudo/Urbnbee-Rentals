import "server-only";
import type Stripe from "stripe";
import type { BookingRecord } from "@/lib/booking-types";
import { getStripe } from "@/lib/stripe-server";

export type StripeReceipt = {
  /** Comprobante oficial de Stripe; sólo existe si Stripe lo generó. */
  receiptUrl?: string;
  reference: string;
  amountMxn: number;
  paidAt: string;
  card?: { brand: string; last4: string };
};

const TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: StripeReceipt | null }>();

/** Cargo de Stripe de la reserva. null si no se pagó con Stripe o Stripe no responde. */
export async function stripeReceiptOf(b: BookingRecord): Promise<StripeReceipt | null> {
  const sessionId = b.stripeCheckoutSessionId;
  if (!b.paidAt || (!b.stripePaymentIntentId && !sessionId?.startsWith("cs_"))) return null;
  const hit = cache.get(b.id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const stripe = getStripe();
  if (!stripe) return null;
  let value: StripeReceipt | null = null;
  try {
    let piId = b.stripePaymentIntentId ?? null;
    if (!piId && sessionId) {
      const s = await stripe.checkout.sessions.retrieve(sessionId);
      piId = typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null);
    }
    if (piId) {
      const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
      const charge = typeof pi.latest_charge === "object" ? (pi.latest_charge as Stripe.Charge | null) : null;
      if (charge?.paid) {
        const card = charge.payment_method_details?.card;
        value = {
          receiptUrl: charge.receipt_url ?? undefined,
          reference: charge.id,
          amountMxn: charge.amount / 100,
          paidAt: new Date(charge.created * 1000).toISOString(),
          card: card?.last4 ? { brand: card.brand ?? "", last4: card.last4 } : undefined,
        };
      }
    }
  } catch (e) {
    console.warn("[stripe receipt]", b.id, e instanceof Error ? e.message : e);
    return null;
  }
  cache.set(b.id, { at: Date.now(), value });
  return value;
}
