import { NextRequest, NextResponse } from "next/server";
import { getBookingById } from "@/lib/bookings-store";
import { getSessionUser } from "@/lib/session";
import { sendStayMessage, stayMessagesForBooking } from "@/lib/stay-messages";

type Ctx = { params: Promise<{ id: string }> };

async function ownBooking(ctx: Ctx) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) return null;
  const { id } = await ctx.params;
  const found = getBookingById(id);
  if (!found || (found.hostId !== user.id && user.role !== "admin")) return null;
  return found;
}

/** Mensajes de la estancia activos en el anuncio y cuándo se mandó cada uno. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const b = await ownBooking(ctx);
  if (!b) return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  return NextResponse.json({ messages: stayMessagesForBooking(b) });
}

/** El anfitrión manda a mano uno de los mensajes. Body: { key: "welcome" | "checkout" | "mid:<id>" }. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const b = await ownBooking(ctx);
  if (!b) return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const key = String(body.key ?? "");
  if (!/^(welcome|checkout|mid:[a-z0-9]{1,16})$/.test(key)) {
    return NextResponse.json({ error: "Mensaje no válido." }, { status: 400 });
  }
  const r = await sendStayMessage(b.id, key, { manual: true });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, sentAt: r.sentAt, chat: r.chat, emailed: r.emailed });
}
