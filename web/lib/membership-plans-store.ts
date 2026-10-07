import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import {
  MEMBERSHIP_PLAN_AUDIENCE,
  MEMBERSHIP_PLAN_BILLING,
  MEMBERSHIP_PLAN_CODES,
  MEMBERSHIP_PLAN_FAMILY,
  type MembershipPlanFamily,
  type MembershipAudience,
  type MembershipPlanBilling,
  type MembershipPlanCode,
  type MembershipPlanRecord,
  type MembershipPlansSnapshot,
} from "@/lib/membership-plans-types";
import type { VerificationRegion } from "@/lib/verification-types";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "membership-plans.json");
const rows = new Map<MembershipPlanCode, MembershipPlanRecord>();
let cachedMtimeMs = 0;
let catalogSyncedAt: string | undefined;
let catalogPushedAt: string | undefined;
let defaultPricesAppliedAt: string | undefined;
let identityMergedAt: string | undefined;
let addressRelaunchedAt: string | undefined;

const TERM_SUFFIX: Record<number, string> = { 1: "· 1 mes", 6: "· 6 meses", 12: "· 12 meses" };

export const FAMILY_COPY: Record<MembershipPlanFamily, { label: string; description: string }> = {
  guest_pass: {
    label: "Pase Cabibee por reserva",
    description: "Un solo pago que habilita una reserva. Para quien viaja una vez y no quiere membresía.",
  },
  guest_membership: {
    label: "Verificación de identidad",
    description:
      "Una por persona: identificación oficial y selfie, comprobadas contra bases de datos oficiales. Como huésped reservas sin límite; como anfitrión tus anuncios llevan el listón «Miembro verificado». Incluye fotos y notas de voz en el chat y el traductor automático: lo que te escriben lo lees en tu idioma y lo que escribes sale en el de la otra persona.",
  },
  host_verification: {
    label: "Anfitrión verificado",
    description:
      "Listón «Miembro verificado» en todos tus anuncios, respaldado por tu identidad comprobada.",
  },
  booking_engine: {
    label: "Motor de reservas",
    description:
      "Por cada anuncio: el huésped se identifica con identificación oficial y selfie, paga con tarjeta (Stripe), firma contrato en línea con la ley del lugar y las fechas se bloquean solas. Incluye tu verificación de identidad como anfitrión.",
  },
  cleaning_tool: {
    label: "Herramienta de limpieza",
    description:
      "Por cada anuncio: las limpiezas salen solas de tus reservas, se asignan a tu equipo y les llegan los avisos.",
  },
  collaborator_seat: {
    label: "Colaborador",
    description:
      "Otra persona con su propia cuenta de Cabibee acepta reservas, firma contratos en tu nombre o contesta mensajes en los anuncios que elijas.",
  },
  address_proof: {
    label: "Verificación de dirección",
    description:
      "Por cada anuncio: subes un recibo a tu nombre con la dirección del anuncio, lo revisamos y tu anuncio lleva el listón «Ubicación verificada». El motor de reservas ya la incluye.",
  },
  featured_listing: {
    label: "Anuncio destacado",
    description: "Por cada anuncio: aparece primero en las búsquedas y lleva la etiqueta «Destacado».",
  },
};

/**
 * Precios que fijó el dueño, en monto por período (6 meses = 6 × el precio mensual
 * de ese plazo). Se aplican una sola vez y sólo a planes que sigan en 0: lo que
 * alguien ya escribió en /admin/pricing no se pisa.
 */
const OWNER_PRICES: Partial<Record<MembershipPlanCode, { mxn: number; usd: number }>> = {
  meses_1: { mxn: 500, usd: 30 },
  meses_6: { mxn: 350 * 6, usd: 20 * 6 },
  meses_12: { mxn: 150 * 12, usd: 10 * 12 },
  anfitrion_1: { mxn: 500, usd: 30 },
  anfitrion_6: { mxn: 350 * 6, usd: 20 * 6 },
  anfitrion_12: { mxn: 150 * 12, usd: 10 * 12 },
  booking_engine: { mxn: 500, usd: 30 },
  booking_engine_6: { mxn: 350 * 6, usd: 20 * 6 },
  booking_engine_12: { mxn: 150 * 12, usd: 10 * 12 },
  cleaning_tool: { mxn: 150, usd: 10 },
  cleaning_tool_6: { mxn: 100 * 6, usd: 6 * 6 },
  cleaning_tool_12: { mxn: 60 * 12, usd: 3.5 * 12 },
  collaborator_seat: { mxn: 250, usd: 15 },
  collaborator_seat_6: { mxn: 200 * 6, usd: 12 * 6 },
  collaborator_seat_12: { mxn: 150 * 12, usd: 9 * 12 },
  // Mismo precio que la verificación de identidad.
  address_proof: { mxn: 500, usd: 30 },
  address_proof_6: { mxn: 350 * 6, usd: 20 * 6 },
  address_proof_12: { mxn: 150 * 12, usd: 10 * 12 },
  featured_listing: { mxn: 850, usd: 50 },
  featured_listing_6: { mxn: 650 * 6, usd: 40 * 6 },
  featured_listing_12: { mxn: 600 * 12, usd: 35 * 12 },
};

