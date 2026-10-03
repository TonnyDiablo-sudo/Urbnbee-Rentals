export type HostPaymentSecrets = {
  stripeSecretKey: string;
  webhookSecret: string;
  /** Set when Cabibee created the endpoint itself in the host's Stripe. */
  webhookEndpointId?: string;
};

export type HostPaymentPublicView = {
  connected: boolean;
  secretLast4: string | null;
  lastVerifiedAt: string | null;
  lastError: string | null;
  webhookPath: string;
  webhookAuto: boolean;
  cryptoReady: boolean;
};

export type HostPaymentRecord = {
  hostId: string;
  ciphertext: string;
  secretLast4: string;
  lastVerifiedAt?: string;
  lastError?: string;
  updatedAt: string;
};

export type BookingChargeVia = "platform" | "host";

export type BookingTransactionRecord = {
  id: string;
  bookingId: string;
  hostId: string;
  chargedVia: BookingChargeVia;
  providerRef: string;
  amountCents: number;
  currency: string;
  processorFeeCents?: number;
  netCents?: number;
  status: "created" | "paid" | "refunded" | "failed";
  createdAt: string;
};
