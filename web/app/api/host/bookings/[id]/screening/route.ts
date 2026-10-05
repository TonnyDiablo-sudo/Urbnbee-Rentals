import { NextRequest, NextResponse } from "next/server";
import { getBookingById } from "@/lib/bookings-store";
import { CREDIT_CHECK_ENABLED } from "@/lib/feature-flags";
import { getSessionUser } from "@/lib/session";
import {
  canRequestScreening,
  parseScreeningPayer,
  requestScreeningForBooking,
  screeningHostView,
  screeningQuote,
} from "@/lib/screening-service";
import { verificationRegionFromRequest } from "@/lib/verification-region";
import { getScreeningByBooking } from "@/lib/screening-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
  return NextResponse.json({
    screening: row ? screeningHostView(row) : null,
    canRequest: canRequestScreening(booking),
    quote: screeningQuote(verificationRegionFromRequest(req)),
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!CREDIT_CHECK_ENABLED) {
    return NextResponse.json({ error: "La revisión de historial crediticio todavía no está disponible." }, { status: 403 });
  }
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const booking = getBookingById(id);
  if (!booking || booking.hostId !== user.id) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }
  if (booking.status === "REJECTED" || booking.status === "CANCELLED") {
    return NextResponse.json({ error: "No se puede pedir screening en esta reserva." }, { status: 409 });
  }
  const body = (await req.json().catch(() => ({}))) as { payer?: unknown };
  const payer = parseScreeningPayer(body.payer);
  if (!payer) {
    return NextResponse.json(
      { error: "Elige quién paga: tú (host) o el huésped (guest)." },
      { status: 400 }
    );
  }
  try {
    const next = requestScreeningForBooking(booking, payer);
    return NextResponse.json({ ok: true, screening: screeningHostView(next) });
  } catch (e) {
    const msg = e instanceof Error && e.message === "NO_GUEST"
      ? "Esta reserva no tiene cuenta de huésped."
      : "No se pudo pedir el screening.";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
