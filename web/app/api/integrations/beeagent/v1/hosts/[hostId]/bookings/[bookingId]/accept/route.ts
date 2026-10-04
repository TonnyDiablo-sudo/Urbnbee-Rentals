import type { NextRequest } from "next/server";
import { botSigner, partnerBookingBody, partnerHostBooking, partnerRequestIp } from "@/lib/beeagent-booking-actions";
import { partnerJson } from "@/lib/beeagent-partner";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { partnerIdempotentJsonAsync } from "@/lib/beeagent-route-helpers";
import { acceptPendingBooking } from "@/lib/booking-host-decision";
import { notifyHostBotBookingAction } from "@/lib/push";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string; bookingId: string }> };

/** El agente acepta una solicitud pendiente tal como la pidió el huésped. Permiso `bookings_decide`. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { hostId, bookingId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId, "bookings_decide");
  if (!gate.ok) return gate.response;
  const booking = partnerHostBooking(hostId, bookingId);
  if (!booking) return partnerJson({ error: "Reserva no encontrada." }, req, { status: 404 });

  return partnerIdempotentJsonAsync(req, async () => {
    const r = await acceptPendingBooking(booking, {
      hostId,
      signer: (listing) => botSigner(hostId, listing, partnerRequestIp(req)),
    });
    if (!r.ok) return { status: r.status, body: { error: r.error, code: r.code ?? null } };
    if (r.booking) notifyHostBotBookingAction(r.booking, "accepted");
    return {
      status: 200,
      body: {
        ok: true,
        booking: partnerBookingBody(req, r.booking),
        balance_due: r.balanceDueMxn,
        refunded: r.refundedMxn,
        currency: "MXN",
      },
    };
  });
}
