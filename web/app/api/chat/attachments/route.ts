import { NextRequest, NextResponse } from "next/server";
import { bridgeChatMessage } from "@/lib/beeagent-chat-bridge";
import { attachmentPreview, attachmentView, storeChatAttachment } from "@/lib/chat-attachments";
import { CHAT_MEDIA_LOCKED_ERROR, chatMediaAllowed } from "@/lib/chat-media-access";
import { scheduleTranscription } from "@/lib/chat-transcribe";
import { publicNameOf, shareABooking } from "@/lib/display-name";
import { emailRequiredResponse } from "@/lib/email-gate";
import { allowHostInboxPost } from "@/lib/host-inbox-rate-limit";
import { sanitizeBodyText, sanitizeGuestName } from "@/lib/host-inbox-sanitize";
import { appendMessage, guestSessionIdForUser } from "@/lib/host-inbox-store";
import { findUserById, getListingById } from "@/lib/marketplace-store";
import { notifyGuestHostReply, notifyHostNewMessage } from "@/lib/push";
import { getSessionUser } from "@/lib/session";
import { memberCan } from "@/lib/team-access";

export const runtime = "nodejs";

/**
 * Manda una foto o una nota de voz al chat del anuncio. multipart/form-data:
 * file, listingId, as=guest|host, guestSessionId (sólo anfitrión), caption, durationSec.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Crea una cuenta gratuita para escribir al anfitrión.", needsLogin: true }, { status: 401 });
  }
  if (!allowHostInboxPost(`media:${user.id}`, 2_500)) {
    return NextResponse.json({ error: "Espera unos segundos entre envíos." }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "No llegó el archivo." }, { status: 400 });
  }
  const listingId = String(form.get("listingId") ?? "").trim();
  const as = form.get("as") === "host" ? "host" : "guest";
  const caption = sanitizeBodyText(form.get("caption") ?? "");
  const listing = getListingById(listingId);
  if (!listing) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  let guestSessionId: string;
  if (as === "host") {
    guestSessionId = String(form.get("guestSessionId") ?? "").trim();
    const owner = listing.hostId === user.id && (user.role === "host" || user.role === "admin");
    if (!guestSessionId || (!owner && !memberCan(user.id, listing.hostId, "messages", listing.id))) {
      return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    }
    // Publicar anuncios y recibir chats no pide nada; contestar sí pide el correo confirmado.
    const blocked = emailRequiredResponse(user, "reply");
    if (blocked) return blocked;
  } else {
    if (!listing.published) return NextResponse.json({ error: "Este alojamiento no está disponible." }, { status: 404 });
    const blocked = emailRequiredResponse(user, "message");
    if (blocked) return blocked;
    guestSessionId = guestSessionIdForUser(user.id);
  }
  if (!chatMediaAllowed(user, { as, listingHostId: listing.hostId })) {
    return NextResponse.json({ error: CHAT_MEDIA_LOCKED_ERROR, needsIdentity: true }, { status: 403 });
  }

  const stored = await storeChatAttachment({
    listingId,
    guestSessionId,
    data: Buffer.from(await file.arrayBuffer()),
    mime: file.type || "application/octet-stream",
    durationSec: Number(form.get("durationSec")),
  }).catch((e) => {
    console.warn("[chat attachment] store", e instanceof Error ? e.message : e);
    return { error: "No se pudo guardar el archivo. Intenta de nuevo." } as { error: string; attachment?: undefined };
  });
  if (!stored.attachment) return NextResponse.json({ error: stored.error }, { status: 400 });

  let guestName = "";
  if (as === "guest") {
    const reveal = shareABooking(listing.hostId, user.id);
    const account = findUserById(user.id);
    guestName = sanitizeGuestName(
      (reveal ? account?.fullName : account && publicNameOf(account)) || user.fullName || "Huésped"
    );
  }
  const msg = appendMessage({
    listingId,
    hostId: listing.hostId,
    guestSessionId,
    sender: as,
    guestName,
    body: caption,
    attachment: stored.attachment,
  });
  bridgeChatMessage(msg);
  scheduleTranscription(msg);

  const preview = caption || attachmentPreview(stored.attachment.kind);
  if (as === "guest") {
    notifyHostNewMessage({ hostId: listing.hostId, listingId, guestSessionId, guestName, body: preview, translatable: !caption });
  } else {
    notifyGuestHostReply({ listingId, guestSessionId, body: preview, translatable: !caption });
  }

  return NextResponse.json({
    ok: true,
    message: { id: msg.id, sender: msg.sender, body: msg.body, createdAt: msg.createdAt, attachment: attachmentView(msg) },
  });
}
