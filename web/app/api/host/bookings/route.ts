import { NextRequest, NextResponse } from "next/server";
import { applyBookingLifecycle } from "@/lib/booking-deposit";
import { paymentDueOf } from "@/lib/booking-payment-window";
import { canReopenBooking } from "@/lib/booking-reopen";
import { getSessionUser } from "@/lib/session";
import { listBookingsForHost } from "@/lib/bookings-store";
import { getListingById } from "@/lib/marketplace-store";
import { canRequestScreening, screeningHostView, screeningQuote } from "@/lib/screening-service";
import { getScreeningByBooking } from "@/lib/screening-store";
import { reviewsForBooking, stayReviewEligible } from "@/lib/stay-reviews";
import { verificationRegionFromRequest } from "@/lib/verification-region";
import { hostScope } from "@/lib/team-access";
import { memberCoversListing } from "@/lib/team-store";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  const scope = hostScope(user, req.nextUrl.searchParams.get("host"), "bookings");
  if (!scope) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const rows = listBookingsForHost(scope.hostId)
    .filter((b) => !scope.member || memberCoversListing(scope.member, b.hostAdjustedListingId ?? b.listingId))
    .map((b) => applyBookingLifecycle(b));
  const bookings = rows.map((b) => {
    const listing = getListingById(b.listingId);
    const adjId = b.hostAdjustedListingId ?? b.listingId;
    const adjListing = adjId !== b.listingId ? getListingById(adjId) : listing;
    const reviews = reviewsForBooking(b.id, "host");
    const screening = getScreeningByBooking(b.id);
    return {
      ...b,
      listingTitle: listing?.title ?? "Alojamiento",
      effectiveListingTitle: (b.hostAdjustedListingId ? adjListing : listing)?.title ?? listing?.title,
      canReview: stayReviewEligible(b) && (!reviews.hostToGuest || reviews.hostToGuest.status === "rejected"),
      myReview: reviews.hostToGuest,
      guestReviewOfListing: reviews.guestToListing,
      screening: screening ? screeningHostView(screening) : null,
      canRequestScreening: canRequestScreening(b),
      canReopen: canReopenBooking(b),
      paymentDueAt: b.status === "AWAITING_PAYMENT" ? paymentDueOf(b) : undefined,
    };
  });

  return NextResponse.json({
    bookings,
    screeningQuote: screeningQuote(verificationRegionFromRequest(req)),
  });
}
