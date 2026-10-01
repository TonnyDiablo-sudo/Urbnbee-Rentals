import "server-only";
import { listingIsPartnerBookable, PARTNER_CURRENCY } from "@/lib/beeagent-listing-public";
import { countNights, nightsBlockedByListing } from "@/lib/booking-helpers";
import { quoteBookingMxn } from "@/lib/booking-quote";
import { hasOverlappingActiveBooking } from "@/lib/bookings-store";
import type { HostListingRecord } from "@/lib/marketplace-types";
import { stayPlatformFeeMxn } from "@/lib/platform-fees";

export type QuoteError = "min_nights" | "max_guests" | "unavailable" | "not_bookable";

export function quoteListingStay(
  listing: HostListingRecord,
  checkIn: string,
  checkOut: string,
  guests: number
) {
  const nights = countNights(checkIn, checkOut);
  const errors: QuoteError[] = [];
  if (nights < 1 || nights < (listing.pricing?.minNights ?? 1)) errors.push("min_nights");
  if (guests > listing.guests) errors.push("max_guests");
  if (!listingIsPartnerBookable(listing)) errors.push("not_bookable");
  if (
    nights >= 1 &&
    (nightsBlockedByListing(listing, checkIn, checkOut) ||
      hasOverlappingActiveBooking(listing.id, checkIn, checkOut))
  ) {
    errors.push("unavailable");
  }

  const q = nights >= 1 ? quoteBookingMxn(listing, checkIn, checkOut) : null;
  const staySubtotal = q?.staySubtotal ?? 0;
  const cleaning = listing.cleaningFee ?? 0;
  const stayTotal = q?.totalMxn ?? Math.round(cleaning);
  const platformFee = stayPlatformFeeMxn(listing.hostId, stayTotal);
  const total = stayTotal + platformFee;

  return {
    ok: errors.length === 0,
    currency: PARTNER_CURRENCY,
    nights,
    breakdown: [
      { label: "Estancia", amount: staySubtotal },
      { label: "Limpieza", amount: cleaning },
      ...(q && q.taxAddedMxn > 0
        ? q.taxLines.map((l) => ({ label: `${l.name} (${l.ratePct}%)`, amount: l.amountMxn }))
        : []),
      ...(platformFee > 0
        ? [{ label: "Cargo de servicio", amount: platformFee }]
        : []),
    ],
    total,
    platform_fee: platformFee,
    booking_approval_mode: listing.bookingApprovalMode ?? "approval",
    errors,
  };
}
