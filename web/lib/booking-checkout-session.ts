import "server-only";
import type Stripe from "stripe";
import { findBookingByCheckoutSessionId } from "@/lib/bookings-store";
import { getHostStripe } from "@/lib/host-stripe";
import { getStripe } from "@/lib/stripe-server";

/**
 * La sesión de Checkout vive en la cuenta que cobró: la del anfitrión o la de Cabibee.
 * retrieve en la cuenta equivocada da 404 de Stripe y el huésped se queda “sin pagar”.
 */
export async function retrieveBookingCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  const booking = findBookingByCheckoutSessionId(sessionId);
  const clients: Stripe[] = [];
  const add = (s: Stripe | null) => {
    if (s && !clients.includes(s)) clients.push(s);
  };

  if (booking?.chargedVia === "host") {
    add(getHostStripe(booking.hostId));
    add(getStripe());
  } else if (booking) {
    add(getStripe());
    add(getHostStripe(booking.hostId));
  } else {
    add(getStripe());
  }

  if (clients.length === 0) {
    throw new Error("Stripe no configurado.");
  }

  let last: unknown;
  for (const stripe of clients) {
    try {
      return await stripe.checkout.sessions.retrieve(sessionId);
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("No se pudo verificar el pago.");
}
