/** Correo y teléfono de quien reserva: mismas reglas en el formulario y en el servidor. */

import { normalizeLegitPhone, PHONE_ERROR } from "@/lib/phone-validation";

export const BOOKING_EMAIL_ERROR = "Pon un correo válido.";
export const BOOKING_PHONE_ERROR = PHONE_ERROR;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Correo en minúsculas, o null si no es válido. */
export function normalizeBookingEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && EMAIL.test(e) ? e : null;
}

/** Teléfono tal como lo escribió (sin espacios de más), o null si no parece real. */
export function normalizeBookingPhone(raw: unknown): string | null {
  return normalizeLegitPhone(raw);
}
