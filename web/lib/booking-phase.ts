/**
 * En qué punto va una reserva respecto a hoy. Sirve igual en el servidor y en el navegador;
 * se usa en los filtros de chats, calendario y reservas.
 */
export type BookingPhase = "requested" | "upcoming" | "current" | "past";

export const BOOKING_PHASES: { id: BookingPhase; label: string }[] = [
  { id: "current", label: "Hospedados ahora" },
  { id: "upcoming", label: "Por llegar" },
  { id: "requested", label: "Solicitud pendiente" },
  { id: "past", label: "Estancia terminada" },
];

export function bookingPhaseLabel(id: BookingPhase): string {
  return BOOKING_PHASES.find((p) => p.id === id)?.label ?? id;
}

type PhaseInput = {
  status: string;
  checkIn: string;
  checkOut: string;
  hostAdjustedCheckIn?: string;
  hostAdjustedCheckOut?: string;
};

/** `today` en ISO local (YYYY-MM-DD). Devuelve null si la reserva ya no cuenta (cancelada, rechazada, vencida). */
export function bookingPhaseOf(b: PhaseInput, today: string): BookingPhase | null {
  const checkIn = b.hostAdjustedCheckIn ?? b.checkIn;
  const checkOut = b.hostAdjustedCheckOut ?? b.checkOut;
  switch (b.status) {
    case "COMPLETED":
      return "past";
    case "CONFIRMED":
    case "AWAITING_DETAILS":
      if (checkOut <= today) return "past";
      return checkIn <= today ? "current" : "upcoming";
    case "PENDING":
    case "PENDING_HOST":
    case "AWAITING_PAYMENT":
      return checkIn > today ? "requested" : null;
    default:
      return null;
  }
}

export function localTodayIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
