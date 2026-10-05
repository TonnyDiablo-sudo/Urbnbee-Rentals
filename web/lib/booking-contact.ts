/** Correo y teléfono de quien reserva: mismas reglas en el formulario y en el servidor. */

export const BOOKING_EMAIL_ERROR = "Pon un correo válido.";
export const BOOKING_PHONE_ERROR = "Pon un teléfono válido (10 a 15 dígitos).";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS = /^\+?[\d\s\-()]+$/;

/** Correo en minúsculas, o null si no es válido. */
export function normalizeBookingEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && EMAIL.test(e) ? e : null;
}

/** Teléfono tal como lo escribió (sin espacios de más), o null si no tiene 10 a 15 dígitos. */
export function normalizeBookingPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const p = raw.trim().replace(/\s+/g, " ");
  if (!PHONE_CHARS.test(p)) return null;
  const digits = p.replace(/\D/g, "").length;
  return digits >= 10 && digits <= 15 ? p : null;
}
