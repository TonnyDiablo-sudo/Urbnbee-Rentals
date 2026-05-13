import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { publicOriginFromRequest } from "@/lib/public-origin";
import { getVerification } from "@/lib/verification-store";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const priceId = process.env.STRIPE_PRICE_VERIFICATION_MONTHLY?.trim();
  if (!priceId) {
    return NextResponse.json(
      { error: "Suscripción de verificación no configurada (STRIPE_PRICE_VERIFICATION_MONTHLY)." },
      { status: 503 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe no configurado (STRIPE_SECRET_KEY)." }, { status: 503 });
  }

  const origin = publicOriginFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const cancelPath =
    typeof body.cancelPath === "string" && body.cancelPath.startsWith("/")
      ? body.cancelPath
      : "/guest/verification";

  const prev = getVerification(user.id);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/guest/verification?subscription=success`,
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
