import { NextRequest, NextResponse } from "next/server";
import { HostPaymentKeyMissingError } from "@/lib/host-payment-crypto";
import {
  deleteHostPaymentSecrets,
  getHostPaymentPublic,
  saveHostPaymentSecrets,
} from "@/lib/host-payment-store";
import { verifyHostStripeKey } from "@/lib/host-stripe";
import { publicOriginFromRequest } from "@/lib/public-origin";
import { getSessionUser } from "@/lib/session";

function requireHost() {
  return getSessionUser();
}

export async function GET(req: NextRequest) {
  const user = await requireHost();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const pub = getHostPaymentPublic(user.id);
  return NextResponse.json({
    ...pub,
    webhookUrl: `${publicOriginFromRequest(req)}${pub.webhookPath}`,
  });
}

export async function PUT(req: NextRequest) {
  const user = await requireHost();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    stripeSecretKey?: string;
    webhookSecret?: string;
  };
  const stripeSecretKey = typeof body.stripeSecretKey === "string" ? body.stripeSecretKey.trim() : "";
  const webhookSecret = typeof body.webhookSecret === "string" ? body.webhookSecret.trim() : "";
  if (!stripeSecretKey.startsWith("sk_") && !stripeSecretKey.startsWith("rk_")) {
    return NextResponse.json(
      { error: "Pega una secret key de Stripe (sk_live_… / sk_test_… o restricted rk_…)." },
      { status: 400 }
    );
  }
  if (!webhookSecret.startsWith("whsec_")) {
    return NextResponse.json(
      { error: "Pega el signing secret del webhook (whsec_…)." },
      { status: 400 }
    );
  }

  const verified = await verifyHostStripeKey(stripeSecretKey);
  try {
    const pub = saveHostPaymentSecrets(
      user.id,
      { stripeSecretKey, webhookSecret },
      verified.ok
        ? { lastVerifiedAt: new Date().toISOString() }
        : { lastError: verified.error }
    );
    if (!verified.ok) {
      return NextResponse.json(
        {
          error: `Stripe rechazó la llave: ${verified.error}`,
          ...pub,
          webhookUrl: `${publicOriginFromRequest(req)}${pub.webhookPath}`,
        },
        { status: 400 }
      );
    }
    return NextResponse.json({
      ...pub,
      webhookUrl: `${publicOriginFromRequest(req)}${pub.webhookPath}`,
    });
  } catch (e) {
    if (e instanceof HostPaymentKeyMissingError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    throw e;
  }
}

export async function DELETE() {
  const user = await requireHost();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  deleteHostPaymentSecrets(user.id);
  return NextResponse.json({ ok: true, connected: false });
}
