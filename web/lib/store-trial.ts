import "server-only";
import { applyHostEntitlement } from "@/lib/host-entitlements";
import { getHostEntitlement } from "@/lib/host-entitlements-store";
import { hostEntitlementInTrial } from "@/lib/host-entitlement-types";
import { primarySkuForPlan } from "@/lib/membership-entitlements";
import { MEMBERSHIP_PLAN_BILLING, MEMBERSHIP_PLAN_FAMILY, type MembershipPlanCode } from "@/lib/membership-plans-types";
import { catalogPurchaseProblem } from "@/lib/store-cart";
import { isTrialFamily, TRIAL_MAX_COLLABORATORS, type TrialFamily } from "@/lib/tool-trial";
import { trialDays, trialEnabled } from "@/lib/trial-settings-store";
import type { VerificationRegion } from "@/lib/verification-types";

export const TRIAL_USED_ERROR =
  "Ya usaste tu prueba gratis de esta herramienta. Actívala en la Tienda y empieza a usarla hoy mismo.";
export const TRIAL_OFF_ERROR = "Por ahora no hay prueba gratis de esta herramienta. Actívala en la Tienda.";

/** Hasta cuántas unidades se prueban gratis (colaboradores: 5; anuncios: sin tope especial). */
export function trialMaxQuantity(code: MembershipPlanCode): number | undefined {
  return MEMBERSHIP_PLAN_FAMILY[code] === "collaborator_seat" ? TRIAL_MAX_COLLABORATORS : undefined;
}

/** Código de referencia de cada familia con prueba (el plan mensual). */
const FAMILY_CODE: Record<TrialFamily, MembershipPlanCode> = {
  cleaning_tool: "cleaning_tool",
  collaborator_seat: "collaborator_seat",
  address_proof: "address_proof",
};

/**
 * ¿Puede empezar la prueba gratis de esta herramienta? Sólo si el admin la tiene encendida,
 * una vez por herramienta y sin tenerla activa.
 */
export function trialEligible(user: { id: string; role: string }, code: MembershipPlanCode): boolean {
  if (!isTrialFamily(MEMBERSHIP_PLAN_FAMILY[code])) return false;
  if (!trialEnabled()) return false;
  if (user.role !== "host" && user.role !== "admin") return false;
  const sku = primarySkuForPlan(code);
  const row = sku ? getHostEntitlement(user.id, sku) : undefined;
  if (row?.trialUsedAt) return false;
  return !row || row.status === "cancelled";
}

/** Días de prueba que se le ofrecen a este anfitrión para una herramienta, o undefined si no aplica. */
export function hostTrialDays(hostId: string, family: TrialFamily): number | undefined {
  return trialEligible({ id: hostId, role: "host" }, FAMILY_CODE[family]) ? trialDays() : undefined;
}

/** Lo que impide empezar la prueba, o null si se puede. */
export function trialProblem(
  user: { id: string; role: string },
  code: MembershipPlanCode,
  region: VerificationRegion,
  quantity: number
): { error: string; status: number } | null {
  if (!isTrialFamily(MEMBERSHIP_PLAN_FAMILY[code])) {
    return { error: "Esta herramienta no tiene prueba gratis.", status: 400 };
  }
  if (!trialEnabled()) return { error: TRIAL_OFF_ERROR, status: 409 };
  const sku = primarySkuForPlan(code);
  const row = sku ? getHostEntitlement(user.id, sku) : undefined;
  if (row?.trialUsedAt) return { error: TRIAL_USED_ERROR, status: 409 };
  const purchase = catalogPurchaseProblem(user, code, region, quantity);
  if (purchase) return purchase;
  return null;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** Prueba gratis sin Stripe (sólo desarrollo): activa hoy y «se cobra» al terminar la prueba. */
export function simulateTrial(userId: string, code: MembershipPlanCode, quantity: number) {
  const sku = primarySkuForPlan(code);
  if (!sku) return;
  const trialEnd = addDays(new Date(), trialDays()).toISOString();
  applyHostEntitlement({
    hostId: userId,
    sku,
    status: "active",
    source: "cabibee_direct",
    stripeSubscriptionId: "simulated",
    currentPeriodEnd: trialEnd,
    trialEndsAt: trialEnd,
    planCode: code,
    cancelAtPeriodEnd: false,
    quantity,
  });
}

/** Al terminar la prueba simulada empieza el primer periodo pagado del plan elegido. */
export function rollSimulatedTrial(row: {
  hostId: string;
  sku: string;
  stripeSubscriptionId?: string;
  trialEndsAt?: string;
  planCode?: string;
  status: string;
  cancelAtPeriodEnd?: boolean;
}, now = Date.now()): boolean {
  if (row.stripeSubscriptionId !== "simulated" || !row.trialEndsAt || row.status === "cancelled") return false;
  if (hostEntitlementInTrial({ status: "active", trialEndsAt: row.trialEndsAt }, now) || row.cancelAtPeriodEnd) return false;
  const code = row.planCode as MembershipPlanCode | undefined;
  const billing = code ? MEMBERSHIP_PLAN_BILLING[code] : undefined;
  const months = billing?.kind === "subscription" ? billing.intervalCount : 1;
  const start = new Date(row.trialEndsAt);
  start.setMonth(start.getMonth() + months);
  const sku = primarySkuForPlan(code ?? ("" as MembershipPlanCode));
  if (!sku) return false;
  applyHostEntitlement({
    hostId: row.hostId,
    sku,
    status: "active",
    source: "cabibee_direct",
    stripeSubscriptionId: "simulated",
    currentPeriodEnd: start.toISOString(),
    trialEndsAt: null,
  });
  return true;
}
