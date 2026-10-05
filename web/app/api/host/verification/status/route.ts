import { addressProofSlots } from "@/lib/address-proof-access";
import { engineHostReady } from "@/lib/booking-engine-slots";
import { purchaseHasPhone } from "@/lib/purchase-guard";
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
import { billingRegionFor } from "@/lib/verification-region";
import { hostAcceptsBookings } from "@/lib/verification-store";

export const dynamic = "force-dynamic";

/** La verificación de identidad es un solo producto por persona. */
function identityPlans(region: "mx" | "us") {
  return membershipPublicPlans(region, "guest").filter((p) => MEMBERSHIP_PLAN_FAMILY[p.code] === "guest_membership");
}

function enginePlans(region: "mx" | "us") {
  return membershipPublicPlans(region, "host").filter((p) => MEMBERSHIP_PLAN_FAMILY[p.code] === "booking_engine");
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  await ensurePublicCatalogFresh();
  const summary = hostVerificationSummary(user.id);
  const listings = listListingsForHost(user.id);
  const billingRegion = billingRegionFor(req, user);

  return NextResponse.json({
    ...summary,
    stripeConfigured: Boolean(getStripe()),
    billingRegion,
    billingCountry: user.billingCountry ?? null,
    emailVerified: Boolean(user.emailVerifiedAt) || user.role === "admin",
    hasPhone: purchaseHasPhone(user),
    catalogPlansByRegion: {
      mx: identityPlans("mx"),
      us: identityPlans("us"),
    },
    enginePlansByRegion: {
      mx: enginePlans("mx"),
      us: enginePlans("us"),
    },
    acceptsBookings: hostAcceptsBookings(user.id) && engineHostReady(user.id),
    addressProofActive: addressProofSlots(user.id) > 0,
    entitlements: entitlementsPublicView(user.id),
    listingsTotal: listings.length,
    listingsWithBadge: summary.ribbon ? listings.length : 0,
  });
}
