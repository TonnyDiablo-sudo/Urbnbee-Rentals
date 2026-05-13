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
  subscriptionStatus: VerificationSubscriptionStatus;
  /** Fin del período pagado actual (Stripe current_period_end). */
  currentPeriodEnd?: string;
  /** Placeholder hasta integrar webhook del proveedor ID. */
  kycStatus: KycProviderStatus;
  kycProviderSessionId?: string;
  kycExpiresAt?: string;
  updatedAt: string;
};
