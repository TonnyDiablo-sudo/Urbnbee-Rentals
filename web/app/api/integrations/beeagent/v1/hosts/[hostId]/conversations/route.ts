import type { NextRequest } from "next/server";
import { chatAiPartnerView, chatMessagePartnerView } from "@/lib/beeagent-chat-bridge";
import { partnerJson } from "@/lib/beeagent-partner";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { cabibeeConversationKey, getChatAi } from "@/lib/chat-ai-settings";
import { groupThreads } from "@/lib/host-inbox-store";
import { getListingById } from "@/lib/marketplace-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string }> };

/** Conversaciones del chat de los anuncios del anfitrión, la más reciente primero. ?since= (ISO) filtra por actividad. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { hostId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId, "messages");
  if (!gate.ok) return gate.response;

  const since = req.nextUrl.searchParams.get("since")?.trim() ?? "";
  const out = [];
  for (const msgs of groupThreads(hostId).values()) {
    const last = msgs[msgs.length - 1];
    if (!last || (since && last.createdAt <= since)) continue;
    const { listingId, guestSessionId } = last;
    const firstGuest = msgs.find((m) => m.sender === "guest");
    out.push({
      conversation_key: cabibeeConversationKey(listingId, guestSessionId),
      listing_id: listingId,
      listing_title: getListingById(listingId)?.title ?? null,
      guest_session_id: guestSessionId,
      guest_name: firstGuest?.guestName ?? null,
      message_count: msgs.length,
      last_message: chatMessagePartnerView(last),
      ...chatAiPartnerView(getChatAi(hostId, listingId, guestSessionId)),
    });
  }
  out.sort((a, b) => b.last_message.created_at.localeCompare(a.last_message.created_at));
  return partnerJson({ host_id: hostId, count: out.length, conversations: out }, req);
}
