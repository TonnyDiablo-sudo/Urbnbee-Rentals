import "server-only";
import { listHostEntitlements, upsertHostEntitlement } from "@/lib/host-entitlements-store";
import { primarySkuForPlan } from "@/lib/membership-entitlements";
import { MEMBERSHIP_PLAN_BILLING, type MembershipPlanCode } from "@/lib/membership-plans-types";
import { getVerification, upsertVerification } from "@/lib/verification-store";

/** Guarda qué plazo se compró, para que la Tienda muestre el precio que de verdad se cobra. */
export function rememberPlanCode(userId: string, code: MembershipPlanCode) {
  if (MEMBERSHIP_PLAN_BILLING[code].kind !== "subscription") return;
  const sku = primarySkuForPlan(code);
  if (sku) {
    const row = listHostEntitlements(userId).find((r) => r.sku === sku);
    if (row && row.planCode !== code) upsertHostEntitlement({ ...row, planCode: code });
    return;
  }
  if (getVerification(userId)?.planCode !== code) upsertVerification(userId, { planCode: code });
}
