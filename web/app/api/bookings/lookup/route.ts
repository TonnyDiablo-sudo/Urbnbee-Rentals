import { NextRequest, NextResponse } from "next/server";
import { contractPlainLines, ensureBookingContract } from "@/lib/booking-contract";
import { bookingBalanceDueMxn, paidStayOf } from "@/lib/booking-adjustments";
import { applyBookingLifecycle } from "@/lib/booking-deposit";
import { findBookingByToken } from "@/lib/bookings-store";
import { getListingById } from "@/lib/marketplace-store";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.replace(/\D/g, "").slice(0, 6) ?? "";
  if (token.length !== 6) {
    return NextResponse.json({ error: "Código de 6 dígitos." }, { status: 400 });
  }
  const found = findBookingByToken(token);
  if (!found) {
    return NextResponse.json({ error: "No hay reserva con ese código." }, { status: 404 });
  }
  let booking = applyBookingLifecycle(found);
  if (!booking.contract && !["CANCELLED", "EXPIRED", "REJECTED"].includes(booking.status)) {
    booking = ensureBookingContract(booking.id, { role: "system", userId: booking.hostId }) ?? booking;
  }
  const listing = getListingById(booking.listingId);
  const effListingId = booking.hostAdjustedListingId ?? booking.listingId;
  const effListing = getListingById(effListingId);
  const dispIn = booking.hostAdjustedCheckIn ?? booking.checkIn;
  const dispOut = booking.hostAdjustedCheckOut ?? booking.checkOut;
  return NextResponse.json({
    booking: {
      id: booking.id,
      status: booking.status,
      token: booking.token,
      checkIn: dispIn,
      checkOut: dispOut,
      nights: booking.nights,
      estimatedTotalMxn: booking.estimatedTotalMxn,
      guestName: booking.contract?.snapshot.guestName ?? booking.guestName,
      guestEmail: booking.contract?.snapshot.guestEmail ?? booking.guestEmail,
      guestPhone: booking.contract?.snapshot.guestPhone ?? booking.guestPhone,
      createdAt: booking.createdAt,
      listingTitle: effListing?.title ?? listing?.title ?? "Alojamiento",
      listingSlug: effListing?.slug ?? listing?.slug,
      bookingApprovalMode: effListing?.bookingApprovalMode ?? listing?.bookingApprovalMode ?? "approval",
      paidAt: booking.paidAt,
      stripePaid: Boolean(booking.stripeCheckoutSessionId),
      payInstruction: booking.payInstruction ?? null,
      payConfirmation: booking.payConfirmation ?? null,
      payProof: booking.payProof ?? null,
      balanceDueMxn: bookingBalanceDueMxn(booking),
      paidStayMxn: booking.paidAt ? paidStayOf(booking) : 0,
      contract: booking.contract
        ? {
            generated: true,
            accepted: Boolean(booking.contract.hostAcceptedAt && booking.contract.guestAcceptedAt),
            guestAccepted: Boolean(booking.contract.guestAcceptedAt),
            hostAcceptedAt: booking.contract.hostAcceptedAt,
            hostAcceptedName: booking.contract.hostAcceptedName,
            guestAcceptedAt: booking.contract.guestAcceptedAt,
            guestAcceptedName: booking.contract.guestAcceptedName,
            acceptedSha256: booking.contract.acceptedSha256,
            templateTitle: booking.contract.snapshot.templateTitle,
            lines: contractPlainLines(booking.contract),
          }
        : { generated: false, accepted: false },
    },
  });
}
