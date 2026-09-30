import type Stripe from "stripe";

/** Cuenta Stripe compartida con urbnbeeai: todo lo nuestro lleva esta etiqueta. */
export const STRIPE_APP_CABIBEE = "cabibee";

export function cabibeeMeta(extra: Record<string, string> = {}): Record<string, string> {
  return { app: STRIPE_APP_CABIBEE, ...extra };
}

export function isCabibeeStripeMetadata(
  meta: Stripe.Metadata | Record<string, string> | null | undefined
): boolean {
  if (!meta) return false;
  const app = meta.app;
  if (app === STRIPE_APP_CABIBEE) return true;
  if (typeof app === "string" && app.length > 0) return false;
  if (typeof meta.userId === "string" && meta.userId) return true;
  if (typeof meta.bookingId === "string" && meta.bookingId) return true;
  if (typeof meta.kind === "string" && meta.kind) return true;
  return false;
}

export function stripeEventBelongsToCabibee(event: Stripe.Event): boolean {
  const obj = event.data.object as { metadata?: Stripe.Metadata | null };
  return isCabibeeStripeMetadata(obj?.metadata);
}
