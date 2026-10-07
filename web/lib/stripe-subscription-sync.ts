import "server-only";
import type Stripe from "stripe";
import { applyHostEntitlement, HOST_SKU_BOOKING_ENGINE, HOST_SKU_HOST_VERIFICATION } from "@/lib/host-entitlements";
import type { HostEntitlementStatus } from "@/lib/host-entitlement-types";
import { syncHostBadgeToListings } from "@/lib/host-verification";
import { hostEntitlementTargets } from "@/lib/membership-entitlements";
import { isMembershipPlanCode } from "@/lib/membership-plans-store";
import { MEMBERSHIP_PLAN_AUDIENCE } from "@/lib/membership-plans-types";
import { rememberPlanCode } from "@/lib/owned-plan";
import { setHostMembershipFields, setVerificationSubscriptionFields } from "@/lib/verification-store";
import type { VerificationSubscriptionStatus } from "@/lib/verification-types";

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
    default:
      return "none";
  }
}

function mapEntitlementStatus(status: Stripe.Subscription.Status): HostEntitlementStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    default:
      return "cancelled";
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

/** Refleja una suscripción de Stripe en los permisos del usuario (lo que compró en la Tienda). */
export async function syncFromSubscription(sub: Stripe.Subscription, explicitUserId?: string) {
  const userId =
    (typeof explicitUserId === "string" && explicitUserId ? explicitUserId : undefined) ??
    (typeof sub.metadata?.userId === "string" ? sub.metadata.userId : undefined);
  if (!userId) {
    console.warn("[stripe webhook] subscription sin userId en metadata", sub.id);
    return;
  }
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const end = subscriptionPeriodEndIso(sub);
  const planCode = typeof sub.metadata?.planCode === "string" ? sub.metadata.planCode : "";
  const audienceFromMeta = sub.metadata?.audience === "host" ? "host" : sub.metadata?.audience === "guest" ? "guest" : null;
  const audience =
    audienceFromMeta ??
    (isMembershipPlanCode(planCode) ? MEMBERSHIP_PLAN_AUDIENCE[planCode] : "guest");

  if (audience === "host") {
    const status = mapEntitlementStatus(sub.status);
    const quantity = sub.items?.data?.[0]?.quantity ?? 1;
    const trialEndsAt =
      sub.status === "trialing" && typeof sub.trial_end === "number" ? new Date(sub.trial_end * 1000).toISOString() : null;
    const targets = hostEntitlementTargets(userId, planCode, sub.id);
    if (targets.some((t) => t.sku === HOST_SKU_BOOKING_ENGINE || t.sku === HOST_SKU_HOST_VERIFICATION)) {
      setHostMembershipFields(userId, {
        stripeCustomerId: customerId,
        hostStripeSubscriptionId: sub.id,
        hostSubscriptionStatus: mapSubStatus(sub.status),
        hostCurrentPeriodEnd: end,
      });
    }
    for (const t of targets) {
      applyHostEntitlement({
        hostId: userId,
        sku: t.sku,
        status,
        source: "cabibee_direct",
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: end,
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        trialEndsAt,
        ...(isMembershipPlanCode(planCode) ? { planCode } : {}),
        ...(t.perUnit ? { quantity } : {}),
      });
    }
    syncHostBadgeToListings(userId);
    if (isMembershipPlanCode(planCode)) rememberPlanCode(userId, planCode);
    return;
  }

  setVerificationSubscriptionFields(userId, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    subscriptionStatus: mapSubStatus(sub.status),
    currentPeriodEnd: end,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
  });
  if (isMembershipPlanCode(planCode)) rememberPlanCode(userId, planCode);
  syncHostBadgeToListings(userId);
}
