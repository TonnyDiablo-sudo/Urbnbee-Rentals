import { NextRequest, NextResponse } from "next/server";
import { guestAcceptBookingContract } from "@/lib/booking-contract";
import { findBookingByToken } from "@/lib/bookings-store";
import { allowHostInboxPost } from "@/lib/host-inbox-rate-limit";
import { findUserById } from "@/lib/marketplace-store";

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

  const canAccept =
    booking.status === "AWAITING_DETAILS" ||
    (booking.status === "CONFIRMED" && booking.contract && !booking.contract.guestAcceptedAt);
  if (!canAccept) {
    return NextResponse.json(
      { error: "En este estado no se puede aceptar el contrato." },
      { status: 409 }
    );
  }

  if (!booking.contract) {
    return NextResponse.json(
      { error: "Esta reserva aún no tiene contrato. Espera a que el anfitrión acepte." },
      { status: 409 }
    );
  }

  if (body.acceptContract !== true) {
    return NextResponse.json(
      { error: "Tienes que aceptar el contrato de la reserva." },
      { status: 400 }
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
  const guestAccount = booking.guestUserId ? findUserById(booking.guestUserId) : undefined;
  const signedName = String(body.signedName ?? guestAccount?.fullName ?? booking.guestName)
    .trim()
    .slice(0, 160);
  if (signedName.length < 3) {
    return NextResponse.json({ error: "Firma con tu nombre completo." }, { status: 400 });
  }

  const updated = guestAcceptBookingContract(booking.id, {
    name: signedName,
    ip,
    phone: guestPhone || guestAccount?.phone || undefined,
    notes: guestFinishNotes || undefined,
  });
  if (!updated) {
    return NextResponse.json({ error: "No se pudieron guardar los datos." }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    status: updated.status,
    contractAccepted: Boolean(updated.contract?.guestAcceptedAt),
  });
}
