import { NextRequest, NextResponse } from "next/server";
import { appReturnPath } from "@/lib/app-return-path";
import { bookingBalanceDueMxn, startAdjustmentCheckout } from "@/lib/booking-adjustments";
import { getBookingById } from "@/lib/bookings-store";
import { publicOriginFromRequest } from "@/lib/public-origin";
import { getSessionUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** Cobra al huésped la diferencia cuando el anfitrión cambió fechas y subió el total. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { token?: string; returnPath?: string };
  const booking = getBookingById(id);
  if (!booking) return NextResponse.json({ error: "Reserva no encontrada." }, { status: 404 });

  const user = await getSessionUser();
  const token = String(body.token ?? "").replace(/\D/g, "").slice(0, 6);
  const allowed = (user && booking.guestUserId === user.id) || (token.length === 6 && token === booking.token);
  if (!allowed) return NextResponse.json({ error: "Reserva no encontrada." }, { status: 404 });

  if (bookingBalanceDueMxn(booking) <= 0) {
    return NextResponse.json({ error: "No hay diferencia pendiente de pago." }, { status: 409 });
  }

  const origin = publicOriginFromRequest(req);
  const back = appReturnPath(body.returnPath) ?? `/finish/${booking.token}`;
  const r = await startAdjustmentCheckout(booking, {
    successUrl: `${origin}${back}?diff_session={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}${back}`,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  if ("simulated" in r) {
    return NextResponse.json({ ok: true, simulated: true, status: r.booking.status });
  }
  return NextResponse.json({ ok: true, checkoutUrl: r.checkoutUrl });
}
