import type { NextRequest } from "next/server";
import { setBeeagentAgentStatus } from "@/lib/beeagent-agent-status";
import {
  getPartnerWebhookSecret,
  partnerJson,
  verifyPartnerWebhookSignature,
} from "@/lib/beeagent-partner";
import {
  getBeeagentLinkForCustomer,
  getBeeagentLinkForHost,
} from "@/lib/beeagent-host-link-store";
import { applyHostEntitlement } from "@/lib/host-entitlements";
import { isHostSku, type HostEntitlementStatus } from "@/lib/host-entitlement-types";

export const runtime = "nodejs";

const STATUSES = new Set<HostEntitlementStatus>(["active", "past_due", "cancelled"]);

function parseCustomerId(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

export async function POST(req: NextRequest) {
  if (!getPartnerWebhookSecret()) {
    return partnerJson(
      { error: "URBNBEE_PARTNER_WEBHOOK_SECRET o URBNBEE_PARTNER_API_SECRET no configurada." },
      req,
      { status: 503 }
    );
  }

  const raw = await req.text();
  const sig = req.headers.get("x-urbnbee-signature");
  if (!verifyPartnerWebhookSignature(raw, sig)) {
    return partnerJson({ error: "Firma inválida." }, req, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = raw.length ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return partnerJson({ error: "JSON inválido." }, req, { status: 400 });
  }

  const event = typeof payload.event === "string" ? payload.event : "";
  const hostId = typeof payload.host_id === "string" ? payload.host_id.trim() : "";
  const customerId = parseCustomerId(payload.beeagent_customer_id);
  const byHost = hostId ? getBeeagentLinkForHost(hostId) : undefined;
  const byCustomer = customerId ? getBeeagentLinkForCustomer(customerId) : undefined;
  const link = byHost ?? byCustomer;
  if (event === "agent.status_changed" || event === "entitlements.changed") {
    if (!link || (hostId && link.hostId !== hostId) || (customerId && link.beeagentCustomerId !== customerId)) {
      return partnerJson({ error: "Workspace no vinculado.", code: "not_linked" }, req, { status: 403 });
    }
  } else {
    console.info("[beeagent-webhook]", JSON.stringify({ receivedAt: new Date().toISOString(), event: event || "unknown" }));
    return partnerJson({ ok: true, accepted: true, ignored: event || "unknown" }, req);
  }
  if (!link) {
    return partnerJson({ error: "Workspace no vinculado.", code: "not_linked" }, req, { status: 403 });
  }

  if (event === "agent.status_changed") {
    const data = (payload.data ?? payload) as Record<string, unknown>;
    const status = setBeeagentAgentStatus({
      hostId: link.hostId,
      active: data.active === true,
      customerAgentId: typeof data.customer_agent_id === "string" ? data.customer_agent_id : undefined,
    });
    return partnerJson({ ok: true, applied: event, agent_status: status }, req);
  }

  if (event === "entitlements.changed") {
    const data = (payload.data ?? payload) as Record<string, unknown>;
    const sku = typeof data.sku === "string" ? data.sku.trim() : "";
    const status = typeof data.status === "string" ? data.status.trim() : "";
    if (!isHostSku(sku) || !STATUSES.has(status as HostEntitlementStatus)) {
      return partnerJson({ error: "sku o status inválidos." }, req, { status: 400 });
    }
    const row = applyHostEntitlement({
      hostId: link.hostId,
      sku,
      status: status as HostEntitlementStatus,
      source: "urbnbeeai_seller",
      stripeSubscriptionId:
        typeof data.stripe_subscription_id === "string" ? data.stripe_subscription_id : undefined,
      currentPeriodEnd:
        typeof data.current_period_end === "string" ? data.current_period_end : undefined,
    });
    return partnerJson({ ok: true, applied: event, entitlement: row }, req);
  }

  console.info("[beeagent-webhook]", JSON.stringify({ receivedAt: new Date().toISOString(), event, hostId: link.hostId }));
  return partnerJson({ ok: true, accepted: true, ignored: event || "unknown" }, req);
}
