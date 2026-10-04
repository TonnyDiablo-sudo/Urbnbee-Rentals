import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolvePartnerConversation } from "@/lib/beeagent-chat-bridge";
import { partnerJson } from "@/lib/beeagent-partner";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { readChatAttachment } from "@/lib/chat-attachments";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string; listingId: string; guestSessionId: string; file: string }> };

/** Foto o nota de voz del chat, para que el agente la vea o la transcriba. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { hostId, listingId, guestSessionId, file } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId);
  if (!gate.ok) return gate.response;
  if (!resolvePartnerConversation(hostId, listingId, guestSessionId)) {
    return partnerJson({ error: "Conversación no encontrada.", code: "not_found" }, req, { status: 404 });
  }
  const found = await readChatAttachment(listingId, guestSessionId, file);
  if (!found) return partnerJson({ error: "Archivo no encontrado.", code: "not_found" }, req, { status: 404 });
  return new NextResponse(new Uint8Array(found.data), {
    headers: {
      "content-type": found.mime,
      "content-length": String(found.data.byteLength),
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
