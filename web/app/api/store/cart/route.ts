import { NextRequest, NextResponse } from "next/server";
import { appReturnPath } from "@/lib/app-return-path";
import { getT } from "@/lib/i18n/server";
import { membershipPlanCurrency } from "@/lib/membership-plans-store";
import { simulateCatalogMembership } from "@/lib/membership-simulate";
import { rememberPlanCode } from "@/lib/owned-plan";
import { publicOriginFromRequest } from "@/lib/public-origin";
import { purchaseBlockedResponse } from "@/lib/purchase-guard";
import { getSessionUser } from "@/lib/session";
import { cabibeeMeta } from "@/lib/stripe-app-meta";
import { allowSimulatedBookingPayment, getStripe } from "@/lib/stripe-server";
import { STORE_CART_KIND, cartTotal, catalogPurchaseProblem, encodeCart, parseCart } from "@/lib/store-cart";
import { ensurePublicCatalogFresh } from "@/lib/urbnbeeai-catalog-sync";
import { getVerification, upsertVerification } from "@/lib/verification-store";
import type { VerificationRegion } from "@/lib/verification-types";
import { billingRegionFor, verificationRegionFromRequest } from "@/lib/verification-region";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pago del carrito de la Tienda. Stripe Checkout sólo crea una suscripción por sesión y cada
 * producto tiene que ser la suya, así que aquí sólo se guarda la tarjeta (modo setup) y al
 * regresar se cobra cada producto con ella (ver /api/store/cart/complete).
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const blocked = purchaseBlockedResponse(user);
  if (blocked) return blocked;

  const body = (await req.json().catch(() => ({}))) as { items?: unknown; region?: string; returnPath?: string };
  const region: VerificationRegion = user.billingCountry
    ? billingRegionFor(req, user)
    : body.region === "us"
      ? "us"
      : body.region === "mx"
        ? "mx"
        : verificationRegionFromRequest(req);
  const lines = parseCart(body.items);
  if (!lines) return NextResponse.json({ error: "Tu carrito tiene algo que ya no se puede comprar. Revísalo." }, { status: 400 });

  await ensurePublicCatalogFresh();
  for (const line of lines) {
    const problem = catalogPurchaseProblem(user, line.code, region, line.quantity);
    if (problem) return NextResponse.json({ error: problem.error, code: line.code }, { status: problem.status });
  }

  const stripe = getStripe();
  if (!stripe) {
    if (!allowSimulatedBookingPayment()) {
      return NextResponse.json({ error: "Stripe no configurado (falta STRIPE_SECRET_KEY)." }, { status: 503 });
    }
    for (const line of lines) {
      simulateCatalogMembership(user.id, line.code, line.quantity);
      rememberPlanCode(user.id, line.code);
    }
    return NextResponse.json({ simulated: true, message: "Modo demo: compras acreditadas sin Stripe." });
  }

  const t = await getT();
  const origin = publicOriginFromRequest(req);
  const back = appReturnPath(body.returnPath) ?? "/tienda";
  const currency = membershipPlanCurrency(region);
  const total = cartTotal(lines, region);
  const totalLabel = `$${total.toLocaleString(currency === "usd" ? "en-US" : "es-MX", { maximumFractionDigits: 2 })} ${currency.toUpperCase()}`;
  const meta = cabibeeMeta({ userId: user.id, kind: STORE_CART_KIND, cart: encodeCart(lines), region });

  try {
    let customer = getVerification(user.id)?.stripeCustomerId;
    if (!customer) {
      customer = (await stripe.customers.create({ email: user.email, metadata: cabibeeMeta({ userId: user.id }) })).id;
      upsertVerification(user.id, { stripeCustomerId: customer });
    }
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer,
      payment_method_types: ["card"],
      success_url: `${origin}${back}?cart=done&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${back}`,
      metadata: meta,
      setup_intent_data: { metadata: meta },
      custom_text: {
        submit: {
          message: t("Al confirmar se cobran hoy {total} por {n} productos de Cabibee. Cada uno se renueva según su plazo y lo puedes cancelar en la Tienda.", {
            total: totalLabel,
            n: lines.length,
          }),
        },
      },
    });
    if (!session.url) return NextResponse.json({ error: "Stripe no devolvió URL." }, { status: 400 });
    return NextResponse.json({ checkoutUrl: session.url });
  } catch (e) {
    console.warn("[store cart] checkout", { userId: user.id, err: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: "No se pudo iniciar el cobro del carrito." }, { status: 400 });
  }
}