function seedFor(code: MembershipPlanCode): Omit<MembershipPlanRecord, "updatedAt"> {
  const family = MEMBERSHIP_PLAN_FAMILY[code];
  const copy = FAMILY_COPY[family];
  const billing = MEMBERSHIP_PLAN_BILLING[code];
  const label =
    billing.kind === "subscription" ? `${copy.label} ${TERM_SUFFIX[billing.intervalCount] ?? ""}`.trim() : copy.label;
  const price = OWNER_PRICES[code];
  return {
    code,
    label,
    description: copy.description,
    amountMxn: price?.mxn ?? 0,
    amountUsd: price?.usd ?? 0,
    active: Boolean(price),
  };
}

function nowIso() {
  return new Date().toISOString();
}

function seedMissing(): boolean {
  let added = false;
  for (const code of MEMBERSHIP_PLAN_CODES) {
    if (rows.has(code)) continue;
    rows.set(code, { ...seedFor(code), updatedAt: nowIso() });
    added = true;
  }
  return added;
}

/** Una vez: los planes que siguen en 0 toman el precio del dueño y se encienden. */
function applyOwnerPricesOnce(): boolean {
  if (defaultPricesAppliedAt) return false;
  for (const [code, price] of Object.entries(OWNER_PRICES) as [MembershipPlanCode, { mxn: number; usd: number }][]) {
    const prev = rows.get(code);
    if (!prev || prev.amountMxn > 0 || prev.amountUsd > 0) continue;
    const seed = seedFor(code);
    rows.set(code, {
      ...prev,
      label: seed.label,
      description: seed.description,
      amountMxn: price.mxn,
      amountUsd: price.usd,
      active: true,
      updatedAt: nowIso(),
    });
  }
  defaultPricesAppliedAt = nowIso();
  return true;
}

/**
 * Una vez: la verificación de identidad queda como un solo producto por persona.
 * Los planes de «Anfitrión verificado» se apagan y la membresía de huésped toma el nombre nuevo.
 */
function mergeIdentityPlansOnce(): boolean {
  if (identityMergedAt) return false;
  for (const code of MEMBERSHIP_PLAN_CODES) {
    const prev = rows.get(code);
    if (!prev) continue;
    const family = MEMBERSHIP_PLAN_FAMILY[code];
    if (family === "host_verification" && prev.active) {
      rows.set(code, { ...prev, active: false, updatedAt: nowIso() });
    } else if (family === "guest_membership") {
      const seed = seedFor(code);
      rows.set(code, { ...prev, label: seed.label, description: seed.description, updatedAt: nowIso() });
    }
  }
  identityMergedAt = nowIso();
  return true;
}

/**
 * Descripciones que ya no son ciertas o quedaron cortas: el motor no acepta pagos manuales, no trae el
 * asistente de urbnbeeai ni la verificación de domicilio; la verificación de identidad ya incluye fotos,
 * audios y traductor del chat. Se cambian si nadie las editó.
 */
const OUTDATED_COPY = new Set([
  "Una por persona. Como huésped reservas sin límite; como anfitrión tus anuncios llevan el listón «Miembro verificado».",
  "Por cada anuncio: reservas en línea con cobro por Stripe o pago manual (transferencia, CLABE, Zelle), contrato firmado en línea con la ley del lugar, verificación de domicilio, bloqueo de fechas y el asistente con IA de urbnbeeai.",
  "Por cada anuncio: reservas en línea con pago automático con tarjeta (Stripe), contrato firmado en línea con la ley del lugar, verificación de domicilio, bloqueo de fechas y el asistente con IA de urbnbeeai.",
  "Insignia «Ubicación verificada» en un anuncio con comprobante de domicilio. Ya viene incluida en el motor de reservas.",
  "Insignia «Ubicación verificada» en un anuncio con comprobante de domicilio.",
]);

