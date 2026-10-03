import "server-only";
import { getHostEntitlement } from "@/lib/host-entitlements-store";
import { HOST_SKU_FEATURED } from "@/lib/host-entitlement-types";
import { getListingById, listListingsForHost, updateListing } from "@/lib/marketplace-store";
import type { HostListingRecord } from "@/lib/marketplace-types";
import { paidUp } from "@/lib/team-access";

/** Anuncios que puede destacar: los lugares pagados, mientras la suscripción esté al corriente. */
export function featuredCapacity(hostId: string): number {
  const row = getHostEntitlement(hostId, HOST_SKU_FEATURED);
  return paidUp(row) ? Math.max(0, row?.quantity ?? 1) : 0;
}

/** Si bajó la cantidad pagada, quedan destacados los primeros que encendió (por fecha de alta). */
export function featuredListingIds(hostId: string): Set<string> {
  const cap = featuredCapacity(hostId);
  if (cap === 0) return new Set();
  const on = listListingsForHost(hostId)
    .filter((l) => l.featuredOn)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, cap);
  return new Set(on.map((l) => l.id));
}

export function listingIsFeatured(listing: Pick<HostListingRecord, "id" | "hostId" | "published">): boolean {
  return Boolean(listing.published) && featuredListingIds(listing.hostId).has(listing.id);
}

export function setListingFeatured(
  hostId: string,
  listingId: string,
  on: boolean
): { ok: true } | { ok: false; error: string } {
  const listing = getListingById(listingId);
  if (!listing || listing.hostId !== hostId) return { ok: false, error: "Anuncio no encontrado." };
  if (on) {
    const cap = featuredCapacity(hostId);
    const used = featuredListingIds(hostId);
    if (!used.has(listingId) && used.size >= cap) {
      return {
        ok: false,
        error:
          cap === 0
            ? "Todavía no tienes «Anuncio destacado». Cómpralo en la Tienda."
            : "Ya usas todos tus lugares de anuncio destacado. Quita otro anuncio o agrega uno más en la Tienda.",
      };
    }
  }
  updateListing(listingId, hostId, { featuredOn: on });
  return { ok: true };
}

export function featuredSummary(hostId: string) {
  const on = featuredListingIds(hostId);
  return {
    capacity: featuredCapacity(hostId),
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
