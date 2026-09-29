import { NextRequest, NextResponse } from "next/server";
import { guestReplyDeposit } from "@/lib/booking-deposit";
import { getBookingById } from "@/lib/bookings-store";
import { getSessionUser } from "@/lib/session";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const booking = getBookingById(id);
  if (!booking || booking.guestUserId !== user.id) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const result = guestReplyDeposit(id, { note: String(body.note ?? "") });
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 409 });
  }
  return NextResponse.json({ ok: true, booking: result.booking });
}
