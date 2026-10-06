import { NextRequest, NextResponse } from "next/server";
import { bookingDetails, bookingRoleFor } from "@/lib/booking-details";
import { getBookingById } from "@/lib/bookings-store";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

/** Detalle de una estancia para quien reservó o para un acompañante con cuenta. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await ctx.params;
  const b = getBookingById(id);
  const role = b ? bookingRoleFor(user.id, b) : null;
  if (!b || !role) return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  return NextResponse.json({ booking: bookingDetails(b, role) });
}
