import "server-only";
import { addDaysIso, eachIsoNight, todayIsoLocal } from "@/lib/beeagent-iso-date";
import { PARTNER_CURRENCY } from "@/lib/beeagent-listing-public";
import { hasOverlappingActiveBooking } from "@/lib/bookings-store";
import { nightPrice } from "@/lib/listing-pricing";
import type { HostListingRecord } from "@/lib/marketplace-types";

export type NightAvailability = {
  date: string;
  available: boolean;
  reason: "booked" | "blocked" | "past" | null;
  price: number;
};

export function listingAvailabilityNights(
  listing: HostListingRecord,
  from: string,
  toInclusive: string
): NightAvailability[] {
  const blocked = new Set(listing.blockedDates ?? []);
  const today = todayIsoLocal();
  const nights = eachIsoNight(from, addDaysIso(toInclusive, 1));
  return nights.map((date) => {
    const price = nightPrice(listing, date);
    if (date < today) {
      return { date, available: false, reason: "past" as const, price };
    }
    if (blocked.has(date)) {
      return { date, available: false, reason: "blocked" as const, price };
    }
    if (hasOverlappingActiveBooking(listing.id, date, addDaysIso(date, 1))) {
      return { date, available: false, reason: "booked" as const, price };
    }
    return { date, available: true, reason: null, price };
  });
}

export function availabilityPayload(listing: HostListingRecord, from: string, toInclusive: string) {
  return {
    listing_id: listing.id,
    currency: PARTNER_CURRENCY,
    nights: listingAvailabilityNights(listing, from, toInclusive),
  };
}
