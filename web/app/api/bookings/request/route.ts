import { NextRequest, NextResponse } from "next/server";
import { getBeeagentBookingLink } from "@/lib/beeagent-booking-links";
import { enqueueBookingOutbound } from "@/lib/beeagent-outbound";
import { ensureBookingContract } from "@/lib/booking-contract";
import { getListingById } from "@/lib/marketplace-store";
import {
  hasOverlappingActiveBooking,
  insertBookingLocked,
} from "@/lib/bookings-store";
import { countNights, nightsBlockedByListing } from "@/lib/booking-helpers";
import { bookingTaxFields, quoteBookingMxn } from "@/lib/booking-quote";
import { allowHostInboxPost } from "@/lib/host-inbox-rate-limit";
import { stayLengthError } from "@/lib/listing-pricing";
import { getSessionUser } from "@/lib/session";
import { stayPlatformFeeMxn } from "@/lib/platform-fees";
import { ensurePublicCatalogFresh } from "@/lib/urbnbeeai-catalog-sync";
import {
  consumeBookingPass,
  hostAcceptsBookings,
  resolveGuestBookingAccess,
  restoreBookingPass,
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

  await ensurePublicCatalogFresh();
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Debes iniciar sesión o registrarte para reservar.", needsLogin: true },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const listingId = typeof body.listingId === "string" ? body.listingId.trim() : "";
  const checkIn = typeof body.checkIn === "string" ? body.checkIn.trim() : "";
  const checkOut = typeof body.checkOut === "string" ? body.checkOut.trim() : "";
  const ref = typeof body.ref === "string" ? body.ref.trim().slice(0, 80) : "";
  const link = ref ? getBeeagentBookingLink(ref) : undefined;

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

  if (!hostAcceptsBookings(listing.hostId)) {
    return NextResponse.json(
      {
        error:
          "Este anfitrión todavía no recibe reservas en Cabibee. Escríbele por el chat o usa sus datos de contacto.",
        hostNotBookable: true,
      },
      { status: 403 }
    );
  }

  // Después del candado del anfitrión: si no, se le pediría membresía al huésped
  // para un anuncio que de todos modos no acepta reservas.
  const access = resolveGuestBookingAccess(user.id);
  if (!access.allowed) {
    const error = access.needsMembership
      ? "Contrata una membresía de Cabibee, o un pase por reserva, en «Membresía» para poder solicitar reservas."
      : "Completa la verificación de identidad (documento + selfie) en «Membresía» para poder reservar.";
    return NextResponse.json(
      {
        error,
        needsVerification: true,
        needsMembership: access.needsMembership,
        needsIdentity: access.needsIdentity,
      },
      { status: 403 }
    );
  }

  const nights = countNights(checkIn, checkOut);
  if (nights < 1) {
    return NextResponse.json(
      { error: "La salida debe ser después de la entrada (mínimo 1 noche)." },
      { status: 400 }
    );
  }

  const lengthErr = stayLengthError(listing, nights);
  if (lengthErr) {
    return NextResponse.json({ error: lengthErr.key.replace("{n}", String(lengthErr.n)) }, { status: 400 });
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

  const quote = quoteBookingMxn(listing, checkIn, checkOut);
  const cleaning = quote.cleaningMxn;
  const estimatedTotalMxn = quote.totalMxn;
  const platformFeeMxn = stayPlatformFeeMxn(listing.hostId, estimatedTotalMxn);

  // El pase se descuenta antes de crear la reserva: si se descontara después, dos
  // solicitudes seguidas podrían colarse con un solo pase.
  const usedMembershipPass = access.via === "pass" ? consumeBookingPass(user.id) : false;
  if (access.via === "pass" && !usedMembershipPass) {
    return NextResponse.json(
      { error: "Tu pase por reserva ya se usó. Compra otro en «Membresía».", needsMembership: true },
      { status: 403 }
    );
  }

  const created = await insertBookingLocked({
    listingId,
    hostId: listing.hostId,
    guestUserId: user.id,
    guestEmail: user.email,
    guestName: user.fullName?.trim() || user.email,
    guestPhone: user.phone,
    checkIn,
    checkOut,
    nights,
    estimatedTotalMxn,
    platformFeeMxn,
    cleaningFeeMxn: cleaning,
    ...bookingTaxFields(quote),
    status: "AWAITING_PAYMENT",
    usedMembershipPass: usedMembershipPass || undefined,
    beeagentRef: link && link.listingId === listingId ? link.ref : undefined,
    conversationKey: link && link.listingId === listingId ? link.conversationKey : undefined,
  });
  if (!created.ok) {
    if (usedMembershipPass) restoreBookingPass(user.id);
    if (created.reason === "overlap") {
      return NextResponse.json(
        { error: "Esas fechas ya tienen una solicitud o reserva activa." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "No se pudo crear la reserva. Intenta de nuevo." },
      { status: 500 }
    );
  }
  const booking =
    ensureBookingContract(created.booking.id, {
      role: "system",
      userId: listing.hostId,
      ip,
    }) ?? created.booking;
  enqueueBookingOutbound("booking.requested", booking);

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
