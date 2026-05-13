import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import {
  getBookingById,
  hasOverlappingActiveBooking,
  updateBooking,
} from "@/lib/bookings-store";
import { getListingById } from "@/lib/marketplace-store";
import {
  countNights,
  nightsBlockedByListing,
  sumStayMxn,
} from "@/lib/booking-helpers";

type PatchBody = {
  action?: string;
  hostAdjustedCheckIn?: string;
  hostAdjustedCheckOut?: string;
  hostAdjustedListingId?: string;
};

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const booking = getBookingById(id);
  if (!booking || booking.hostId !== user.id) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "";

  if (action === "reject") {
    if (booking.status !== "PENDING") {
      return NextResponse.json(
        { error: "Solo se pueden rechazar solicitudes pendientes." },
        { status: 409 }
      );
    }
    if (booking.guestUserId && !booking.paidAt) {
      return NextResponse.json(
        { error: "Esta reserva no tiene pago registrado." },
        { status: 409 }
      );
    }
    const next = updateBooking(id, user.id, { status: "REJECTED" });
    return NextResponse.json({ ok: true, booking: next });
  }

  if (action !== "accept") {
    return NextResponse.json({ error: "Acción no válida (accept | reject)." }, { status: 400 });
  }

  if (booking.status !== "PENDING") {
    return NextResponse.json(
      { error: "Solo se pueden aceptar solicitudes pendientes." },
      { status: 409 }
    );
  }

  if (booking.guestUserId && !booking.paidAt) {
    return NextResponse.json(
      { error: "Esta reserva no tiene pago registrado." },
      { status: 409 }
    );
  }

  const effListingId =
    typeof body.hostAdjustedListingId === "string" && body.hostAdjustedListingId.trim()
      ? body.hostAdjustedListingId.trim()
      : booking.listingId;
  const effIn =
    typeof body.hostAdjustedCheckIn === "string" && body.hostAdjustedCheckIn.trim()
      ? body.hostAdjustedCheckIn.trim()
      : booking.checkIn;
  const effOut =
    typeof body.hostAdjustedCheckOut === "string" && body.hostAdjustedCheckOut.trim()
      ? body.hostAdjustedCheckOut.trim()
      : booking.checkOut;

  const listing = getListingById(effListingId);
  if (!listing?.published || listing.hostId !== user.id) {
    return NextResponse.json(
      { error: "El alojamiento elegido no está disponible." },
      { status: 400 }
    );
  }

  const nights = countNights(effIn, effOut);
  if (nights < 1) {
    return NextResponse.json(
      { error: "Las fechas deben dejar al menos una noche." },
      { status: 400 }
    );
  }

  if (nightsBlockedByListing(listing, effIn, effOut)) {
    return NextResponse.json(
      { error: "Hay noches bloqueadas en ese rango." },
      { status: 409 }
    );
  }

  if (hasOverlappingActiveBooking(effListingId, effIn, effOut, booking.id)) {
    return NextResponse.json(
      { error: "Esas fechas ya tienen otra solicitud o reserva activa." },
      { status: 409 }
    );
  }

  const { staySubtotal } = sumStayMxn(listing, effIn, effOut);
  const cleaning = listing.cleaningFee ?? 0;
  const estimatedTotalMxn = Math.round(staySubtotal + cleaning);

  const hostAdjustedListingId =
    effListingId !== booking.listingId ? effListingId : undefined;
  const hostAdjustedCheckIn = effIn !== booking.checkIn ? effIn : undefined;
  const hostAdjustedCheckOut = effOut !== booking.checkOut ? effOut : undefined;

  const next = updateBooking(id, user.id, {
    status: "AWAITING_DETAILS",
    nights,
    estimatedTotalMxn,
    hostAdjustedListingId,
    hostAdjustedCheckIn,
    hostAdjustedCheckOut,
  });

  return NextResponse.json({ ok: true, booking: next });
}
