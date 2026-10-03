import type { BookingContractRecord } from "@/lib/booking-contract-types";
import type { BookingDepositRecord } from "@/lib/booking-deposit-types";

export type BookingStatus =
  | "AWAITING_PAYMENT"
  | "PENDING"
  | "PENDING_HOST"
  | "AWAITING_DETAILS"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED"
  | "EXPIRED";

export type BookingPaymentStatus =
  | "unpaid"
  | "paid"
  | "refunded"
  | "partially_refunded"
  | "failed";

export type BookingContractStatus = "not_required" | "pending" | "signed";

export type BookingActor = "host" | "guest" | "system" | "beeagent" | "admin";

export type BookingTransitionEvent = {
  at: string;
  actor: BookingActor;
  from: BookingStatus;
  to: BookingStatus;
  reason?: string;
};

/** Por qué se devolvió el dinero de una reserva ya pagada. */
export type BookingRefundReason = "host_rejected";

/** Reserva persistida (JSON → más adelante MySQL). Flujo FDS: PENDING → AWAITING_DETAILS → CONFIRMED … */
export type BookingRecord = {
  id: string;
  listingId: string;
  hostId: string;
  guestEmail: string;
  guestName: string;
  guestPhone?: string;
  guestFinishNotes?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  estimatedTotalMxn: number;
  /** Cargo plataforma (~1% configurable) sobre estancia + limpieza; sumado en Checkout con la estancia. */
  platformFeeMxn?: number;
  cleaningFeeMxn: number;
  status: BookingStatus;
  paymentStatus?: BookingPaymentStatus;
  contractStatus?: BookingContractStatus;
  lifecycle?: BookingTransitionEvent[];
  /** 6 dígitos — consulta sin cuenta */
  token: string;
  /** Usuario registrado que reserva (obligatorio en flujo actual). */
  guestUserId?: string;
  /** Se creó gastando un pase por reserva: hay que devolverlo si no llega a existir. */
  usedMembershipPass?: boolean;
  paidAt?: string;
  stripeCheckoutSessionId?: string;
  /** Dónde se cobró la estancia. Sin esto se asume la cuenta de Cabibee. */
  chargedVia?: "platform" | "host";
  /** PaymentIntent del cobro de la estancia — necesario para devolver. */
  stripePaymentIntentId?: string;
  refundedAt?: string;
  /** Cuándo se le pidió reseña a cada lado (una sola vez). */
  reviewReminderGuestAt?: string;
  reviewReminderHostAt?: string;
  refundAmountMxn?: number;
  stripeRefundId?: string;
  refundReason?: BookingRefundReason;
  createdAt: string;
  updatedAt: string;
  /** Si el host ajusta antes de aceptar */
  hostAdjustedCheckIn?: string;
  hostAdjustedCheckOut?: string;
  hostAdjustedListingId?: string;
  /** Liga del bot (booking-link). */
  beeagentRef?: string;
  conversationKey?: string;
  /** Contrato de esta reserva. Se genera al aceptar (o al confirmar instantáneo). */
  contract?: BookingContractRecord;
  /** Depósito pactado. Cabibee solo documenta; no retiene el dinero. */
  deposit?: BookingDepositRecord;
  /** Impuestos del anfitrión ya contenidos en `estimatedTotalMxn`. */
  taxMxn?: number;
  taxLines?: BookingTaxLine[];
  /** true: el precio ya los incluía; false: se sumaron encima. */
  taxIncluded?: boolean;
  /** Lo que decidió el anfitrión al aceptar; sin esto vale lo del anuncio. */
  chargeTax?: boolean;
  /** Parte de `estimatedTotalMxn` ya cobrada. Sin esto y con `paidAt`, se cobró completo. */
  paidStayMxn?: number;
  /** Cobros o devoluciones extra por cambio de fechas. */
  adjustments?: BookingAdjustment[];
  /** Datos de cobro manual que el anfitrión ya le mandó al huésped. */
  payInstruction?: PayInstruction;
  /** Quién dejó constancia de que la estancia ya se pagó. */
  payConfirmation?: PayConfirmation;
  /** Comprobante que subió el huésped en un pago manual. */
  payProof?: PayProof;
};

export type PayProof = {
  uploadedAt: string;
  mime: "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf";
};

export type ManualPayMethod = "clabe" | "zelle" | "cashapp" | "oxxo";

export type PayInstruction = {
  method: ManualPayMethod;
  sentAt: string;
  /** Texto en español que se anexa al contrato. No entra al hash de la firma. */
  lines: string[];
  clabe?: { holder: string; clabe: string; bank?: string };
  zelle?: { name: string; contact: string };
  cashapp?: { name: string; cashtag: string };
  oxxo?: { holder: string; reference: string; note?: string };
};

export type PayConfirmation = {
  at: string;
  by: "stripe" | "host";
  method: "stripe" | ManualPayMethod;
};

export type BookingTaxLine = { name: string; ratePct: number; amountMxn: number };

export type BookingAdjustment = {
  id: string;
  kind: "charge" | "refund";
  /** Diferencia de la estancia (sin cargo de plataforma). */
  amountMxn: number;
  /** Cargo de plataforma sobre la diferencia (se suma al cobro o se devuelve). */
  feeMxn: number;
  status: "pending" | "paid" | "refunded" | "void" | "failed";
  reason: "dates_changed";
  createdAt: string;
  settledAt?: string;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  stripeRefundId?: string;
};
