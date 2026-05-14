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

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe no configurado." }, { status: 503 });
  }

  const rec = getVerification(user.id);
  const customerId = rec?.stripeCustomerId;
  if (!customerId) {
    return NextResponse.json(
      { error: "No hay cliente de facturación. Activa la suscripción primero." },
      { status: 409 }
    );
  }

  const origin = publicOriginFromRequest(req);
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/guest/membresia`,
    });
    if (!portal.url) {
      return NextResponse.json({ error: "Stripe no devolvió URL del portal." }, { status: 502 });
    }
    return NextResponse.json({ portalUrl: portal.url });
  } catch (e) {
    console.warn("[billing portal]", e);
    return NextResponse.json({ error: "No se pudo abrir el portal de facturación." }, { status: 502 });
  }
}
