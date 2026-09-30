import "server-only";
import Stripe from "stripe";
import { getHostPaymentSecrets } from "@/lib/host-payment-store";

export function getHostStripe(hostId: string): Stripe | null {
  const secrets = getHostPaymentSecrets(hostId);
  if (!secrets?.stripeSecretKey) return null;
  return new Stripe(secrets.stripeSecretKey);
}

export function constructHostStripeEvent(
  hostId: string,
  rawBody: string,
  signature: string | null
): Stripe.Event {
  const secrets = getHostPaymentSecrets(hostId);
  if (!secrets?.webhookSecret) {
    throw new Error("Este anfitrión no tiene webhook secret guardado.");
  }
  if (!signature) throw new Error("Falta stripe-signature.");
  const stripe = getHostStripe(hostId);
  if (!stripe) throw new Error("Stripe del anfitrión no conectado.");
  return stripe.webhooks.constructEvent(rawBody, signature, secrets.webhookSecret);
}

export async function verifyHostStripeKey(secretKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const stripe = new Stripe(secretKey.trim());
  try {
    await stripe.balance.retrieve();
    return { ok: true };
  } catch (e1) {
    try {
      await stripe.checkout.sessions.list({ limit: 1 });
      return { ok: true };
    } catch (e2) {
      const msg =
        e2 instanceof Error ? e2.message : e1 instanceof Error ? e1.message : "Llave inválida.";
      return { ok: false, error: msg.slice(0, 280) };
    }
  }
}
