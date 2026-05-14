import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { publicOriginFromRequest } from "@/lib/public-origin";
import { getVerification, resolveVerificationPriceId, type VerificationBillingPlan } from "@/lib/verification-store";
import type { VerificationRegion } from "@/lib/verification-types";
import { verificationRegionFromRequest } from "@/lib/verification-region";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
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
            ? `Plan anual no configurado para región «${region}» (variables STRIPE_PRICE_VERIFICATION_${region.toUpperCase()}_ANNUAL o legado STRIPE_PRICE_VERIFICATION_ANNUAL).`
            : `Plan mensual no configurado para región «${region}» (variables STRIPE_PRICE_VERIFICATION_${region.toUpperCase()}_MONTHLY o legado STRIPE_PRICE_VERIFICATION_MONTHLY).`,
      },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe no configurado (STRIPE_SECRET_KEY)." }, { status: 503 });
  }

  const origin = publicOriginFromRequest(req);
  const cancelPath =
    typeof body.cancelPath === "string" && body.cancelPath.startsWith("/")
      ? body.cancelPath
      : "/guest/membresia";

  const prev = getVerification(user.id);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/guest/membresia?subscription=success`,
      cancel_url: `${origin}${cancelPath}`,
      metadata: { userId: user.id },
      subscription_data: {
        metadata: { userId: user.id },
      },
      ...(prev?.stripeCustomerId
        ? { customer: prev.stripeCustomerId }
        : { customer_email: user.email }),
    });

    const url = session.url;
    if (!url) {
      return NextResponse.json({ error: "Stripe no devolvió URL." }, { status: 502 });
    }
    return NextResponse.json({ checkoutUrl: url });
  } catch (e) {
    console.warn("[verification checkout]", e);
    return NextResponse.json({ error: "No se pudo iniciar la suscripción." }, { status: 502 });
  }
}
