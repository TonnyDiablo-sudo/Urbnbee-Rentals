import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { refundBookingPayment } from "@/lib/booking-refunds";
import {
  buildContractSnapshot,
  contractPlainLines,
  ensureBookingContract,
  hostSignBookingContract,
} from "@/lib/booking-contract";
import { restoreBookingPass } from "@/lib/verification-store";
import { acceptBookingByHost, isPendingHostApproval, rejectBookingByHost } from "@/lib/booking-machine";
import { mysqlApplyBookingOccupancy } from "@/lib/booking-nights";
import {
  getBookingById,
  hasOverlappingActiveBooking,
} from "@/lib/bookings-store";
import { getListingById } from "@/lib/marketplace-store";
import { notifyGuestBookingDecision } from "@/lib/push";
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
  acceptContract?: boolean;
  signName?: string;
};

function requestIp(req: NextRequest): string | undefined {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    undefined
  );
}

export async function GET(
  _req: NextRequest,
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
  if (booking.contract) {
    return NextResponse.json({
      generated: true,
      accepted: Boolean(booking.contract.hostAcceptedAt && booking.contract.guestAcceptedAt),
      hostAcceptedAt: booking.contract.hostAcceptedAt,
      guestAcceptedAt: booking.contract.guestAcceptedAt,
      lines: contractPlainLines(booking.contract),
    });
  }
  const snapshot = buildContractSnapshot(booking);
  if (!snapshot) {
    return NextResponse.json({ error: "No se pudo armar el contrato." }, { status: 409 });
  }
  const preview = {
    version: 1 as const,
    templateId: snapshot.templateId,
    generatedAt: new Date().toISOString(),
    snapshot,
    events: [] as [],
  };
  return NextResponse.json({
    generated: false,
    preview: true,
    accepted: false,
    lines: contractPlainLines(preview),
  });
}

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
    if (!isPendingHostApproval(booking.status)) {
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

    // El huésped ya pagó: se devuelve antes de rechazar, para que nunca quede
    // una reserva rechazada con el dinero retenido.
    const refund = await refundBookingPayment(booking.id, "host_rejected");
    if (!refund.ok) {
      return NextResponse.json(
        { error: `No se rechazó la reserva porque no se pudo devolver el pago. ${refund.error}` },
        { status: refund.status }
      );
    }

    // El pase se gastó por una reserva que el anfitrión no aceptó: se devuelve,
    // porque el huésped pagó por reservar, no por pedir permiso.
    if (booking.usedMembershipPass && booking.guestUserId) {
      restoreBookingPass(booking.guestUserId);
    }

    const next = rejectBookingByHost(id);
    if (next) {
      const occ = await mysqlApplyBookingOccupancy(next);
      if (occ === "error") {
        console.warn("[host/bookings] no se pudieron soltar las noches de", id);
      }
      notifyGuestBookingDecision(next, false);
    }
    return NextResponse.json({ ok: true, booking: next, refund: refund.kind });
  }

  if (action === "sign") {
    const signName = typeof body.signName === "string" ? body.signName.trim() : "";
    if (signName.length < 3) {
      return NextResponse.json({ error: "Escribe tu nombre para firmar el contrato." }, { status: 400 });
    }
    if (!booking.contract) {
      return NextResponse.json({ error: "Todavía no hay contrato que firmar." }, { status: 409 });
    }
    const signed = hostSignBookingContract(booking.id, {
      name: signName,
      userId: user.id,
      ip: requestIp(req),
    });
    return NextResponse.json({ ok: true, booking: signed });
  }

  if (action !== "accept") {
    return NextResponse.json({ error: "Acción no válida (accept | reject | sign)." }, { status: 400 });
  }

  if (!isPendingHostApproval(booking.status)) {
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

  if (body.acceptContract !== true) {
    return NextResponse.json(
      { error: "Tienes que revisar y aceptar el contrato de esta reserva." },
      { status: 400 }
    );
  }
  const signName = typeof body.signName === "string" ? body.signName.trim() : "";
  if (signName.length < 3) {
    return NextResponse.json(
      { error: "Firma el contrato con tu nombre completo." },
      { status: 400 }
    );
  }

  const proposed = {
    ...booking,
    status: "AWAITING_DETAILS" as const,
    nights,
    estimatedTotalMxn,
    hostAdjustedListingId,
    hostAdjustedCheckIn,
    hostAdjustedCheckOut,
  };
  const occ = await mysqlApplyBookingOccupancy(proposed);
  if (occ === "overlap") {
    return NextResponse.json(
      { error: "Esas fechas ya tienen otra solicitud o reserva activa." },
      { status: 409 }
    );
  }
  if (occ === "error") {
    return NextResponse.json(
      { error: "No se pudieron reservar esas noches. Intenta de nuevo." },
      { status: 500 }
    );
  }

  const next = acceptBookingByHost(id, {
    nights,
    estimatedTotalMxn,
    hostAdjustedListingId,
    hostAdjustedCheckIn,
    hostAdjustedCheckOut,
  });

  const withContract = next
    ? ensureBookingContract(next.id, {
        role: "host",
        userId: user.id,
        ip: requestIp(req),
        signName,
      }) ?? next
    : next;
  if (withContract) notifyGuestBookingDecision(withContract, true);

  return NextResponse.json({ ok: true, booking: withContract });
}
