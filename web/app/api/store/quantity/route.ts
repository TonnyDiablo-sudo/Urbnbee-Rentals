import { NextRequest, NextResponse } from "next/server";
import { featuredPurchaseProblem, isFeaturedPlan } from "@/lib/featured-demand";
import { applyHostEntitlement } from "@/lib/host-entitlements";
import { getHostEntitlement } from "@/lib/host-entitlements-store";
import { membershipPlanCodeFromInput, membershipQuantity } from "@/lib/membership-checkout";
import { primarySkuForPlan } from "@/lib/membership-entitlements";
import { MEMBERSHIP_PLAN_UNIT } from "@/lib/membership-plans-types";
import { getSessionUser } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";

export const runtime = "nodejs";

/**
 * Cambia cuántos anuncios o colaboradores paga el anfitrión en su suscripción actual.
 * Stripe prorratea la diferencia en la próxima factura.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { plan?: string; quantity?: number };
  const code = membershipPlanCodeFromInput(body.plan);
  const sku = code ? primarySkuForPlan(code) : null;
  if (!code || !sku || !MEMBERSHIP_PLAN_UNIT[code]) {
    return NextResponse.json({ error: "Ese producto no se cobra por unidad." }, { status: 400 });
  }
  const quantity = membershipQuantity(code, body.quantity);
  const row = getHostEntitlement(user.id, sku);
  if (!row || row.status === "cancelled" || !row.stripeSubscriptionId) {
    return NextResponse.json({ error: "Todavía no tienes este producto. Cómpralo primero." }, { status: 409 });
  }
  if (row.quantity === undefined) {
    return NextResponse.json(
      { error: "Tu suscripción actual ya cubre todos tus anuncios; no necesitas agregar más." },
      { status: 409 }
    );
  }
  if (isFeaturedPlan(code) && quantity > row.quantity) {
    const problem = featuredPurchaseProblem(quantity - row.quantity);
    if (problem) return NextResponse.json({ error: problem.error, soldOut: true }, { status: problem.status });
  }

  if (row.stripeSubscriptionId !== "simulated") {
    const stripe = getStripe();
    if (!stripe) return NextResponse.json({ error: "Stripe no configurado." }, { status: 503 });
    try {
      const sub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId);
      const item = sub.items.data[0];
      if (!item) return NextResponse.json({ error: "La suscripción no tiene renglón." }, { status: 409 });
      await stripe.subscriptions.update(sub.id, {
        items: [{ id: item.id, quantity }],
        proration_behavior: "create_prorations",
      });
    } catch (e) {
      console.warn("[store quantity]", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "No se pudo cambiar la cantidad." },
        { status: 502 }
      );
    }
  }

  applyHostEntitlement({
    hostId: user.id,
    sku,
    status: row.status,
    source: row.source,
    stripeSubscriptionId: row.stripeSubscriptionId,
    currentPeriodEnd: row.currentPeriodEnd,
    quantity,
  });
  return NextResponse.json({ ok: true, quantity });
}
