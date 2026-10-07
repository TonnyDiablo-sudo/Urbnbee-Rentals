import { numberLocale, type Lang, type TFn } from "@/lib/i18n";

/** Periodo que se mira en una lista de reservas: lo que viene, los últimos días, un mes o un año. */
export type DatePeriod =
  | { kind: "upcoming" }
  | { kind: "last30" }
  | { kind: "month"; year: number; month: number }
  | { kind: "year"; year: number };

export const UPCOMING: DatePeriod = { kind: "upcoming" };

const pad = (n: number) => String(n).padStart(2, "0");

function shiftDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** Rango inclusivo en ISO local; `to` null = sin tope. */
export function periodRange(p: DatePeriod, today: string): { from: string; to: string | null } {
  switch (p.kind) {
    case "upcoming":
      return { from: today, to: null };
    case "last30":
      return { from: shiftDays(today, -30), to: null };
    case "month": {
      const last = new Date(p.year, p.month + 1, 0).getDate();
      return { from: `${p.year}-${pad(p.month + 1)}-01`, to: `${p.year}-${pad(p.month + 1)}-${pad(last)}` };
    }
    case "year":
      return { from: `${p.year}-01-01`, to: `${p.year}-12-31` };
  }
}

export function periodLabel(p: DatePeriod, t: TFn, lang: Lang): string {
  switch (p.kind) {
    case "upcoming":
      return t("Desde hoy");
    case "last30":
      return t("Últimos 30 días");
    case "month":
      return new Date(p.year, p.month, 1).toLocaleDateString(numberLocale(lang), { month: "long", year: "numeric" });
    case "year":
      return String(p.year);
  }
}

export function samePeriod(a: DatePeriod, b: DatePeriod): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "month" && b.kind === "month") return a.year === b.year && a.month === b.month;
  if (a.kind === "year" && b.kind === "year") return a.year === b.year;
  return true;
}

/** Codifica el periodo para la URL (`periodo=2026-10`, `periodo=2027`, `periodo=30d`). */
export function periodToParam(p: DatePeriod): string | null {
  switch (p.kind) {
    case "upcoming":
      return null;
    case "last30":
      return "30d";
    case "month":
      return `${p.year}-${pad(p.month + 1)}`;
    case "year":
      return String(p.year);
  }
}

export function periodFromParam(s: string | null): DatePeriod {
  if (!s) return UPCOMING;
  if (s === "30d") return { kind: "last30" };
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (m) return { kind: "month", year: Number(m[1]), month: Number(m[2]) - 1 };
  if (/^\d{4}$/.test(s)) return { kind: "year", year: Number(s) };
  return UPCOMING;
}

/** ¿La estancia toca el rango? (alguna noche o la salida cae dentro). */
export function stayInRange(checkIn: string, checkOut: string, range: { from: string; to: string | null }): boolean {
  if (checkOut < range.from) return false;
  if (range.to && checkIn > range.to) return false;
  return true;
}
