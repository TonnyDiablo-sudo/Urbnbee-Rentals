import "server-only";
import {
  HOST_SKU_BOOKING_ENGINE,
  HOST_SKU_HOST_VERIFICATION,
  hostEntitlementAllowsAccess,
  type HostEntitlementRecord,
  type HostEntitlementSource,
  type HostEntitlementStatus,
  type HostSku,
} from "@/lib/host-entitlement-types";
import {
  getHostEntitlement,
  listHostEntitlements,
  upsertHostEntitlement,
} from "@/lib/host-entitlements-store";

export {
  HOST_SKU_BOOKING_ENGINE,
  HOST_SKU_HOST_VERIFICATION,
  hostEntitlementAllowsAccess,
} from "@/lib/host-entitlement-types";
export { getHostEntitlement, listHostEntitlements } from "@/lib/host-entitlements-store";

export type ApplyHostEntitlementInput = {
  hostId: string;
  sku: HostSku;
  status: HostEntitlementStatus;
  source: HostEntitlementSource;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string;
};

export function applyHostEntitlement(input: ApplyHostEntitlementInput): HostEntitlementRecord {
  const row = upsertHostEntitlement({
    hostId: input.hostId,
    sku: input.sku,
    status: input.status,
    source: input.source,
    stripeSubscriptionId: input.stripeSubscriptionId,
    currentPeriodEnd: input.currentPeriodEnd,
    updatedAt: new Date().toISOString(),
  });

  if (input.sku === HOST_SKU_BOOKING_ENGINE) {
    const existing = getHostEntitlement(input.hostId, HOST_SKU_HOST_VERIFICATION);
    const keepPaid =
      existing &&
      existing.source !== "derived" &&
      hostEntitlementAllowsAccess(existing.status);
    if (!keepPaid) {
      upsertHostEntitlement({
        hostId: input.hostId,
        sku: HOST_SKU_HOST_VERIFICATION,
        status: input.status,
        source: "derived",
        stripeSubscriptionId: input.stripeSubscriptionId,
        currentPeriodEnd: input.currentPeriodEnd,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return row;
}

export function hostHasBookingEngine(hostId: string): boolean {
  const row = getHostEntitlement(hostId, HOST_SKU_BOOKING_ENGINE);
  return Boolean(row && hostEntitlementAllowsAccess(row.status));
}

export function hostHasVerificationSku(hostId: string): boolean {
  const row = getHostEntitlement(hostId, HOST_SKU_HOST_VERIFICATION);
  if (row) return hostEntitlementAllowsAccess(row.status);
  return hostHasBookingEngine(hostId);
}

export function entitlementsPublicView(hostId: string): {
  cabibee_booking_engine: HostEntitlementStatus | "none";
  cabibee_host_verification: HostEntitlementStatus | "none";
} {
  return {
    cabibee_booking_engine: getHostEntitlement(hostId, HOST_SKU_BOOKING_ENGINE)?.status ?? "none",
    cabibee_host_verification:
      getHostEntitlement(hostId, HOST_SKU_HOST_VERIFICATION)?.status ?? "none",
  };
}
