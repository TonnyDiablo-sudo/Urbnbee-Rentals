import { NextRequest, NextResponse } from "next/server";
import { findBookingByToken } from "@/lib/bookings-store";
import { getListingById } from "@/lib/marketplace-store";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.replace(/\D/g, "").slice(0, 6) ?? "";
  if (token.length !== 6) {
    return NextResponse.json({ error: "Código de 6 dígitos." }, { status: 400 });
  }
  const booking = findBookingByToken(token);
  if (!booking) {
    return NextResponse.json({ error: "No hay reserva con ese código." }, { status: 404 });
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
      guestName: booking.guestName,
      createdAt: booking.createdAt,
      listingTitle: effListing?.title ?? listing?.title ?? "Alojamiento",
      listingSlug: effListing?.slug ?? listing?.slug,
      bookingApprovalMode: effListing?.bookingApprovalMode ?? listing?.bookingApprovalMode ?? "approval",
      paidAt: booking.paidAt,
    },
  });
}
