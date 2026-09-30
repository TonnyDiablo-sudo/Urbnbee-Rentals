import type { NextRequest } from "next/server";
import { applyHostEntitlement, getHostEntitlement } from "@/lib/host-entitlements";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { partnerIdempotentJson } from "@/lib/beeagent-route-helpers";
import { isHostSku, type HostEntitlementStatus } from "@/lib/host-entitlement-types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string }> };

const STATUSES = new Set<HostEntitlementStatus>(["active", "past_due", "cancelled"]);

export async function POST(req: NextRequest, ctx: Ctx) {
  const { hostId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId);
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  return partnerIdempotentJson(req, () => {
    const sku = typeof body.sku === "string" ? body.sku.trim() : "";
    const status = typeof body.status === "string" ? body.status.trim() : "";
    const subId =
      typeof body.stripe_subscription_id === "string" ? body.stripe_subscription_id.trim() : "";
    if (!isHostSku(sku) || !STATUSES.has(status as HostEntitlementStatus)) {
      return { status: 400, body: { error: "sku y status inválidos." } };
    }
    const existing = getHostEntitlement(hostId, sku);
    if (existing && subId && existing.stripeSubscriptionId === subId) {
      const row = applyHostEntitlement({
        hostId,
        sku,
        status: status as HostEntitlementStatus,
        source: "urbnbeeai_seller",
        stripeSubscriptionId: subId,
        currentPeriodEnd:
          typeof body.current_period_end === "string" ? body.current_period_end : existing.currentPeriodEnd,
      });
      return { status: 200, body: { ok: true, entitlement: row } };
    }
    const row = applyHostEntitlement({
      hostId,
      sku,
      status: status as HostEntitlementStatus,
      source: "urbnbeeai_seller",
      stripeSubscriptionId: subId || undefined,
      currentPeriodEnd: typeof body.current_period_end === "string" ? body.current_period_end : undefined,
    });
    return { status: 200, body: { ok: true, entitlement: row } };
  });
}
