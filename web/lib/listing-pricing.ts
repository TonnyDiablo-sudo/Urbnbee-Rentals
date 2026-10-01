/**
 * Reglas de precio de un anuncio, iguales en el navegador y en el servidor:
 * lo que el huésped ve en el calendario es lo que se cobra al reservar.
 *
 * Orden (como Airbnb): precio por fecha > precio de fin de semana > precio base;
 * luego las promociones de temporada (por noche) y al final un solo descuento
 * de estancia: el mayor entre duración (mensual 28+, semanal 7+), reserva
 * anticipada y última hora.
 */
export type SeasonalPromo = {
  /** Primera noche con descuento (YYYY-MM-DD). */
  from: string;
  /** Última noche con descuento (YYYY-MM-DD, incluida). */
  to: string;
  pct: number;
  label?: string;
};

export type ListingPricing = {
  /** Precio para las noches de viernes y sábado. */
  weekendPrice?: number;
  weeklyDiscountPct?: number;
  monthlyDiscountPct?: number;
  /** Descuento si reservan con al menos `earlyBirdDays` días de anticipación. */
  earlyBirdPct?: number;
  earlyBirdDays?: number;
  /** Descuento si la llegada es dentro de `lastMinuteDays` días o menos. */
  lastMinutePct?: number;
  lastMinuteDays?: number;
  seasonal?: SeasonalPromo[];
  minNights?: number;
  maxNights?: number;
};

export type StayDiscountKind = "monthly" | "weekly" | "early_bird" | "last_minute";

export const DEFAULT_EARLY_BIRD_DAYS = 30;
export const DEFAULT_LAST_MINUTE_DAYS = 7;
export const MAX_SEASONAL_PROMOS = 12;

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

/** Fecha de hoy en Ciudad de México (YYYY-MM-DD), igual en navegador y servidor. */
export function pricingToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function daysBetween(fromIso: string, toIsoDate: string): number {
  return Math.round((parseIso(toIsoDate).getTime() - parseIso(fromIso).getTime()) / 86_400_000);
}

export function seasonalPctFor(p: PricingInput, iso: string): number {
  let best = 0;
  for (const s of p.pricing?.seasonal ?? []) {
    if (iso >= s.from && iso <= s.to && s.pct > best) best = s.pct;
  }
  return best;
}

/** El mayor descuento de estancia que aplica (no se acumulan entre sí). */
export function stayDiscountFor(
  p: PricingInput,
  nights: number,
  checkIn: string,
  today: string
): { pct: number; kind: StayDiscountKind | null } {
  const pr = p.pricing ?? {};
  const options: { pct: number; kind: StayDiscountKind }[] = [];
  if (nights >= MONTHLY_NIGHTS && (pr.monthlyDiscountPct ?? 0) > 0) {
    options.push({ pct: pr.monthlyDiscountPct!, kind: "monthly" });
  } else if (nights >= WEEKLY_NIGHTS && (pr.weeklyDiscountPct ?? 0) > 0) {
    options.push({ pct: pr.weeklyDiscountPct!, kind: "weekly" });
  }
  const ahead = daysBetween(today, checkIn);
  if ((pr.earlyBirdPct ?? 0) > 0 && ahead >= (pr.earlyBirdDays ?? DEFAULT_EARLY_BIRD_DAYS)) {
    options.push({ pct: pr.earlyBirdPct!, kind: "early_bird" });
  }
  if ((pr.lastMinutePct ?? 0) > 0 && ahead >= 0 && ahead <= (pr.lastMinuteDays ?? DEFAULT_LAST_MINUTE_DAYS)) {
    options.push({ pct: pr.lastMinutePct!, kind: "last_minute" });
  }
  let best: { pct: number; kind: StayDiscountKind | null } = { pct: 0, kind: null };
  for (const o of options) if (o.pct > best.pct) best = o;
  return best;
}

export type StayQuote = {
  nights: number;
  /** Suma de las noches antes de promociones y descuentos. */
  nightsSubtotal: number;
  /** Lo que se descuenta por promociones de temporada (noche por noche). */
  seasonalDiscountMxn: number;
  /** Descuento de estancia (duración, anticipada o última hora). */
  discountPct: number;
  discountKind: StayDiscountKind | null;
  discountMxn: number;
  /** Lo que cuestan las noches ya con descuento (sin limpieza). */
  staySubtotal: number;
  sameRate: boolean;
};

/**
 * `today` es el día en que se reserva: decide reserva anticipada y última hora.
 * Si no se pasa, se usa hoy en Ciudad de México.
 */
