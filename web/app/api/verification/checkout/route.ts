import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getSessionUser } from "@/lib/session";
import { cabibeeMeta } from "@/lib/stripe-app-meta";
import { getStripe } from "@/lib/stripe-server";
import { publicOriginFromRequest } from "@/lib/public-origin";
import {
  buildMembershipCheckout,
  membershipPlanCodeFromInput,
} from "@/lib/membership-checkout";
import { getMembershipPlan, membershipPlanAmount } from "@/lib/membership-plans-store";
import { ensurePublicCatalogFresh } from "@/lib/urbnbeeai-catalog-sync";
import { MEMBERSHIP_PLAN_AUDIENCE, type MembershipPlanCode } from "@/lib/membership-plans-types";
import { simulateCatalogMembership } from "@/lib/membership-simulate";
import { getVerification, resolveVerificationPriceId, type VerificationBillingPlan } from "@/lib/verification-store";
import type { VerificationRegion } from "@/lib/verification-types";
import { verificationRegionFromRequest } from "@/lib/verification-region";
import { allowSimulatedBookingPayment } from "@/lib/stripe-server";
import { appReturnPath } from "@/lib/app-return-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_TIMEOUT_MS = 25_000;

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout (${ms}ms) en ${label}.`)), ms)
    ),
  ]);
}

/**
 * Cobro de un plan del catálogo: el monto sale de /admin/pricing, no de un Price fijo.
 *
 * El pase por reserva es un pago único y las membresías son suscripción, así que el
 * `mode` lo decide el plan. Lo que comparten es que el renglón lleva el Producto y el
 * monto del momento.
 */
async function catalogCheckout(
  req: NextRequest,
  stripe: Stripe,
  code: MembershipPlanCode,
  region: VerificationRegion,
  user: { id: string; email: string },
  rawCancelPath?: string,
  rawReturnPath?: string
) {
  const pieces = await buildMembershipCheckout(stripe, code, region, user.id);
  if ("error" in pieces) {
    const msg =
      pieces.error === "unknown_plan"
        ? "Ese plan no existe."
        : pieces.error === "not_offered"
          ? `«${pieces.planLabel}» no tiene precio para esta región. Ponle uno en /admin/pricing.`
          : `«${pieces.planLabel}» no tiene producto en Stripe. Sincroniza el catálogo en /admin/pricing.`;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const origin = publicOriginFromRequest(req);
  const audience = MEMBERSHIP_PLAN_AUDIENCE[code];
  const defaultReturn = audience === "host" ? "/host/verificacion" : "/guest/membresia";
  const cancelPath =
    typeof rawCancelPath === "string" && rawCancelPath.startsWith("/")
      ? rawCancelPath
      : defaultReturn;
  const successPath = appReturnPath(rawReturnPath) ?? defaultReturn;

  let prevCustomerId: string | undefined;
  try {
    prevCustomerId = getVerification(user.id)?.stripeCustomerId;
  } catch (e) {
    console.warn("[verification checkout] getVerification falló:", e);
  }

  try {
    const session = await withTimeout(
      stripe.checkout.sessions.create({
        mode: pieces.mode,
        line_items: pieces.lineItems,
        success_url: `${origin}${successPath}?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}${cancelPath}`,
        metadata: pieces.metadata,
        ...(pieces.mode === "payment"
          ? { payment_intent_data: { metadata: pieces.metadata } }
          : {}),
        ...(pieces.subscriptionMetadata
          ? { subscription_data: { metadata: pieces.subscriptionMetadata } }
          : {}),
        ...(prevCustomerId ? { customer: prevCustomerId } : { customer_email: user.email }),
      }),
      STRIPE_TIMEOUT_MS,
      "stripe.checkout.sessions.create"
    );
    const url = session.url;
    if (!url) {
      return NextResponse.json({ error: "Stripe no devolvió URL." }, { status: 400 });
    }
    return NextResponse.json({ checkoutUrl: url });
  } catch (e) {
    console.warn("[verification checkout] catálogo", {
      userId: user.id,
      region,
      code,
      err: e instanceof Error ? e.message : String(e),
    });
    const stripeMsg =
      e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
        ? (e as { message: string }).message
        : null;
    return NextResponse.json(
      { error: stripeMsg ?? "No se pudo iniciar el cobro del plan." },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      plan?: string;
      region?: string;
      cancelPath?: string;
      returnPath?: string;
    };
    const bodyRegion =
      body.region === "us" ? "us" : body.region === "mx" ? "mx" : undefined;
    const region: VerificationRegion = bodyRegion ?? verificationRegionFromRequest(req);

    const catalogCode = membershipPlanCodeFromInput(body.plan);
    if (catalogCode) {
      await ensurePublicCatalogFresh();
      const audience = MEMBERSHIP_PLAN_AUDIENCE[catalogCode];
      if (audience === "host" && user.role !== "host" && user.role !== "admin") {
        return NextResponse.json(
          { error: "Esta membresía es para anfitriones." },
          { status: 403 }
        );
      }

      const catalogPlan = getMembershipPlan(catalogCode);
      if (!catalogPlan || !catalogPlan.active || membershipPlanAmount(catalogPlan, region) <= 0) {
        return NextResponse.json(
          { error: "Ese plan no tiene precio para esta región. Ponlo en /admin/pricing." },
          { status: 400 }
        );
      }

      const stripeForCatalog = getStripe();
      if (!stripeForCatalog) {
        if (!allowSimulatedBookingPayment()) {
          return NextResponse.json(
            { error: "Stripe no configurado (falta STRIPE_SECRET_KEY)." },
            { status: 503 }
          );
        }
        const simulated = simulateCatalogMembership(user.id, catalogCode);
        return NextResponse.json({
          simulated: true,
          audience: simulated.audience,
          message: "Modo demo: membresía acreditada sin Stripe.",
        });
      }
      return await catalogCheckout(
        req,
        stripeForCatalog,
        catalogCode,
        region,
        user,
        body.cancelPath,
        body.returnPath
      );
    }

    const plan: VerificationBillingPlan = body.plan === "annual" ? "annual" : "monthly";
    const priceId = resolveVerificationPriceId(plan, region);
    if (!priceId) {
      return NextResponse.json(
        {
          error:
            plan === "annual"
              ? `Plan anual no configurado para región «${region}» (STRIPE_PRICE_VERIFICATION_${region.toUpperCase()}_ANNUAL).`
              : `Plan mensual no configurado para región «${region}» (STRIPE_PRICE_VERIFICATION_${region.toUpperCase()}_MONTHLY).`,
        },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe no configurado (falta STRIPE_SECRET_KEY)." },
        { status: 503 }
      );
    }

    const origin = publicOriginFromRequest(req);
    const cancelPath =
      typeof body.cancelPath === "string" && body.cancelPath.startsWith("/")
        ? body.cancelPath
        : "/guest/membresia";

    let prevCustomerId: string | undefined;
    try {
      prevCustomerId = getVerification(user.id)?.stripeCustomerId;
    } catch (e) {
      console.warn("[verification checkout] getVerification falló:", e);
    }

    const params: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}${appReturnPath(body.returnPath) ?? "/guest/membresia"}?subscription=success`,
      cancel_url: `${origin}${cancelPath}`,
      metadata: cabibeeMeta({ userId: user.id }),
      subscription_data: { metadata: cabibeeMeta({ userId: user.id }) },
      ...(prevCustomerId
        ? { customer: prevCustomerId }
        : { customer_email: user.email }),
    };

    let session;
    try {
      session = await withTimeout(
        stripe.checkout.sessions.create(params),
        STRIPE_TIMEOUT_MS,
        "stripe.checkout.sessions.create"
      );
    } catch (e) {
      console.warn("[verification checkout] stripe error", {
        userId: user.id,
        region,
        plan,
        priceIdPrefix: priceId.slice(0, 10),
        hadCustomer: Boolean(prevCustomerId),
        err: e instanceof Error ? e.message : String(e),
      });
      const stripeMsg =
        e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
          ? (e as { message: string }).message
          : null;
      const hint =
        stripeMsg?.includes("No such price") || stripeMsg?.includes("resource_missing")
          ? " Revisa que STRIPE_SECRET_KEY y los price_… sean del mismo modo (test o live) y de la misma cuenta Stripe."
          : stripeMsg?.includes("No such customer")
            ? " El cliente guardado en URBNBEE_DATA_DIR es de otra cuenta Stripe. Borra el archivo guest-verification.json o cambia la SK."
            : "";
      return NextResponse.json(
        {
          error: stripeMsg
            ? `${stripeMsg}${hint}`
            : "No se pudo iniciar la suscripción. Revisa STRIPE_SECRET_KEY y los price IDs en Railway.",
        },
        { status: 400 }
      );
    }

    const url = session.url;
    if (!url) {
      return NextResponse.json({ error: "Stripe no devolvió URL." }, { status: 400 });
    }
    return NextResponse.json({ checkoutUrl: url });
  } catch (e) {
    console.error("[verification checkout] uncaught", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Error inesperado en el servidor: ${msg}` },
      { status: 500 }
    );
  }
}
