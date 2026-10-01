import { quoteStay } from "@/lib/listing-pricing";
import type { HostListingRecord } from "@/lib/marketplace-types";

export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDate(iso: string): Date {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

/** Noches entre check-in y check-out (checkout exclusivo). */
export function countNights(checkIn: string, checkOut: string): number {
  const a = parseLocalDate(checkIn);
  const b = parseLocalDate(checkOut);
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

/** Intervalos [in,out) se solapan si in1 < out2 && in2 < out1 */
export function dateRangesOverlap(in1: string, out1: string, in2: string, out2: string): boolean {
  return in1 < out2 && in2 < out1;
}

/** Cada noche en [checkIn, checkOut) debe estar libre de blockedDates del listing. */
export function nightsBlockedByListing(
  listing: HostListingRecord,
  checkIn: string,
  checkOut: string
): boolean {
  const blocked = new Set(listing.blockedDates ?? []);
  const cur = parseLocalDate(checkIn);
  const end = parseLocalDate(checkOut);
  while (cur < end) {
    if (blocked.has(toLocalISODate(cur))) return true;
    cur.setDate(cur.getDate() + 1);
  }
  return false;
}

/** Costo de las noches ya con fin de semana, precios por fecha, promociones y descuentos (sin limpieza). */
export function sumStayMxn(
  listing: HostListingRecord,
  checkIn: string,
  checkOut: string,
  opts: { today?: string } = {}
): { nights: number; staySubtotal: number } {
  const q = quoteStay(listing, checkIn, checkOut, opts);
  return { nights: q.nights, staySubtotal: q.staySubtotal };
}
