import { NextRequest, NextResponse } from "next/server";
import { getLang } from "@/lib/i18n/server";
import { translatedContractLines } from "@/lib/listing-localize";
import { getSessionUser } from "@/lib/session";
import {
  buildContractSnapshot,
  contractPlainLines,
  hostSignBookingContract,
  previewContractLines,
} from "@/lib/booking-contract";
import { LISTING_ENGINE_OFF_ERROR, listingAcceptsBookings } from "@/lib/booking-engine-slots";
import { defaultListingContract } from "@/lib/booking-contract-templates";
import { acceptPendingBooking, rejectPendingBooking } from "@/lib/booking-host-decision";
import { archiveExpiredBooking, notifyGuestCanPay, reopenExpiredBooking } from "@/lib/booking-reopen";
import { findUserById } from "@/lib/marketplace-store";
import { bookingActor, memberCan } from "@/lib/team-access";
import { publicNameOf } from "@/lib/display-name";
import {
  getBookingById,
  hasOverlappingActiveBooking,
} from "@/lib/bookings-store";
import { getListingById } from "@/lib/marketplace-store";
import { countNights, nightsBlockedByListing } from "@/lib/booking-helpers";
import { paidStayOf } from "@/lib/booking-adjustments";
import {
  bookingChargesTax,
  bookingQuoteDay,
  bookingTaxFields,
  quoteBookingMxn,
  retaxBookingMxn,
} from "@/lib/booking-quote";
import { paymentNoteLines } from "@/lib/host-payout-methods";
import { platformBookingFeeMxn } from "@/lib/platform-fees";

type PatchBody = {
  action?: string;
  hostAdjustedCheckIn?: string;
  hostAdjustedCheckOut?: string;
  hostAdjustedListingId?: string;
  acceptContract?: boolean;
  signName?: string;
  checkIn?: string;
  checkOut?: string;
  /** Si se cobran los impuestos del anfitrión en esta reserva. */
  chargeTax?: boolean;
};

