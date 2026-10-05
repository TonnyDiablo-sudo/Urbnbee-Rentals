import { NextRequest, NextResponse } from "next/server";
import { sendArrivalMessage } from "@/lib/arrival-message";
import { getBookingById } from "@/lib/bookings-store";
import { getSessionUser } from "@/lib/session";

/** El anfitrión manda a mano los datos de llegada de una reserva confirmada. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const found = getBookingById(id);
  if (!found || (found.hostId !== user.id && user.role !== "admin")) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }
  const r = await sendArrivalMessage(found.id, { manual: true });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, sentAt: r.sentAt, chat: r.chat, emailed: r.emailed });
}
