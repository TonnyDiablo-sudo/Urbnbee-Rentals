import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { settleBookingCheckoutSession } from "@/lib/booking-payment-settle";
import { recordBookingTransaction } from "@/lib/booking-transactions";
import { constructHostStripeEvent } from "@/lib/host-stripe";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { hostId } = await ctx.params;
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = constructHostStripeEvent(hostId, raw, sig);
  } catch (e) {
    console.warn("[host-stripe webhook] signature", hostId, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const settled = settleBookingCheckoutSession(session);
      if (settled.ok) {
        if (settled.booking.hostId !== hostId) {
          console.warn("[host-stripe webhook] booking de otro anfitrión", hostId, settled.booking.id);
          return NextResponse.json({ ignored: "wrong_host" });
        }
        if (settled.kind === "completed") {
          recordBookingTransaction({
            bookingId: settled.booking.id,
            hostId,
            chargedVia: "host",
            providerRef: session.id,
            amountCents: session.amount_total ?? 0,
            currency: session.currency ?? "mxn",
            status: "paid",
          });
        }
      } else if (settled.status !== 400) {
        console.warn("[host-stripe webhook] settle", session.id, settled.error);
      }
    }
  } catch (e) {
    console.warn("[host-stripe webhook] handler", e);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
