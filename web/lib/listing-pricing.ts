/**
 * Reglas de precio de un anuncio, iguales en el navegador y en el servidor:
 * lo que el huésped ve en el calendario es lo que se cobra al reservar.
 *
 * Orden (como Airbnb): precio por fecha > precio de fin de semana > precio base;
 * luego el descuento por duración (mensual desde 28 noches, semanal desde 7).
 */
export type ListingPricing = {
  /** Precio para las noches de viernes y sábado. */
  weekendPrice?: number;
  weeklyDiscountPct?: number;
  monthlyDiscountPct?: number;
  minNights?: number;
  maxNights?: number;
};

export type PricingInput = {
  pricePerNight: number;
  nightlyPriceOverrides?: Record<string, number>;
  pricing?: ListingPricing;
};

export const WEEKLY_NIGHTS = 7;
export const MONTHLY_NIGHTS = 28;

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isWeekendNight(iso: string): boolean {
  const dow = parseIso(iso).getDay();
  return dow === 5 || dow === 6;
}

/** Precio de una noche antes de descuentos por duración. */
export function nightPrice(p: PricingInput, iso: string): number {
  const override = p.nightlyPriceOverrides?.[iso];
  if (typeof override === "number" && Number.isFinite(override)) return override;
  const weekend = p.pricing?.weekendPrice;
  if (weekend && weekend > 0 && isWeekendNight(iso)) return weekend;
  return p.pricePerNight;
}

export function lengthDiscountPct(p: PricingInput, nights: number): number {
  const monthly = p.pricing?.monthlyDiscountPct ?? 0;
  const weekly = p.pricing?.weeklyDiscountPct ?? 0;
  if (nights >= MONTHLY_NIGHTS && monthly > 0) return monthly;
  if (nights >= WEEKLY_NIGHTS && weekly > 0) return weekly;
  return 0;
}

export type StayQuote = {
  nights: number;
  /** Suma de las noches antes del descuento. */
  nightsSubtotal: number;
  discountPct: number;
  discountMxn: number;
  /** Lo que cuestan las noches ya con descuento (sin limpieza). */
  staySubtotal: number;
  sameRate: boolean;
};

export function quoteStay(p: PricingInput, checkIn: string, checkOut: string): StayQuote {
  let nightsSubtotal = 0;
  let nights = 0;
  let min = Infinity;
  let max = -Infinity;
  const cur = parseIso(checkIn);
  const end = parseIso(checkOut);
  while (cur < end) {
    const price = nightPrice(p, toIso(cur));
    nightsSubtotal += price;
    min = Math.min(min, price);
    max = Math.max(max, price);
    nights++;
    cur.setDate(cur.getDate() + 1);
  }
  const discountPct = lengthDiscountPct(p, nights);
  const discountMxn = Math.round((nightsSubtotal * discountPct) / 100);
  return {
    nights,
    nightsSubtotal,
    discountPct,
    discountMxn,
    staySubtotal: nightsSubtotal - discountMxn,
    sameRate: nights === 0 || min === max,
  };
}

/** Mensaje en español (clave de traducción) si la duración no cumple las reglas del anuncio. */
export function stayLengthError(p: PricingInput, nights: number): { key: string; n: number } | null {
  const min = p.pricing?.minNights ?? 1;
  const max = p.pricing?.maxNights;
  if (min > 1 && nights < min) return { key: "La estancia mínima es de {n} noches.", n: min };
  if (max && max > 0 && nights > max) return { key: "La estancia máxima es de {n} noches.", n: max };
  return null;
}

function num(v: unknown, min: number, max: number): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

export function sanitizePricing(raw: unknown): ListingPricing {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: ListingPricing = {};
  const weekend = num(o.weekendPrice, 0, 1_000_000);
  if (weekend) out.weekendPrice = Math.round(weekend);
  const weekly = num(o.weeklyDiscountPct, 0, 99);
  if (weekly) out.weeklyDiscountPct = Math.round(weekly);
  const monthly = num(o.monthlyDiscountPct, 0, 99);
  if (monthly) out.monthlyDiscountPct = Math.round(monthly);
  const minN = num(o.minNights, 1, 365);
  if (minN && minN > 1) out.minNights = Math.round(minN);
  const maxN = num(o.maxNights, 1, 730);
  if (maxN) out.maxNights = Math.max(Math.round(maxN), out.minNights ?? 1);
  return out;
}
