import "server-only";
import Stripe from "stripe";

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

export function constructStripeWebhookEvent(
  rawBody: string | Buffer,
  signature: string | null
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const stripe = getStripe();
  if (!secret || !stripe) {
    throw new Error("Stripe webhook no configurado.");
  }
  if (!signature) {
    throw new Error("Falta stripe-signature.");
  }
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

/** Permite completar pago sin Stripe (solo desarrollo / demo). */
export function allowSimulatedBookingPayment(): boolean {
  if (process.env.STRIPE_SECRET_KEY?.trim()) return false;
  return true;
}
