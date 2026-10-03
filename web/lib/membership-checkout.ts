import "server-only";
import type Stripe from "stripe";
import {
  getMembershipPlan,
  isMembershipPlanCode,
  membershipPlanAmount,
  membershipPlanCurrency,
} from "@/lib/membership-plans-store";
import {
  MEMBERSHIP_PLAN_AUDIENCE,
  MEMBERSHIP_PLAN_BILLING,
  MEMBERSHIP_PLAN_MAX_QUANTITY,
  MEMBERSHIP_PLAN_UNIT,
  type MembershipPlanCode,
} from "@/lib/membership-plans-types";
import { primarySkuForPlan } from "@/lib/membership-entitlements";
import { cabibeeMeta } from "@/lib/stripe-app-meta";
import { membershipProductIdForCheckout } from "@/lib/stripe-membership-products";
import type { VerificationRegion } from "@/lib/verification-types";

/** Marca en la metadata del pago para distinguirlo del pago de una reserva. */
export const MEMBERSHIP_PASS_KIND = "membership_pass";

export type MembershipCheckoutPieces = {
  mode: "payment" | "subscription";
  lineItems: NonNullable<Stripe.Checkout.SessionCreateParams["line_items"]>;
  metadata: Record<string, string>;
  /** Sólo en suscripción: Stripe copia esto a la suscripción creada. */
  subscriptionMetadata?: Record<string, string>;
};

export type MembershipCheckoutProblem =
  | { error: "unknown_plan" }
  | { error: "not_offered"; planLabel: string }
  | { error: "no_product"; planLabel: string };

/**
 * Arma el cobro de un plan del catálogo con **monto libre**.
 *
 * El renglón lleva el Producto de Stripe (el nombre) y el monto que dice el catálogo
 * en este instante. No hay Price fijo, así que mover el precio en /admin/pricing no
 * obliga a crear ni archivar nada en Stripe: el próximo checkout cobra el número nuevo.
 */
export async function buildMembershipCheckout(
  stripe: Stripe,
  code: MembershipPlanCode,
  region: VerificationRegion,
  userId: string,
  rawQuantity = 1
): Promise<MembershipCheckoutPieces | MembershipCheckoutProblem> {
  const quantity = membershipQuantity(code, rawQuantity);
  const plan = getMembershipPlan(code);
  if (!plan) return { error: "unknown_plan" };

  const amount = membershipPlanAmount(plan, region);
  if (!plan.active || amount <= 0) return { error: "not_offered", planLabel: plan.label };

  const productId = await membershipProductIdForCheckout(stripe, code);
  if (!productId) return { error: "no_product", planLabel: plan.label };

  const currency = membershipPlanCurrency(region);
  const unitAmount = Math.round(amount * 100);
  const billing = MEMBERSHIP_PLAN_BILLING[code];

  if (billing.kind === "one_time") {
    return {
      mode: "payment",
      lineItems: [
        {
          quantity: 1,
          price_data: { currency, product: productId, unit_amount: unitAmount },
        },
      ],
      // `kind` es lo que evita que el webhook confunda este pago con el de una
      // reserva: los dos llegan como checkout.session.completed en modo payment.
      metadata: cabibeeMeta({
        userId,
        kind: MEMBERSHIP_PASS_KIND,
        planCode: code,
        audience: MEMBERSHIP_PLAN_AUDIENCE[code],
      }),
    };
  }

  const sku = MEMBERSHIP_PLAN_AUDIENCE[code] === "host" ? (primarySkuForPlan(code) ?? "cabibee_booking_engine") : null;
  return {
    mode: "subscription",
    lineItems: [
      {
        quantity,
        price_data: {
          currency,
          product: productId,
          unit_amount: unitAmount,
          recurring: { interval: "month", interval_count: billing.intervalCount },
        },
      },
    ],
    metadata: cabibeeMeta({
      userId,
      kind: "membership_subscription",
      planCode: code,
      audience: MEMBERSHIP_PLAN_AUDIENCE[code],
      ...(sku ? { sku } : {}),
    }),
    subscriptionMetadata: cabibeeMeta({
      userId,
      planCode: code,
      audience: MEMBERSHIP_PLAN_AUDIENCE[code],
      ...(sku ? { sku } : {}),
    }),
  };
}

/** Planes por unidad aceptan de 1 a MEMBERSHIP_PLAN_MAX_QUANTITY; los demás siempre 1. */
export function membershipQuantity(code: MembershipPlanCode, raw: unknown): number {
  if (!MEMBERSHIP_PLAN_UNIT[code]) return 1;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? Math.min(MEMBERSHIP_PLAN_MAX_QUANTITY, Math.max(1, n)) : 1;
}

export function membershipPlanCodeFromInput(raw: unknown): MembershipPlanCode | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return isMembershipPlanCode(s) ? s : null;
}
