import { NextRequest, NextResponse } from "next/server";
import { listHostEntitlements, upsertHostEntitlement } from "@/lib/host-entitlements-store";
import { hostEntitlementInTrial } from "@/lib/host-entitlement-types";
import { syncHostBadgeToListings } from "@/lib/host-verification";
import { primarySkuForPlan } from "@/lib/membership-entitlements";
import { MEMBERSHIP_PLAN_FAMILY, type MembershipPlanFamily } from "@/lib/membership-plans-types";
import { getSessionUser } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { getVerification, setVerificationSubscriptionFields } from "@/lib/verification-store";

export const dynamic = "force-dynamic";

const FAMILIES = new Set<string>(Object.values(MEMBERSHIP_PLAN_FAMILY));

function anyCodeOf(family: MembershipPlanFamily) {
  return (Object.keys(MEMBERSHIP_PLAN_FAMILY) as (keyof typeof MEMBERSHIP_PLAN_FAMILY)[]).find(
    (c) => MEMBERSHIP_PLAN_FAMILY[c] === family
  )!;
}

/**
 * Cancela (o reanuda) la renovación de un plan. Lo ya pagado no se devuelve: el plan
 * sigue activo hasta el fin del período y ese día termina en vez de renovarse.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  let body: { family?: unknown; resume?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const family = String(body.family ?? "");
  if (!FAMILIES.has(family) || family === "guest_pass") {
    return NextResponse.json({ error: "Ese plan no se renueva, no hay nada que cancelar." }, { status: 400 });
  }
  const cancel = body.resume !== true;

  const sku = primarySkuForPlan(anyCodeOf(family as MembershipPlanFamily));
  let subId: string | undefined;
  let until: string | undefined;
  if (sku) {
    const row = listHostEntitlements(user.id).find((r) => r.sku === sku);
    if (!row || row.status === "cancelled" || row.source !== "cabibee_direct" || !row.stripeSubscriptionId) {
      return NextResponse.json({ error: "No tienes este plan activo." }, { status: 404 });
    }
    subId = row.stripeSubscriptionId;
    until = row.currentPeriodEnd;

    // En prueba gratis no hay nada pagado: se cancela hoy mismo, la herramienta se apaga y no se cobra nada.
    if (cancel && hostEntitlementInTrial(row)) {
      if (subId !== "simulated") {
        const stripe = getStripe();
        if (!stripe) {
          return NextResponse.json({ error: "Los pagos no están configurados. Intenta más tarde." }, { status: 503 });
        }
        try {
          await stripe.subscriptions.cancel(subId, { prorate: false });
        } catch (e) {
          console.error("[store cancel trial]", subId, e);
          return NextResponse.json({ error: "No se pudo cancelar la prueba. Intenta de nuevo." }, { status: 502 });
        }
      }
      const now = new Date().toISOString();
      for (const r of listHostEntitlements(user.id)) {
        if (r.stripeSubscriptionId !== subId) continue;
        upsertHostEntitlement({ ...r, status: "cancelled", cancelAtPeriodEnd: true, trialEndsAt: undefined, updatedAt: now });
      }
      syncHostBadgeToListings(user.id);
      return NextResponse.json({ ok: true, cancelAtPeriodEnd: true, immediate: true, until: now });
    }
  } else {
    const v = getVerification(user.id);
    const s = v?.subscriptionStatus;
    if (!v?.stripeSubscriptionId || !(s === "active" || s === "trialing" || s === "past_due")) {
      return NextResponse.json({ error: "No tienes este plan activo." }, { status: 404 });
    }
    subId = v.stripeSubscriptionId;
    until = v.currentPeriodEnd;
  }

  if (subId !== "simulated") {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Los pagos no están configurados. Intenta más tarde." }, { status: 503 });
    }
    try {
      const sub = await stripe.subscriptions.update(subId, { cancel_at_period_end: cancel });
      const ends = sub.items?.data?.reduce((m, it) => Math.max(m, it.current_period_end ?? 0), 0);
      if (ends) until = new Date(ends * 1000).toISOString();
    } catch (e) {
      console.error("[store cancel]", subId, e);
      return NextResponse.json({ error: "No se pudo cambiar la renovación. Intenta de nuevo." }, { status: 502 });
    }
  }

  // Un mismo cobro puede cubrir varios productos (la membresía de anfitrión anterior).
  if (sku) {
    for (const row of listHostEntitlements(user.id)) {
      if (row.stripeSubscriptionId !== subId) continue;
      upsertHostEntitlement({ ...row, cancelAtPeriodEnd: cancel, updatedAt: new Date().toISOString() });
    }
  } else {
    const v = getVerification(user.id)!;
    setVerificationSubscriptionFields(user.id, {
      subscriptionStatus: v.subscriptionStatus,
      cancelAtPeriodEnd: cancel,
    });
  }

  return NextResponse.json({ ok: true, cancelAtPeriodEnd: cancel, until });
}
