import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { publicOriginFromRequest } from "@/lib/public-origin";
import {
  completeScreeningAfterPayment,
  screeningPublicView,
  screeningQuote,
} from "@/lib/screening-service";
import { getScreeningPrice, patchScreening, updateScreeningPrice } from "@/lib/screening-store";
import { SCREENING_KIND, screeningPayerOf, type ScreeningPayer, type ScreeningRecord } from "@/lib/screening-types";
import { allowSimulatedBookingPayment, getStripe } from "@/lib/stripe-server";
import { getVerification } from "@/lib/verification-store";
import { verificationRegionFromRequest } from "@/lib/verification-region";

const STRIPE_TIMEOUT_MS = 25_000;

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout (${ms}ms) en ${label}.`)), ms)
    ),
  ]);
}

export async function ensureScreeningStripeProduct(stripe: Stripe): Promise<string> {
  const price = getScreeningPrice();
  if (price.stripeProductId) {
    try {
      const saved = await stripe.products.retrieve(price.stripeProductId);
      if (saved.active) return saved.id;
    } catch {
      /* crear de nuevo */
    }
  }
  const product = await stripe.products.create({
    name: "Screening Cabibee",
    description: "Consulta de screening con proveedor externo. Cabibee no es el buró.",
    metadata: { cabibee_sku: "screening" },
  });
  updateScreeningPrice({ stripeProductId: product.id });
  return product.id;
}

export async function buildScreeningCheckout(
  stripe: Stripe,
  region: "mx" | "us",
  userId: string,
  screeningId: string,
  payer: ScreeningPayer
): Promise<
  | { error: string }
  | {
      mode: "payment";
      lineItems: NonNullable<Stripe.Checkout.SessionCreateParams["line_items"]>;
      metadata: Record<string, string>;
    }
> {
  const quote = screeningQuote(region);
  if (!quote.offered || quote.amount <= 0) {
    return { error: "El screening no tiene precio. Ponlo en /admin/pricing." };
  }
  const productId = await ensureScreeningStripeProduct(stripe);
  return {
    mode: "payment",
    lineItems: [
      {
        quantity: 1,
        price_data: {
          currency: quote.currency,
          product: productId,
          unit_amount: Math.round(quote.amount * 100),
        },
      },
    ],
    metadata: {
      userId,
      kind: SCREENING_KIND,
      screeningId,
      payer,
    },
  };
}

export async function runScreeningCheckout(
  req: NextRequest,
  opts: {
    screening: ScreeningRecord;
    payerUser: { id: string; email: string };
    expectedPayer: ScreeningPayer;
    successPath: string;
    cancelPath: string;
  }
): Promise<NextResponse> {
  const payer = screeningPayerOf(opts.screening);
  if (payer !== opts.expectedPayer) {
    return NextResponse.json(
      {
        error:
          payer === "host"
            ? "Este screening lo paga el anfitrión."
            : "Este screening se le cobra al huésped.",
      },
      { status: 409 }
    );
  }
  if (!opts.screening.consentedAt) {
    return NextResponse.json(
      { error: "El huésped tiene que autorizar el screening primero." },
      { status: 400 }
    );
  }
  if (opts.screening.status === "completed" || opts.screening.paidAt) {
    return NextResponse.json({ error: "Este screening ya está pagado." }, { status: 409 });
  }

  const region = verificationRegionFromRequest(req);
  const quote = screeningQuote(region);
  if (!quote.offered || quote.amount <= 0) {
    return NextResponse.json(
      { error: "El screening no tiene precio. Pon costo del proveedor y margen en /admin/pricing." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    if (!allowSimulatedBookingPayment()) {
      return NextResponse.json(
        { error: "Stripe no configurado (falta STRIPE_SECRET_KEY)." },
        { status: 503 }
      );
    }
    const next = completeScreeningAfterPayment(opts.screening.id, {
      simulated: true,
      amount: quote.amount,
      providerCost: quote.providerCost,
      markup: quote.markup,
      currency: quote.currency,
      sessionId: `simulated_scr_${Date.now()}`,
      paidByUserId: opts.payerUser.id,
    });
    return NextResponse.json({
      simulated: true,
      screening: next ? screeningPublicView(next) : undefined,
      message: "Modo demo: screening de prueba. No se consultó ningún buró.",
    });
  }

  const pieces = await buildScreeningCheckout(
    stripe,
    region,
    opts.payerUser.id,
    opts.screening.id,
    payer
  );
  if ("error" in pieces) {
    return NextResponse.json({ error: pieces.error }, { status: 400 });
  }

  const origin = publicOriginFromRequest(req);
  let prevCustomerId: string | undefined;
  try {
    prevCustomerId = getVerification(opts.payerUser.id)?.stripeCustomerId;
  } catch {
    /* ignore */
  }

  try {
    const session = await withTimeout(
      stripe.checkout.sessions.create({
        mode: pieces.mode,
        line_items: pieces.lineItems,
        success_url: `${origin}${opts.successPath}${opts.successPath.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}${opts.cancelPath}`,
        metadata: pieces.metadata,
        ...(prevCustomerId
          ? { customer: prevCustomerId }
          : { customer_email: opts.payerUser.email }),
      }),
      STRIPE_TIMEOUT_MS,
      "stripe.checkout.sessions.create"
    );
    if (!session.url) {
      return NextResponse.json({ error: "Stripe no devolvió URL." }, { status: 400 });
    }
    patchScreening(opts.screening.id, { stripeCheckoutSessionId: session.id });
    return NextResponse.json({ checkoutUrl: session.url });
  } catch (e) {
    const stripeMsg =
      e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
        ? (e as { message: string }).message
        : null;
    return NextResponse.json(
      { error: stripeMsg ?? "No se pudo iniciar el cobro del screening." },
      { status: 400 }
    );
  }
}
