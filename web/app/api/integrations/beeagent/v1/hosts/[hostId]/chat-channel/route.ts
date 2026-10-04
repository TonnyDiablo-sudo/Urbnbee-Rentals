import type { NextRequest } from "next/server";
import { partnerJson } from "@/lib/beeagent-partner";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { chatAiAvailable, getChatChannel, setChatChannel } from "@/lib/chat-ai-settings";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string }> };

function view(hostId: string) {
  const ch = getChatChannel(hostId);
  return {
    host_id: hostId,
    enabled: ch?.enabled === true,
    updated_at: ch?.updatedAt ?? null,
    agent_available: chatAiAvailable(hostId),
  };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { hostId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId);
  if (!gate.ok) return gate.response;
  return partnerJson(view(hostId), req);
}

/** urbnbeeai avisa que su central de chat ya recibe y contesta el chat de Cabibee de este anfitrión. */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const { hostId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId);
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => null)) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== "boolean") {
    return partnerJson({ error: "enabled (boolean) es obligatorio.", code: "invalid_body" }, req, { status: 400 });
  }
  setChatChannel(hostId, body.enabled);
  return partnerJson(view(hostId), req);
}
