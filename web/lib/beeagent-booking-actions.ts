import "server-only";
import type { NextRequest } from "next/server";
import { bookingPartnerDetail } from "@/lib/beeagent-booking-public";
import { botCan } from "@/lib/beeagent-permissions";
import { defaultListingContract } from "@/lib/booking-contract-templates";
import type { HostSigner } from "@/lib/booking-host-decision";
import type { BookingRecord } from "@/lib/booking-types";
import { getBookingById } from "@/lib/bookings-store";
import { findUserById } from "@/lib/marketplace-store";
import type { HostListingRecord } from "@/lib/marketplace-types";
import { publicOriginFromRequest } from "@/lib/public-origin";

/** Cómo sale en la bitácora del contrato. */
export const BOT_SIGNED_BY = "Agente IA de urbnbeeai";

/** La reserva existe y es de ese anfitrión. */
export function partnerHostBooking(hostId: string, bookingId: string): BookingRecord | null {
  const b = getBookingById(bookingId);
  return b && b.hostId === hostId ? b : null;
}

export function partnerBookingBody(req: NextRequest, booking: BookingRecord | undefined) {
  const fresh = booking ? getBookingById(booking.id) ?? booking : undefined;
  return fresh ? bookingPartnerDetail(fresh, publicOriginFromRequest(req)) : null;
}

/**
 * El agente firma con el nombre legal del contrato del anuncio. Puede hacerlo si tiene
 * «Firmar contratos» o si el anfitrión ya firmó por adelantado el contrato de ese anuncio.
 */
export function botSigner(hostId: string, listing: HostListingRecord, ip?: string) {
  const settings = defaultListingContract(listing.contract);
  if (!botCan(hostId, "contracts_sign") && !settings.hostAcknowledged) {
    return {
      ok: false as const,
      status: 409,
      code: "host_signature_required",
      error:
        "Para aceptar, el anfitrión tiene que firmar por adelantado el contrato de este anuncio o darle a urbnbeeai el permiso «Firmar contratos».",
    };
  }
  const signer: HostSigner = {
    name: settings.hostLegalName || findUserById(hostId)?.fullName || "",
    userId: hostId,
    ip,
    signedBy: BOT_SIGNED_BY,
  };
  return signer;
}

export function partnerRequestIp(req: NextRequest): string | undefined {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || undefined;
}
