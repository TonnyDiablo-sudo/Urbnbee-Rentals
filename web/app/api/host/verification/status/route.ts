import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { entitlementsPublicView } from "@/lib/host-entitlements";
import { hostVerificationSummary } from "@/lib/host-verification";
import { listListingsForHost } from "@/lib/marketplace-store";
import { membershipPublicPlans } from "@/lib/membership-plans-store";
import { getSessionUser } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { verificationRegionFromRequest } from "@/lib/verification-region";
import { hostAcceptsBookings } from "@/lib/verification-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const summary = hostVerificationSummary(user.id);
  const listings = listListingsForHost(user.id);
  const billingRegion = verificationRegionFromRequest(req);

  return NextResponse.json({
    ...summary,
    stripeConfigured: Boolean(getStripe()),
    billingRegion,
    catalogPlansByRegion: {
      mx: membershipPublicPlans("mx", "host"),
      us: membershipPublicPlans("us", "host"),
    },
    acceptsBookings: hostAcceptsBookings(user.id),
    entitlements: entitlementsPublicView(user.id),
    listingsTotal: listings.length,
    listingsWithBadge: summary.ribbon ? listings.length : 0,
  });
}
