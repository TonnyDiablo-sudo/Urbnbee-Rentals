import type { NextRequest } from "next/server";
import { getBeeagentBookingLink } from "@/lib/beeagent-booking-links";
import { guestRequirementsOf } from "@/lib/beeagent-guest-requirements";
import { partnerJson } from "@/lib/beeagent-partner";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
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
    const gate = requirePartnerLinkedHost(req, link.hostId);
    if (!gate.ok) return gate.response;
    const booking = findBookingByBeeagentRef(id);
    return partnerJson(guestRequirementsOf(booking, origin), req);
  }

  const booking = getBookingById(id);
  if (!booking) return partnerJson({ error: "Reserva no encontrada." }, req, { status: 404 });
  const gate = requirePartnerLinkedHost(req, booking.hostId);
  if (!gate.ok) return gate.response;
  return partnerJson(guestRequirementsOf(booking, origin), req);
}
