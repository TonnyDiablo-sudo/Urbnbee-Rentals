import type { PayConfirmation, PayInstruction, PayProof } from "@/lib/booking-types";
import type { HostListingRecord } from "@/lib/marketplace-types";
import { mutateCached, prefetchCached, useCached } from "../../_components/cached-fetch";

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
  stripeCheckoutSessionId?: string;
  payInstruction?: PayInstruction;
  payConfirmation?: PayConfirmation;
  payProof?: PayProof;
  createdAt: string;
  /** Ya se le mandaron los datos de llegada. */
  arrivalMessageSentAt?: string;
  /** Terminó la estancia y el anfitrión todavía no califica al huésped. */
  canReview?: boolean;
  contract?: { hostAcceptedAt?: string; guestAcceptedAt?: string };
  /** Anulada por falta de pago y todavía se puede reabrir con un contrato nuevo. */
  canReopen?: boolean;
  archivedAt?: string;
  paymentDueAt?: string;
  paymentFailedAt?: string;
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

export const HOST_URLS = {
  listings: "/api/host/listings",
  bookings: "/api/host/bookings",
  status: "/api/host/verification/status",
  inbox: "/api/host/inbox",
  listing: (id: string) => `/api/host/listings/${encodeURIComponent(id)}`,
};

/** Lo que el anfitrión ve seguido: se pide en cuanto entra a la app para que las pestañas abran al instante. */
export function prefetchHostData() {
  prefetchCached([HOST_URLS.listings, HOST_URLS.bookings, HOST_URLS.status, HOST_URLS.inbox]);
}

function useList<T>(url: string, key: string): T[] | null {
  const { data, error } = useCached<Record<string, unknown>>(url);
  if (data) return Array.isArray(data[key]) ? (data[key] as T[]) : [];
  return error ? [] : null;
}

export const useHostListings = () => useList<HostListing>(HOST_URLS.listings, "listings");
export const useHostBookings = () => useList<HostBooking>(HOST_URLS.bookings, "bookings");

export function putListing(l: HostListing) {
  mutateCached<{ listings?: HostListing[] }>(HOST_URLS.listings, (prev) =>
    prev?.listings ? { ...prev, listings: prev.listings.map((x) => (x.id === l.id ? l : x)) } : prev
  );
  mutateCached(HOST_URLS.listing(l.id), () => ({ listing: l }));
}

export function dropListing(id: string) {
  mutateCached<{ listings?: HostListing[] }>(HOST_URLS.listings, (prev) =>
    prev?.listings ? { ...prev, listings: prev.listings.filter((x) => x.id !== id) } : prev
  );
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
  putListing(j.listing);
  return { listing: j.listing };
}
