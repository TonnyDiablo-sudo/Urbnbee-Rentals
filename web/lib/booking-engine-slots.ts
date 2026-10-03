import "server-only";
import { getHostEntitlement } from "@/lib/host-entitlements-store";
import { HOST_SKU_BOOKING_ENGINE } from "@/lib/host-entitlement-types";
import { getListingById, listListingsForHost, updateListing } from "@/lib/marketplace-store";
import type { HostListingRecord } from "@/lib/marketplace-types";
import { hostAcceptsBookings } from "@/lib/verification-store";

/** Anuncios que puede tener con motor: "all" en suscripciones anteriores al cobro por anuncio. */
export function engineCapacity(hostId: string): number | "all" {
  if (!hostAcceptsBookings(hostId)) return 0;
  const row = getHostEntitlement(hostId, HOST_SKU_BOOKING_ENGINE);
  if (!row || row.quantity === undefined) return "all";
  return Math.max(0, row.quantity);
}

/**
 * Anuncios que hoy tienen motor. Si el anfitrión bajó la cantidad pagada, quedan
 * encendidos los primeros que encendió (por fecha de alta), no se apaga todo.
 */
export function engineListingIds(hostId: string): Set<string> {
  const cap = engineCapacity(hostId);
  const listings = listListingsForHost(hostId);
  if (cap === "all") return new Set(listings.map((l) => l.id));
  const on = listings
    .filter((l) => l.bookingEngineOn)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, cap);
  return new Set(on.map((l) => l.id));
}

export function listingHasEngine(listing: Pick<HostListingRecord, "id" | "hostId">): boolean {
  return engineListingIds(listing.hostId).has(listing.id);
}

/** Puede recibir y procesar reservas: membresía al corriente y un lugar del motor asignado. */
export function listingAcceptsBookings(listingId: string): boolean {
  const listing = getListingById(listingId);
  return Boolean(listing && listingHasEngine(listing));
}

export const LISTING_ENGINE_OFF_ERROR =
  "Este anuncio no tiene el motor de reservas activo. Actívalo en Reservas en línea o compra otro lugar en la Tienda.";

export function setListingEngine(
  hostId: string,
  listingId: string,
  on: boolean
): { ok: true } | { ok: false; error: string } {
  const listing = getListingById(listingId);
  if (!listing || listing.hostId !== hostId) return { ok: false, error: "Anuncio no encontrado." };
  const cap = engineCapacity(hostId);
  if (on && cap !== "all") {
    const used = engineListingIds(hostId);
    if (!used.has(listingId) && used.size >= cap) {
      return {
        ok: false,
        error:
          cap === 0
            ? "Todavía no tienes el motor de reservas. Cómpralo en la Tienda."
            : `Ya usas tus ${cap} lugares del motor. Apaga otro anuncio o agrega uno más en la Tienda.`,
      };
    }
  }
  updateListing(listingId, hostId, { bookingEngineOn: on });
  return { ok: true };
}

export function engineSummary(hostId: string) {
  const cap = engineCapacity(hostId);
  const on = engineListingIds(hostId);
  return {
    capacity: cap,
    used: on.size,
    listings: listListingsForHost(hostId).map((l) => ({
      id: l.id,
      title: l.title || "Sin título",
      city: l.city,
      published: l.published,
      on: on.has(l.id),
    })),
  };
}
