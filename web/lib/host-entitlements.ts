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
import { enqueueEntitlementsChanged } from "@/lib/beeagent-outbound";
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
  quantity?: number;
  cancelAtPeriodEnd?: boolean;
};

export function applyHostEntitlement(input: ApplyHostEntitlementInput): HostEntitlementRecord {
  // Misma suscripción viva: se conservan el plazo comprado y la cancelación pedida.
  const prev = getHostEntitlement(input.hostId, input.sku);
  const same =
    prev && prev.status !== "cancelled" && prev.stripeSubscriptionId === input.stripeSubscriptionId ? prev : undefined;
  const cancelAtPeriodEnd = input.cancelAtPeriodEnd ?? same?.cancelAtPeriodEnd;
  const row = upsertHostEntitlement({
    hostId: input.hostId,
    sku: input.sku,
    status: input.status,
    source: input.source,
    stripeSubscriptionId: input.stripeSubscriptionId,
    currentPeriodEnd: input.currentPeriodEnd,
    ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
    ...(cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd } : {}),
    ...(same?.planCode ? { planCode: same.planCode } : {}),
    updatedAt: new Date().toISOString(),
  });

  // El motor por anuncio (con cantidad) ya no concede el listón de verificado: son productos aparte.
  if (input.sku === HOST_SKU_BOOKING_ENGINE && row.quantity === undefined) {
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

  if (input.source !== "urbnbeeai_seller") {
    enqueueEntitlementsChanged(input.hostId, listHostEntitlements(input.hostId));
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
