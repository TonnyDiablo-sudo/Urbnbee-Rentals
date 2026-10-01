import "server-only";
import { applyHostEntitlement, HOST_SKU_BOOKING_ENGINE } from "@/lib/host-entitlements";
import { lockLegalName } from "@/lib/display-name";
import { setHostListingsVerified } from "@/lib/marketplace-store";
import {
  getVerification,
  hostShowsVerifiedRibbon,
  isHostIdentityVerified,
  isHostMembershipPaidUp,
  setHostMembershipFields,
  setHostVerification,
  stripeIdentityEnabled,
} from "@/lib/verification-store";
import type { VerificationSubscriptionStatus } from "@/lib/verification-types";

/**
 * El listón «Miembro verificado».
 *
 * Vive en la ficha de la persona (identidad + membresía de anfitrión) y se copia a
 * sus anuncios. Este módulo es el único que debe escribirla: antes cualquier
 * anfitrión se la ponía sola mandando `verified: true` al PATCH de su anuncio.
 */

export type HostVerificationSummary = {
  identityVerified: boolean;
  membershipActive: boolean;
  /** Listón público: las dos cosas a la vez. */
  ribbon: boolean;
  verifiedAt?: string;
  source?: "identity" | "admin";
  kycStatus: string;
  identityEnabled: boolean;
  hostSubscriptionStatus: VerificationSubscriptionStatus;
  hostCurrentPeriodEnd?: string;
};

export function hostVerificationSummary(userId: string): HostVerificationSummary {
  const v = getVerification(userId);
  return {
    identityVerified: isHostIdentityVerified(userId),
    membershipActive: isHostMembershipPaidUp(userId),
    ribbon: hostShowsVerifiedRibbon(userId),
    verifiedAt: v?.hostVerifiedAt,
    source: v?.hostVerificationSource,
    kycStatus: v?.kycStatus ?? "not_started",
    identityEnabled: stripeIdentityEnabled(),
    hostSubscriptionStatus: v?.hostSubscriptionStatus ?? "none",
    hostCurrentPeriodEnd: v?.hostCurrentPeriodEnd,
  };
}

export function grantHostVerification(
  userId: string,
  source: "identity" | "admin"
): { identityVerified: true; listingsUpdated: number } {
  setHostVerification(userId, { verified: true, source });
  lockLegalName(userId);
  return { identityVerified: true, listingsUpdated: syncHostBadgeToListings(userId) };
}

export function revokeHostVerification(userId: string): {
  identityVerified: false;
  listingsUpdated: number;
} {
  setHostVerification(userId, { verified: false });
  return { identityVerified: false, listingsUpdated: syncHostBadgeToListings(userId) };
}

/** Activa o apaga la membresía de anfitrión (pago real o concesión de admin/demo). */
export function setHostMembershipActive(
  userId: string,
  active: boolean,
  opts?: { periodEnd?: string; subscriptionId?: string }
): { membershipActive: boolean; listingsUpdated: number } {
  setHostMembershipFields(userId, {
    hostSubscriptionStatus: active ? "active" : "canceled",
    hostCurrentPeriodEnd: active ? opts?.periodEnd : undefined,
    hostStripeSubscriptionId: active ? opts?.subscriptionId : undefined,
  });
  applyHostEntitlement({
    hostId: userId,
    sku: HOST_SKU_BOOKING_ENGINE,
    status: active ? "active" : "cancelled",
    source: "cabibee_direct",
    stripeSubscriptionId: active ? opts?.subscriptionId : undefined,
    currentPeriodEnd: active ? opts?.periodEnd : undefined,
  });
  return { membershipActive: active, listingsUpdated: syncHostBadgeToListings(userId) };
}

export function syncHostBadgeToListings(userId: string): number {
  return setHostListingsVerified(userId, hostShowsVerifiedRibbon(userId));
}
