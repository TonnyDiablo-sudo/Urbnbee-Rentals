import "server-only";
import type { ListingDetail } from "@/lib/listing-detail-data";
import { listingDetails } from "@/lib/listing-detail-data";
import { getListingById, getListingBySlug } from "@/lib/marketplace-store";
import { hostListingToDetail } from "@/lib/host-listing-mapper";

/** Public detail page: slug in URL. */
export function getListingDetail(slug: string): ListingDetail | undefined {
  const hostListing = getListingBySlug(slug);
  if (hostListing?.published) return hostListingToDetail(hostListing);
  return listingDetails[slug];
}

/** Chat/API: resolve by listing id or slug (mock or host). */
export function resolveListingDetail(idOrSlug: string): ListingDetail | undefined {
  const bySlug = getListingBySlug(idOrSlug);
  if (bySlug?.published) return hostListingToDetail(bySlug);
  const byId = getListingById(idOrSlug);
  if (byId?.published) return hostListingToDetail(byId);
  return Object.values(listingDetails).find((l) => l.id === idOrSlug || l.slug === idOrSlug);
}
