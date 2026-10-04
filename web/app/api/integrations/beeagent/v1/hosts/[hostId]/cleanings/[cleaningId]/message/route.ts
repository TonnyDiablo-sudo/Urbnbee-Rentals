import type { NextRequest } from "next/server";
import { chatMessagePartnerView } from "@/lib/beeagent-chat-bridge";
import { partnerJson } from "@/lib/beeagent-partner";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { cabibeeConversationKey, getChatAi } from "@/lib/chat-ai-settings";
import { getCleaningTask } from "@/lib/cleaning-store";
import { cleaningMemberForThread } from "@/lib/cleaning-thread";
import { sanitizeBodyText } from "@/lib/host-inbox-sanitize";
import { appendMessage, listThread } from "@/lib/host-inbox-store";
import { notifyGuestHostReply } from "@/lib/push";
import { getTeamMember } from "@/lib/team-store";
import { publicNameOf } from "@/lib/display-name";
import { findUserById } from "@/lib/marketplace-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string; cleaningId: string }> };

/**
 * El agente le escribe a quien tiene asignada la limpieza, en su chat con el anfitrión.
 * Body: { body, client_message_id? }. Permiso `cleanings_coordinate`.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { hostId, cleaningId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId, "cleanings_coordinate");
  if (!gate.ok) return gate.response;
  const task = getCleaningTask(cleaningId);
  if (!task || task.hostId !== hostId) return partnerJson({ error: "Limpieza no encontrada." }, req, { status: 404 });

  const member = task.assignee && task.assignee !== "host" ? getTeamMember(task.assignee) : undefined;
  const guestSessionId = member?.userId ? `gu_${member.userId}` : "";
  if (!guestSessionId || !cleaningMemberForThread(hostId, guestSessionId)) {
    return partnerJson(
      { error: "Esta limpieza no tiene asignada a nadie del equipo con cuenta activa.", code: "no_cleaner" },
      req,
      { status: 409 }
    );
  }

  const body = (await req.json().catch(() => null)) as { body?: unknown; client_message_id?: unknown } | null;
  const text = sanitizeBodyText(body?.body);
  if (!text) return partnerJson({ error: "body es obligatorio.", code: "invalid_body" }, req, { status: 400 });
  const clientId = typeof body?.client_message_id === "string" ? body.client_message_id.trim().slice(0, 120) : "";
  const thread = listThread(task.listingId, guestSessionId);
  if (clientId) {
    const dup = thread.find((m) => m.partnerMessageId === clientId);
    if (dup) return partnerJson({ ok: true, duplicate: true, message: chatMessagePartnerView(dup) }, req);
  }

  // Si el anfitrión apagó la IA en ese hilo, quiere hablar él con esa persona.
  const ai = getChatAi(hostId, task.listingId, guestSessionId);
  if (ai.updatedAt && !ai.enabled) {
    return partnerJson(
      { error: "El anfitrión apagó la IA en el chat con esta persona.", code: "ai_disabled" },
      req,
      { status: 409 }
    );
  }

  const msg = appendMessage({
    listingId: task.listingId,
    hostId,
    guestSessionId,
    sender: "host",
    guestName: thread.find((m) => m.sender === "guest")?.guestName || publicNameOf(findUserById(member!.userId!)) || member!.email,
    body: text,
    via: "ai",
    ...(clientId ? { partnerMessageId: clientId } : {}),
  });
  notifyGuestHostReply({ listingId: task.listingId, guestSessionId, body: text });

  return partnerJson(
    {
      ok: true,
      conversation_key: cabibeeConversationKey(task.listingId, guestSessionId),
      guest_session_id: guestSessionId,
      team_member_id: member!.id,
      message: chatMessagePartnerView(msg),
    },
    req,
    { status: 201 }
  );
}
