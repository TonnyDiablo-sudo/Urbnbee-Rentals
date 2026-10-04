import type { NextRequest } from "next/server";
import { getBeeagentBookingLink } from "@/lib/beeagent-booking-links";
import { bookingPartnerDetail } from "@/lib/beeagent-booking-public";
import { guestRequirementsOf } from "@/lib/beeagent-guest-requirements";
import { partnerJson } from "@/lib/beeagent-partner";
import { partnerBookingHidden, requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { findBookingByBeeagentRef, getBookingById } from "@/lib/bookings-store";
import { publicOriginFromRequest } from "@/lib/public-origin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const origin = publicOriginFromRequest(req);

  if (id.startsWith("bl_")) {
    const link = getBeeagentBookingLink(id);
    if (!link) return partnerJson({ error: "Liga no encontrada o expirada." }, req, { status: 404 });
    const gate = requirePartnerLinkedHost(req, link.hostId, ["bookings_view", "booking_links"]);
    if (!gate.ok) return gate.response;
    const booking = findBookingByBeeagentRef(id);
    if (booking) return partnerJson(bookingPartnerDetail(booking, origin), req);
    return partnerJson(
      {
        ref: id,
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

  const booking = getBookingById(id);
  if (!booking) return partnerJson({ error: "Reserva no encontrada." }, req, { status: 404 });
  const gate = requirePartnerLinkedHost(req, booking.hostId, ["bookings_view", "booking_links"]);
  if (!gate.ok) return gate.response;
  const hidden = partnerBookingHidden(req, booking);
  if (hidden) return hidden;
  return partnerJson(bookingPartnerDetail(booking, origin), req);
}
