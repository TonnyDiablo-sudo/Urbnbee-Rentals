import type { NextRequest } from "next/server";
import { setBeeagentAgentStatus } from "@/lib/beeagent-agent-status";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { partnerIdempotentJson } from "@/lib/beeagent-route-helpers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { hostId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId);
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  return partnerIdempotentJson(req, () => {
    if (typeof body.active !== "boolean") {
      return { status: 400, body: { error: "Requiere active (boolean)." } };
    }
    const status = setBeeagentAgentStatus({
      hostId,
      active: body.active,
      customerAgentId:
        typeof body.customer_agent_id === "string" ? body.customer_agent_id : undefined,
    });
    return { status: 200, body: { ok: true, agent_status: status } };
  });
}
