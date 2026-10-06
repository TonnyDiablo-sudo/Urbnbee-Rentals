import { NextRequest, NextResponse } from "next/server";
import { bookingDetails, withStripeReceipt } from "@/lib/booking-details";
import { getBookingById } from "@/lib/bookings-store";
import { getSessionUser } from "@/lib/session";
import { bookingActor } from "@/lib/team-access";

export const runtime = "nodejs";

/** Detalle completo de una reserva para el anfitrión (o su equipo con permiso de reservas). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  const { id } = await ctx.params;
  const b = getBookingById(id);
  if (!user || !b || !bookingActor(user, b)) return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  return NextResponse.json({ booking: await withStripeReceipt(b, bookingDetails(b, "host")) });
}
