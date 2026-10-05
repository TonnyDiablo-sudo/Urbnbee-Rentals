import "server-only";
import type Stripe from "stripe";
import { addressProofSlots } from "@/lib/address-proof-access";
import { featuredPlanAmount, featuredPurchaseProblem, isFeaturedPlan } from "@/lib/featured-demand";
import { getHostEntitlement } from "@/lib/host-entitlements-store";
import { hostEntitlementAllowsAccess } from "@/lib/host-entitlement-types";
import { buildMembershipCheckout, membershipPlanCodeFromInput, membershipQuantity } from "@/lib/membership-checkout";
import { primarySkuForPlan } from "@/lib/membership-entitlements";
import { getMembershipPlan, membershipPlanAmount } from "@/lib/membership-plans-store";
import {
  MEMBERSHIP_PLAN_AUDIENCE,
  MEMBERSHIP_PLAN_FAMILY,
  type MembershipPlanCode,
} from "@/lib/membership-plans-types";
import { syncFromSubscription } from "@/lib/stripe-subscription-sync";
import { getVerification, grantBookingPass, identityPlanActive } from "@/lib/verification-store";
import type { VerificationRegion } from "@/lib/verification-types";

/** Marca de la sesión de Checkout que sólo guarda la tarjeta para cobrar el carrito. */
export const STORE_CART_KIND = "store_cart";
export const CART_MAX_ITEMS = 12;

export type CartLine = { code: MembershipPlanCode; quantity: number };

/** Lo que impide comprar un plan, o null si se puede. */
export function catalogPurchaseProblem(
  user: { id: string; role: string },
  code: MembershipPlanCode,
  region: VerificationRegion,
  quantity = 1,
  /** Lo demás que va en el mismo carrito: cuenta para los requisitos del motor. */
  alsoBuying: MembershipPlanCode[] = []
): { error: string; status: number } | null {
  if (MEMBERSHIP_PLAN_AUDIENCE[code] === "host" && user.role !== "host" && user.role !== "admin") {
    return { error: "Esta membresía es para anfitriones.", status: 403 };
  }
  if (MEMBERSHIP_PLAN_FAMILY[code] === "booking_engine" && user.role !== "admin") {
    const families = new Set(alsoBuying.map((c) => MEMBERSHIP_PLAN_FAMILY[c]));
    const identity =
      identityPlanActive(user.id) || families.has("guest_membership") || families.has("host_verification");
    const address = addressProofSlots(user.id) > 0 || families.has("address_proof");
    if (!identity || !address) {
      return {
        error:
          !identity && !address
            ? "El motor de reservas requiere la verificación de identidad y la verificación de dirección. Agrégalas a tu carrito o cómpralas antes."
            : !identity
              ? "El motor de reservas requiere la verificación de identidad. Agrégala a tu carrito o cómprala antes."
              : "El motor de reservas requiere la verificación de dirección de tus anuncios. Agrégala a tu carrito o cómprala antes.",
        status: 412,
      };
    }
  }
  const plan = getMembershipPlan(code);
  if (!plan || !plan.active || membershipPlanAmount(plan, region) <= 0) {
    return { error: "Ese plan no tiene precio para esta región. Ponlo en /admin/pricing.", status: 400 };
  }
  if (MEMBERSHIP_PLAN_FAMILY[code] === "guest_membership" && identityPlanActive(user.id)) {
    return { error: "Ya tienes la verificación de identidad activa.", status: 409 };
  }
  const sku = primarySkuForPlan(code);
  const row = sku ? getHostEntitlement(user.id, sku) : undefined;
  if (row && row.status !== "cancelled" && hostEntitlementAllowsAccess(row.status)) {
    return {
      error:
        row.quantity === undefined
          ? "Ya tienes este producto activo."
          : "Ya tienes este producto. Cambia la cantidad desde la Tienda; para cambiar de plazo, cancela el actual y compra el nuevo al vencer.",
      status: 409,
    };
  }
  // 410 y no 409: chargeLine lee 409 como «ya lo tiene» y no cobraría.
  const soldOut = isFeaturedPlan(code) ? featuredPurchaseProblem(quantity) : null;
  if (soldOut) return { error: soldOut.error, status: 410 };
  return null;
}

/** Valida lo que manda el navegador: planes reales, uno por producto, cantidades dentro del límite. */
export function parseCart(raw: unknown): CartLine[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > CART_MAX_ITEMS) return null;
  const out: CartLine[] = [];
  const families = new Set<string>();
  for (const it of raw) {
    const code = membershipPlanCodeFromInput((it as { plan?: unknown })?.plan);
    if (!code) return null;
    const family = MEMBERSHIP_PLAN_FAMILY[code];
    if (families.has(family)) return null;
    families.add(family);
    out.push({ code, quantity: membershipQuantity(code, (it as { quantity?: unknown }).quantity) });
  }
  return out;
}

export function cartTotal(lines: CartLine[], region: VerificationRegion): number {
  let total = 0;
  for (const l of lines) {
    const plan = getMembershipPlan(l.code);
    if (plan) total += featuredPlanAmount(plan, region) * l.quantity;
  }
  return Math.round(total * 100) / 100;
}

export function encodeCart(lines: CartLine[]): string {
  return lines.map((l) => `${l.code}*${l.quantity}`).join(",");
}

function decodeCart(raw: unknown): CartLine[] {
  if (typeof raw !== "string" || !raw) return [];
  return parseCart(raw.split(",").map((s) => {
    const [plan, q] = s.split("*");
    return { plan, quantity: Number(q) };
  })) ?? [];
}

