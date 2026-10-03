import "server-only";
import { findUserById, getListingById } from "@/lib/marketplace-store";

/** El anuncio lo dio de alta un asociado y el dueño todavía no toma la cuenta. */
export function isListingUnclaimed(listingId: string): boolean {
  const listing = getListingById(listingId);
  const host = listing ? findUserById(listing.hostId) : undefined;
  return Boolean(host?.provisionedBy && !host.claimedAt);
}
