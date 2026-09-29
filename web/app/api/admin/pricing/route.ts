import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { listMembershipPlans, membershipPlanOfferedIn } from "@/lib/membership-plans-store";
import { MEMBERSHIP_PLAN_AUDIENCE, MEMBERSHIP_PLAN_BILLING } from "@/lib/membership-plans-types";
import { ensureAllMembershipProducts } from "@/lib/stripe-membership-products";
import { getScreeningPrice } from "@/lib/screening-store";
import { getStripe } from "@/lib/stripe-server";
import { verificationSubscriptionConfigured } from "@/lib/verification-store";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const plans = listMembershipPlans().map((p) => {
    const billing = MEMBERSHIP_PLAN_BILLING[p.code];
    return {
      code: p.code,
      audience: MEMBERSHIP_PLAN_AUDIENCE[p.code],
      label: p.label,
      description: p.description,
      amountMxn: p.amountMxn,
      amountUsd: p.amountUsd,
      active: p.active,
      stripeProductId: p.stripeProductId ?? null,
      billing:
        billing.kind === "one_time"
          ? { kind: "one_time" as const }
          : { kind: "subscription" as const, intervalCount: billing.intervalCount },
      offeredMx: membershipPlanOfferedIn(p, "mx"),
      offeredUs: membershipPlanOfferedIn(p, "us"),
      updatedAt: p.updatedAt,
    };
  });

  return NextResponse.json({
    plans,
    stripeConfigured: Boolean(getStripe()),
    legacyEnvPricesActive: verificationSubscriptionConfigured(),
    note:
      "El monto vive acá, no en Stripe. En Stripe sólo está el Producto (el nombre), " +
      "y el cobro manda el monto del momento: por eso mover un precio no obliga a " +
      "crear ni archivar nada allá.",
    missingProducts: plans.filter((p) => !p.stripeProductId).map((p) => p.code),
    screening: getScreeningPrice(),
  });
}

/** Provisiona en Stripe el Producto de cada plan. Sin Producto no se puede cobrar. */
export async function POST() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!getStripe()) {
    return NextResponse.json(
      { error: "Stripe no está configurado (falta STRIPE_SECRET_KEY)." },
      { status: 503 }
    );
  }
  try {
    const result = await ensureAllMembershipProducts();
    return NextResponse.json({ ok: result.failed === 0, ...result });
  } catch (e) {
    console.error("[admin pricing sync]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo sincronizar con Stripe." },
      { status: 502 }
    );
  }
}
