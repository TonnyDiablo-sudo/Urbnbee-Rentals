import { NextRequest, NextResponse } from "next/server";
import { CHAT_TRANSLATOR_LOCKED_ERROR, chatTranslatorAllowed } from "@/lib/chat-media-access";
import { preferredChatLangOf } from "@/lib/chat-reading-lang";
import { chatTranslatorEnabled, translateOutgoing } from "@/lib/chat-translate";
import { guestSessionIdForUser, listThread } from "@/lib/host-inbox-store";
import { getLang } from "@/lib/i18n/server";
import { getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { memberCan } from "@/lib/team-access";

/**
 * Traduce un borrador al idioma de la otra persona del chat antes de mandarlo (como el traductor de
 * urbnbeeai). Destino: el idioma que la otra persona puso en su perfil; si no, el de sus mensajes.
 * Body: { text, listingId, guestSessionId? (anfitrión) } → { text, same, lang }.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 2_000) : "";
  const listingId = typeof body.listingId === "string" ? body.listingId.trim() : "";
  const listing = getListingById(listingId);
  if (!listing || !text) return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });

  const asHost =
    listing.hostId === user.id || user.role === "admin" || memberCan(user.id, listing.hostId, "messages", listing.id);
  const guestSessionId = asHost
    ? typeof body.guestSessionId === "string"
      ? body.guestSessionId.trim()
      : ""
    : guestSessionIdForUser(user.id);
  if (!guestSessionId) return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });

  if (!chatTranslatorAllowed(user, asHost ? { as: "host", listingHostId: listing.hostId } : { as: "guest" })) {
    return NextResponse.json({ error: CHAT_TRANSLATOR_LOCKED_ERROR, translatorLocked: true }, { status: 403 });
  }
  if (!chatTranslatorEnabled()) {
    return NextResponse.json({ error: "El traductor no está disponible en este momento." }, { status: 503 });
  }

  const otherSender = asHost ? "guest" : "host";
  const otherUserId = asHost ? (guestSessionId.startsWith("gu_") ? guestSessionId.slice(3) : undefined) : listing.hostId;
  const preferred = preferredChatLangOf(otherUserId);
  const out = await translateOutgoing(text, preferred ?? "auto", {
    // Lo que escribió la otra persona, incluidas las transcripciones de sus notas de voz.
    otherTexts: listThread(listingId, guestSessionId)
      .filter((m) => m.sender === otherSender)
      .map((m) => (m.body.trim() ? m.body : (m.transcript ?? "")))
      .filter((s) => s.trim()),
    // Sin mensajes de la otra persona: el idioma en que está el anuncio.
    fallbackTexts: asHost ? undefined : [listing.title, listing.description].filter(Boolean),
    // Si no hay nada que leer, el idioma base del sitio.
    defaultLang: await getLang(),
    cacheKey: `${asHost ? "h" : "g"}:${listingId}:${guestSessionId}`,
  });

  return NextResponse.json({ text: out.body, same: !out.original, lang: out.lang ?? preferred ?? null });
}
