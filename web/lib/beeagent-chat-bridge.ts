import "server-only";
import { getBeeagentLinkForHost } from "@/lib/beeagent-host-link-store";
import { enqueueChatOutbound } from "@/lib/beeagent-outbound";
import { botCan } from "@/lib/beeagent-permissions";
import { cabibeeConversationKey, getChatAi, type ChatAiState } from "@/lib/chat-ai-settings";
import { listThread } from "@/lib/host-inbox-store";
import type { HostInboxMessageRecord } from "@/lib/host-inbox-types";
import { getListingById } from "@/lib/marketplace-store";

const API_ROOT = "/api/integrations/beeagent/v1";

export function partnerAttachmentPath(hostId: string, listingId: string, guestSessionId: string, file: string): string {
  return `${API_ROOT}/hosts/${encodeURIComponent(hostId)}/conversations/${encodeURIComponent(listingId)}/${encodeURIComponent(guestSessionId)}/attachments/${encodeURIComponent(file)}`;
}

export function chatMessagePartnerView(m: HostInboxMessageRecord) {
  const a = m.attachment;
  return {
    id: m.id,
    sender: m.sender,
    via: m.via ?? null,
    body: m.body,
    guest_name: m.sender === "guest" ? m.guestName : null,
    created_at: m.createdAt,
    attachment: a
      ? {
          kind: a.kind,
          mime: a.mime,
          bytes: a.bytes,
          duration_sec: a.durationSec ?? null,
          path: partnerAttachmentPath(m.hostId, m.listingId, m.guestSessionId, a.file),
        }
      : null,
  };
}

export function chatAiPartnerView(state: ChatAiState) {
  return { available: state.available, ai_replies_enabled: state.enabled, updated_at: state.updatedAt };
}

/** Manda a la central de chat de urbnbeeai cada mensaje del chat de un anuncio cuyo anfitrión está vinculado. */
export function bridgeChatMessage(m: HostInboxMessageRecord): void {
  if (!getBeeagentLinkForHost(m.hostId) || !botCan(m.hostId, "messages")) return;
  const ai = getChatAi(m.hostId, m.listingId, m.guestSessionId);
  enqueueChatOutbound("message.created", m.hostId, cabibeeConversationKey(m.listingId, m.guestSessionId), {
    listing_id: m.listingId,
    guest_session_id: m.guestSessionId,
    message: chatMessagePartnerView(m),
    ...chatAiPartnerView(ai),
  });
}

/** La conversación existe y el anuncio es de ese anfitrión. */
export function resolvePartnerConversation(hostId: string, listingId: string, guestSessionId: string) {
  const listing = getListingById(listingId);
  if (!listing || listing.hostId !== hostId) return null;
  const messages = listThread(listingId, guestSessionId);
  if (messages.length === 0) return null;
  return { listing, messages };
}

export function bridgeChatAiChanged(hostId: string, listingId: string, guestSessionId: string, state: ChatAiState): void {
  if (!botCan(hostId, "messages")) return;
  enqueueChatOutbound("conversation.ai_changed", hostId, cabibeeConversationKey(listingId, guestSessionId), {
    listing_id: listingId,
    guest_session_id: guestSessionId,
    changed_by: "host",
    ...chatAiPartnerView(state),
  });
}
