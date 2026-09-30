import { NextResponse } from "next/server";
import { attachContractIfInstant } from "@/lib/booking-contract";
import { markBookingPaid } from "@/lib/booking-machine";
import { getBookingById } from "@/lib/bookings-store";
import { getSessionUser } from "@/lib/session";
import { notifyHostBookingPaid } from "@/lib/push";
import { allowSimulatedBookingPayment } from "@/lib/stripe-server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  if (!allowSimulatedBookingPayment()) {
    return NextResponse.json({ error: "Simulación desactivada cuando Stripe está configurado." }, { status: 403 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const booking = getBookingById(id);
  if (!booking || booking.guestUserId !== user.id) {
    return NextResponse.json({ error: "Reserva no encontrada." }, { status: 404 });
  }
  if (booking.status !== "AWAITING_PAYMENT") {
    return NextResponse.json({ error: "Esta reserva no está pendiente de pago." }, { status: 409 });
  }
  if (!booking.contract?.guestAcceptedAt) {
    return NextResponse.json(
      {
        error: "Debes aceptar el contrato antes de pagar.",
        needsContract: true,
        token: booking.token,
      },
      { status: 409 }
    );
  }

  const next = markBookingPaid(booking.id, { stripeCheckoutSessionId: "simulated" });
  if (!next) {
    return NextResponse.json({ error: "No se pudo completar el pago." }, { status: 409 });
  }

  const settled = attachContractIfInstant(next);
  notifyHostBookingPaid(settled);
  return NextResponse.json({ ok: true, booking: settled });
}
