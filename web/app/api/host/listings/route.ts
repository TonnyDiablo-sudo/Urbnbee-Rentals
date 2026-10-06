import { NextResponse } from "next/server";
import { listingShowsLocationBadge } from "@/lib/address-proof-access";
import { listingHasEngine } from "@/lib/booking-engine-slots";
import { hostCanTakeBookingPayments } from "@/lib/host-stripe";
import { createListing, getListingById, listListingsForHost } from "@/lib/marketplace-store";
import { syncHostBadgeToListings } from "@/lib/host-verification";
import { getSessionUser } from "@/lib/session";
import { isHostIdentityVerified } from "@/lib/verification-store";

export async function GET() {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const identity = isHostIdentityVerified(user.id);
  const payments = hostCanTakeBookingPayments(user.id);
  const listings = listListingsForHost(user.id).map((l) => ({
    ...l,
    badges: {
      identity,
      location: listingShowsLocationBadge(l),
      bookable: payments && listingHasEngine(l),
    },
  }));
  return NextResponse.json({ listings });
}

export async function POST() {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const created = createListing(user.id);
  // El anuncio nuevo nace sin insignia; si el anfitrión ya está verificado, la hereda.
  syncHostBadgeToListings(user.id);
  return NextResponse.json({ listing: getListingById(created.id) ?? created });
}
