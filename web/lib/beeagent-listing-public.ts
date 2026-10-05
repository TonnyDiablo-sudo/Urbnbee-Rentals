import "server-only";
import {
  defaultListingContract,
  getContractTemplate,
} from "@/lib/booking-contract-templates";
import { listingHasEngine } from "@/lib/booking-engine-slots";
import { getHostPaymentPublic } from "@/lib/host-payment-store";
import { exactAddressProblem, listingFullAddress } from "@/lib/listing-address";
import { longStayNights } from "@/lib/listing-pricing";
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
  const exactPublic = listing.locationPrecision === "exact";
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
      /** Dirección exacta completa (calle, número, interior, colonia, ciudad…). */
      full: listingFullAddress(listing) || null,
      line: listing.addressLine || null,
      unit: listing.addressUnit?.trim() || null,
      zone: listing.zone || null,
      city: listing.city || null,
      county: listing.county || null,
      state: listing.state || null,
      country: listing.country || null,
      lat: Number.isFinite(listing.lat) ? listing.lat : null,
      lng: Number.isFinite(listing.lng) ? listing.lng : null,
      /** false: al anfitrión le falta completar la dirección exacta en Cabibee. */
      complete: exactAddressProblem(listing) === null,
      public_precision: exactPublic ? "exact" : "approximate",
      /** Si es false, la calle, el número y el interior sólo se le dicen a un huésped con reserva confirmada. */
      exact_address_public: exactPublic,
      /** Lo que sí se puede decir a cualquiera cuando exact_address_public es false. */
      approximate: [listing.zone, listing.city, listing.state].map((v) => (v ?? "").trim()).filter(Boolean).join(", ") || null,
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
    /**
     * Descuentos por estancias de varios meses (un mes = 30 noches). No se acumulan con
     * los demás descuentos: la cotización aplica sólo el mayor que cumpla `min_nights`.
     */
    long_stay_discounts: (p.longStayDiscounts ?? []).map((d) => ({
      months: d.months,
      min_nights: longStayNights(d.months),
      percent: d.pct,
    })),
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
      /** null si no hay código o si el anfitrión no deja que el agente lo comparta. */
      access_code: listing.agentCanShareAccessCode !== false ? (ag.accessCode ?? null) : null,
      access_code_shareable: listing.agentCanShareAccessCode !== false,
      house_manual: ag.houseManual ?? null,
      checkout_instructions: ag.checkoutInstructions ?? null,
    },
    ai_faq: (listing.agentFaq ?? []).map((f) => ({ question: f.q, answer: f.a })),
    ai_notes: listing.agentNotes?.trim() || null,
    cancellation_policy: listingCancellationPolicy(listing),
    updated_at: listing.updatedAt,
  };
}
