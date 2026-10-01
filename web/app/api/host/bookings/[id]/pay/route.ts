import { NextRequest, NextResponse } from "next/server";
import type { ManualPayMethod, PayConfirmation } from "@/lib/booking-types";
import { getHostPayoutMethods, instructionFor } from "@/lib/host-payout-methods";
import { markBookingPaid, paymentStatusOf } from "@/lib/booking-machine";
import { getBookingById, patchBookingRecord } from "@/lib/bookings-store";
import { notifyGuestPayInstructions, notifyGuestPaymentConfirmed } from "@/lib/push";
import { getSessionUser } from "@/lib/session";
import { HOST_ENGINE_OFF_ERROR, hostAcceptsBookings } from "@/lib/verification-store";

const METHODS = new Set<ManualPayMethod>(["clabe", "zelle", "cashapp", "oxxo"]);

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!hostAcceptsBookings(user.id)) {
    return NextResponse.json({ error: HOST_ENGINE_OFF_ERROR }, { status: 403 });
  }
  const { id } = await ctx.params;
  const booking = getBookingById(id);
  if (!booking || booking.hostId !== user.id) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
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
    const saved = getHostPayoutMethods(user.id);
    if (!saved) return NextResponse.json({ error: "Esa forma de cobro no está guardada." }, { status: 400 });
    const instruction = instructionFor(body.method as ManualPayMethod, saved);
    if ("error" in instruction) return NextResponse.json({ error: instruction.error }, { status: 400 });
    const next = patchBookingRecord(booking.id, { payInstruction: instruction });
    if (!next) return NextResponse.json({ error: "No se pudo guardar." }, { status: 409 });
    notifyGuestPayInstructions(next);
    return NextResponse.json({
      payInstruction: next.payInstruction,
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
    if (booking.status !== "AWAITING_PAYMENT") {
      return NextResponse.json({ error: "La reserva ya no está esperando pago." }, { status: 409 });
    }
    const at = new Date().toISOString();
    const payConfirmation: PayConfirmation = {
      at,
      by: "host",
      method: booking.payInstruction.method,
    };
    const next = markBookingPaid(booking.id, { actor: "host", payConfirmation });
    if (!next) return NextResponse.json({ error: "No se pudo confirmar el pago." }, { status: 409 });
    notifyGuestPaymentConfirmed(next);
    return NextResponse.json({
      payInstruction: next.payInstruction ?? null,
      payConfirmation: next.payConfirmation ?? null,
      paidAt: next.paidAt ?? null,
      status: next.status,
    });
  }

  return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
}
