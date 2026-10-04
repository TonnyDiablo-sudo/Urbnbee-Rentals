import type { NextRequest } from "next/server";
import { BOT_SIGNED_BY, partnerBookingBody, partnerHostBooking, partnerRequestIp } from "@/lib/beeagent-booking-actions";
import { partnerJson } from "@/lib/beeagent-partner";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { partnerIdempotentJsonAsync } from "@/lib/beeagent-route-helpers";
import { hostSignBookingContract } from "@/lib/booking-contract";
import { defaultListingContract } from "@/lib/booking-contract-templates";
import { LISTING_ENGINE_OFF_ERROR, listingAcceptsBookings } from "@/lib/booking-engine-slots";
import { findUserById, getListingById } from "@/lib/marketplace-store";
import { notifyHostBotBookingAction } from "@/lib/push";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string; bookingId: string }> };

/** El agente firma el contrato de la reserva en nombre del anfitrión. Permiso `contracts_sign`. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { hostId, bookingId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId, "contracts_sign");
  if (!gate.ok) return gate.response;
  const booking = partnerHostBooking(hostId, bookingId);
  if (!booking) return partnerJson({ error: "Reserva no encontrada." }, req, { status: 404 });

  return partnerIdempotentJsonAsync(req, async () => {
    const listingId = booking.hostAdjustedListingId ?? booking.listingId;
    if (!listingAcceptsBookings(listingId)) {
      return { status: 403, body: { error: LISTING_ENGINE_OFF_ERROR, code: "engine_off" } };
    }
    if (!booking.contract) {
      return { status: 409, body: { error: "Todavía no hay contrato que firmar.", code: "no_contract" } };
    }
    if (booking.contract.hostAcceptedAt) {
      return { status: 200, body: { ok: true, already_signed: true, booking: partnerBookingBody(req, booking) } };
    }
    const listing = getListingById(listingId);
    const name = defaultListingContract(listing?.contract).hostLegalName || findUserById(hostId)?.fullName || "";
    const signed = hostSignBookingContract(booking.id, {
      name,
      userId: hostId,
      ip: partnerRequestIp(req),
      signedBy: BOT_SIGNED_BY,
    });
    if (!signed) {
      return {
        status: 409,
        body: { error: "Falta el nombre legal del anfitrión en el contrato del anuncio.", code: "sign_name_required" },
      };
    }
    notifyHostBotBookingAction(signed, "signed");
    return { status: 200, body: { ok: true, booking: partnerBookingBody(req, signed) } };
  });
}
