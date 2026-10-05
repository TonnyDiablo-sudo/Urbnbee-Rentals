import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { membershipPublicPlans } from "@/lib/membership-plans-store";
import { ensurePublicCatalogFresh } from "@/lib/urbnbeeai-catalog-sync";
import { billingRegionFor } from "@/lib/verification-region";
import {
  getVerification,
  isGuestEligibleToBook,
  resolveVerificationPriceId,
  stripeIdentityEnabled,
  verificationPlansAvailableForRegion,
  verificationRegionalPricingEnabled,
  verificationSubscriptionConfigured,
} from "@/lib/verification-store";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  await ensurePublicCatalogFresh();
  const configured = verificationSubscriptionConfigured();
  const rec = getVerification(user.id);
  const eligible = isGuestEligibleToBook(user.id);
  const billingRegion = billingRegionFor(req, user);
  const plansMx = verificationPlansAvailableForRegion("mx");
  const plansUs = verificationPlansAvailableForRegion("us");
  const plansAvailable = verificationPlansAvailableForRegion(billingRegion);

  return NextResponse.json({
    configured,
    eligible,
    identityEnabled: stripeIdentityEnabled(),
    regionalPricing: verificationRegionalPricingEnabled(),
    billingRegion,
    billingCountry: user.billingCountry ?? null,
    emailVerified: Boolean(user.emailVerifiedAt) || user.role === "admin",
    plansAvailable,
    plansByRegion: { mx: plansMx, us: plansUs },
    // Planes del catálogo, con su precio: son los que se muestran cuando ya hay
    // montos escritos en /admin/pricing. `plansByRegion` es el camino viejo por env.
    catalogPlansByRegion: {
      mx: membershipPublicPlans("mx", "guest"),
      us: membershipPublicPlans("us", "guest"),
    },
    bookingPassesRemaining: rec?.bookingPassesRemaining ?? 0,
    subscriptionStatus: rec?.subscriptionStatus ?? "none",
    currentPeriodEnd: rec?.currentPeriodEnd,
    kycStatus: rec?.kycStatus ?? "not_started",
    hasBillingCustomer: Boolean(rec?.stripeCustomerId),
  });
}
