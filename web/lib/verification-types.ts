/** Región de precios Stripe (MXN vs USD) para membresía huésped. */
export type VerificationRegion = "mx" | "us";

/** Estado de suscripción mensual de verificación + huecos para proveedor KYC (Persona, etc.). */
export type VerificationSubscriptionStatus =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid";

export type KycProviderStatus = "not_started" | "pending" | "verified" | "failed" | "expired";

export type GuestVerificationRecord = {
  userId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  /** Plan del catálogo de la membresía (fija el plazo y el precio). */
  planCode?: string;
  /** Pidió cancelar la membresía: sigue hasta `currentPeriodEnd` y no se renueva. */
  cancelAtPeriodEnd?: boolean;
  subscriptionStatus: VerificationSubscriptionStatus;
  /** Fin del período pagado actual (Stripe current_period_end). */
  currentPeriodEnd?: string;
  /** Placeholder hasta integrar webhook del proveedor ID. */
  kycStatus: KycProviderStatus;
  kycProviderSessionId?: string;
  kycExpiresAt?: string;
  /**
   * Cuándo quedó verificado como anfitrión. La insignia de los anuncios es el reflejo
   * de esto, no un campo que el anfitrión pueda escribir.
   */
  hostVerifiedAt?: string;
  /** `identity` = lo comprobó Stripe; `admin` = lo aprobó una persona del equipo. */
  hostVerificationSource?: "identity" | "admin";
  /** Membresía de anfitrión: distinta de la del huésped, porque una persona puede ser las dos. */
  hostSubscriptionStatus?: VerificationSubscriptionStatus;
  hostStripeSubscriptionId?: string;
  hostCurrentPeriodEnd?: string;
  /** Pases comprados y sin usar (plan `pase_reserva`): cada uno habilita una reserva. */
  bookingPassesRemaining?: number;
  /** Sesiones de Checkout ya acreditadas, para no acreditar dos veces el mismo pago. */
  grantedPassSessionIds?: string[];
  /** Cuándo pasaron a activas por última vez (para contar suscripciones nuevas). */
  subscriptionStartedAt?: string;
  hostSubscriptionStartedAt?: string;
  updatedAt: string;
};
