import "server-only";
import { getHostEntitlement } from "@/lib/host-entitlements-store";
import { HOST_SKU_BOOKING_ENGINE } from "@/lib/host-entitlement-types";
import { getListingById, listListingsForHost, updateListing } from "@/lib/marketplace-store";
import type { HostListingRecord } from "@/lib/marketplace-types";
import { isListingLocationVerified } from "@/lib/address-proof-store";
import { bindListing, boundListings } from "@/lib/listing-slots-store";
import { hostAcceptsBookings, identityPlanActive, isHostIdentityVerified } from "@/lib/verification-store";

/** Anuncios que puede tener con motor: "all" en suscripciones anteriores al cobro por anuncio. */
export function engineCapacity(hostId: string): number | "all" {
  if (!hostAcceptsBookings(hostId)) return 0;
  const row = getHostEntitlement(hostId, HOST_SKU_BOOKING_ENGINE);
  if (!row || row.quantity === undefined) return "all";
  return Math.max(0, row.quantity);
}

/**
 * Anuncios con lugar pagado del motor. Cada lugar se queda con el anuncio al que se le dio;
 * los que ya estaban encendidos antes del candado conservan el suyo (por fecha de alta).
 */
export function engineSlots(hostId: string): string[] {
  const cap = engineCapacity(hostId);
  if (cap === "all") return listListingsForHost(hostId).map((l) => l.id);
  let bound = boundListings(hostId, "engine");
  const legacy = listListingsForHost(hostId)
    .filter((l) => l.bookingEngineOn && !bound.includes(l.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const l of legacy) {
    if (bound.length >= cap) break;
    bindListing(hostId, "engine", l.id);
    bound = [...bound, l.id];
  }
  return bound.slice(0, cap);
}

/** Anuncios que hoy tienen motor: encendidos y con su lugar. */
export function engineListingIds(hostId: string): Set<string> {
  const cap = engineCapacity(hostId);
  const listings = listListingsForHost(hostId);
  if (cap === "all") return new Set(listings.map((l) => l.id));
  if (cap === 0) return new Set();
  const slots = new Set(engineSlots(hostId));
  return new Set(listings.filter((l) => l.bookingEngineOn && slots.has(l.id)).map((l) => l.id));
}

export const ENGINE_NEEDS_IDENTITY =
  "El motor de reservas necesita tu verificación de identidad contratada y aprobada. Se compra aparte en la Tienda.";
/**
 * La identidad del anfitrión se paga y aprueba aparte. La verificación de dirección viene incluida:
 * sin comprobante el anuncio sí recibe reservas, sólo no muestra la insignia de ubicación verificada.
 */
export function engineHostReady(hostId: string): boolean {
  return identityPlanActive(hostId) && isHostIdentityVerified(hostId);
}

export function engineReadyProblem(listing: HostListingRecord): string | null {
  if (!engineHostReady(listing.hostId)) return ENGINE_NEEDS_IDENTITY;
  return null;
}

export function listingHasEngine(listing: Pick<HostListingRecord, "id" | "hostId">): boolean {
  if (!engineListingIds(listing.hostId).has(listing.id)) return false;
  const full = getListingById(listing.id);
  return Boolean(full && !engineReadyProblem(full));
}

/** Puede recibir y procesar reservas: membresía al corriente y un lugar del motor asignado. */
export function listingAcceptsBookings(listingId: string): boolean {
  const listing = getListingById(listingId);
  return Boolean(listing && listingHasEngine(listing));
}

export const LISTING_ENGINE_OFF_ERROR =
  "Este anuncio no puede procesar reservas. Necesita el motor de reservas activo y tu identidad verificada; revísalo en Reservas en línea o en la Tienda.";

export function setListingEngine(
  hostId: string,
  listingId: string,
  on: boolean
): { ok: true } | { ok: false; error: string } {
  const listing = getListingById(listingId);
  if (!listing || listing.hostId !== hostId) return { ok: false, error: "Anuncio no encontrado." };
  const cap = engineCapacity(hostId);
  if (on && cap !== "all") {
    const slots = engineSlots(hostId);
    if (!slots.includes(listingId)) {
      if (slots.length >= cap) {
        return {
          ok: false,
          error:
            cap === 0
              ? "Todavía no tienes el motor de reservas. Cómpralo en la Tienda."
              : `Tus ${cap} lugares del motor ya son de otros anuncios. Cada lugar se queda con el anuncio que elegiste; para este, agrega uno en la Tienda.`,
        };
      }
      bindListing(hostId, "engine", listingId);
    }
  }
  updateListing(listingId, hostId, { bookingEngineOn: on });
  return { ok: true };
}

export function engineSummary(hostId: string) {
  const cap = engineCapacity(hostId);
  const on = engineListingIds(hostId);
  const slots = new Set(cap === "all" ? [] : engineSlots(hostId));
  return {
    capacity: cap,
    used: cap === "all" ? on.size : slots.size,
    identityReady: engineHostReady(hostId),
    listings: listListingsForHost(hostId).map((l) => ({
      id: l.id,
      title: l.title || "Sin título",
      city: l.city,
      published: l.published,
      on: on.has(l.id),
      bound: cap === "all" || slots.has(l.id),
      addressReady: isListingLocationVerified(l),
    })),
  };
}
