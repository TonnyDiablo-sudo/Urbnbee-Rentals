import type { BookingContractRecord } from "@/lib/booking-contract-types";
import type { BookingDepositRecord } from "@/lib/booking-deposit-types";

export type BookingStatus =
  | "AWAITING_PAYMENT"
  | "PENDING"
  | "AWAITING_DETAILS"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";

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
  /** 6 dígitos — consulta sin cuenta */
  token: string;
  /** Usuario registrado que reserva (obligatorio en flujo actual). */
  guestUserId?: string;
  /** Se creó gastando un pase por reserva: hay que devolverlo si no llega a existir. */
  usedMembershipPass?: boolean;
  paidAt?: string;
  stripeCheckoutSessionId?: string;
  /** PaymentIntent del cobro de la estancia — necesario para devolver. */
  stripePaymentIntentId?: string;
  refundedAt?: string;
  refundAmountMxn?: number;
  stripeRefundId?: string;
  refundReason?: BookingRefundReason;
  createdAt: string;
  updatedAt: string;
  /** Si el host ajusta antes de aceptar */
  hostAdjustedCheckIn?: string;
  hostAdjustedCheckOut?: string;
  hostAdjustedListingId?: string;
  /** Contrato de esta reserva. Se genera al aceptar (o al confirmar instantáneo). */
  contract?: BookingContractRecord;
  /** Depósito pactado. Cabibee solo documenta; no retiene el dinero. */
  deposit?: BookingDepositRecord;
};
