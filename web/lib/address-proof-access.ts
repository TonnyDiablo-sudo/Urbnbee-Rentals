import "server-only";
import { isListingLocationVerified } from "@/lib/address-proof-store";
import { getHostEntitlement } from "@/lib/host-entitlements-store";
import { HOST_SKU_ADDRESS_PROOF } from "@/lib/host-entitlement-types";
import { listListingsForHost } from "@/lib/marketplace-store";
import type { HostListingRecord } from "@/lib/marketplace-types";
import { paidUp } from "@/lib/team-access";

/** Lugares de verificación de domicilio comprados. El motor de reservas no la incluye. */
export function addressProofSlots(hostId: string): number {
  const row = getHostEntitlement(hostId, HOST_SKU_ADDRESS_PROOF);
  return paidUp(row) ? Math.max(0, row?.quantity ?? 1) : 0;
}

/** Anuncios cuya insignia de domicilio está pagada: los primeros N con comprobante aprobado (por fecha de alta). */
export function addressCoveredListingIds(hostId: string): Set<string> {
  const covered = new Set<string>();
  let slots = addressProofSlots(hostId);
  if (slots === 0) return covered;
  const rest = listListingsForHost(hostId)
    .filter((l) => !covered.has(l.id) && isListingLocationVerified(l))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const l of rest) {
    if (slots-- <= 0) break;
    covered.add(l.id);
  }
  return covered;
}

/** La insignia pública «Ubicación verificada»: comprobante aprobado y pagado. */
export function listingShowsLocationBadge(l: HostListingRecord): boolean {
  return isListingLocationVerified(l) && addressCoveredListingIds(l.hostId).has(l.id);
}
