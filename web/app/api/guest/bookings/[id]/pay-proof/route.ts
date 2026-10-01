import { NextRequest, NextResponse } from "next/server";
import { getBookingById, patchBookingRecord } from "@/lib/bookings-store";
import { savePayProof, sniffPayProof } from "@/lib/pay-proof";
import { notifyHostPayProof } from "@/lib/push";
import { getSessionUser } from "@/lib/session";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await ctx.params;
  const booking = getBookingById(id);
  if (!booking || booking.guestUserId !== user.id) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }
  if (booking.paidAt || booking.payConfirmation) {
    return NextResponse.json({ error: "Esta reserva ya está pagada." }, { status: 409 });
  }
  if (!booking.payInstruction || booking.status !== "AWAITING_PAYMENT") {
    return NextResponse.json({ error: "El anfitrión todavía no te envió datos para pagar." }, { status: 409 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Archivo requerido." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El comprobante supera 8 MB." }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffPayProof(buf);
  if (!mime) {
    return NextResponse.json({ error: "Sube una imagen (JPG, PNG, WebP, GIF) o un PDF." }, { status: 400 });
  }

  await savePayProof(booking.id, buf, mime);
  const payProof = { uploadedAt: new Date().toISOString(), mime };
  const next = patchBookingRecord(booking.id, { payProof });
  if (!next) return NextResponse.json({ error: "No se pudo guardar." }, { status: 409 });
  notifyHostPayProof(next);
  return NextResponse.json({ payProof });
}
