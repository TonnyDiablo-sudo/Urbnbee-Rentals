import "server-only";
import { syncHostBadgeToListings } from "@/lib/host-verification";
import { listAllHostEntitlements, upsertHostEntitlement } from "@/lib/host-entitlements-store";
import { listAllVerifications, setVerificationSubscriptionFields } from "@/lib/verification-store";

/**
 * Cierra los planes que pidieron cancelar y ya llegaron al fin de su período.
 * Con Stripe esto lo hace el webhook `customer.subscription.deleted`; esta pasada cubre
 * los planes simulados y el caso de un webhook que nunca llegó.
 */
export function expireCancelledPlans(now = Date.now()): number {
  let closed = 0;
  const hosts = new Set<string>();
  for (const row of listAllHostEntitlements()) {
    if (!row.cancelAtPeriodEnd || row.status === "cancelled" || !row.currentPeriodEnd) continue;
    const end = Date.parse(row.currentPeriodEnd);
    if (!Number.isFinite(end) || end > now) continue;
    upsertHostEntitlement({ ...row, status: "cancelled", updatedAt: new Date(now).toISOString() });
    hosts.add(row.hostId);
    closed++;
  }
  for (const h of hosts) syncHostBadgeToListings(h);
  for (const v of listAllVerifications()) {
    if (!v.cancelAtPeriodEnd || v.subscriptionStatus === "canceled" || !v.currentPeriodEnd) continue;
    const end = Date.parse(v.currentPeriodEnd);
    if (!Number.isFinite(end) || end > now) continue;
    setVerificationSubscriptionFields(v.userId, { subscriptionStatus: "canceled" });
    closed++;
  }
  return closed;
}

let started = false;
export function startPlanExpiryWorker() {
  if (started) return;
  started = true;
  const tick = () => {
    try {
      expireCancelledPlans();
    } catch (e) {
      console.warn("[plan expiry]", e);
    }
  };
  setTimeout(tick, 30_000);
  setInterval(tick, 60 * 60 * 1000);
}
