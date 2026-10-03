import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { entitlementsPublicView } from "@/lib/host-entitlements";
import { hostVerificationSummary } from "@/lib/host-verification";
import { listListingsForHost } from "@/lib/marketplace-store";
import { membershipPublicPlans } from "@/lib/membership-plans-store";
import { MEMBERSHIP_PLAN_FAMILY } from "@/lib/membership-plans-types";
import { ensurePublicCatalogFresh } from "@/lib/urbnbeeai-catalog-sync";
import { getSessionUser } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { verificationRegionFromRequest } from "@/lib/verification-region";
import { hostAcceptsBookings } from "@/lib/verification-store";

export const dynamic = "force-dynamic";

/** La verificación de identidad es un solo producto por persona. */
function identityPlans(region: "mx" | "us") {
  return membershipPublicPlans(region, "guest").filter((p) => MEMBERSHIP_PLAN_FAMILY[p.code] === "guest_membership");
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  await ensurePublicCatalogFresh();
  const summary = hostVerificationSummary(user.id);
  const listings = listListingsForHost(user.id);
  const billingRegion = verificationRegionFromRequest(req);

  return NextResponse.json({
    ...summary,
    stripeConfigured: Boolean(getStripe()),
    billingRegion,
    catalogPlansByRegion: {
      mx: identityPlans("mx"),
      us: identityPlans("us"),
    },
    acceptsBookings: hostAcceptsBookings(user.id),
    entitlements: entitlementsPublicView(user.id),
    listingsTotal: listings.length,
    listingsWithBadge: summary.ribbon ? listings.length : 0,
  });
}