/**
 * Una vez: la verificación de dirección vuelve a venderse aparte, por anuncio y al precio de la
 * verificación de identidad. Toma el nombre, la descripción y el precio del dueño y se enciende.
 */
function relaunchAddressPlansOnce(): boolean {
  if (addressRelaunchedAt) return false;
  for (const code of MEMBERSHIP_PLAN_CODES) {
    const prev = rows.get(code);
    if (!prev || MEMBERSHIP_PLAN_FAMILY[code] !== "address_proof") continue;
    const seed = seedFor(code);
    rows.set(code, { ...prev, ...seed, stripeProductId: prev.stripeProductId, updatedAt: nowIso() });
  }
  addressRelaunchedAt = nowIso();
  return true;
}

function dropOutdatedCopy(): boolean {
  let changed = false;
  for (const code of MEMBERSHIP_PLAN_CODES) {
    const prev = rows.get(code);
    if (!prev || !OUTDATED_COPY.has(prev.description)) continue;
    rows.set(code, { ...prev, description: seedFor(code).description, updatedAt: nowIso() });
    changed = true;
  }
  return changed;
}

function persist() {
  try {
    ensureDir(getDataDir());
    const snapshot: MembershipPlansSnapshot = {
      version: 1,
      plans: MEMBERSHIP_PLAN_CODES.map((c) => rows.get(c)!).filter(Boolean),
      catalogSyncedAt,
      catalogPushedAt,
      defaultPricesAppliedAt,
      identityMergedAt,
      addressRelaunchedAt,
    };
    writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    if (existsSync(DATA_FILE)) cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("membership-plans", snapshot));
  } catch (e) {
    console.warn("[membership-plans] persist failed:", e);
  }
}

function reloadFromDisk() {
  try {
    if (existsSync(DATA_FILE)) {
      const raw = readFileSync(DATA_FILE, "utf8");
      const data = JSON.parse(raw) as Partial<MembershipPlansSnapshot>;
      rows.clear();
      for (const p of data.plans ?? []) {
        // Un código desconocido en el archivo se ignora: sería un plan que el código
        // no sabe cobrar, y ofrecerlo dejaría al huésped en un checkout imposible.
        if (p?.code && MEMBERSHIP_PLAN_CODES.includes(p.code)) rows.set(p.code, p);
      }
      catalogSyncedAt = data.catalogSyncedAt;
      catalogPushedAt = data.catalogPushedAt;
      defaultPricesAppliedAt = data.defaultPricesAppliedAt;
      identityMergedAt = data.identityMergedAt;
      addressRelaunchedAt = data.addressRelaunchedAt;
      cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    }
  } catch (e) {
    console.warn("[membership-plans] load failed:", e);
  }
  const seeded = seedMissing();
  const priced = applyOwnerPricesOnce();
  const merged = mergeIdentityPlansOnce();
  const address = relaunchAddressPlansOnce();
  const copy = dropOutdatedCopy();
  if (seeded || priced || merged || address || copy) persist();
}

function syncIfStale() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    reloadFromDisk();
  } catch {
    /* ignore */
  }
}

reloadFromDisk();

export function listMembershipPlans(): MembershipPlanRecord[] {
  syncIfStale();
  return MEMBERSHIP_PLAN_CODES.map((c) => rows.get(c)!).filter(Boolean);
}

export function getMembershipPlan(code: string): MembershipPlanRecord | undefined {
  syncIfStale();
  return rows.get(code as MembershipPlanCode);
}

export function isMembershipPlanCode(code: string): code is MembershipPlanCode {
  return MEMBERSHIP_PLAN_CODES.includes(code as MembershipPlanCode);
}

/** Monto vigente en la moneda de la región, o 0 si ahí no se ofrece. */
export function membershipPlanAmount(
  plan: MembershipPlanRecord,
  region: VerificationRegion
): number {
  return region === "us" ? plan.amountUsd : plan.amountMxn;
}

export function membershipPlanCurrency(region: VerificationRegion): "mxn" | "usd" {
  return region === "us" ? "usd" : "mxn";
}

/** Encendido y con precio: se puede mostrar. El cobro real pide además el Producto. */
export function membershipPlanPricedIn(
  plan: MembershipPlanRecord,
  region: VerificationRegion
): boolean {
  return plan.active && membershipPlanAmount(plan, region) > 0;
}

