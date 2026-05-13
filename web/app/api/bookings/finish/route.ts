import { NextRequest, NextResponse } from "next/server";
import { findBookingByToken, patchBookingByGuestToken } from "@/lib/bookings-store";
import { allowHostInboxPost } from "@/lib/host-inbox-rate-limit";

function sanitizePhone(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.replace(/[^\d+\s-]/g, "").trim().slice(0, 30);
}

function sanitizeNotes(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.replace(/[<>]/g, "").trim().slice(0, 2000);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "")
    .replace(/\D/g, "")
    .slice(0, 6);
  if (token.length !== 6) {
    return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  }

  const booking = findBookingByToken(token);
  if (!booking) {
    return NextResponse.json({ error: "Reserva no encontrada." }, { status: 404 });
  }

  if (booking.status !== "AWAITING_DETAILS") {
    return NextResponse.json(
      { error: "En este estado no se pueden completar datos aquí." },
      { status: 409 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown";
  if (!allowHostInboxPost(`booking_finish:${ip}:${token}`, 15_000)) {
    return NextResponse.json({ error: "Espera un momento." }, { status: 429 });
  }

  const guestPhone = sanitizePhone(body.guestPhone);
  const guestFinishNotes = sanitizeNotes(body.guestFinishNotes);

  const updated = patchBookingByGuestToken(token, {
    guestPhone: guestPhone || undefined,
    guestFinishNotes: guestFinishNotes || undefined,
  });
  if (!updated) {
    return NextResponse.json({ error: "No se pudieron guardar los datos." }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
