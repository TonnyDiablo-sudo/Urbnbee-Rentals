import { NextRequest, NextResponse } from "next/server";
import { getBookingById } from "@/lib/bookings-store";
import { readPayProof } from "@/lib/pay-proof";
import { getSessionUser } from "@/lib/session";

async function readAllowed(id: string) {
  const user = await getSessionUser();
  if (!user) return { status: 401 as const };
  const booking = getBookingById(id);
  const allowed =
    booking &&
    (user.role === "admin" || user.id === booking.hostId || user.id === booking.guestUserId);
  if (!booking?.payProof || !allowed) return { status: 404 as const };
  const buf = await readPayProof(booking.id, booking.payProof.mime);
  if (!buf) return { status: 404 as const };
  return { status: 200 as const, mime: booking.payProof.mime, buf };
}

function respond(result: Awaited<ReturnType<typeof readAllowed>>, head: boolean) {
  if (result.status !== 200) return new NextResponse(null, { status: result.status });
  return new NextResponse(head ? null : new Uint8Array(result.buf), {
    headers: {
      "Content-Type": result.mime,
      "Content-Length": String(result.buf.length),
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return respond(await readAllowed(id), false);
}

export async function HEAD(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return respond(await readAllowed(id), true);
}
