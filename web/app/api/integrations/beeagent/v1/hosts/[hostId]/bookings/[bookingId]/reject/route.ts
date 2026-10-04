import type { NextRequest } from "next/server";
import { partnerBookingBody, partnerHostBooking } from "@/lib/beeagent-booking-actions";
import { partnerJson } from "@/lib/beeagent-partner";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { partnerIdempotentJsonAsync } from "@/lib/beeagent-route-helpers";
import { rejectPendingBooking } from "@/lib/booking-host-decision";
import { notifyHostBotBookingAction } from "@/lib/push";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string; bookingId: string }> };

/** El agente rechaza una solicitud pendiente; si estaba pagada, se le devuelve al huésped. Permiso `bookings_decide`. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { hostId, bookingId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId, "bookings_decide");
  if (!gate.ok) return gate.response;
  const booking = partnerHostBooking(hostId, bookingId);
  if (!booking) return partnerJson({ error: "Reserva no encontrada." }, req, { status: 404 });

  return partnerIdempotentJsonAsync(req, async () => {
    const r = await rejectPendingBooking(booking);
    if (!r.ok) return { status: r.status, body: { error: r.error, code: r.code ?? null } };
    if (r.booking) notifyHostBotBookingAction(r.booking, "rejected");
    return { status: 200, body: { ok: true, booking: partnerBookingBody(req, r.booking), refund: r.refund } };
  });
}
