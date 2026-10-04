import type { NextRequest } from "next/server";
import { chatMessagePartnerView, resolvePartnerConversation } from "@/lib/beeagent-chat-bridge";
import { partnerJson } from "@/lib/beeagent-partner";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { getChatAi } from "@/lib/chat-ai-settings";
import { sanitizeBodyText } from "@/lib/host-inbox-sanitize";
import { appendMessage } from "@/lib/host-inbox-store";
import { notifyGuestHostReply } from "@/lib/push";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string; listingId: string; guestSessionId: string }> };

/**
 * El agente de urbnbeeai contesta al huésped a nombre del anfitrión.
 * Body: { body, client_message_id? }. Sólo si la IA está encendida en esa conversación.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { hostId, listingId, guestSessionId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId, "messages");
  if (!gate.ok) return gate.response;
  const conv = resolvePartnerConversation(hostId, listingId, guestSessionId);
  if (!conv) return partnerJson({ error: "Conversación no encontrada.", code: "not_found" }, req, { status: 404 });

  const body = (await req.json().catch(() => null)) as { body?: unknown; client_message_id?: unknown } | null;
  const text = sanitizeBodyText(body?.body);
  if (!text) return partnerJson({ error: "body es obligatorio.", code: "invalid_body" }, req, { status: 400 });
  const clientId =
    typeof body?.client_message_id === "string" ? body.client_message_id.trim().slice(0, 120) : "";

  if (clientId) {
    const dup = conv.messages.find((m) => m.partnerMessageId === clientId);
    if (dup) return partnerJson({ ok: true, duplicate: true, message: chatMessagePartnerView(dup) }, req);
  }

  const ai = getChatAi(hostId, listingId, guestSessionId);
  if (!ai.enabled) {
    return partnerJson(
      {
        error: "La IA está apagada en esta conversación: contesta el anfitrión.",
        code: ai.available ? "ai_disabled" : "agent_unavailable",
      },
      req,
      { status: 409 }
    );
  }

  const msg = appendMessage({
    listingId,
    hostId,
    guestSessionId,
    sender: "host",
    guestName: "",
    body: text,
    via: "ai",
    ...(clientId ? { partnerMessageId: clientId } : {}),
  });
  notifyGuestHostReply({ listingId, guestSessionId, body: text });

  return partnerJson({ ok: true, message: chatMessagePartnerView(msg) }, req, { status: 201 });
}
