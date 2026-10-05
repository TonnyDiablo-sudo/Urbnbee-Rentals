/**
 * Teléfono "creíble": no se manda SMS, pero se descartan números inventados
 * (todos iguales, escaleras, lada imposible) con reglas de México y EE. UU./Canadá.
 */

export const PHONE_ERROR = "Pon un teléfono real con lada (10 dígitos, o con + y código de país).";

const PHONE_CHARS = /^\+?[\d\s\-().]+$/;
const SEQUENCES = ["0123456789012345", "9876543210987654", "1234567890123456"];

function looksFake(d: string): boolean {
  if (new Set(d).size < 3) return true;
  if (/(\d)\1{6,}/.test(d)) return true;
  return SEQUENCES.some((s) => s.includes(d.slice(-10)));
}

/** NANP: lada y central no empiezan con 0/1, sin 555-01xx de películas. */
function validNanp(n10: string): boolean {
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(n10)) return false;
  if (/^[2-9]\d{2}55501\d{2}$/.test(n10)) return false;
  return !/^[2-9]11/.test(n10);
}

/** México: 10 dígitos nacionales, la lada no empieza con 0 ni 1. */
function validMx(n10: string): boolean {
  return /^[2-9]\d{9}$/.test(n10);
}

/** Teléfono tal como lo escribió (espacios normalizados), o null si no es creíble. */
export function normalizeLegitPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const p = raw.trim().replace(/\s+/g, " ");
  if (!PHONE_CHARS.test(p)) return null;
  const d = p.replace(/\D/g, "");
  if (d.length < 10 || d.length > 15) return null;
  if (looksFake(d)) return null;

  const intl = p.startsWith("+") || d.startsWith("00");
  const full = d.startsWith("00") ? d.slice(2) : d;

  if (!intl) {
    if (d.length === 10) return validMx(d) || validNanp(d) ? p : null;
    if (d.length === 11 && d.startsWith("1")) return validNanp(d.slice(1)) ? p : null;
    if (d.length === 12 && d.startsWith("52")) return validMx(d.slice(2)) ? p : null;
    if (d.length === 13 && d.startsWith("521")) return validMx(d.slice(3)) ? p : null;
    return null;
  }

  if (full.startsWith("1")) return full.length === 11 && validNanp(full.slice(1)) ? p : null;
  if (full.startsWith("52")) {
    const rest = full.startsWith("521") && full.length === 13 ? full.slice(3) : full.slice(2);
    return rest.length === 10 && validMx(rest) ? p : null;
  }
  if (full.startsWith("0") || full.length < 9) return null;
  return p;
}
