import { NextRequest, NextResponse } from "next/server";
import { appReturnPath } from "@/lib/app-return-path";
import { getT } from "@/lib/i18n/server";
import { membershipPlanCodeFromInput, membershipQuantity } from "@/lib/membership-checkout";
import { getMembershipPlan, membershipPlanAmount, membershipPlanCurrency } from "@/lib/membership-plans-store";
import { MEMBERSHIP_PLAN_BILLING } from "@/lib/membership-plans-types";
import { publicOriginFromRequest } from "@/lib/public-origin";
import { purchaseBlockedResponse } from "@/lib/purchase-guard";
import { getSessionUser } from "@/lib/session";
import { cabibeeMeta } from "@/lib/stripe-app-meta";
import { allowSimulatedBookingPayment, getStripe } from "@/lib/stripe-server";
import { STORE_CART_KIND, STORE_TRIAL_META_KEY, encodeCart } from "@/lib/store-cart";
import { simulateTrial, trialMaxQuantity, trialProblem } from "@/lib/store-trial";
import { TRIAL_DAYS } from "@/lib/tool-trial";
import { ensurePublicCatalogFresh } from "@/lib/urbnbeeai-catalog-sync";
import { getVerification, upsertVerification } from "@/lib/verification-store";
import { billingRegionFor, verificationRegionFromRequest } from "@/lib/verification-region";
import type { VerificationRegion } from "@/lib/verification-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Prueba gratis de 30 días de una herramienta (limpieza o colaboradores). Se pide la tarjeta
 * en Checkout (modo setup) pero hoy no se cobra nada: al terminar la prueba la suscripción
 * cobra el plan elegido y se renueva sola hasta que el anfitrión cancele.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const blocked = purchaseBlockedResponse(user);
  if (blocked) return blocked;

  const body = (await req.json().catch(() => ({}))) as {
    plan?: unknown;
    quantity?: unknown;
    region?: string;
    returnPath?: string;
  };
  const code = membershipPlanCodeFromInput(body.plan);
  if (!code) return NextResponse.json({ error: "Elige un plan." }, { status: 400 });
  const region: VerificationRegion = user.billingCountry
    ? billingRegionFor(req, user)
    : body.region === "us"
      ? "us"
      : body.region === "mx"
        ? "mx"
        : verificationRegionFromRequest(req);
  const max = trialMaxQuantity(code);
  const quantity = Math.min(max ?? Infinity, membershipQuantity(code, body.quantity));

  await ensurePublicCatalogFresh();
  const problem = trialProblem(user, code, region, quantity);
  if (problem) return NextResponse.json({ error: problem.error, code }, { status: problem.status });

  const stripe = getStripe();
  if (!stripe) {
    if (!allowSimulatedBookingPayment()) {
      return NextResponse.json({ error: "Stripe no configurado (falta STRIPE_SECRET_KEY)." }, { status: 503 });
    }
    simulateTrial(user.id, code, quantity);
    return NextResponse.json({ simulated: true, trial: true, message: "Modo demo: prueba gratis activada sin Stripe." });
  }

  const t = await getT();
  const origin = publicOriginFromRequest(req);
  const back = appReturnPath(body.returnPath) ?? "/tienda";
  const plan = getMembershipPlan(code);
  const billing = MEMBERSHIP_PLAN_BILLING[code];
  const months = billing.kind === "subscription" ? billing.intervalCount : 1;
  const currency = membershipPlanCurrency(region);
  const total = plan ? membershipPlanAmount(plan, region) * quantity : 0;
  const totalLabel = `$${total.toLocaleString(currency === "usd" ? "en-US" : "es-MX", { maximumFractionDigits: 2 })} ${currency.toUpperCase()}`;
  const ends = new Date();
  ends.setDate(ends.getDate() + TRIAL_DAYS);
  const endsLabel = ends.toLocaleDateString(currency === "usd" ? "en-US" : "es-MX", { day: "numeric", month: "long", year: "numeric" });
  const meta = cabibeeMeta({
    userId: user.id,
    kind: STORE_CART_KIND,
    cart: encodeCart([{ code, quantity }]),
    region,
    [STORE_TRIAL_META_KEY]: String(TRIAL_DAYS),
  });

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
          message:
            months === 1
              ? t("Hoy no se cobra nada. Tu prueba gratis termina el {date}; ese día se cobran {total} y el plan se renueva cada mes hasta que lo canceles en la Tienda.", {
                  date: endsLabel,
                  total: totalLabel,
                })
              : t("Hoy no se cobra nada. Tu prueba gratis termina el {date}; ese día se cobran {total} y el plan se renueva cada {n} meses hasta que lo canceles en la Tienda.", {
                  date: endsLabel,
                  total: totalLabel,
                  n: months,
                }),
        },
      },
    });
    if (!session.url) return NextResponse.json({ error: "Stripe no devolvió URL." }, { status: 400 });
    return NextResponse.json({ checkoutUrl: session.url, trial: true });
  } catch (e) {
    console.warn("[store trial] checkout", { userId: user.id, err: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: "No se pudo iniciar la prueba gratis. Intenta de nuevo." }, { status: 400 });
  }
}
