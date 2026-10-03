import "server-only";
import {
  HOST_SKU_ADDRESS_PROOF,
  HOST_SKU_BOOKING_ENGINE,
  HOST_SKU_CLEANING,
  HOST_SKU_COLLABORATORS,
  HOST_SKU_FEATURED,
  HOST_SKU_HOST_VERIFICATION,
  type HostSku,
} from "@/lib/host-entitlement-types";
import { getHostEntitlement } from "@/lib/host-entitlements-store";
import { planFamily, type MembershipPlanFamily } from "@/lib/membership-plans-types";

export type EntitlementTarget = { sku: HostSku; perUnit: boolean };

const FAMILY_SKU: Partial<Record<MembershipPlanFamily, HostSku>> = {
  booking_engine: HOST_SKU_BOOKING_ENGINE,
  cleaning_tool: HOST_SKU_CLEANING,
  collaborator_seat: HOST_SKU_COLLABORATORS,
  address_proof: HOST_SKU_ADDRESS_PROOF,
  featured_listing: HOST_SKU_FEATURED,
  host_verification: HOST_SKU_HOST_VERIFICATION,
};

/**
 * Qué desbloquea cada plan de anfitrión. La membresía «Anfitrión verificado» ya no
 * abre el motor de reservas, salvo para la suscripción que ya lo abría antes del
 * cambio: ésa lo sigue abriendo mientras siga viva.
 */
export function hostEntitlementTargets(hostId: string, planCode: string, subscriptionId: string): EntitlementTarget[] {
  const family = planFamily(planCode);
  const engine = getHostEntitlement(hostId, HOST_SKU_BOOKING_ENGINE);
  const legacyEngine = engine?.stripeSubscriptionId === subscriptionId && engine.quantity === undefined;
  switch (family) {
    case "booking_engine":
      return [{ sku: HOST_SKU_BOOKING_ENGINE, perUnit: !legacyEngine }];
    case "cleaning_tool":
    case "collaborator_seat":
    case "address_proof":
    case "featured_listing":
      return [{ sku: FAMILY_SKU[family]!, perUnit: true }];
    case "host_verification":
      return [
        { sku: HOST_SKU_HOST_VERIFICATION, perUnit: false },
        ...(legacyEngine ? [{ sku: HOST_SKU_BOOKING_ENGINE, perUnit: false } as EntitlementTarget] : []),
      ];
    default:
      // Suscripciones sin código de plan: las primeras membresías de anfitrión.
      return [{ sku: HOST_SKU_BOOKING_ENGINE, perUnit: false }];
  }
}

/** SKU que concede cada plan de anfitrión, para la tienda y el modo demo. */
export function primarySkuForPlan(planCode: string): HostSku | null {
  const family = planFamily(planCode);
  return (family && FAMILY_SKU[family]) || null;
}