function requestIp(req: NextRequest): string | undefined {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    undefined
  );
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const booking = getBookingById(id);
  const actor = booking ? bookingActor(user, booking) : null;
  if (!booking || !actor) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }

  // Vista previa con las fechas o el alojamiento que el anfitrión está proponiendo.
  const q = req.nextUrl.searchParams;
  const pIn = q.get("checkIn")?.trim() || "";
  const pOut = q.get("checkOut")?.trim() || "";
  const pListing = q.get("listingId")?.trim() || "";
  const pTax = q.get("tax")?.trim() || "";
  if (pIn || pOut || pListing || pTax) {
    if (!listingAcceptsBookings(pListing || (booking.hostAdjustedListingId ?? booking.listingId))) {
      return NextResponse.json({ error: LISTING_ENGINE_OFF_ERROR }, { status: 403 });
    }
    const effIn = pIn || (booking.hostAdjustedCheckIn ?? booking.checkIn);
    const effOut = pOut || (booking.hostAdjustedCheckOut ?? booking.checkOut);
    const listing = getListingById(pListing || (booking.hostAdjustedListingId ?? booking.listingId));
    if (!listing || listing.hostId !== actor.hostId) {
      return NextResponse.json({ error: "El alojamiento elegido no está disponible." }, { status: 400 });
    }
    const nights = countNights(effIn, effOut);
    if (nights < 1) {
      return NextResponse.json({ error: "Las fechas deben dejar al menos una noche." }, { status: 400 });
    }
    const currentTax = bookingChargesTax(booking);
    const chargeTax = pTax === "1" ? true : pTax === "0" ? false : currentTax;
    const sameStay = listing.id === booking.listingId && effIn === booking.checkIn && effOut === booking.checkOut;
    const quote = sameStay
      ? retaxBookingMxn(booking, listing, chargeTax)
      : quoteBookingMxn(listing, effIn, effOut, { today: bookingQuoteDay(booking), chargeTax });
    const unchanged = sameStay && (!quote.taxAvailable || chargeTax === currentTax);
    const estimatedTotalMxn = unchanged ? booking.estimatedTotalMxn : quote.totalMxn;
    const preview = previewContractLines(booking, {
      checkIn: effIn,
      checkOut: effOut,
      listingId: listing.id,
      nights,
      estimatedTotalMxn,
      ...(unchanged ? {} : bookingTaxFields(quote)),
    });
    if (!preview) {
      return NextResponse.json({ error: "No se pudo armar el contrato." }, { status: 409 });
    }
    return NextResponse.json({
      generated: Boolean(booking.contract),
      preview: true,
      accepted: false,
      nights,
      estimatedTotalMxn,
      paidTotalMxn: booking.paidAt ? paidStayOf(booking) : undefined,
      taxMxn: unchanged ? (booking.taxMxn ?? 0) : quote.taxMxn,
      taxIncluded: unchanged ? Boolean(booking.taxIncluded) : quote.taxIncluded,
      taxAvailable: quote.taxAvailable,
      chargeTax: quote.taxAvailable && chargeTax,
      platformFeeDeltaMxn:
        booking.paidAt && booking.chargedVia !== "host" && (booking.platformFeeMxn ?? 0) > 0
          ? platformBookingFeeMxn(estimatedTotalMxn) - (booking.platformFeeMxn ?? 0)
          : 0,
      blocked: nightsBlockedByListing(listing, effIn, effOut),
      overlapping: hasOverlappingActiveBooking(listing.id, effIn, effOut, booking.id),
      ...preview,
    });
  }

  const lang = await getLang();
  if (booking.contract) {
    const lines = [...contractPlainLines(booking.contract), ...paymentNoteLines(booking)];
    return NextResponse.json({
      generated: true,
      accepted: Boolean(booking.contract.hostAcceptedAt && booking.contract.guestAcceptedAt),
      hostAcceptedAt: booking.contract.hostAcceptedAt,
      guestAcceptedAt: booking.contract.guestAcceptedAt,
      lines,
      linesTranslated: await translatedContractLines(lines, lang),
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
  const previewLines = contractPlainLines(preview);
  return NextResponse.json({
    generated: false,
    preview: true,
    accepted: false,
    lines: previewLines,
    linesTranslated: await translatedContractLines(previewLines, lang),
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const booking = getBookingById(id);
  const actor = booking ? bookingActor(user, booking) : null;
  if (!booking || !actor) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "";

  if (action === "reject") {
    const r = await rejectPendingBooking(booking);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, booking: r.booking, refund: r.refund });
  }

  if (action === "sign" || action === "accept") {
    if (!listingAcceptsBookings(booking.hostAdjustedListingId ?? booking.listingId)) {
      return NextResponse.json({ error: LISTING_ENGINE_OFF_ERROR }, { status: 403 });
    }
  }

  const listingForSign = getListingById(booking.hostAdjustedListingId ?? booking.listingId);
  const signsForHost =
    !actor.owner && Boolean(listingForSign && memberCan(user.id, actor.hostId, "contracts", listingForSign.id));
  const hostSignName = () =>
    defaultListingContract(listingForSign?.contract).hostLegalName || findUserById(actor.hostId)?.fullName || "";
  const collaboratorName = publicNameOf(user) || user.fullName || user.email;

  if (action === "sign" && !actor.owner && !signsForHost) {
    return NextResponse.json(
      { error: "Para firmar en nombre del anfitrión necesitas el rol «Firmar contratos»." },
      { status: 403 }
    );
  }

  if (action === "sign") {
    const signName = signsForHost ? hostSignName() : typeof body.signName === "string" ? body.signName.trim() : "";
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
      signedBy: signsForHost ? collaboratorName : undefined,
    });
    if (signed) notifyGuestCanPay(signed);
    return NextResponse.json({ ok: true, booking: signed });
  }

  if (action === "reopen") {
    if (!actor.owner && !signsForHost) {
      return NextResponse.json(
        { error: "Para reabrir y firmar en nombre del anfitrión necesitas el rol «Firmar contratos»." },
        { status: 403 }
      );
    }
    const r = await reopenExpiredBooking(booking.id, "host", {
      checkIn: typeof body.checkIn === "string" ? body.checkIn.trim() : undefined,
      checkOut: typeof body.checkOut === "string" ? body.checkOut.trim() : undefined,
      userId: user.id,
      ip: requestIp(req),
      signName: signsForHost ? hostSignName() : typeof body.signName === "string" ? body.signName : undefined,
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, booking: r.booking });
  }

  if (action === "archive") {
    const r = archiveExpiredBooking(booking.id, "host");
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, booking: r.booking });
  }

  if (action !== "accept") {
    return NextResponse.json({ error: "Acción no válida (accept | reject | sign | reopen | archive)." }, { status: 400 });
  }

  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const r = await acceptPendingBooking(booking, {
    hostId: actor.hostId,
    member: actor.member,
    listingId: text(body.hostAdjustedListingId),
    checkIn: text(body.hostAdjustedCheckIn),
    checkOut: text(body.hostAdjustedCheckOut),
    chargeTax: typeof body.chargeTax === "boolean" ? body.chargeTax : undefined,
    signer: (listing) => {
      if (body.acceptContract !== true) {
        return { ok: false, error: "Tienes que revisar y aceptar el contrato de esta reserva.", status: 400 };
      }
      if (actor.owner) {
        return { name: typeof body.signName === "string" ? body.signName.trim() : "", userId: user.id, ip: requestIp(req) };
      }
      // Quien colabora no firma por sí mismo: se usa la firma por adelantado del anfitrión.
      const settings = defaultListingContract(listing.contract);
      if (!settings.hostAcknowledged && !memberCan(user.id, actor.hostId, "contracts", listing.id)) {
        return {
          ok: false,
          error:
            "El anfitrión tiene que firmar por adelantado el contrato de este anuncio (en Contratos) o darte el rol «Firmar contratos» para que puedas aceptar.",
          status: 409,
        };
      }
      return {
        name: settings.hostLegalName || findUserById(actor.hostId)?.fullName || "",
        userId: user.id,
        ip: requestIp(req),
        signedBy: collaboratorName,
      };
    },
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({
    ok: true,
    booking: r.booking,
    balanceDueMxn: r.balanceDueMxn,
    refundedMxn: r.refundedMxn,
  });
}
