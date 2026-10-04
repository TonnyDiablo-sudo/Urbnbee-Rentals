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
  const ag = listing.arrivalGuide ?? {};
  const p = listing.pricing ?? {};
  return {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    description: listing.description || null,
    category: listing.categoryKey,
    space_type: listing.spaceType,
    city: listing.city,
    zone: listing.zone,
    country: listing.country,
    address: {
      line: listing.addressLine || null,
      zone: listing.zone || null,
      city: listing.city || null,
      county: listing.county || null,
      state: listing.state || null,
      country: listing.country || null,
      lat: Number.isFinite(listing.lat) ? listing.lat : null,
      lng: Number.isFinite(listing.lng) ? listing.lng : null,
      /** approximate: la calle sólo se comparte con huéspedes que ya reservaron. */
      public_precision: listing.locationPrecision ?? "approximate",
    },
    published: listing.published,
    booking_approval_mode: listing.bookingApprovalMode ?? "approval",
    bookable: listingIsPartnerBookable(listing),
    currency: PARTNER_CURRENCY,
    min_nights: p.minNights ?? 1,
    max_nights: p.maxNights ?? null,
    max_guests: listing.guests,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    amenities: listing.amenities,
    cleaning_fee: listing.cleaningFee,
    cleaning_service_on: listing.cleaningOn === true,
    price_per_night: listing.pricePerNight,
    weekend_price: p.weekendPrice ?? null,
    rules: listing.rules,
    house_rules: listing.houseRules?.trim() || null,
    check_in_time: ag.checkInTime ?? null,
    check_out_time: ag.checkOutTime ?? null,
    /** Datos de acceso (wifi, cómo entrar): sólo para huéspedes con reserva confirmada. */
    arrival_guide: {
      share_only_with_confirmed_guests: true,
      check_in_method: ag.checkInMethod ?? null,
      directions: ag.directions ?? null,
      wifi_name: ag.wifiName ?? null,
      wifi_password: ag.wifiPassword ?? null,
      house_manual: ag.houseManual ?? null,
      checkout_instructions: ag.checkoutInstructions ?? null,
    },
    ai_faq: (listing.agentFaq ?? []).map((f) => ({ question: f.q, answer: f.a })),
    ai_notes: listing.agentNotes?.trim() || null,
    cancellation_policy: listingCancellationPolicy(listing),
    updated_at: listing.updatedAt,
  };
}
