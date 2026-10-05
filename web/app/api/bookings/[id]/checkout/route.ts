import { NextRequest, NextResponse } from "next/server";
import { ensureBookingContract } from "@/lib/booking-contract";
import { expireUnpaidIfDue } from "@/lib/booking-machine";
import { paymentDueOf } from "@/lib/booking-payment-window";
import { notifyHostContractToSign } from "@/lib/booking-reopen";
import { getBookingById, patchBookingRecord } from "@/lib/bookings-store";
import { getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { cabibeeMeta } from "@/lib/stripe-app-meta";
import { recordBookingTransaction } from "@/lib/booking-transactions";
import { ensureHostWebhookEvents, getHostStripe } from "@/lib/host-stripe";
import { allowSimulatedBookingPayment } from "@/lib/stripe-server";
import { publicOriginFromRequest } from "@/lib/public-origin";
import { appReturnPath } from "@/lib/app-return-path";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const found = getBookingById(id);
  if (!found || found.guestUserId !== user.id) {
    return NextResponse.json({ error: "Reserva no encontrada." }, { status: 404 });
  }
  let booking = expireUnpaidIfDue(found);
  if (booking.status === "EXPIRED") {
    return NextResponse.json(
      { error: "Se venció el plazo para pagar y el contrato quedó anulado. Puedes reabrir la reserva para generar uno nuevo." },
      { status: 409 }
    );
  }
  if (booking.status !== "AWAITING_PAYMENT") {
    return NextResponse.json({ error: "Esta reserva no está pendiente de pago." }, { status: 409 });
  }
  if (!booking.contract) {
    booking = ensureBookingContract(booking.id, { role: "system", userId: booking.hostId }) ?? booking;
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
  if (!booking.contract.hostAcceptedAt) {
    notifyHostContractToSign(booking);
    return NextResponse.json(
      {
        error: "El anfitrión todavía no firma el contrato. Le avisamos; en cuanto firme podrás pagar.",
        needsHostSignature: true,
      },
      { status: 409 }
    );
  }
  const dueMs = Date.parse(paymentDueOf(booking));
  if (Date.now() >= dueMs) {
    return NextResponse.json(
      { error: "Se venció el plazo para pagar. En unos minutos el contrato queda anulado y podrás reabrir la reserva." },
      { status: 409 }
    );
  }
  void ensureHostWebhookEvents(booking.hostId);
  const sessionExpiresAt = Math.floor(
    Math.min(Math.max(dueMs, Date.now() + 31 * 60 * 1000), Date.now() + 23.5 * 60 * 60 * 1000) / 1000
  );

  const body = await req.json().catch(() => ({}));
  const cancelPath =
    typeof body.cancelPath === "string" && body.cancelPath.startsWith("/")
      ? body.cancelPath
      : "/";
  const origin = publicOriginFromRequest(req);
  const cancelUrl = `${origin}${cancelPath}`;

  const listing = getListingById(booking.listingId);
  const stripe = getHostStripe(booking.hostId);
  const chargedVia = "host";

  if (!stripe) {
    if (!allowSimulatedBookingPayment()) {
      return NextResponse.json(
        { error: "El anfitrión todavía no conecta su cuenta de Stripe para cobrar esta reserva." },
        { status: 409 }
      );
    }
    return NextResponse.json({
      simulatePayment: true,
      bookingId: booking.id,
      message: "Modo demo: usa «Confirmar pago (demo)» desde la ficha o /bookings/confirm.",
    });
  }

  const title = listing?.title ?? "Reserva Cabibee";
  const addedTaxMxn = booking.taxIncluded ? 0 : (booking.taxMxn ?? 0);
  const taxCents = Math.max(0, Math.round(addedTaxMxn * 100));
  const stayCents = Math.max(1, Math.round(booking.estimatedTotalMxn * 100) - taxCents);
  const totalCents = stayCents + taxCents;
  const taxName = (booking.taxLines ?? []).map((l) => `${l.name} ${l.ratePct}%`).join(" + ") || "Impuestos";
  if (totalCents < 50) {
    return NextResponse.json({ error: "Importe de reserva demasiado bajo." }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      expires_at: sessionExpiresAt,
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
        ...(taxCents > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: "mxn" as const,
                  unit_amount: taxCents,
                  product_data: { name: taxName.slice(0, 100), description: "Impuestos del anfitrión" },
                },
              },
            ]
          : []),
      ],
      success_url: `${origin}${appReturnPath(body.returnPath) ?? "/bookings/confirm"}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: cabibeeMeta({
        bookingId: booking.id,
        guestUserId: user.id,
        hostId: booking.hostId,
        chargedVia,
        stayTotalMxn: String(booking.estimatedTotalMxn),
      }),
      payment_intent_data: {
        metadata: cabibeeMeta({
          bookingId: booking.id,
          guestUserId: user.id,
          hostId: booking.hostId,
          chargedVia,
        }),
      },
      client_reference_id: booking.id,
    });

    if (session.id) {
      patchBookingRecord(booking.id, {
        stripeCheckoutSessionId: session.id,
        chargedVia,
        platformFeeMxn: 0,
      });
      recordBookingTransaction({
        bookingId: booking.id,
        hostId: booking.hostId,
        chargedVia,
        providerRef: session.id,
        amountCents: totalCents,
        currency: "mxn",
        status: "created",
      });
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
