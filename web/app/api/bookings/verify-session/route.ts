import { NextRequest, NextResponse } from "next/server";
import { completeBookingAfterPayment, getBookingById } from "@/lib/bookings-store";
import { getStripe } from "@/lib/stripe-server";
import { platformBookingFeeMxn } from "@/lib/platform-fees";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Sesión inválida." }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe no configurado." }, { status: 503 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.mode !== "payment") {
      return NextResponse.json({ error: "Esta sesión no corresponde al pago de una reserva." }, { status: 400 });
    }
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "El pago no está completado." }, { status: 409 });
    }

    const bookingId = session.metadata?.bookingId ?? session.client_reference_id;
    if (!bookingId || typeof bookingId !== "string") {
      return NextResponse.json({ error: "Sesión sin reserva asociada." }, { status: 400 });
    }

    const booking = getBookingById(bookingId);
    if (!booking || booking.status !== "AWAITING_PAYMENT") {
      return NextResponse.json({ error: "Reserva ya procesada o inválida." }, { status: 409 });
    }

    const fee =
      booking.platformFeeMxn ?? platformBookingFeeMxn(booking.estimatedTotalMxn);
    const expectedTotalMxn = booking.estimatedTotalMxn + fee;
    const expectedCents = Math.round(expectedTotalMxn * 100);
    const paidCents = session.amount_total ?? 0;
    if (paidCents > 0 && Math.abs(paidCents - expectedCents) > 2) {
      console.warn("[verify-session] amount mismatch", {
        bookingId,
        paidCents,
        expectedCents,
      });
      return NextResponse.json(
        { error: "El importe pagado no coincide con la reserva." },
        { status: 409 }
      );
    }

    const next = completeBookingAfterPayment(bookingId, { stripeCheckoutSessionId: sessionId });
    if (!next) {
      return NextResponse.json({ error: "No se pudo actualizar la reserva." }, { status: 409 });
    }

    return NextResponse.json({ ok: true, booking: next });
  } catch (e) {
    console.warn("[verify-session]", e);
    return NextResponse.json({ error: "No se pudo verificar el pago." }, { status: 502 });
  }
}