export function quoteStay(
  p: PricingInput,
  checkIn: string,
  checkOut: string,
  opts: { today?: string } = {}
): StayQuote {
  let nightsSubtotal = 0;
  let seasonalRaw = 0;
  let nights = 0;
  let min = Infinity;
  let max = -Infinity;
  const cur = parseIso(checkIn);
  const end = parseIso(checkOut);
  while (cur < end) {
    const iso = toIso(cur);
    const price = nightPrice(p, iso);
    nightsSubtotal += price;
    seasonalRaw += (price * seasonalPctFor(p, iso)) / 100;
    min = Math.min(min, price);
    max = Math.max(max, price);
    nights++;
    cur.setDate(cur.getDate() + 1);
  }
  const seasonalDiscountMxn = Math.round(seasonalRaw);
  const { pct: discountPct, kind: discountKind } = stayDiscountFor(
    p,
    nights,
    checkIn,
    opts.today ?? pricingToday()
  );
  const discountMxn = Math.round(((nightsSubtotal - seasonalDiscountMxn) * discountPct) / 100);
  return {
    nights,
    nightsSubtotal,
    seasonalDiscountMxn,
    discountPct,
    discountKind,
    discountMxn,
    staySubtotal: nightsSubtotal - seasonalDiscountMxn - discountMxn,
    sameRate: nights === 0 || min === max,
  };
}

export type DiscountRow = {
  /** Clave de traducción en español. */
  key: string;
  vars?: Record<string, string | number>;
  pct: number;
};

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d}/${m}`;
}

/** Descuentos vigentes del anuncio, para mostrarlos en la ficha. */
export function discountRows(p: ListingPricing | undefined, today: string = pricingToday()): DiscountRow[] {
  if (!p) return [];
  const rows: DiscountRow[] = [];
  if (p.weeklyDiscountPct) rows.push({ key: "Descuento por semana (7+ noches)", pct: p.weeklyDiscountPct });
  if (p.monthlyDiscountPct) rows.push({ key: "Descuento por mes (28+ noches)", pct: p.monthlyDiscountPct });
  if (p.earlyBirdPct) {
    rows.push({
      key: "Reserva anticipada ({n}+ días antes)",
      vars: { n: p.earlyBirdDays ?? DEFAULT_EARLY_BIRD_DAYS },
      pct: p.earlyBirdPct,
    });
  }
  if (p.lastMinutePct) {
    rows.push({
      key: "Última hora (llegada en {n} días o menos)",
      vars: { n: p.lastMinuteDays ?? DEFAULT_LAST_MINUTE_DAYS },
      pct: p.lastMinutePct,
    });
  }
  for (const s of upcomingSeasonalPromos(p, today)) {
    rows.push({
      key: s.label ? "{label}: {from} al {to}" : "Temporada: {from} al {to}",
      vars: { label: s.label ?? "", from: shortDate(s.from), to: shortDate(s.to) },
      pct: s.pct,
    });
  }
  return rows;
}

/** Promociones de temporada que todavía no terminan, ordenadas por fecha. */
export function upcomingSeasonalPromos(p: ListingPricing | undefined, today: string = pricingToday()): SeasonalPromo[] {
  return (p?.seasonal ?? []).filter((s) => s.to >= today).sort((a, b) => a.from.localeCompare(b.from));
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
  const early = num(o.earlyBirdPct, 0, 90);
  if (early) {
    out.earlyBirdPct = Math.round(early);
    out.earlyBirdDays = Math.round(num(o.earlyBirdDays, 1, 365) ?? DEFAULT_EARLY_BIRD_DAYS);
  }
  const last = num(o.lastMinutePct, 0, 90);
  if (last) {
    out.lastMinutePct = Math.round(last);
    out.lastMinuteDays = Math.round(num(o.lastMinuteDays, 0, 28) ?? DEFAULT_LAST_MINUTE_DAYS);
  }
  if (Array.isArray(o.seasonal)) {
    const isoRe = /^\d{4}-\d{2}-\d{2}$/;
    const promos: SeasonalPromo[] = [];
    for (const raw of o.seasonal) {
      if (!raw || typeof raw !== "object") continue;
      const s = raw as Record<string, unknown>;
      const from = typeof s.from === "string" && isoRe.test(s.from) ? s.from : "";
      const to = typeof s.to === "string" && isoRe.test(s.to) ? s.to : "";
      const pct = num(s.pct, 0, 90);
      if (!from || !to || !pct) continue;
      const label = typeof s.label === "string" ? s.label.trim().slice(0, 40) : "";
      promos.push({
        from: from <= to ? from : to,
        to: from <= to ? to : from,
        pct: Math.round(pct),
        ...(label ? { label } : {}),
      });
      if (promos.length >= MAX_SEASONAL_PROMOS) break;
    }
    if (promos.length) out.seasonal = promos.sort((a, b) => a.from.localeCompare(b.from));
  }
  const minN = num(o.minNights, 1, 365);
  if (minN && minN > 1) out.minNights = Math.round(minN);
  const maxN = num(o.maxNights, 1, 730);
  if (maxN) out.maxNights = Math.max(Math.round(maxN), out.minNights ?? 1);
  return out;
}
