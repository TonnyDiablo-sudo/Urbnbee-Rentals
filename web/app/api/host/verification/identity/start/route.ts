import { NextRequest, NextResponse } from "next/server";
import { appReturnPath } from "@/lib/app-return-path";
import { publicOriginFromRequest } from "@/lib/public-origin";
import { getSessionUser } from "@/lib/session";
import { cabibeeMeta } from "@/lib/stripe-app-meta";
import { getStripe } from "@/lib/stripe-server";
import {
  getVerification,
  identityPlanActive,
  stripeIdentityEnabled,
  upsertVerification,
} from "@/lib/verification-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Abre la verificación de identidad del anfitrión (documento + selfie) en Stripe.
 *
 * Es la misma verificación que hace el huésped y escribe el mismo `kycStatus`, porque
 * la identidad es de la persona y no del rol: quien ya se identificó no vuelve a pagar
 * una sesión. Antes de abrirla tiene que estar pagada (el motor de reservas la incluye).
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!stripeIdentityEnabled()) {
    return NextResponse.json(
      {
        error:
          "La verificación de identidad no está activada en el servidor (STRIPE_IDENTITY_ENABLED).",
      },
      { status: 503 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe no configurado." }, { status: 503 });
  }

  const v = getVerification(user.id);
  if (user.role !== "admin" && !identityPlanActive(user.id)) {
    return NextResponse.json(
      {
        error: "Primero contrata el Motor de reservas (ya incluye la verificación de identidad). Se cobra antes de pedirte la identificación.",
        code: "identity_not_paid",
      },
      { status: 402 }
    );
  }
  const origin = publicOriginFromRequest(req);
  const body = (await req.json().catch(() => ({}))) as { returnPath?: string };
  const returnPath = appReturnPath(body.returnPath) ?? "/host/verificacion";

  try {
    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: cabibeeMeta({ userId: user.id, role: "host" }),
      return_url: `${origin}${returnPath}?identity=return`,
      ...(v?.stripeCustomerId ? { related_customer: v.stripeCustomerId } : {}),
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
        {
          error:
            "Stripe no devolvió URL de verificación. Revisa que Identity esté habilitado en tu cuenta.",
        },
        { status: 502 }
      );
    }

    upsertVerification(user.id, { kycStatus: "pending", kycProviderSessionId: session.id });

    return NextResponse.json({ url });
  } catch (e) {
    console.warn("[host identity start]", e);
    return NextResponse.json(
      { error: "No se pudo iniciar la verificación. Activa Identity en Stripe y reintenta." },
      { status: 502 }
    );
  }
}
