import "server-only";
import { getListingById, getListingBySlug } from "@/lib/marketplace-store";
import type { HostListingRecord } from "@/lib/marketplace-types";

export function resolvePartnerListing(idOrSlug: string): HostListingRecord | undefined {
  const key = decodeURIComponent(idOrSlug);
  return getListingById(key) ?? getListingBySlug(key);
}
