export const HOST_SKU_BOOKING_ENGINE = "cabibee_booking_engine";
export const HOST_SKU_HOST_VERIFICATION = "cabibee_host_verification";
export const HOST_SKU_CLEANING = "cabibee_cleaning_tool";
export const HOST_SKU_COLLABORATORS = "cabibee_collaborators";
export const HOST_SKU_ADDRESS_PROOF = "cabibee_address_proof";
export const HOST_SKU_FEATURED = "cabibee_featured_listing";

export const HOST_SKUS = [
  HOST_SKU_BOOKING_ENGINE,
  HOST_SKU_HOST_VERIFICATION,
  HOST_SKU_CLEANING,
  HOST_SKU_COLLABORATORS,
  HOST_SKU_ADDRESS_PROOF,
  HOST_SKU_FEATURED,
] as const;
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
  /**
   * Unidades pagadas: anuncios con motor de reservas o asientos de colaborador.
   * Sin campo en el motor = suscripción anterior al cobro por anuncio, que cubre todos.
   */
  quantity?: number;
  /** Plan del catálogo con que se compró (fija el plazo y el precio). */
  planCode?: string;
  /** Pidió cancelar: sigue activa hasta `currentPeriodEnd` y ya no se renueva. */
  cancelAtPeriodEnd?: boolean;
  /** Cuándo pasó a activa por última vez (para contar suscripciones nuevas). */
  startedAt?: string;
  updatedAt: string;
};

export function isHostSku(v: string): v is HostSku {
  return (HOST_SKUS as readonly string[]).includes(v);
}

/** `past_due` sigue abriendo el motor (gracia). `cancelled` lo cierra. */
export function hostEntitlementAllowsAccess(status: HostEntitlementStatus): boolean {
  return status === "active" || status === "past_due";
}
