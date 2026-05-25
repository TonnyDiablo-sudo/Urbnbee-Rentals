import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { publicOriginFromRequest } from "@/lib/public-origin";
import { getVerification, resolveVerificationPriceId, type VerificationBillingPlan } from "@/lib/verification-store";
import type { VerificationRegion } from "@/lib/verification-types";
import { verificationRegionFromRequest } from "@/lib/verification-region";

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
    };
    const plan: VerificationBillingPlan = body.plan === "annual" ? "annual" : "monthly";
    const bodyRegion =
      body.region === "us" ? "us" : body.region === "mx" ? "mx" : undefined;
    const region: VerificationRegion = bodyRegion ?? verificationRegionFromRequest(req);
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
      success_url: `${origin}/guest/membresia?subscription=success`,
      cancel_url: `${origin}${cancelPath}`,
      metadata: { userId: user.id },
      subscription_data: { metadata: { userId: user.id } },
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
