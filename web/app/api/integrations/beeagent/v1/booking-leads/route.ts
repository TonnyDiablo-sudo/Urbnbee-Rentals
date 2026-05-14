import type { NextRequest } from "next/server";
import { appendMessage } from "@/lib/host-inbox-store";
import { getListingById, getListingBySlug, findUserById } from "@/lib/marketplace-store";
import {
  getPartnerApiSecret,
  partnerJson,
  partnerNotConfiguredResponse,
  verifyPartnerBearer,
  partnerAuthErrorResponse,
} from "@/lib/beeagent-partner";

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
  if (!getPartnerApiSecret()) return partnerNotConfiguredResponse(req);
  if (!verifyPartnerBearer(req)) return partnerAuthErrorResponse(req);

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

  const host = findUserById(hostId);
  if (!host || host.role !== "host") {
    return partnerJson({ error: "Anfitrión no válido." }, req, { status: 404 });
  }

  const listing = getListingById(listingRef) ?? getListingBySlug(listingRef);
  if (!listing || listing.hostId !== hostId) {
    return partnerJson({ error: "Anuncio no encontrado o no pertenece al host." }, req, { status: 404 });
  }

  const guestSessionId =
    typeof body.threadKey === "string" && body.threadKey.trim().length > 0
      ? `beeagent_${body.threadKey.trim().slice(0, 200)}`
      : `beeagent_${listing.id}`;

  const guestEmail = typeof body.guestEmail === "string" ? body.guestEmail.trim().slice(0, 254) : undefined;

  const msg = appendMessage({
    listingId: listing.id,
    hostId,
    guestSessionId,
    sender: "guest",
    guestName,
    guestEmail: guestEmail?.length ? guestEmail : undefined,
    body: `[BeeAgent] ${text}`,
  });

  return partnerJson({ ok: true, messageId: msg.id, listingId: listing.id }, req);
}
