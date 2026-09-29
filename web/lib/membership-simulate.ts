import "server-only";
import { setHostMembershipActive } from "@/lib/host-verification";
import {
  MEMBERSHIP_PLAN_AUDIENCE,
  MEMBERSHIP_PLAN_BILLING,
  type MembershipPlanCode,
} from "@/lib/membership-plans-types";
import { grantBookingPass, upsertVerification } from "@/lib/verification-store";

function periodEndIso(intervalCount: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + intervalCount);
  return d.toISOString();
}

/**
 * Acredita un plan sin Stripe. Sólo para desarrollo: si existiera la clave,
 * `allowSimulatedBookingPayment` ya no deja entrar aquí.
 */
export function simulateCatalogMembership(userId: string, code: MembershipPlanCode): {
  audience: "guest" | "host";
  kind: "pass" | "subscription";
} {
  const audience = MEMBERSHIP_PLAN_AUDIENCE[code];
  const billing = MEMBERSHIP_PLAN_BILLING[code];

  if (audience === "host") {
    const months = billing.kind === "subscription" ? billing.intervalCount : 6;
    setHostMembershipActive(userId, true, {
      periodEnd: periodEndIso(months),
      subscriptionId: "simulated",
    });
    return { audience: "host", kind: "subscription" };
  }

  if (billing.kind === "one_time") {
    grantBookingPass(userId, `simulated_${code}_${Date.now()}`);
    return { audience: "guest", kind: "pass" };
  }

  upsertVerification(userId, {
    subscriptionStatus: "active",
    stripeSubscriptionId: "simulated",
    currentPeriodEnd: periodEndIso(billing.intervalCount),
  });
  return { audience: "guest", kind: "subscription" };
}
