export const SCREENING_CONSENT_VERSION = "cabibee_screening_v2";

export const SCREENING_KIND = "guest_screening";

export type ScreeningStatus =
  | "requested"
  | "consented"
  | "paid"
  | "authorizing"
  | "processing"
  | "completed"
  | "failed";

export type ScreeningProvider = "simulated" | "pending" | "kibai";

export type ScreeningBand = "apto" | "revisar" | "no_recomendado" | "pendiente_proveedor";

export type ScreeningPayer = "host" | "guest";

export type ScreeningRecord = {
  id: string;
  guestUserId: string;
  bookingId?: string;
  hostId?: string;
  status: ScreeningStatus;
  payer: ScreeningPayer;
  consentVersion?: string;
  consentedAt?: string;
  consentedIp?: string;
  paidAt?: string;
  paidByUserId?: string;
  amountCharged?: number;
  providerCostCharged?: number;
  markupCharged?: number;
  currency?: "mxn" | "usd";
  stripeCheckoutSessionId?: string;
  band?: ScreeningBand;
  provider: ScreeningProvider;
  providerNote?: string;
  /** Referencia del proveedor, cifrada con sealSecret. */
  providerRefSealed?: string;
  /** sha256 de la referencia, para encontrar el caso cuando llega el webhook. */
  providerRefHash?: string;
  /** Liga del formulario donde el huésped confirma con su NIP, cifrada. Se borra al terminar. */
  providerFormSealed?: string;
  providerAttempts?: number;
  providerStartedAt?: string;
  providerCheckedAt?: string;
  providerCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ScreeningPrice = {
  providerCostMxn: number;
  markupMxn: number;
  amountMxn: number;
  providerCostUsd: number;
  markupUsd: number;
  amountUsd: number;
  stripeProductId?: string;
  active: boolean;
  updatedAt: string;
};

export type ScreeningQuote = {
  offered: boolean;
  amount: number;
  providerCost: number;
  markup: number;
  currency: "mxn" | "usd";
};

export type ScreeningPublicView = {
  id: string;
  bookingId?: string;
  status: ScreeningStatus;
  payer: ScreeningPayer;
  consentedAt?: string;
  paidAt?: string;
  band?: ScreeningBand;
  providerNote?: string;
  updatedAt: string;
  needsConsent: boolean;
  needsPayGuest: boolean;
  needsPayHost: boolean;
  needsBureauForm: boolean;
};

export const SCREENING_STATUS_LABEL: Record<ScreeningStatus, string> = {
  requested: "El anfitrión lo pidió",
  consented: "Autorizado, falta el pago",
  paid: "Pagado",
  authorizing: "Falta que el huésped confirme con su NIP",
  processing: "El buró está procesando la consulta",
  completed: "Listo",
  failed: "No se pudo completar",
};

export const SCREENING_BAND_LABEL: Record<ScreeningBand, string> = {
  apto: "Apto",
  revisar: "Revisar",
  no_recomendado: "No recomendado",
  pendiente_proveedor: "Pendiente del proveedor",
};

export const SCREENING_PAYER_LABEL: Record<ScreeningPayer, string> = {
  host: "Lo paga el anfitrión",
  guest: "Se le cobra al huésped",
};

export function screeningPayerOf(row: { payer?: ScreeningPayer }): ScreeningPayer {
  return row.payer === "host" ? "host" : "guest";
}
