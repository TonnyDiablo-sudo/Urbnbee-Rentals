import "server-only";
import type { BookingCompanion } from "@/lib/booking-types";
import { findUserByEmail } from "@/lib/marketplace-store";

export const PARTY_NAME_MAX = 80;

/**
 * Quién se queda: `guestCount` cuenta a quien reserva; cada acompañante lleva su nombre y,
 * si da el correo de su cuenta de Cabibee, se liga para que vea la estancia.
 */
export function parseBookingParty(
  raw: { guestCount?: unknown; party?: unknown },
  opts: { maxGuests: number; bookerId: string }
): { guestCount: number; party: BookingCompanion[] } | { error: string; field: string } {
  const count = Math.floor(Number(raw.guestCount));
  const max = Math.max(1, opts.maxGuests || 1);
  if (!Number.isFinite(count) || count < 1) return { error: "Indica cuántas personas se van a quedar.", field: "guestCount" };
  if (count > max) return { error: "Son más personas de las que admite este alojamiento.", field: "guestCount" };
  const list = Array.isArray(raw.party) ? raw.party : [];
  const party: BookingCompanion[] = [];
  for (let i = 0; i < count - 1; i++) {
    const o = list[i] && typeof list[i] === "object" ? (list[i] as Record<string, unknown>) : {};
    const name = String(o.name ?? "").replace(/\s+/g, " ").trim().slice(0, PARTY_NAME_MAX);
    const email = String(o.email ?? "").trim().toLowerCase();
    const user = email ? findUserByEmail(email) : undefined;
    if (email && !user) return { error: "No encontramos una cuenta de Cabibee con uno de los correos. Revísalo o deja sólo el nombre.", field: `party.${i}` };
    if (user?.id === opts.bookerId) return { error: "No te agregues a ti mismo como acompañante.", field: `party.${i}` };
    const finalName = name || user?.fullName?.trim() || "";
    if (finalName.length < 2) return { error: "Escribe el nombre de cada persona que se queda.", field: `party.${i}` };
    if (user && party.some((p) => p.userId === user.id)) return { error: "Agregaste la misma cuenta dos veces.", field: `party.${i}` };
    party.push(user ? { name: finalName, userId: user.id } : { name: finalName });
  }
  return { guestCount: count, party };
}
