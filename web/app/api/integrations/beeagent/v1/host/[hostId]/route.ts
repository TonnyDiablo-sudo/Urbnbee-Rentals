import type { NextRequest } from "next/server";
import { getBeeagentAgentStatus } from "@/lib/beeagent-agent-status";
import { entitlementsPublicView } from "@/lib/host-entitlements";
import { getHostPaymentPublic } from "@/lib/host-payment-store";
import { getBotPermissions, getBotPermissionsUpdatedAt } from "@/lib/beeagent-permissions";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { findUserById, getHostProfile } from "@/lib/marketplace-store";
import { partnerJson } from "@/lib/beeagent-partner";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string }> };

function publicUser(u: NonNullable<ReturnType<typeof findUserById>>) {
  return {
    id: u.id,
    fullName: u.fullName,
    role: u.role,
    createdAt: u.createdAt,
  };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { hostId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId);
  if (!gate.ok) return gate.response;

  const user = findUserById(hostId);
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return partnerJson({ error: "Anfitrión no encontrado." }, req, { status: 404 });
  }
  const profile = getHostProfile(hostId);
  return partnerJson(
    {
      user: publicUser(user),
      profile: profile ?? null,
      entitlements: entitlementsPublicView(hostId),
      payments_connected: getHostPaymentPublic(hostId).connected,
      agent_status: getBeeagentAgentStatus(hostId) ?? { hostId, active: false },
      permissions: getBotPermissions(hostId),
      permissions_updated_at: getBotPermissionsUpdatedAt(hostId),
    },
    req
  );
}
