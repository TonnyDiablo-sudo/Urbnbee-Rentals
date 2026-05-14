import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { verificationRegionFromRequest } from "@/lib/verification-region";
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

  const configured = verificationSubscriptionConfigured();
  const rec = getVerification(user.id);
  const eligible = isGuestEligibleToBook(user.id);
  const billingRegion = verificationRegionFromRequest(req);
  const plansMx = verificationPlansAvailableForRegion("mx");
  const plansUs = verificationPlansAvailableForRegion("us");
  const plansAvailable = verificationPlansAvailableForRegion(billingRegion);

  return NextResponse.json({
    configured,
    eligible,
    identityEnabled: stripeIdentityEnabled(),
    regionalPricing: verificationRegionalPricingEnabled(),
    billingRegion,
    plansAvailable,
    plansByRegion: { mx: plansMx, us: plansUs },
    subscriptionStatus: rec?.subscriptionStatus ?? "none",
    currentPeriodEnd: rec?.currentPeriodEnd,
    kycStatus: rec?.kycStatus ?? "not_started",
    hasBillingCustomer: Boolean(rec?.stripeCustomerId),
  });
}
