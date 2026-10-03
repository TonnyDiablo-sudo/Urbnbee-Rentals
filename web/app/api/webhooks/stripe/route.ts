import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { settleBookingCheckoutSession } from "@/lib/booking-payment-settle";
import { lockLegalName } from "@/lib/display-name";
import { grantHostVerification } from "@/lib/host-verification";
import { MEMBERSHIP_PASS_KIND } from "@/lib/membership-checkout";
import { settleScreeningCheckoutSession } from "@/lib/screening-service";
import { SCREENING_KIND } from "@/lib/screening-types";
import { stripeEventBelongsToCabibee } from "@/lib/stripe-app-meta";
import { constructStripeWebhookEvent, getStripe } from "@/lib/stripe-server";
import { STORE_CART_KIND, fulfillCartSession } from "@/lib/store-cart";
import { syncFromSubscription } from "@/lib/stripe-subscription-sync";
import { grantBookingPass, upsertVerification } from "@/lib/verification-store";

export const runtime = "nodejs";

function legalNameFromIdentity(session: Stripe.Identity.VerificationSession): string | undefined {
  const out = session.verified_outputs;
  const name = [out?.first_name, out?.last_name]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return name.length >= 2 ? name : undefined;
}

async function syncIdentityFromSession(session: Stripe.Identity.VerificationSession) {
  const userId = typeof session.metadata?.userId === "string" ? session.metadata.userId : undefined;
  if (!userId) {
    console.warn("[stripe webhook] identity session sin userId en metadata", session.id);
    return;
  }
  switch (session.status) {
    case "verified": {
      let legal = legalNameFromIdentity(session);
      if (!legal) {
        try {
          const full = await getStripe()?.identity.verificationSessions.retrieve(session.id);
          if (full) legal = legalNameFromIdentity(full);
        } catch (e) {
          console.warn("[stripe webhook] no se pudo leer el nombre del documento", session.id, e);
        }
      }
      lockLegalName(userId, legal);
      upsertVerification(userId, { kycStatus: "verified", kycProviderSessionId: session.id });
      // Si la verificación la inició un anfitrión, su insignia aparece ahora en sus
      // anuncios. Una identidad no aprobada nunca concede la insignia, y quitarla es
      // decisión del equipo: un reintento fallido no debería borrar lo ya concedido.
      if (session.metadata?.role === "host") {
        const { listingsUpdated } = grantHostVerification(userId, "identity");
        console.info("[stripe webhook] anfitrión verificado", userId, {
          anunciosActualizados: listingsUpdated,
        });
      }
      break;
    }
    case "canceled":
      upsertVerification(userId, { kycStatus: "failed", kycProviderSessionId: session.id });
      break;
    case "processing":
    case "requires_input":
      upsertVerification(userId, { kycStatus: "pending", kycProviderSessionId: session.id });
      break;
    default:
      break;
  }
}

/** Acredita el pase de reserva comprado. Idempotente por sesión de Checkout. */
function grantPassFromSession(session: Stripe.Checkout.Session) {
  const userId = typeof session.metadata?.userId === "string" ? session.metadata.userId : undefined;
  if (!userId) {
    console.warn("[stripe webhook] pase sin userId en metadata", session.id);
    return;
  }
  if (session.payment_status !== "paid") return;
  const granted = grantBookingPass(userId, session.id);
  if (!granted) console.info("[stripe webhook] pase ya acreditado", session.id);
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = constructStripeWebhookEvent(raw, sig);
  } catch (e) {
    console.warn("[stripe webhook] signature", e);
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe no configurado." }, { status: 503 });
  }

  if (!stripeEventBelongsToCabibee(event)) {
    return NextResponse.json({ ignored: "not_cabibee" });
  }

  try {
    if (event.type.startsWith("identity.verification_session.")) {
      const session = event.data.object as Stripe.Identity.VerificationSession;
      await syncIdentityFromSession(session);
    } else {
      switch (event.type) {
        case "checkout.session.async_payment_succeeded":
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          // Dos cobros distintos llegan como pago único: el pase de membresía y la
          // estancia. Los separa la metadata, no el modo.
          if (session.mode === "payment") {
            if (session.metadata?.kind === MEMBERSHIP_PASS_KIND) {
              grantPassFromSession(session);
              break;
            }
            if (session.metadata?.kind === SCREENING_KIND) {
              const screeningSettled = settleScreeningCheckoutSession(session);
              if (!screeningSettled.ok) {
                console.warn("[stripe webhook] screening no liquidado", session.id, screeningSettled.error);
              }
              break;
            }
            // Pago de reserva: el webhook es la vía confiable, porque el huésped
            // puede cerrar el navegador sin volver a la página de confirmación.
            const settled = settleBookingCheckoutSession(session);
            if (!settled.ok) {
              console.warn("[stripe webhook] reserva no liquidada", session.id, settled.error);
            }
            break;
          }
          if (session.mode === "setup") {
            if (session.metadata?.kind === STORE_CART_KIND) await fulfillCartSession(stripe, session.id);
            break;
          }
          if (session.mode !== "subscription") break;
          const userId =
            typeof session.metadata?.userId === "string" ? session.metadata.userId : undefined;
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription && typeof session.subscription === "object"
                ? session.subscription.id
                : null;
          if (userId && subId) {
            const sub = await stripe.subscriptions.retrieve(subId);
            await syncFromSubscription(sub, userId);
          }
          break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          await syncFromSubscription(sub);
          break;
        }
        default:
          break;
      }
    }
  } catch (e) {
    console.warn("[stripe webhook] handler", e);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
