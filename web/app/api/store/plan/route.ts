import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { applyHostEntitlement } from "@/lib/host-entitlements";
import { getHostEntitlement } from "@/lib/host-entitlements-store";
import { hostEntitlementInTrial } from "@/lib/host-entitlement-types";
import { buildMembershipCheckout, membershipPlanCodeFromInput } from "@/lib/membership-checkout";
import { primarySkuForPlan } from "@/lib/membership-entitlements";
import { isMembershipPlanCode } from "@/lib/membership-plans-store";
import { MEMBERSHIP_PLAN_BILLING, MEMBERSHIP_PLAN_FAMILY } from "@/lib/membership-plans-types";
import { getSessionUser } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { syncFromSubscription } from "@/lib/stripe-subscription-sync";
import { billingRegionFor, verificationRegionFromRequest } from "@/lib/verification-region";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cambia el plazo (1, 6 o 12 meses) de una herramienta ya contratada. No se cobra nada hoy:
 * lo pagado sigue hasta el fin del periodo (o de la prueba gratis) y en la renovación se cobra el plan nuevo.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { plan?: unknown };
  const code = membershipPlanCodeFromInput(body.plan);
  const sku = code ? primarySkuForPlan(code) : null;
  if (!code || !sku || MEMBERSHIP_PLAN_BILLING[code].kind !== "subscription") {
    return NextResponse.json({ error: "Ese plan no se puede elegir aquí." }, { status: 400 });
  }
  const row = getHostEntitlement(user.id, sku);
  if (!row || row.status === "cancelled" || !row.stripeSubscriptionId || row.source !== "cabibee_direct") {
    return NextResponse.json({ error: "Todavía no tienes este producto. Cómpralo o pruébalo gratis primero." }, { status: 409 });
  }
  if (row.planCode === code) return NextResponse.json({ error: "Ya tienes ese plazo." }, { status: 409 });
  if (row.planCode && isMembershipPlanCode(row.planCode) && MEMBERSHIP_PLAN_FAMILY[row.planCode] !== MEMBERSHIP_PLAN_FAMILY[code]) {
    return NextResponse.json({ error: "Ese plan es de otra herramienta." }, { status: 400 });
  }
  if (row.cancelAtPeriodEnd) {
    return NextResponse.json({ error: "Tu plan está por cancelarse. Primero elige «Seguir con el plan» y luego cambia el plazo." }, { status: 409 });
  }
  const region = user.billingCountry ? billingRegionFor(req, user) : verificationRegionFromRequest(req);
  const inTrial = hostEntitlementInTrial(row);

  if (row.stripeSubscriptionId !== "simulated") {
    const stripe = getStripe();
    if (!stripe) return NextResponse.json({ error: "Stripe no configurado." }, { status: 503 });
    try {
      const sub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId);
      const item = sub.items.data[0];
      if (!item) return NextResponse.json({ error: "La suscripción no tiene renglón." }, { status: 409 });
      const quantity = item.quantity ?? row.quantity ?? 1;
      const pieces = await buildMembershipCheckout(stripe, code, region, user.id, quantity);
      if ("error" in pieces) return NextResponse.json({ error: "Ese plan no está disponible en tu región." }, { status: 400 });
      const price = pieces.lineItems[0].price_data;
      if (!price?.recurring || typeof price.unit_amount !== "number" || !price.product) {
        return NextResponse.json({ error: "Ese plan no está disponible." }, { status: 400 });
      }
      const priceData: Stripe.SubscriptionItemUpdateParams.PriceData = {
        currency: price.currency,
        product: price.product,
        unit_amount: price.unit_amount,
        recurring: { interval: price.recurring.interval, interval_count: price.recurring.interval_count },
      };
      const metadata = { ...sub.metadata, planCode: code };

      if (sub.status === "trialing") {
        // Sin cobro aún: se cambia el renglón y, al terminar la prueba, se cobra el plan nuevo.
        const updated = await stripe.subscriptions.update(sub.id, {
          items: [{ id: item.id, price_data: priceData, quantity }],
          proration_behavior: "none",
          metadata,
        });
        await syncFromSubscription(updated, user.id);
      } else {
        // Periodo pagado: una programación deja el plan actual hasta su fin y arranca el nuevo al renovarse.
        const scheduleId = typeof sub.schedule === "string" ? sub.schedule : sub.schedule?.id;
        const schedule = scheduleId
          ? await stripe.subscriptionSchedules.retrieve(scheduleId)
          : await stripe.subscriptionSchedules.create({ from_subscription: sub.id });
        const now = Math.floor(Date.now() / 1000);
        const current =
          schedule.phases.find((p) => p.start_date <= now && p.end_date > now) ?? schedule.phases[schedule.phases.length - 1];
        await stripe.subscriptionSchedules.update(schedule.id, {
          end_behavior: "release",
          proration_behavior: "none",
          phases: [
            {
              start_date: current.start_date,
              end_date: current.end_date,
              items: current.items.map((i) => ({
                price: typeof i.price === "string" ? i.price : i.price.id,
                quantity: i.quantity ?? undefined,
              })),
            },
            {
              items: [{ price_data: priceData, quantity }],
              duration: { interval: "month", interval_count: price.recurring.interval_count },
              metadata: { planCode: code },
            },
          ],
        });
        await stripe.subscriptions.update(sub.id, { metadata }).catch((e) =>
          console.warn("[store plan] metadata", e instanceof Error ? e.message : e)
        );
      }
    } catch (e) {
      console.warn("[store plan]", e);
      return NextResponse.json({ error: "No se pudo cambiar el plan. Intenta de nuevo." }, { status: 502 });
    }
  }

  const fresh = getHostEntitlement(user.id, sku) ?? row;
  applyHostEntitlement({
    hostId: user.id,
    sku,
    status: fresh.status,
    source: fresh.source,
    stripeSubscriptionId: fresh.stripeSubscriptionId,
    currentPeriodEnd: fresh.currentPeriodEnd,
    planCode: code,
  });
  return NextResponse.json({ ok: true, planCode: code, effectiveAt: fresh.currentPeriodEnd, inTrial });
}
