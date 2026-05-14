import { NextRequest, NextResponse } from "next/server";
import { getListingById } from "@/lib/marketplace-store";
import {
  hasOverlappingActiveBooking,
  insertBooking,
} from "@/lib/bookings-store";
import {
  countNights,
  nightsBlockedByListing,
  sumStayMxn,
} from "@/lib/booking-helpers";
import { allowHostInboxPost } from "@/lib/host-inbox-rate-limit";
import { getSessionUser } from "@/lib/session";
import { platformBookingFeeMxn } from "@/lib/platform-fees";
import {
  getVerification,
  isGuestEligibleToBook,
  stripeIdentityEnabled,
} from "@/lib/verification-store";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!allowHostInboxPost(`booking_req:${ip}`, 25_000)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Espera un momento." },
      { status: 429 }
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Debes iniciar sesión o registrarte para reservar.", needsLogin: true },
      { status: 401 }
    );
  }

  if (!isGuestEligibleToBook(user.id)) {
    const v = getVerification(user.id);
    const subOk = v && (v.subscriptionStatus === "active" || v.subscriptionStatus === "trialing");
    const idOk = !stripeIdentityEnabled() || v?.kycStatus === "verified";
    let error =
      "Para reservar en Urbnbee necesitas membresía de verificación activa y, si aplica, identidad confirmada.";
    if (!subOk) {
      error =
        "Contrata una membresía de verificación (mensual o anual) en «Membresía» para poder solicitar reservas.";
    } else if (stripeIdentityEnabled() && !idOk) {
      error =
        "Completa la verificación de identidad (documento + selfie) en «Membresía» para poder reservar.";
    }
    return NextResponse.json(
      {
        error,
        needsVerification: true,
        needsMembership: !subOk,
        needsIdentity: Boolean(subOk && stripeIdentityEnabled() && !idOk),
      },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const listingId = typeof body.listingId === "string" ? body.listingId.trim() : "";
  const checkIn = typeof body.checkIn === "string" ? body.checkIn.trim() : "";
  const checkOut = typeof body.checkOut === "string" ? body.checkOut.trim() : "";

  if (!listingId || !checkIn || !checkOut) {
    return NextResponse.json({ error: "Faltan fechas o alojamiento." }, { status: 400 });
  }

  const listing = getListingById(listingId);
  if (!listing?.published) {
    return NextResponse.json({ error: "Este alojamiento no está disponible." }, { status: 404 });
  }

  if (user.id === listing.hostId) {
    return NextResponse.json({ error: "No puedes reservar tu propio alojamiento." }, { status: 403 });
  }

  const nights = countNights(checkIn, checkOut);
  if (nights < 1) {
    return NextResponse.json(
      { error: "La salida debe ser después de la entrada (mínimo 1 noche)." },
      { status: 400 }
    );
  }

  if (nightsBlockedByListing(listing, checkIn, checkOut)) {
    return NextResponse.json(
      { error: "Hay fechas no disponibles en ese rango (bloqueadas por el anfitrión)." },
      { status: 409 }
    );
  }

  if (hasOverlappingActiveBooking(listingId, checkIn, checkOut)) {
    return NextResponse.json(
      { error: "Esas fechas ya tienen una solicitud o reserva activa." },
      { status: 409 }
    );
  }

  const { staySubtotal } = sumStayMxn(listing, checkIn, checkOut);
  const cleaning = listing.cleaningFee ?? 0;
  const estimatedTotalMxn = Math.round(staySubtotal + cleaning);
  const platformFeeMxn = platformBookingFeeMxn(estimatedTotalMxn);

  const booking = insertBooking({
    listingId,
    hostId: listing.hostId,
    guestUserId: user.id,
    guestEmail: user.email,
    guestName: user.fullName?.trim() || user.email,
    checkIn,
    checkOut,
    nights,
    estimatedTotalMxn,
    platformFeeMxn,
    cleaningFeeMxn: cleaning,
    status: "AWAITING_PAYMENT",
  });

  return NextResponse.json({
    booking: {
      id: booking.id,
      token: booking.token,
      status: booking.status,
      estimatedTotalMxn: booking.estimatedTotalMxn,
      platformFeeMxn: booking.platformFeeMxn ?? 0,
      totalChargeMxn: booking.estimatedTotalMxn + (booking.platformFeeMxn ?? 0),
      nights: booking.nights,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      bookingApprovalMode: listing.bookingApprovalMode ?? "approval",
    },
  });
}
