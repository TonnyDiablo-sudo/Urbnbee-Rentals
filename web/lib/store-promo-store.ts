import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { MEMBERSHIP_PLAN_FAMILY, type MembershipPlanFamily } from "@/lib/membership-plans-types";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

/** Lo que cabe en el listón de una tarjeta de la Tienda. */
export const PROMO_RIBBON_MAX = 18;
export const PROMO_BANNER_MAX = 140;

export const DEFAULT_RIBBON_TEXT = "-50%";
const OLD_RIBBON_TEXTS = new Set(["50% de descuento"]);
export const DEFAULT_BANNER_TEXT =
  "Precios de promoción: todo está al 50% de descuento. Aprovecha antes de que suban los precios.";

/** El precio actual es el precio original con este descuento: original = actual / (1 − %). */
export const DEFAULT_DISCOUNT_PCT = 50;
export const DISCOUNT_PCT_MIN = 5;
export const DISCOUNT_PCT_MAX = 90;

export type PromoRibbon = { on: boolean; text: string };
export type StorePromo = {
  banner: PromoRibbon;
  ribbons: Partial<Record<MembershipPlanFamily, PromoRibbon>>;
  discountPct?: number;
  updatedAt?: string;
};

function pctOf(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(DISCOUNT_PCT_MAX, Math.max(DISCOUNT_PCT_MIN, n)) : DEFAULT_DISCOUNT_PCT;
}

const DATA_FILE = join(getDataDir(), "store-promo.json");
let cache: StorePromo | null = null;
let cachedMtimeMs = 0;

export const PROMO_FAMILIES = [...new Set(Object.values(MEMBERSHIP_PLAN_FAMILY))] as MembershipPlanFamily[];

function defaults(): StorePromo {
  return { banner: { on: true, text: DEFAULT_BANNER_TEXT }, ribbons: {} };
}

function load(): StorePromo {
  try {
    if (!existsSync(DATA_FILE)) return (cache ??= defaults());
    const m = statSync(DATA_FILE).mtimeMs;
    if (cache && m === cachedMtimeMs) return cache;
    const raw = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Partial<StorePromo>;
    cache = { ...defaults(), ...raw, ribbons: raw.ribbons ?? {} };
    cachedMtimeMs = m;
  } catch (e) {
    console.warn("[store-promo] load failed:", e);
    cache ??= defaults();
  }
  return cache;
}

/** Listón de un producto: encendido por defecto con «-50%». */
export function ribbonFor(family: MembershipPlanFamily): PromoRibbon {
  const r = load().ribbons[family];
  if (!r) return { on: true, text: DEFAULT_RIBBON_TEXT };
  return OLD_RIBBON_TEXTS.has(r.text) ? { ...r, text: DEFAULT_RIBBON_TEXT } : r;
}

export function storePromo(): { banner: PromoRibbon; ribbons: Record<string, PromoRibbon>; discountPct: number } {
  const p = load();
  return {
    banner: p.banner,
    ribbons: Object.fromEntries(PROMO_FAMILIES.map((f) => [f, ribbonFor(f)])),
    discountPct: pctOf(p.discountPct ?? DEFAULT_DISCOUNT_PCT),
  };
}

function clean(text: unknown, max: number, fallback: string): string {
  const s = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  return Array.from(s || fallback).slice(0, max).join("");
}

export function saveStorePromo(input: {
  banner?: Partial<PromoRibbon>;
  ribbons?: Record<string, Partial<PromoRibbon>>;
  discountPct?: unknown;
}): StorePromo {
  const prev = load();
  const next: StorePromo = {
    discountPct: input.discountPct !== undefined ? pctOf(input.discountPct) : pctOf(prev.discountPct ?? DEFAULT_DISCOUNT_PCT),
    banner: {
      on: typeof input.banner?.on === "boolean" ? input.banner.on : prev.banner.on,
      text: input.banner?.text !== undefined ? clean(input.banner.text, PROMO_BANNER_MAX, DEFAULT_BANNER_TEXT) : prev.banner.text,
    },
    ribbons: { ...prev.ribbons },
    updatedAt: new Date().toISOString(),
  };
  for (const [family, r] of Object.entries(input.ribbons ?? {})) {
    if (!PROMO_FAMILIES.includes(family as MembershipPlanFamily)) continue;
    const cur = ribbonFor(family as MembershipPlanFamily);
    next.ribbons[family as MembershipPlanFamily] = {
      on: typeof r.on === "boolean" ? r.on : cur.on,
      text: r.text !== undefined ? clean(r.text, PROMO_RIBBON_MAX, DEFAULT_RIBBON_TEXT) : cur.text,
    };
  }
  try {
    ensureDir(getDataDir());
    writeFileSync(DATA_FILE, JSON.stringify(next, null, 2), "utf8");
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    cache = next;
    scheduleMysql(() => upsertJsonBlob("store-promo", next));
  } catch (e) {
    console.warn("[store-promo] persist failed:", e);
  }
  return next;
}
