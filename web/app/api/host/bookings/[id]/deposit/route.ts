import { NextRequest, NextResponse } from "next/server";
import { hostClaimDeposit, hostCloseDeposit } from "@/lib/booking-deposit";
import { getBookingById } from "@/lib/bookings-store";
import { getSessionUser } from "@/lib/session";
import { LISTING_ENGINE_OFF_ERROR, listingAcceptsBookings } from "@/lib/booking-engine-slots";

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

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "claim") {
    if (!listingAcceptsBookings(booking.hostAdjustedListingId ?? booking.listingId)) {
      return NextResponse.json({ error: LISTING_ENGINE_OFF_ERROR }, { status: 403 });
    }
    const result = hostClaimDeposit(id, { note: String(body.note ?? "") });
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 409 });
    }
    return NextResponse.json({ ok: true, booking: result.booking });
  }

  if (action === "release" || action === "close") {
    const result = hostCloseDeposit(id, action === "release" ? "released" : "closed");
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 409 });
    }
    return NextResponse.json({ ok: true, booking: result.booking });
  }

  return NextResponse.json({ error: "Acción no válida (claim | release | close)." }, { status: 400 });
}
