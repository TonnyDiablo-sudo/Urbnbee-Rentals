import "server-only";
import type { BookingRecord } from "@/lib/booking-types";
import { getBookingById, findBookingByToken } from "@/lib/bookings-store";
import { getSessionUser } from "@/lib/session";

export async function resolveBookingForContract(
  tokenRaw: string | null,
  bookingIdRaw: string | null
): Promise<{ booking: BookingRecord } | { error: string; status: number }> {
  const token = (tokenRaw ?? "").replace(/\D/g, "").slice(0, 6);
  const bookingId = (bookingIdRaw ?? "").trim();

  if (token.length === 6) {
    const booking = findBookingByToken(token);
    if (!booking) return { error: "No hay reserva con ese código.", status: 404 };
    return { booking };
  }

  if (!bookingId) {
    return { error: "Falta el código o el id de la reserva.", status: 400 };
  }

  const user = await getSessionUser();
  if (!user) return { error: "Debes iniciar sesión.", status: 401 };

  const booking = getBookingById(bookingId);
  if (!booking) return { error: "Reserva no encontrada.", status: 404 };

  const allowed =
    user.role === "admin" ||
    booking.hostId === user.id ||
    booking.guestUserId === user.id;
  if (!allowed) return { error: "No autorizado.", status: 403 };

  return { booking };
}
