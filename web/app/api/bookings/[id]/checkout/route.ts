import { NextRequest, NextResponse } from "next/server";
import { getBookingById, patchBookingRecord } from "@/lib/bookings-store";
import { getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { getStripe, allowSimulatedBookingPayment } from "@/lib/stripe-server";
import { publicOriginFromRequest } from "@/lib/public-origin";
import { platformBookingFeeMxn } from "@/lib/platform-fees";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
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

  const body = await req.json().catch(() => ({}));
  const cancelPath =
    typeof body.cancelPath === "string" && body.cancelPath.startsWith("/")
      ? body.cancelPath
      : "/";
  const origin = publicOriginFromRequest(req);
  const cancelUrl = `${origin}${cancelPath}`;

  const listing = getListingById(booking.listingId);
  const stripe = getStripe();

  if (!stripe) {
    if (!allowSimulatedBookingPayment()) {
      return NextResponse.json(
        { error: "Pago no configurado (STRIPE_SECRET_KEY)." },
        { status: 503 }
      );
    }
    return NextResponse.json({
      simulatePayment: true,
      bookingId: booking.id,
      message: "Modo demo: usa «Confirmar pago (demo)» desde la ficha o /bookings/confirm.",
    });
  }

  const title = listing?.title ?? "Reserva Urbnbee";
  const platformFeeMxn =
    booking.platformFeeMxn ?? platformBookingFeeMxn(booking.estimatedTotalMxn);
  const stayCents = Math.max(1, Math.round(booking.estimatedTotalMxn * 100));
  const feeCents = Math.max(0, Math.round(platformFeeMxn * 100));
  const totalCents = stayCents + feeCents;
  if (totalCents < 50) {
    return NextResponse.json({ error: "Importe de reserva demasiado bajo." }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "mxn",
            unit_amount: stayCents,
            product_data: {
              name: `${title.slice(0, 100)} — Estancia`,
              description: `${booking.checkIn} → ${booking.checkOut}`,
            },
          },
        },
        ...(feeCents > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: "mxn" as const,
                  unit_amount: feeCents,
                  product_data: {
                    name: "Cargo de servicio Urbnbee",
                    description: "Cargo de plataforma sobre el total de la estancia (configurable).",
                  },
                },
              },
            ]
          : []),
      ],
      success_url: `${origin}/bookings/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        bookingId: booking.id,
        guestUserId: user.id,
        stayTotalMxn: String(booking.estimatedTotalMxn),
        platformFeeMxn: String(platformFeeMxn),
      },
      client_reference_id: booking.id,
    });

    if (session.id) {
      patchBookingRecord(booking.id, { stripeCheckoutSessionId: session.id });
    }

    const url = session.url;
    if (!url) {
      return NextResponse.json({ error: "Stripe no devolvió URL de pago." }, { status: 502 });
    }

    return NextResponse.json({ checkoutUrl: url, bookingId: booking.id });
  } catch (e) {
    console.warn("[checkout]", e);
    return NextResponse.json({ error: "No se pudo iniciar el pago con Stripe." }, { status: 502 });
  }
}
