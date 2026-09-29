import { NextRequest, NextResponse } from "next/server";
import { applyBookingLifecycle } from "@/lib/booking-deposit";
import { listBookingsForGuest } from "@/lib/bookings-store";
import { getListingById } from "@/lib/marketplace-store";
import { SCREENING_CONSENT_TEXT, screeningPublicView, screeningQuote } from "@/lib/screening-service";
import { getScreeningByBooking } from "@/lib/screening-store";
import { getSessionUser } from "@/lib/session";
import { reviewsForBooking, stayReviewEligible } from "@/lib/stay-reviews";
import { verificationRegionFromRequest } from "@/lib/verification-region";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const rows = listBookingsForGuest(user.id).map((b) => applyBookingLifecycle(b));
  const bookings = rows.map((b) => {
    const listing = getListingById(b.listingId);
    const effId = b.hostAdjustedListingId ?? b.listingId;
    const effListing = effId !== b.listingId ? getListingById(effId) : listing;
    const reviews = reviewsForBooking(b.id);
    const screening = getScreeningByBooking(b.id);
    return {
      ...b,
      listingTitle: listing?.title ?? "Alojamiento",
      listingSlug: effListing?.slug ?? listing?.slug,
      canReview: stayReviewEligible(b) && !reviews.guestToListing,
      myReview: reviews.guestToListing,
      hostReviewOfMe: reviews.hostToGuest,
      screening: screening ? screeningPublicView(screening) : null,
    };
  });

  return NextResponse.json({
    bookings,
    screeningQuote: screeningQuote(verificationRegionFromRequest(req)),
    screeningConsentText: SCREENING_CONSENT_TEXT,
  });
}
