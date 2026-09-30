import type { HostListingRecord } from "@/lib/marketplace-types";

export type HostListing = HostListingRecord;

export type HostBooking = {
  id: string;
  listingId: string;
  hostAdjustedListingId?: string;
  status: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  guestUserId?: string;
  checkIn: string;
  checkOut: string;
  hostAdjustedCheckIn?: string;
  hostAdjustedCheckOut?: string;
  nights: number;
  estimatedTotalMxn: number;
  cleaningFeeMxn?: number;
  platformFeeMxn?: number;
  listingTitle: string;
  effectiveListingTitle?: string;
  token: string;
  paidAt?: string;
  createdAt: string;
};

export function todayIso(): string {
  const d = new Date();
  return toIso(d);
}

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toIso(new Date(y, m - 1, d + n));
}

/** Fechas y anuncio que valen de verdad: si el anfitrión los ajustó al aceptar, mandan los ajustados. */
export function stayOf(b: HostBooking) {
  return {
    listingId: b.hostAdjustedListingId ?? b.listingId,
    checkIn: b.hostAdjustedCheckIn ?? b.checkIn,
    checkOut: b.hostAdjustedCheckOut ?? b.checkOut,
    title: b.effectiveListingTitle ?? b.listingTitle,
  };
}

export const isPending = (s: string) => s === "PENDING" || s === "PENDING_HOST";
export const isConfirmed = (s: string) => s === "CONFIRMED" || s === "AWAITING_DETAILS";

/** Mismo criterio que el servidor: estas reservas ocupan noches en el calendario. */
export function holdsNights(s: string): boolean {
  return s === "AWAITING_PAYMENT" || isPending(s) || isConfirmed(s);
}

export function hostChatHref(b: HostBooking): string | null {
  if (!b.guestUserId) return null;
  const { listingId } = stayOf(b);
  return `/host/mensajes/${encodeURIComponent(listingId)}/${encodeURIComponent(`gu_${b.guestUserId}`)}`;
}

export async function loadHostData(): Promise<{ listings: HostListing[]; bookings: HostBooking[] }> {
  const [l, b] = await Promise.all([
    fetch("/api/host/listings", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
    fetch("/api/host/bookings", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
  ]);
  return {
    listings: Array.isArray(l.listings) ? l.listings : [],
    bookings: Array.isArray(b.bookings) ? b.bookings : [],
  };
}

export async function patchListing(
  id: string,
  body: Record<string, unknown>
): Promise<{ listing?: HostListing; error?: string }> {
  const res = await fetch(`/api/host/listings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const j = res ? await res.json().catch(() => ({})) : {};
  if (!res?.ok || !j.listing) return { error: typeof j.error === "string" ? j.error : res ? "No se pudo guardar." : "Sin conexión." };
  return { listing: j.listing };
}
