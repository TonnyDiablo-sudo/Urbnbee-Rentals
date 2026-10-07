import type { Lang, TFn } from "@/lib/i18n";
import { numberLocale } from "@/lib/i18n";

/** Lo que la API del inbox dice de la reserva ligada a un chat (ver `lib/chat-thread-booking.ts`). */
export type ThreadBooking = {
  id: string;
  checkIn: string;
  checkOut: string;
  phase: "requested" | "upcoming" | "current" | "past";
};

/** Filtro «Reserva»: cada fase, más «sin reserva». */
export type BookingFilter = ThreadBooking["phase"] | "none";

export const BOOKING_FILTERS: { id: BookingFilter; label: string }[] = [
  { id: "current", label: "Hospedados ahora" },
  { id: "upcoming", label: "Por llegar" },
  { id: "requested", label: "Solicitud pendiente" },
  { id: "past", label: "Estancia terminada" },
  { id: "none", label: "Sin reserva" },
];

export function bookingFilterLabel(id: BookingFilter, t: TFn): string {
  return t(BOOKING_FILTERS.find((f) => f.id === id)?.label ?? id);
}

export function threadMatchesBooking(booking: ThreadBooking | undefined, filter: BookingFilter | null): boolean {
  if (!filter) return true;
  if (filter === "none") return !booking;
  return booking?.phase === filter;
}

/** «12–16 oct» en el idioma del sitio. */
export function fmtStay(checkIn: string, checkOut: string, lang: Lang): string {
  const locale = numberLocale(lang);
  const a = new Date(`${checkIn}T12:00:00`);
  const b = new Date(`${checkOut}T12:00:00`);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const left = sameMonth ? a.toLocaleDateString(locale, { day: "numeric" }) : a.toLocaleDateString(locale, { day: "numeric", month: "short" });
  const right = b.toLocaleDateString(locale, { day: "numeric", month: "short" });
  return `${left}–${right}`;
}

/** Una línea para el anfitrión: «Por llegar · 12–16 oct». */
export function bookingLine(booking: ThreadBooking, t: TFn, lang: Lang): string {
  return `${bookingFilterLabel(booking.phase, t)} · ${fmtStay(booking.checkIn, booking.checkOut, lang)}`;
}
