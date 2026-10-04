import type { NextRequest } from "next/server";
import {
  chatAiPartnerView,
  chatMessagePartnerView,
  resolvePartnerConversation,
  threadCounterpartView,
} from "@/lib/beeagent-chat-bridge";
import { partnerJson } from "@/lib/beeagent-partner";
import { partnerThreadDenied, requirePartnerLinkedHost, THREAD_PERMISSIONS } from "@/lib/beeagent-require-link";
import { cabibeeConversationKey, getChatAi } from "@/lib/chat-ai-settings";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string; listingId: string; guestSessionId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { hostId, listingId, guestSessionId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId, THREAD_PERMISSIONS);
  if (!gate.ok) return gate.response;
  const denied = partnerThreadDenied(req, hostId, guestSessionId);
  if (denied) return denied;
  const conv = resolvePartnerConversation(hostId, listingId, guestSessionId);
  if (!conv) return partnerJson({ error: "Conversación no encontrada.", code: "not_found" }, req, { status: 404 });

  return partnerJson(
    {
      conversation_key: cabibeeConversationKey(listingId, guestSessionId),
      listing_id: listingId,
      listing_title: conv.listing.title,
      guest_session_id: guestSessionId,
      guest_name: conv.messages.find((m) => m.sender === "guest")?.guestName ?? null,
      ...threadCounterpartView(hostId, guestSessionId),
      ...chatAiPartnerView(getChatAi(hostId, listingId, guestSessionId)),
      messages: conv.messages.map(chatMessagePartnerView),
    },
    req
  );
}
