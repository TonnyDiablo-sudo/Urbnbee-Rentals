import type { NextRequest } from "next/server";
import { getBeeagentBookingLink } from "@/lib/beeagent-booking-links";
import { bookingPartnerDetail } from "@/lib/beeagent-booking-public";
import { guestRequirementsOf } from "@/lib/beeagent-guest-requirements";
import { partnerJson } from "@/lib/beeagent-partner";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { findBookingByBeeagentRef } from "@/lib/bookings-store";
import { publicOriginFromRequest } from "@/lib/public-origin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref")?.trim() ?? "";
  if (!ref) {
    return partnerJson({ error: "Usa /bookings/:id o ?ref=." }, req, { status: 400 });
  }
  const link = getBeeagentBookingLink(ref);
  if (!link) return partnerJson({ error: "Liga no encontrada o expirada." }, req, { status: 404 });
  const gate = requirePartnerLinkedHost(req, link.hostId, ["bookings_view", "booking_links"]);
  if (!gate.ok) return gate.response;

  const origin = publicOriginFromRequest(req);
  const booking = findBookingByBeeagentRef(ref);
  if (booking) {
    return partnerJson(bookingPartnerDetail(booking, origin), req);
  }
  return partnerJson(
    {
      ref,
      listing_id: link.listingId,
      check_in: link.checkIn,
      check_out: link.checkOut,
      guests: link.guests,
      conversation_key: link.conversationKey ?? null,
      expires_at: link.expiresAt,
      guest_requirements: guestRequirementsOf(undefined, origin),
    },
    req
  );
}
