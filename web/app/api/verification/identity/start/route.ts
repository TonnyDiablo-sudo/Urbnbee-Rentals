import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { publicOriginFromRequest } from "@/lib/public-origin";
import {
  getVerification,
  stripeIdentityEnabled,
  upsertVerification,
} from "@/lib/verification-store";

export async function POST(_req: NextRequest) {
  if (!stripeIdentityEnabled()) {
    return NextResponse.json(
      { error: "Verificación de identidad no activada en el servidor." },
      { status: 503 }
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe no configurado." }, { status: 503 });
  }

  const v = getVerification(user.id);
  if (!v || (v.subscriptionStatus !== "active" && v.subscriptionStatus !== "trialing")) {
    return NextResponse.json(
      { error: "Activa tu membresía de verificación antes de identificarte." },
      { status: 409 }
    );
  }

  const origin = publicOriginFromRequest(_req);
  const returnUrl = `${origin}/guest/membresia?identity=return`;

  try {
    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: { userId: user.id },
      return_url: returnUrl,
      ...(v.stripeCustomerId ? { related_customer: v.stripeCustomerId } : {}),
      provided_details: user.email ? { email: user.email } : undefined,
      options: {
        document: {
          allowed_types: ["driving_license", "id_card", "passport"],
          require_matching_selfie: true,
        },
      },
    });

    const url = session.url;
    if (!url) {
      return NextResponse.json(
        { error: "Stripe no devolvió URL de verificación. Revisa que Identity esté habilitado en tu cuenta Stripe." },
        { status: 502 }
      );
    }

    upsertVerification(user.id, {
      kycStatus: "pending",
      kycProviderSessionId: session.id,
    });

    return NextResponse.json({ url });
  } catch (e) {
    console.warn("[identity start]", e);
    return NextResponse.json(
      {
        error:
          "No se pudo iniciar la verificación. En Stripe Dashboard activa Identity y vuelve a intentar.",
      },
      { status: 502 }
    );
  }
}
