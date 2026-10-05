import "server-only";
import Stripe from "stripe";
import { getHostPaymentSecrets } from "@/lib/host-payment-store";
import { allowSimulatedBookingPayment } from "@/lib/stripe-server";

export const HOST_WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
];

/** HOST_STRIPE_API_URL only exists so tests can point the host's Stripe at a local mock. */
function stripeFor(secretKey: string): Stripe {
  const override = process.env.HOST_STRIPE_API_URL?.trim();
  if (!override) return new Stripe(secretKey.trim());
  const u = new URL(override);
  return new Stripe(secretKey.trim(), {
    host: u.hostname,
    port: u.port ? Number(u.port) : undefined,
    protocol: u.protocol === "http:" ? "http" : "https",
  });
}

export function getHostStripe(hostId: string): Stripe | null {
  const secrets = getHostPaymentSecrets(hostId);
  if (!secrets?.stripeSecretKey) return null;
  return stripeFor(secrets.stripeSecretKey);
}

/** Cabibee nunca cobra estancias: sin Stripe del anfitrión no hay reserva en línea (salvo demo sin Stripe). */
export function hostCanTakeBookingPayments(hostId: string): boolean {
  return Boolean(getHostPaymentSecrets(hostId)?.stripeSecretKey) || allowSimulatedBookingPayment();
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

function errText(e: unknown, fallback: string): string {
  return (e instanceof Error ? e.message : fallback).slice(0, 280);
}

export async function verifyHostStripeKey(secretKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const stripe = stripeFor(secretKey);
  try {
    await stripe.balance.retrieve();
    return { ok: true };
  } catch (e1) {
    try {
      await stripe.checkout.sessions.list({ limit: 1 });
      return { ok: true };
    } catch (e2) {
      return { ok: false, error: errText(e2 ?? e1, "Llave inválida.") };
    }
  }
}

/**
 * Creates the Cabibee webhook inside the host's own Stripe account. Stripe only reveals the
 * signing secret on creation, so an older endpoint with the same URL is replaced.
 */
export async function createHostWebhook(
  secretKey: string,
  url: string,
  hostId: string
): Promise<{ ok: true; secret: string; id: string } | { ok: false; error: string }> {
  if (!/^https:\/\//.test(url) && !process.env.HOST_STRIPE_API_URL) {
    return { ok: false, error: "Stripe sólo acepta webhooks con https; en este servidor hay que crearlo a mano." };
  }
  const stripe = stripeFor(secretKey);
  try {
    const existing = await stripe.webhookEndpoints.list({ limit: 100 });
    for (const w of existing.data) {
      if (w.url === url) await stripe.webhookEndpoints.del(w.id);
    }
    const ep = await stripe.webhookEndpoints.create({
      url,
      enabled_events: HOST_WEBHOOK_EVENTS,
      description: "Cabibee: pagos de reservas",
      metadata: { cabibee_host: hostId },
    });
    if (!ep.secret) return { ok: false, error: "Stripe no devolvió el signing secret." };
    return { ok: true, secret: ep.secret, id: ep.id };
  } catch (e) {
    return { ok: false, error: errText(e, "No se pudo crear el webhook.") };
  }
}

export async function deleteHostWebhook(secretKey: string, endpointId: string): Promise<void> {
  try {
    await stripeFor(secretKey).webhookEndpoints.del(endpointId);
  } catch (e) {
    console.warn("[host-stripe] webhook delete", errText(e, ""));
  }
}

export type HostStripeAccountInfo = {
  name: string | null;
  email: string | null;
  country: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  livemode: boolean;
};

const accountCache = new Map<string, { at: number; info: HostStripeAccountInfo | null }>();

export async function hostStripeAccountInfo(
  hostId: string,
  opts: { fresh?: boolean } = {}
): Promise<HostStripeAccountInfo | null> {
  const secrets = getHostPaymentSecrets(hostId);
  if (!secrets) return null;
  const cacheKey = `${hostId}:${secrets.stripeSecretKey.slice(-6)}`;
  const hit = accountCache.get(cacheKey);
  if (!opts.fresh && hit && Date.now() - hit.at < 5 * 60_000) return hit.info;
  let info: HostStripeAccountInfo | null = null;
  try {
    const a = await stripeFor(secrets.stripeSecretKey).accounts.retrieveCurrent();
    info = {
      name: a.business_profile?.name || a.settings?.dashboard?.display_name || null,
      email: a.email ?? null,
      country: a.country ?? null,
      chargesEnabled: Boolean(a.charges_enabled),
      payoutsEnabled: Boolean(a.payouts_enabled),
      detailsSubmitted: Boolean(a.details_submitted),
      livemode: !secrets.stripeSecretKey.includes("_test_"),
    };
  } catch (e) {
    console.warn("[host-stripe] account", hostId, errText(e, ""));
  }
  accountCache.set(cacheKey, { at: Date.now(), info });
  return info;
}