/** Se cobra en Stripe si está encendido, tiene precio y tiene Producto. */
export function membershipPlanOfferedIn(
  plan: MembershipPlanRecord,
  region: VerificationRegion
): boolean {
  return membershipPlanPricedIn(plan, region) && Boolean(plan.stripeProductId);
}

export function membershipPlanAudience(code: MembershipPlanCode): MembershipAudience {
  return MEMBERSHIP_PLAN_AUDIENCE[code];
}

export function membershipPlansOfferedIn(
  region: VerificationRegion,
  audience?: MembershipAudience
): MembershipPlanRecord[] {
  return listMembershipPlans().filter(
    (p) =>
      membershipPlanOfferedIn(p, region) &&
      (audience === undefined || MEMBERSHIP_PLAN_AUDIENCE[p.code] === audience)
  );
}

/** Planes visibles (con precio), aunque aún falte el Producto de Stripe. */
export function membershipPlansPricedIn(
  region: VerificationRegion,
  audience?: MembershipAudience
): MembershipPlanRecord[] {
  return listMembershipPlans().filter(
    (p) =>
      membershipPlanPricedIn(p, region) &&
      (audience === undefined || MEMBERSHIP_PLAN_AUDIENCE[p.code] === audience)
  );
}

/**
 * ¿Hay algún plan encendido con precio para esta audiencia, aunque le falte el producto?
 *
 * Es lo que decide si la puerta se cierra: se mira el precio y no el producto de Stripe
 * porque una sincronización fallida debe bloquear, no abrir.
 */
export function membershipCatalogHasPricedPlan(audience?: MembershipAudience): boolean {
  return listMembershipPlans().some(
    (p) =>
      p.active &&
      (p.amountMxn > 0 || p.amountUsd > 0) &&
      (audience === undefined || MEMBERSHIP_PLAN_AUDIENCE[p.code] === audience)
  );
}

/** ¿Hay algo comprable ahora mismo, producto de Stripe incluido? */
export function membershipCatalogSellsSomething(audience?: MembershipAudience): boolean {
  return (
    membershipPlansOfferedIn("mx", audience).length > 0 ||
    membershipPlansOfferedIn("us", audience).length > 0
  );
}

/** Lo que se le puede contar al huésped de un plan: nombre, precio y cada cuánto. */
export type MembershipPublicPlan = {
  code: MembershipPlanCode;
  label: string;
  description: string;
  amount: number;
  currency: "mxn" | "usd";
  billing: MembershipPlanBilling;
  audience: MembershipAudience;
};

export function membershipPublicPlans(
  region: VerificationRegion,
  audience?: MembershipAudience
): MembershipPublicPlan[] {
  return membershipPlansPricedIn(region, audience).map((p) => ({
    code: p.code,
    label: p.label,
    description: p.description,
    amount: membershipPlanAmount(p, region),
    currency: membershipPlanCurrency(region),
    billing: MEMBERSHIP_PLAN_BILLING[p.code],
    audience: MEMBERSHIP_PLAN_AUDIENCE[p.code],
  }));
}

export function updateMembershipPlan(
  code: MembershipPlanCode,
  patch: Partial<Omit<MembershipPlanRecord, "code" | "updatedAt">>
): MembershipPlanRecord | undefined {
  syncIfStale();
  const prev = rows.get(code);
  if (!prev) return undefined;
  const next: MembershipPlanRecord = {
    ...prev,
    ...patch,
    code: prev.code,
    updatedAt: nowIso(),
  };
  rows.set(code, next);
  persist();
  return next;
}

export function applyCatalogPublicFields(
  code: MembershipPlanCode,
  fields: Pick<MembershipPlanRecord, "label" | "description" | "amountMxn" | "amountUsd" | "active">
): MembershipPlanRecord | undefined {
  syncIfStale();
  const prev = rows.get(code);
  if (!prev) return undefined;
  const same =
    prev.label === fields.label &&
    prev.description === fields.description &&
    prev.amountMxn === fields.amountMxn &&
    prev.amountUsd === fields.amountUsd &&
    prev.active === fields.active;
  if (same) return prev;
  const next: MembershipPlanRecord = {
    ...prev,
    ...fields,
    code: prev.code,
    stripeProductId: prev.stripeProductId,
    updatedAt: nowIso(),
  };
  rows.set(code, next);
  persist();
  return next;
}

export function getCatalogSyncMeta() {
  syncIfStale();
  return { catalogSyncedAt, catalogPushedAt };
}

export function markCatalogSynced() {
  catalogSyncedAt = nowIso();
  persist();
}

export function markCatalogPushed() {
  catalogPushedAt = nowIso();
  persist();
}
