import type { NextRequest } from "next/server";
import { partnerJson } from "@/lib/beeagent-partner";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { applyBookingLifecycle } from "@/lib/booking-deposit";
import { canonicalBookingStatus } from "@/lib/booking-machine";
import { listBookingsForHost } from "@/lib/bookings-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string }> };

const WINDOW_MS = 60 * 60 * 1000;
/** El código también abre contrato y pago y son 6 dígitos: pocos intentos fallidos por anfitrión. */
const MAX_FAILS = 10;
const MAX_TRIES = 40;
const DEAD = new Set(["CANCELLED", "REJECTED", "EXPIRED"]);

const attempts = new Map<string, { at: number; ok: boolean }[]>();

function recent(hostId: string): { at: number; ok: boolean }[] {
  const now = Date.now();
  const list = (attempts.get(hostId) ?? []).filter((a) => now - a.at < WINDOW_MS);
  attempts.set(hostId, list);
  return list;
}

function firstName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)[0] ?? "";
}

/**
 * El agente comprueba que quien escribe es huésped de una reserva vigente de este anfitrión
 * (código de 6 dígitos + primer nombre). Nunca dice cuál de los dos falló. Permiso `listings`.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { hostId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId, "listings");
  if (!gate.ok) return gate.response;

  const list = recent(hostId);
  if (list.filter((a) => !a.ok).length >= MAX_FAILS || list.length >= MAX_TRIES) {
    return partnerJson({ error: "Demasiados intentos. Intenta más tarde.", code: "rate_limited" }, req, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(WINDOW_MS / 1000)) },
    });
  }

  const body = (await req.json().catch(() => null)) as { code?: unknown; first_name?: unknown } | null;
  const code = String(body?.code ?? "").replace(/\D/g, "");
  const name = firstName(String(body?.first_name ?? ""));
  if (code.length !== 6 || name.length < 2) {
    return partnerJson({ error: "Faltan code (6 dígitos) y first_name.", code: "invalid_request" }, req, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const booking = listBookingsForHost(hostId)
    .map(applyBookingLifecycle)
    .find(
      (b) =>
        b.token === code &&
        !DEAD.has(b.status) &&
        (b.hostAdjustedCheckOut ?? b.checkOut) >= today &&
        firstName(b.guestName) === name
    );
  list.push({ at: Date.now(), ok: Boolean(booking) });

  if (!booking) return partnerJson({ match: false }, req);
  return partnerJson(
    {
      match: true,
      booking: {
        booking_id: booking.id,
        listing_id: booking.hostAdjustedListingId ?? booking.listingId,
        check_in: booking.hostAdjustedCheckIn ?? booking.checkIn,
        check_out: booking.hostAdjustedCheckOut ?? booking.checkOut,
        status: canonicalBookingStatus(booking.status),
      },
    },
    req
  );
}
