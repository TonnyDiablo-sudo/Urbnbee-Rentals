import { NextRequest, NextResponse } from "next/server";
import { retrieveBookingCheckoutSession } from "@/lib/booking-checkout-session";
import { settleBookingCheckoutSession } from "@/lib/booking-payment-settle";
import { getHostStripe } from "@/lib/host-stripe";
import { findBookingByCheckoutSessionId } from "@/lib/bookings-store";
import { getStripe } from "@/lib/stripe-server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Sesión inválida." }, { status: 400 });
  }

  const known = findBookingByCheckoutSessionId(sessionId);
  const hasStripe =
    Boolean(getStripe()) || Boolean(known && getHostStripe(known.hostId));
  if (!hasStripe) {
    return NextResponse.json({ error: "Stripe no configurado." }, { status: 503 });
  }

  let session;
  try {
    session = await retrieveBookingCheckoutSession(sessionId);
  } catch (e) {
    console.warn("[verify-session]", e);
    return NextResponse.json({ error: "No se pudo verificar el pago." }, { status: 502 });
  }

  const settled = settleBookingCheckoutSession(session);
  if (!settled.ok) {
    return NextResponse.json({ error: settled.error }, { status: settled.status });
  }

  return NextResponse.json({ ok: true, booking: settled.booking });
}
