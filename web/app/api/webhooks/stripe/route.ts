import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { constructStripeWebhookEvent, getStripe } from "@/lib/stripe-server";
import { setVerificationSubscriptionFields, upsertVerification } from "@/lib/verification-store";
import type { VerificationSubscriptionStatus } from "@/lib/verification-types";

export const runtime = "nodejs";

function mapSubStatus(status: Stripe.Subscription.Status): VerificationSubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "unpaid":
      return "unpaid";
    case "paused":
    case "incomplete":
    case "incomplete_expired":
      return "none";
    default:
      return "none";
  }
}

function subscriptionPeriodEndIso(sub: Stripe.Subscription): string | undefined {
  const items = sub.items?.data ?? [];
  let maxEnd = 0;
  for (const it of items) {
    if (typeof it.current_period_end === "number" && it.current_period_end > maxEnd) {
      maxEnd = it.current_period_end;
    }
  }
  if (!maxEnd) return undefined;
  return new Date(maxEnd * 1000).toISOString();
}

async function syncFromSubscription(sub: Stripe.Subscription, explicitUserId?: string) {
  const userId =
    (typeof explicitUserId === "string" && explicitUserId
      ? explicitUserId
      : undefined) ??
    (typeof sub.metadata?.userId === "string" ? sub.metadata.userId : undefined);
  if (!userId) {
    console.warn("[stripe webhook] subscription sin userId en metadata", sub.id);
    return;
  }
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const end = subscriptionPeriodEndIso(sub);
  setVerificationSubscriptionFields(userId, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    subscriptionStatus: mapSubStatus(sub.status),
    currentPeriodEnd: end,
  });
}

function syncIdentityFromSession(session: Stripe.Identity.VerificationSession) {
  const userId = typeof session.metadata?.userId === "string" ? session.metadata.userId : undefined;
  if (!userId) {
    console.warn("[stripe webhook] identity session sin userId en metadata", session.id);
    return;
  }
  switch (session.status) {
    case "verified":
      upsertVerification(userId, { kycStatus: "verified", kycProviderSessionId: session.id });
      break;
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

  try {
    if (event.type.startsWith("identity.verification_session.")) {
      const session = event.data.object as Stripe.Identity.VerificationSession;
      syncIdentityFromSession(session);
    } else {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
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
