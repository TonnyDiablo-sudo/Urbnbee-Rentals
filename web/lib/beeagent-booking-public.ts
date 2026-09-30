import "server-only";
import { firstGuestName, guestRequirementsOf } from "@/lib/beeagent-guest-requirements";
import { PARTNER_CURRENCY } from "@/lib/beeagent-listing-public";
import { applyBookingLifecycle } from "@/lib/booking-deposit";
import { canonicalBookingStatus, contractStatusOf, paymentStatusOf } from "@/lib/booking-machine";
import type { BookingRecord } from "@/lib/booking-types";

export function bookingPartnerListItem(booking: BookingRecord) {
  const live = applyBookingLifecycle(booking);
  const checkIn = live.hostAdjustedCheckIn ?? live.checkIn;
  const checkOut = live.hostAdjustedCheckOut ?? live.checkOut;
  return {
    booking_id: live.id,
    ref: live.beeagentRef ?? null,
    listing_id: live.hostAdjustedListingId ?? live.listingId,
    check_in: checkIn,
    check_out: checkOut,
    guests: 1,
    status: canonicalBookingStatus(live.status),
    payment_status: paymentStatusOf(live),
    contract_status: contractStatusOf(live),
    total: live.estimatedTotalMxn + (live.platformFeeMxn ?? 0),
    currency: PARTNER_CURRENCY,
    guest_first_name: firstGuestName(live.guestName),
    created_at: live.createdAt,
  };
}

export function bookingPartnerDetail(booking: BookingRecord, origin: string) {
  const item = bookingPartnerListItem(booking);
  const live = applyBookingLifecycle(booking);
  return {
    ...item,
    nights: live.nights,
    conversation_key: live.conversationKey ?? null,
    token: live.token,
    guest_requirements: guestRequirementsOf(live, origin),
  };
}
