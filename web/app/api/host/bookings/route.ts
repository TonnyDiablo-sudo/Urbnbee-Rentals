import { NextRequest, NextResponse } from "next/server";
import { applyBookingLifecycle } from "@/lib/booking-deposit";
import { getSessionUser } from "@/lib/session";
import { listBookingsForHost } from "@/lib/bookings-store";
import { getListingById } from "@/lib/marketplace-store";
import { canRequestScreening, screeningHostView, screeningQuote } from "@/lib/screening-service";
import { getScreeningByBooking } from "@/lib/screening-store";
import { reviewsForBooking, stayReviewEligible } from "@/lib/stay-reviews";
import { verificationRegionFromRequest } from "@/lib/verification-region";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const rows = listBookingsForHost(user.id).map((b) => applyBookingLifecycle(b));
  const bookings = rows.map((b) => {
    const listing = getListingById(b.listingId);
    const adjId = b.hostAdjustedListingId ?? b.listingId;
    const adjListing = adjId !== b.listingId ? getListingById(adjId) : listing;
    const reviews = reviewsForBooking(b.id);
    const screening = getScreeningByBooking(b.id);
    return {
      ...b,
      listingTitle: listing?.title ?? "Alojamiento",
      effectiveListingTitle: (b.hostAdjustedListingId ? adjListing : listing)?.title ?? listing?.title,
      canReview: stayReviewEligible(b) && !reviews.hostToGuest,
      myReview: reviews.hostToGuest,
      guestReviewOfListing: reviews.guestToListing,
      screening: screening ? screeningHostView(screening) : null,
      canRequestScreening: canRequestScreening(b),
    };
  });

  return NextResponse.json({
    bookings,
    screeningQuote: screeningQuote(verificationRegionFromRequest(req)),
  });
}
