import type { NextRequest } from "next/server";
import { deleteBeeagentHostLink } from "@/lib/beeagent-host-link-store";
import { enqueueHostUnlinked } from "@/lib/beeagent-outbound";
import { partnerJson } from "@/lib/beeagent-partner";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string }> };

/** urbnbeeai desconecta: Bearer + X-Beeagent-Customer-Id + vínculo. Manda host.unlinked. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { hostId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId);
  if (!gate.ok) return gate.response;
  enqueueHostUnlinked(hostId, gate.customerId);
  deleteBeeagentHostLink(hostId);
  return partnerJson({ ok: true, unlinked: true, host_id: hostId }, req);
}
