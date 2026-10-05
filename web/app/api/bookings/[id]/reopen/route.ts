import { NextRequest, NextResponse } from "next/server";
import { archiveExpiredBooking, reopenExpiredBooking } from "@/lib/booking-reopen";
import { getBookingById } from "@/lib/bookings-store";
import { getSessionUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** El huésped reabre (con las mismas fechas u otras) o archiva una reserva anulada por falta de pago. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const { id } = await ctx.params;
  const booking = getBookingById(id);
  if (!booking || booking.guestUserId !== user.id) {
    return NextResponse.json({ error: "Reserva no encontrada." }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { action?: string; checkIn?: string; checkOut?: string };
  if (body.action === "archive") {
    const r = archiveExpiredBooking(booking.id, "guest");
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, token: r.booking.token });
  }
  const r = await reopenExpiredBooking(booking.id, "guest", {
    checkIn: typeof body.checkIn === "string" ? body.checkIn.trim() : undefined,
    checkOut: typeof body.checkOut === "string" ? body.checkOut.trim() : undefined,
    userId: user.id,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, token: r.booking.token });
}
