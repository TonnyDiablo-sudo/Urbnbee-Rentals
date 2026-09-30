import type { NextRequest } from "next/server";
import { appendMessage } from "@/lib/host-inbox-store";
import { getListingById, getListingBySlug, findUserById } from "@/lib/marketplace-store";
import { partnerJson } from "@/lib/beeagent-partner";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { partnerIdempotentJson } from "@/lib/beeagent-route-helpers";

export const runtime = "nodejs";

function sanitizeName(s: unknown): string {
  if (typeof s !== "string") return "BeeAgent";
  const t = s.trim().slice(0, 120);
  return t.length ? t : "BeeAgent";
}

function sanitizeBody(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, 8000);
}

/** Lead / mensaje desde BeeAgent → bandeja del anfitrión (mismo store que el inbox web). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const hostId = typeof body.hostId === "string" ? body.hostId.trim() : "";
  const listingRef = typeof body.listingId === "string" ? body.listingId.trim() : "";
  const text = sanitizeBody(body.body ?? body.message);
  const guestName = sanitizeName(body.guestName ?? body.fromName);

  if (!hostId || !listingRef || !text.length) {
    return partnerJson(
      { error: "Requiere hostId, listingId (id o slug) y body o message." },
      req,
      { status: 400 }
    );
  }

  const gate = requirePartnerLinkedHost(req, hostId);
  if (!gate.ok) return gate.response;

  const host = findUserById(hostId);
  if (!host || host.role !== "host") {
    return partnerJson({ error: "Anfitrión no válido." }, req, { status: 404 });
  }

  const listing = getListingById(listingRef) ?? getListingBySlug(listingRef);
  if (!listing || listing.hostId !== hostId) {
    return partnerJson({ error: "Anuncio no encontrado o no pertenece al host." }, req, { status: 404 });
  }

  const conversationKey =
    typeof body.conversation_key === "string"
      ? body.conversation_key.trim().slice(0, 200)
      : typeof body.threadKey === "string"
        ? body.threadKey.trim().slice(0, 200)
        : "";
  const guestSessionId = conversationKey
    ? `beeagent_${conversationKey}`
    : `beeagent_${listing.id}`;

  const guestEmail = typeof body.guestEmail === "string" ? body.guestEmail.trim().slice(0, 254) : undefined;

  return partnerIdempotentJson(req, () => {
    const msg = appendMessage({
      listingId: listing.id,
      hostId,
      guestSessionId,
      sender: "guest",
      guestName,
      guestEmail: guestEmail?.length ? guestEmail : undefined,
      body: `[BeeAgent] ${text}`,
    });
    return {
      status: 200,
      body: {
        ok: true,
        messageId: msg.id,
        listingId: listing.id,
        conversation_key: conversationKey || null,
      },
    };
  });
}
