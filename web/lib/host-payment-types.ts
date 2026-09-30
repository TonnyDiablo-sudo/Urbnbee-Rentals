export type HostPaymentSecrets = {
  stripeSecretKey: string;
  webhookSecret: string;
};

export type HostPaymentPublicView = {
  connected: boolean;
  secretLast4: string | null;
  lastVerifiedAt: string | null;
  lastError: string | null;
  webhookPath: string;
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
