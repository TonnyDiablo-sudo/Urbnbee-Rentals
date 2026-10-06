import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getListingById } from "@/lib/marketplace-store";
import { appendMessage, listThread } from "@/lib/host-inbox-store";
import { bridgeChatMessage } from "@/lib/beeagent-chat-bridge";
import { isChatTranslateTarget } from "@/lib/chat-langs";
import { CHAT_TRANSLATOR_LOCKED_ERROR, chatTranslatorAllowed } from "@/lib/chat-media-access";
import { translateOutgoing } from "@/lib/chat-translate";
import { sanitizeBodyText } from "@/lib/host-inbox-sanitize";
import { allowHostInboxPost } from "@/lib/host-inbox-rate-limit";
import { notifyGuestHostReply } from "@/lib/push";
import { memberCan } from "@/lib/team-access";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!allowHostInboxPost(`host:${user.id}`, 8_000)) {
    return NextResponse.json({ error: "Espera unos segundos entre respuestas." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const listingId = typeof body.listingId === "string" ? body.listingId.trim() : "";
  const guestSessionId =
    typeof body.guestSessionId === "string" ? body.guestSessionId.trim() : "";
  const text = sanitizeBodyText(body.body);

  if (!listingId || !guestSessionId) {
    return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  }
  if (!text.length) {
    return NextResponse.json({ error: "Escribe un mensaje." }, { status: 400 });
  }

  const listing = getListingById(listingId);
  const owner = listing?.hostId === user.id && (user.role === "host" || user.role === "admin");
  if (!listing || (!owner && !memberCan(user.id, listing.hostId, "messages", listing.id))) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  let out = { body: text } as Awaited<ReturnType<typeof translateOutgoing>>;
  if (isChatTranslateTarget(body.translateTo)) {
    if (!chatTranslatorAllowed(user, { as: "host", listingHostId: listing.hostId })) {
      return NextResponse.json({ error: CHAT_TRANSLATOR_LOCKED_ERROR, translatorLocked: true }, { status: 403 });
    }
    out = await translateOutgoing(text, body.translateTo, {
      otherTexts: listThread(listingId, guestSessionId)
        .filter((m) => m.sender === "guest" && m.body.trim())
        .map((m) => m.body),
      cacheKey: `h:${listingId}:${guestSessionId}`,
    });
  }

  const msg = appendMessage({
    listingId,
    hostId: listing.hostId,
    guestSessionId,
    sender: "host",
    guestName: "",
    body: out.body,
    ...(out.original ? { original: out.original, lang: out.lang } : {}),
  });
  bridgeChatMessage(msg);
  notifyGuestHostReply({ listingId, guestSessionId, body: out.body });

  return NextResponse.json({ ok: true, translated: Boolean(out.original), lang: out.lang });
}
