export const HOST_SKU_BOOKING_ENGINE = "cabibee_booking_engine";
export const HOST_SKU_HOST_VERIFICATION = "cabibee_host_verification";

export const HOST_SKUS = [HOST_SKU_BOOKING_ENGINE, HOST_SKU_HOST_VERIFICATION] as const;
export type HostSku = (typeof HOST_SKUS)[number];

export type HostEntitlementStatus = "active" | "past_due" | "cancelled";
export type HostEntitlementSource = "cabibee_direct" | "urbnbeeai_seller" | "derived";

export type HostEntitlementRecord = {
  hostId: string;
  sku: HostSku;
  status: HostEntitlementStatus;
  source: HostEntitlementSource;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string;
  updatedAt: string;
};

export function isHostSku(v: string): v is HostSku {
  return (HOST_SKUS as readonly string[]).includes(v);
}

/** `past_due` sigue abriendo el motor (gracia). `cancelled` lo cierra. */
export function hostEntitlementAllowsAccess(status: HostEntitlementStatus): boolean {
  return status === "active" || status === "past_due";
}
