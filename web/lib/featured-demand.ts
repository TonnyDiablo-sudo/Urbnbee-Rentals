import "server-only";
import { listAllHostEntitlements } from "@/lib/host-entitlements-store";
import { HOST_SKU_FEATURED } from "@/lib/host-entitlement-types";
import { listAllListings } from "@/lib/marketplace-store";
import { getMembershipPlan, membershipPlanAmount } from "@/lib/membership-plans-store";
import { MEMBERSHIP_PLAN_FAMILY, type MembershipPlanCode, type MembershipPlanRecord } from "@/lib/membership-plans-types";
import { paidUp } from "@/lib/team-access";
import type { VerificationRegion } from "@/lib/verification-types";

/**
 * Precio por demanda de «Anuncio destacado»: si todos lo compran, nadie destaca.
 * Hay un tope de lugares y el precio sube conforme se llenan, como las subastas de anuncios.
 */
export const FEATURED_MIN_SLOTS = 5;
/** Fracción de los anuncios publicados que puede ir destacada al mismo tiempo. */
export const FEATURED_SLOT_SHARE = 0.15;
/** Lleno = 1 + 2 = 3× el precio base. */
export const FEATURED_DEMAND_FACTOR = 2;

export const FEATURED_SOLD_OUT_ERROR = "«Anuncio destacado» está agotado por ahora. Vuelve a intentarlo en unos días.";

export type FeaturedDemand = {
  /** Lugares pagados ÷ lugares totales, de 0 a 1. */
  occupancy: number;
  multiplier: number;
  soldOut: boolean;
  slotsLeft: number;
  /** Lugares totales: max(5, 15 % de los anuncios publicados). */
  maxSlots: number;
  usedSlots: number;
};

export function isFeaturedPlan(code: MembershipPlanCode): boolean {
  return MEMBERSHIP_PLAN_FAMILY[code] === "featured_listing";
}

export function featuredMaxSlots(): number {
  const published = listAllListings().filter((l) => l.published).length;
  return Math.max(FEATURED_MIN_SLOTS, Math.ceil(published * FEATURED_SLOT_SHARE));
}

/** Lugares de destacado pagados y al corriente, sumando la cantidad de cada anfitrión. */
export function featuredUsedSlots(): number {
  return listAllHostEntitlements()
    .filter((r) => r.sku === HOST_SKU_FEATURED && paidUp(r))
    .reduce((n, r) => n + Math.max(0, r.quantity ?? 1), 0);
}

export function featuredDemand(): FeaturedDemand {
  const maxSlots = featuredMaxSlots();
  const usedSlots = featuredUsedSlots();
  const occupancy = Math.min(1, usedSlots / maxSlots);
  const multiplier = Math.round((1 + FEATURED_DEMAND_FACTOR * occupancy ** 2) * 100) / 100;
  return {
    occupancy: Math.round(occupancy * 1000) / 1000,
    multiplier,
    soldOut: usedSlots >= maxSlots,
    slotsLeft: Math.max(0, maxSlots - usedSlots),
    maxSlots,
    usedSlots,
  };
}

function roundForRegion(amount: number, region: VerificationRegion): number {
  return region === "us" ? Math.round(amount) : Math.round(amount / 10) * 10;
}

/**
 * Precio de un plan para mostrar o para un cobro nuevo: los de destacado llevan el multiplicador
 * de la demanda; el resto queda igual. Las suscripciones ya creadas conservan su precio en Stripe.
 */
export function featuredPlanAmount(plan: MembershipPlanRecord, region: VerificationRegion, demand?: FeaturedDemand): number {
  const base = membershipPlanAmount(plan, region);
  if (base <= 0 || !isFeaturedPlan(plan.code)) return base;
  return roundForRegion(base * (demand ?? featuredDemand()).multiplier, region);
}

/** Por qué no se pueden sumar `quantity` lugares de destacado ahora, o null si sí. */
export function featuredPurchaseProblem(quantity: number): { error: string; status: number } | null {
  const d = featuredDemand();
  if (d.soldOut) return { error: FEATURED_SOLD_OUT_ERROR, status: 409 };
  if (quantity > d.slotsLeft) {
    return { error: "Ya no quedan tantos lugares de anuncio destacado. Elige una cantidad menor.", status: 409 };
  }
  return null;
}

/** Ajusta los precios de destacado del catálogo de la Tienda y le pega la demanda. */
export function withFeaturedDemand<T extends { family: string; terms: { code: MembershipPlanCode; months: number; amount: number; perMonth: number }[] }>(
  items: T[],
  region: VerificationRegion
): (T & { demand?: Pick<FeaturedDemand, "occupancy" | "multiplier" | "soldOut" | "slotsLeft"> })[] {
  return items.map((item) => {
    if (item.family !== "featured_listing") return item;
    const d = featuredDemand();
    const terms = item.terms.map((term) => {
      const plan = getMembershipPlan(term.code);
      const amount = plan ? featuredPlanAmount(plan, region, d) : term.amount;
      return { ...term, amount, perMonth: term.months ? Math.round((amount / term.months) * 100) / 100 : amount };
    });
    return { ...item, terms, demand: { occupancy: d.occupancy, multiplier: d.multiplier, soldOut: d.soldOut, slotsLeft: d.slotsLeft } };
  });
}
