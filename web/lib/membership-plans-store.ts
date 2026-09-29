import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import {
  MEMBERSHIP_PLAN_AUDIENCE,
  MEMBERSHIP_PLAN_BILLING,
  MEMBERSHIP_PLAN_CODES,
  type MembershipAudience,
  type MembershipPlanBilling,
  type MembershipPlanCode,
  type MembershipPlanRecord,
  type MembershipPlansSnapshot,
} from "@/lib/membership-plans-types";
import type { VerificationRegion } from "@/lib/verification-types";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "membership-plans.json");
const rows = new Map<MembershipPlanCode, MembershipPlanRecord>();
let cachedMtimeMs = 0;

/**
 * Los planes nacen en cero y apagados: mientras nadie escriba un precio, el sitio
 * no ofrece membresía. Un plan sembrado con precio inventado se cobraría de verdad.
 */
const SEEDS: Record<MembershipPlanCode, Omit<MembershipPlanRecord, "updatedAt">> = {
  pase_reserva: {
    code: "pase_reserva",
    label: "Pase Cabibee por reserva",
    description:
      "Un solo pago que habilita una reserva. Para quien viaja una vez y no quiere membresía.",
    amountMxn: 0,
    amountUsd: 0,
    active: false,
  },
  meses_6: {
    code: "meses_6",
    label: "Membresía Cabibee 6 meses",
    description: "Reservas ilimitadas durante seis meses. Se renueva al vencer.",
    amountMxn: 0,
    amountUsd: 0,
    active: false,
  },
  meses_12: {
    code: "meses_12",
    label: "Membresía Cabibee 12 meses",
    description: "Reservas ilimitadas durante un año, al mejor precio por mes.",
    amountMxn: 0,
    amountUsd: 0,
    active: false,
  },
  anfitrion_6: {
    code: "anfitrion_6",
    label: "Anfitrión Verificado Cabibee 6 meses",
    description:
      "Listón «Miembro verificado» en todos tus anuncios durante seis meses, respaldado por tu identidad comprobada.",
    amountMxn: 0,
    amountUsd: 0,
    active: false,
  },
  anfitrion_12: {
    code: "anfitrion_12",
    label: "Anfitrión Verificado Cabibee 12 meses",
    description:
      "Listón «Miembro verificado» todo el año, al mejor precio por mes.",
    amountMxn: 0,
    amountUsd: 0,
    active: false,
  },
};

function nowIso() {
  return new Date().toISOString();
}

function seedMissing() {
  for (const code of MEMBERSHIP_PLAN_CODES) {
    if (!rows.has(code)) rows.set(code, { ...SEEDS[code], updatedAt: nowIso() });
  }
}

function persist() {
  try {
    ensureDir(getDataDir());
    const snapshot: MembershipPlansSnapshot = {
      version: 1,
      plans: MEMBERSHIP_PLAN_CODES.map((c) => rows.get(c)!).filter(Boolean),
    };
    writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    if (existsSync(DATA_FILE)) cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
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
      cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    }
  } catch (e) {
    console.warn("[membership-plans] load failed:", e);
  }
  seedMissing();
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
