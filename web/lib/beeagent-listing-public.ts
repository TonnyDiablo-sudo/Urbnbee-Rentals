import "server-only";
import {
  defaultListingContract,
  getContractTemplate,
} from "@/lib/booking-contract-templates";
import { listingHasEngine } from "@/lib/booking-engine-slots";
import { getHostPaymentPublic } from "@/lib/host-payment-store";
import type { HostListingRecord } from "@/lib/marketplace-types";

export const PARTNER_CURRENCY = "MXN";

export function listingIsPartnerBookable(listing: HostListingRecord): boolean {
  return Boolean(
    listing.published &&
      listingHasEngine(listing) &&
      getHostPaymentPublic(listing.hostId).connected
  );
}

export function listingCancellationPolicy(listing: HostListingRecord): string {
  const settings = defaultListingContract(listing.contract);
  return settings.cancellationOverride || getContractTemplate(settings.templateId).defaultCancellation;
}

export function listingPartnerView(listing: HostListingRecord) {
  return {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    city: listing.city,
    zone: listing.zone,
    country: listing.country,
    published: listing.published,
    booking_approval_mode: listing.bookingApprovalMode ?? "approval",
    bookable: listingIsPartnerBookable(listing),
    currency: PARTNER_CURRENCY,
    min_nights: 1,
    max_guests: listing.guests,
    cleaning_fee: listing.cleaningFee,
    price_per_night: listing.pricePerNight,
    rules: listing.rules,
    house_rules: listing.houseRules?.trim() || null,
    cancellation_policy: listingCancellationPolicy(listing),
  };
}
