import { NextRequest, NextResponse } from "next/server";
import type { ManualPayMethod, PayConfirmation } from "@/lib/booking-types";
import { getHostPayoutMethods, instructionFor } from "@/lib/host-payout-methods";
import { onBookingPaid } from "@/lib/booking-acceptance";
import { markBookingPaid, paymentStatusOf } from "@/lib/booking-machine";
import { getBookingById, patchBookingRecord } from "@/lib/bookings-store";
import { notifyGuestPayInstructions, notifyGuestPaymentConfirmed } from "@/lib/push";
import { getSessionUser } from "@/lib/session";
import { LISTING_ENGINE_OFF_ERROR, listingAcceptsBookings } from "@/lib/booking-engine-slots";
import { bookingActor } from "@/lib/team-access";

const METHODS = new Set<ManualPayMethod>(["clabe", "zelle", "cashapp", "oxxo"]);

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const booking = getBookingById(id);
  if (!booking || !bookingActor(user, booking)) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }
  if (!listingAcceptsBookings(booking.hostAdjustedListingId ?? booking.listingId)) {
    return NextResponse.json({ error: LISTING_ENGINE_OFF_ERROR }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { action?: string; method?: string };
  const paid = Boolean(booking.paidAt) || paymentStatusOf(booking) === "paid" || paymentStatusOf(booking) === "refunded";

  if (body.action === "send") {
    if (paid) return NextResponse.json({ error: "Esta reserva ya está pagada." }, { status: 409 });
    if (booking.status !== "AWAITING_PAYMENT") {
      return NextResponse.json({ error: "La reserva ya no está esperando pago." }, { status: 409 });
    }
    if (!METHODS.has(body.method as ManualPayMethod)) {
      return NextResponse.json({ error: "Elige CLABE, Zelle, Cash App u Oxxo." }, { status: 400 });
    }
    const saved = getHostPayoutMethods(booking.hostId);
    if (!saved) return NextResponse.json({ error: "Esa forma de cobro no está guardada." }, { status: 400 });
    const instruction = instructionFor(body.method as ManualPayMethod, saved);
    if ("error" in instruction) return NextResponse.json({ error: instruction.error }, { status: 400 });
    const next = patchBookingRecord(booking.id, { payInstruction: instruction });
    if (!next) return NextResponse.json({ error: "No se pudo guardar." }, { status: 409 });
    notifyGuestPayInstructions(next);
    return NextResponse.json({
      payInstruction: next.payInstruction,
      payProof: next.payProof ?? null,
      payConfirmation: next.payConfirmation ?? null,
      paidAt: next.paidAt ?? null,
      status: next.status,
    });
  }

  if (body.action === "confirm") {
    if (paid) return NextResponse.json({ error: "Esta reserva ya está pagada." }, { status: 409 });
    if (!booking.payInstruction) {
      return NextResponse.json({ error: "Primero envía los datos para que el huésped pague." }, { status: 409 });
    }
    if (!booking.payProof) {
      return NextResponse.json({ error: "El huésped todavía no sube el comprobante de pago." }, { status: 409 });
    }
    if (booking.status !== "AWAITING_PAYMENT") {
      return NextResponse.json({ error: "La reserva ya no está esperando pago." }, { status: 409 });
    }
    const at = new Date().toISOString();
    const payConfirmation: PayConfirmation = {
      at,
      by: "host",
      method: booking.payInstruction.method,
    };
    const paidBooking = markBookingPaid(booking.id, { actor: "host", payConfirmation });
    if (!paidBooking) return NextResponse.json({ error: "No se pudo confirmar el pago." }, { status: 409 });
    const next = onBookingPaid(paidBooking);
    notifyGuestPaymentConfirmed(next);
    return NextResponse.json({
      payInstruction: next.payInstruction ?? null,
      payProof: next.payProof ?? null,
      payConfirmation: next.payConfirmation ?? null,
      paidAt: next.paidAt ?? null,
      status: next.status,
    });
  }

  return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
}
