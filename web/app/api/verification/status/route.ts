import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import {
  getVerification,
  isGuestEligibleToBook,
  verificationSubscriptionConfigured,
} from "@/lib/verification-store";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const configured = verificationSubscriptionConfigured();
  const rec = getVerification(user.id);
  const eligible = isGuestEligibleToBook(user.id);

  return NextResponse.json({
    configured,
    eligible,
    subscriptionStatus: rec?.subscriptionStatus ?? "none",
    currentPeriodEnd: rec?.currentPeriodEnd,
    kycStatus: rec?.kycStatus ?? "not_started",
    hasBillingCustomer: Boolean(rec?.stripeCustomerId),
  });
}
