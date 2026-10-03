import { NextRequest, NextResponse } from "next/server";
import { HostPaymentKeyMissingError, hostPaymentCryptoReady } from "@/lib/host-payment-crypto";
import {
  deleteHostPaymentSecrets,
  getHostPaymentPublic,
  getHostPaymentSecrets,
  saveHostPaymentSecrets,
} from "@/lib/host-payment-store";
import {
  createHostWebhook,
  deleteHostWebhook,
  hostStripeAccountInfo,
  verifyHostStripeKey,
} from "@/lib/host-stripe";
import { publicOriginFromRequest } from "@/lib/public-origin";
import { getSessionUser } from "@/lib/session";

function requireHost() {
  return getSessionUser();
}

async function statusBody(req: NextRequest, hostId: string, fresh = false) {
  const pub = getHostPaymentPublic(hostId);
  return {
    ...pub,
    webhookUrl: `${publicOriginFromRequest(req)}${pub.webhookPath}`,
    account: pub.connected ? await hostStripeAccountInfo(hostId, { fresh }) : null,
  };
}

export async function GET(req: NextRequest) {
  const user = await requireHost();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const fresh = req.nextUrl.searchParams.get("refresh") === "1";
  return NextResponse.json(await statusBody(req, user.id, fresh));
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
  const manualWebhookSecret = typeof body.webhookSecret === "string" ? body.webhookSecret.trim() : "";
  if (stripeSecretKey.startsWith("pk_")) {
    return NextResponse.json({ error: "Esa es la publishable key (pk_…). Copia la secret key (sk_…)." }, { status: 400 });
  }
  if (!stripeSecretKey.startsWith("sk_") && !stripeSecretKey.startsWith("rk_")) {
    return NextResponse.json(
      { error: "Pega una secret key de Stripe (sk_live_… / sk_test_… o restricted rk_…)." },
      { status: 400 }
    );
  }
  if (manualWebhookSecret && !manualWebhookSecret.startsWith("whsec_")) {
    return NextResponse.json({ error: "Pega el signing secret del webhook (whsec_…)." }, { status: 400 });
  }
  if (!hostPaymentCryptoReady()) {
    return NextResponse.json({ error: new HostPaymentKeyMissingError().message }, { status: 503 });
  }

  const verified = await verifyHostStripeKey(stripeSecretKey);
  if (!verified.ok) {
    return NextResponse.json({ error: `Stripe rechazó la llave: ${verified.error}` }, { status: 400 });
  }

  const previous = getHostPaymentSecrets(user.id);
  let webhookSecret = manualWebhookSecret;
  let webhookEndpointId: string | undefined;
  if (!webhookSecret) {
    const pub = getHostPaymentPublic(user.id);
    const made = await createHostWebhook(
      stripeSecretKey,
      `${publicOriginFromRequest(req)}${pub.webhookPath}`,
      user.id
    );
    if (!made.ok) {
      return NextResponse.json(
        {
          error: `Tu llave funciona, pero no pudimos crear el webhook en tu Stripe (${made.error}). Créalo a mano y pega el signing secret en "Configurar el webhook a mano".`,
          needsManualWebhook: true,
        },
        { status: 400 }
      );
    }
    webhookSecret = made.secret;
    webhookEndpointId = made.id;
  }

  try {
    saveHostPaymentSecrets(
      user.id,
      { stripeSecretKey, webhookSecret, webhookEndpointId },
      { lastVerifiedAt: new Date().toISOString() }
    );
  } catch (e) {
    if (e instanceof HostPaymentKeyMissingError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    throw e;
  }
  if (
    previous?.webhookEndpointId &&
    previous.webhookEndpointId !== webhookEndpointId &&
    previous.stripeSecretKey !== stripeSecretKey
  ) {
    await deleteHostWebhook(previous.stripeSecretKey, previous.webhookEndpointId);
  }
  return NextResponse.json(await statusBody(req, user.id, true));
}

export async function DELETE() {
  const user = await requireHost();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const previous = getHostPaymentSecrets(user.id);
  if (previous?.webhookEndpointId) {
    await deleteHostWebhook(previous.stripeSecretKey, previous.webhookEndpointId);
  }
  deleteHostPaymentSecrets(user.id);
  return NextResponse.json({ ok: true, connected: false });
}
