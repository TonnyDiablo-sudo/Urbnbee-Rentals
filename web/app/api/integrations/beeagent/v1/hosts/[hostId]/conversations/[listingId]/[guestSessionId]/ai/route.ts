import type { NextRequest } from "next/server";
import { chatAiPartnerView, resolvePartnerConversation } from "@/lib/beeagent-chat-bridge";
import { partnerJson } from "@/lib/beeagent-partner";
import { partnerThreadDenied, requirePartnerLinkedHost, THREAD_PERMISSIONS } from "@/lib/beeagent-require-link";
import { cabibeeConversationKey, getChatAi, setChatAi } from "@/lib/chat-ai-settings";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string; listingId: string; guestSessionId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { hostId, listingId, guestSessionId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId, THREAD_PERMISSIONS);
  if (!gate.ok) return gate.response;
  const denied = partnerThreadDenied(req, hostId, guestSessionId);
  if (denied) return denied;
  if (!resolvePartnerConversation(hostId, listingId, guestSessionId)) {
    return partnerJson({ error: "Conversación no encontrada.", code: "not_found" }, req, { status: 404 });
  }
  return partnerJson(
    { conversation_key: cabibeeConversationKey(listingId, guestSessionId), ...chatAiPartnerView(getChatAi(hostId, listingId, guestSessionId)) },
    req
  );
}

/** El anfitrión prendió o apagó la IA desde urbnbeeai. Body: { ai_replies_enabled, if_match_updated_at? }. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { hostId, listingId, guestSessionId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId, THREAD_PERMISSIONS);
  if (!gate.ok) return gate.response;
  const denied = partnerThreadDenied(req, hostId, guestSessionId);
  if (denied) return denied;
  if (!resolvePartnerConversation(hostId, listingId, guestSessionId)) {
    return partnerJson({ error: "Conversación no encontrada.", code: "not_found" }, req, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as { ai_replies_enabled?: unknown; if_match_updated_at?: unknown } | null;
  if (typeof body?.ai_replies_enabled !== "boolean") {
    return partnerJson({ error: "ai_replies_enabled (boolean) es obligatorio.", code: "invalid_body" }, req, { status: 400 });
  }
  const ifMatch =
    body.if_match_updated_at === undefined
      ? undefined
      : typeof body.if_match_updated_at === "string"
        ? body.if_match_updated_at
        : null;

  const r = setChatAi({ hostId, listingId, guestSessionId, enabled: body.ai_replies_enabled, by: "urbnbeeai", ifMatchUpdatedAt: ifMatch });
  const key = cabibeeConversationKey(listingId, guestSessionId);
  if (!r.ok) {
    return partnerJson(
      {
        error: r.reason === "conflict" ? "El anfitrión cambió el modo IA hace un momento." : "El agente no está activo.",
        code: r.reason === "conflict" ? "conflict" : "agent_unavailable",
        conversation_key: key,
        ...chatAiPartnerView(r.state),
      },
      req,
      { status: 409 }
    );
  }
  return partnerJson({ ok: true, conversation_key: key, ...chatAiPartnerView(r.state) }, req);
}
