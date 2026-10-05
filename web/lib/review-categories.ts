import type { StayReviewKind } from "@/lib/stay-review-types";

export type ReviewCategory = { id: string; label: string; hint: string };

/** Lo que califica el huésped del alojamiento, de 1 a 5. */
export const LISTING_REVIEW_CATEGORIES: ReviewCategory[] = [
  { id: "cleanliness", label: "Limpieza", hint: "¿Estaba limpio al llegar?" },
  { id: "accuracy", label: "Veracidad del anuncio", hint: "¿Era como en las fotos y la descripción?" },
  { id: "checkin", label: "Llegada", hint: "¿Fue fácil entrar?" },
  { id: "communication", label: "Comunicación", hint: "¿El anfitrión te respondió a tiempo?" },
  { id: "location", label: "Ubicación", hint: "¿La zona era como esperabas?" },
  { id: "safety", label: "Seguridad", hint: "¿Te sentiste seguro en el lugar y en la zona?" },
  { id: "value", label: "Calidad-precio", hint: "¿Valió lo que pagaste?" },
];

/** Lo que califica el anfitrión del huésped, de 1 a 5. */
export const GUEST_REVIEW_CATEGORIES: ReviewCategory[] = [
  { id: "cleanliness", label: "Cómo dejó el lugar", hint: "¿Lo entregó limpio y sin daños?" },
  { id: "communication", label: "Comunicación", hint: "¿Respondió y avisó a tiempo?" },
  { id: "rules", label: "Respeto de las reglas", hint: "¿Siguió las reglas de la casa?" },
];

export function reviewCategoriesFor(kind: StayReviewKind): ReviewCategory[] {
  return kind === "guest_to_listing" ? LISTING_REVIEW_CATEGORIES : GUEST_REVIEW_CATEGORIES;
}

/** Calificación global de una estancia: el promedio de sus categorías, con 2 decimales. */
export function stayScore(categories: Record<string, number>): number {
  const v = Object.values(categories);
  return v.length ? Math.round((v.reduce((s, n) => s + n, 0) / v.length) * 100) / 100 : 0;
}

/** Cada bloque de 6 meses hacia atrás pesa menos: 1, 1/2, 1/3, 1/4… */
export const RATING_BLOCK_MONTHS = 6;
const BLOCK_MS = (RATING_BLOCK_MONTHS * 365.25 * 86_400_000) / 12;

export function ratingWeight(createdAt: string, now = Date.now()): number {
  const age = Math.max(0, now - Date.parse(createdAt));
  if (!Number.isFinite(age)) return 1;
  return 1 / (1 + Math.floor(age / BLOCK_MS));
}

export type RatedRow = { rating: number; score?: number; categories?: Record<string, number>; createdAt: string };

export type RatingSummary = {
  /** Promedio ponderado por antigüedad; 0 si no hay reseñas. */
  avg: number;
  count: number;
  /** Mismo promedio ponderado, por categoría (sólo las que alguien calificó). */
  categories: Record<string, number>;
};

export function weightedRating(rows: RatedRow[], now = Date.now()): RatingSummary {
  let w = 0;
  let sum = 0;
  const cat: Record<string, { w: number; sum: number }> = {};
  for (const r of rows) {
    const weight = ratingWeight(r.createdAt, now);
    const score = r.score ?? r.rating;
    if (!Number.isFinite(score) || score <= 0) continue;
    w += weight;
    sum += weight * score;
    for (const [id, n] of Object.entries(r.categories ?? {})) {
      if (!Number.isFinite(n) || n <= 0) continue;
      cat[id] ??= { w: 0, sum: 0 };
      cat[id].w += weight;
      cat[id].sum += weight * n;
    }
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    avg: w ? round(sum / w) : 0,
    count: rows.length,
    categories: Object.fromEntries(Object.entries(cat).map(([id, c]) => [id, round(c.sum / c.w)])),
  };
}
