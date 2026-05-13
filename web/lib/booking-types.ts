export type BookingStatus =
  | "AWAITING_PAYMENT"
  | "PENDING"
  | "AWAITING_DETAILS"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";

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
  paidAt?: string;
  stripeCheckoutSessionId?: string;
  createdAt: string;
  updatedAt: string;
  /** Si el host ajusta antes de aceptar */
  hostAdjustedCheckIn?: string;
  hostAdjustedCheckOut?: string;
  hostAdjustedListingId?: string;
};
