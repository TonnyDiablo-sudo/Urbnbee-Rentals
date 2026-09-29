import { NextRequest, NextResponse } from "next/server";
import { getBookingById } from "@/lib/bookings-store";
import { runScreeningCheckout } from "@/lib/screening-checkout";
import { getScreeningByBooking } from "@/lib/screening-store";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const booking = getBookingById(id);
  if (!booking || booking.hostId !== user.id) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }
  const row = getScreeningByBooking(booking.id);
  if (!row) {
    return NextResponse.json({ error: "No hay screening en esta reserva." }, { status: 404 });
  }
  return runScreeningCheckout(req, {
    screening: row,
    payerUser: user,
    expectedPayer: "host",
    successPath: "/host/requests?paid=1",
    cancelPath: "/host/requests",
  });
}
