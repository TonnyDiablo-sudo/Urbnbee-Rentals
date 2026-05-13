/** Texto visible en UI y persistido: sin HTML y longitud acotada. */
export const HOST_INBOX_MAX_MESSAGE = 2000;
export const HOST_INBOX_MAX_NAME = 80;

export function sanitizeBodyText(input: unknown, max = HOST_INBOX_MAX_MESSAGE): string {
  if (typeof input !== "string") return "";
  let s = input.trim().replace(/\s+/g, " ");
  s = s.replace(/[<>]/g, "");
  if (s.length > max) s = s.slice(0, max);
  return s;
}

export function sanitizeGuestName(input: unknown): string {
  const s = sanitizeBodyText(input, HOST_INBOX_MAX_NAME);
  return s;
}

export function sanitizeOptionalEmail(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const e = input.trim().slice(0, 120);
  if (!e) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return undefined;
  return e.toLowerCase();
}