export type CartLineResult = { code: MembershipPlanCode; ok: boolean; error?: string };
export type CartResult = { ok: boolean; userId?: string; lines: CartLineResult[]; error?: string };

function declineMessage(e: unknown): string {
  const code = (e as { code?: string; decline_code?: string })?.code;
  if (code === "card_declined" || code === "insufficient_funds" || code === "expired_card") {
    return "El banco rechazó el cobro de este producto.";
  }
  if (code === "authentication_required" || code === "subscription_payment_intent_requires_action") {
    return "Tu banco pidió confirmar este cobro. Déjalo solo en tu carrito y paga de nuevo.";
  }
  return "No se pudo cobrar este producto.";
}

async function chargeLine(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  line: CartLine,
  userId: string,
  region: VerificationRegion,
  customer: string,
  paymentMethod: string
): Promise<CartLineResult> {
  const { code, quantity } = line;
  const key = `cart_${session.id}_${code}`;
  if (catalogPurchaseProblem({ id: userId, role: "admin" }, code, region)?.status === 409) {
    return { code, ok: true };
  }
  const pieces = await buildMembershipCheckout(stripe, code, region, userId, quantity);
  if ("error" in pieces) return { code, ok: false, error: "Este producto ya no está disponible." };
  const row = pieces.lineItems[0];
  const price = row.price_data;
  if (!price?.product || typeof price.unit_amount !== "number") {
    return { code, ok: false, error: "Este producto ya no está disponible." };
  }

  try {
    if (pieces.mode === "payment") {
      if (getVerification(userId)?.grantedPassSessionIds?.includes(key)) return { code, ok: true };
      const pi = await stripe.paymentIntents.create(
        {
          amount: price.unit_amount,
          currency: price.currency,
          customer,
          payment_method: paymentMethod,
          off_session: true,
          confirm: true,
          metadata: pieces.metadata,
        },
        { idempotencyKey: key }
      );
      if (pi.status !== "succeeded") return { code, ok: false, error: "No se pudo cobrar este producto." };
      grantBookingPass(userId, key);
      return { code, ok: true };
    }
    if (!price.recurring) return { code, ok: false, error: "Este producto ya no está disponible." };
    const sub = await stripe.subscriptions.create(
      {
        customer,
        default_payment_method: paymentMethod,
        items: [
          {
            quantity: row.quantity ?? 1,
            price_data: {
              currency: price.currency,
              product: price.product,
              unit_amount: price.unit_amount,
              recurring: { interval: price.recurring.interval, interval_count: price.recurring.interval_count },
            },
          },
        ],
        metadata: pieces.subscriptionMetadata,
        payment_behavior: "error_if_incomplete",
        off_session: true,
      },
      { idempotencyKey: key }
    );
    await syncFromSubscription(sub, userId);
    return { code, ok: true };
  } catch (e) {
    console.warn("[store cart] cobro", { session: session.id, code, err: e instanceof Error ? e.message : String(e) });
    return { code, ok: false, error: declineMessage(e) };
  }
}

async function runFulfill(stripe: Stripe, sessionId: string): Promise<CartResult> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["setup_intent"] });
  const userId = typeof session.metadata?.userId === "string" ? session.metadata.userId : "";
  if (session.mode !== "setup" || session.metadata?.kind !== STORE_CART_KIND || !userId) {
    return { ok: false, lines: [], error: "Ese pago no es de la Tienda." };
  }
  if (session.status !== "complete") return { ok: false, userId, lines: [], error: "Todavía no se confirma tu tarjeta." };

  const si = session.setup_intent;
  const setup = typeof si === "string" ? await stripe.setupIntents.retrieve(si) : si;
  const paymentMethod = typeof setup?.payment_method === "string" ? setup.payment_method : setup?.payment_method?.id;
  const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!paymentMethod || !customer) return { ok: false, userId, lines: [], error: "Stripe no devolvió la tarjeta." };
  const region: VerificationRegion = session.metadata?.region === "us" ? "us" : "mx";

  await stripe.customers
    .update(customer, { invoice_settings: { default_payment_method: paymentMethod } })
    .catch((e) => console.warn("[store cart] tarjeta predeterminada", e instanceof Error ? e.message : e));

  const lines: CartLineResult[] = [];
  for (const line of decodeCart(session.metadata?.cart)) {
    lines.push(await chargeLine(stripe, session, line, userId, region, customer, paymentMethod));
  }
  return { ok: lines.length > 0 && lines.every((l) => l.ok), userId, lines };
}

const inflight = new Map<string, Promise<CartResult>>();

/**
 * Cobra cada producto del carrito con la tarjeta que se guardó en Checkout. Cada uno es su
 * propia suscripción (así se cancela o cambia de cantidad por separado). Lo llaman el regreso
 * del navegador y el webhook; las llaves de idempotencia evitan cobrar dos veces.
 */
export function fulfillCartSession(stripe: Stripe, sessionId: string): Promise<CartResult> {
  const running = inflight.get(sessionId);
  if (running) return running;
  const p = runFulfill(stripe, sessionId).then(
    (r) => {
      if (r.lines.length === 0) inflight.delete(sessionId);
      else setTimeout(() => inflight.delete(sessionId), 60_000);
      return r;
    },
    (e) => {
      inflight.delete(sessionId);
      throw e;
    }
  );
  inflight.set(sessionId, p);
  return p;
}
