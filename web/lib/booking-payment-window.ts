import type { BookingRecord } from "@/lib/booking-types";

/** Plazo para pagar una reserva (o volver a pagar si el pago se rechazó). */
export const PAYMENT_WINDOW_MS = 48 * 60 * 60 * 1000;
const MIN_WINDOW_MS = 2 * 60 * 60 * 1000;
/** Un pago iniciado justo antes del límite puede tardar en confirmarse (Checkout dura mínimo 30 min). */
export const PAYMENT_GRACE_MS = 35 * 60 * 1000;

export function paymentWindowClosed(b: Pick<BookingRecord, "paymentDueAt" | "createdAt">, now = Date.now()): boolean {
  const due = Date.parse(paymentDueOf(b));
  return Number.isFinite(due) && now >= due + PAYMENT_GRACE_MS;
}

/** 48 h, pero nunca después del día de llegada; si la llegada ya es hoy, al menos 2 h. */
export function paymentWindowEnd(checkIn: string, from = Date.now()): string {
  const arrival = Date.parse(`${checkIn.slice(0, 10)}T00:00:00-06:00`);
  let end = from + PAYMENT_WINDOW_MS;
  if (Number.isFinite(arrival) && arrival < end) end = arrival;
  return new Date(Math.max(end, from + MIN_WINDOW_MS)).toISOString();
}

export function paymentDueOf(b: Pick<BookingRecord, "paymentDueAt" | "createdAt">): string {
  if (b.paymentDueAt) return b.paymentDueAt;
  const created = Date.parse(b.createdAt);
  return new Date((Number.isFinite(created) ? created : Date.now()) + PAYMENT_WINDOW_MS).toISOString();
}
