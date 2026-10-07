import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { bridgeChatMessage } from "@/lib/beeagent-chat-bridge";
import { attachmentView } from "@/lib/chat-attachments";
import { isChatLang, isChatTranslateTarget } from "@/lib/chat-langs";
import { CHAT_TRANSLATOR_LOCKED_ERROR, chatTranslatorAllowed } from "@/lib/chat-media-access";
import { chatReadingLang } from "@/lib/chat-reading-lang";
import { translateOutgoing } from "@/lib/chat-translate";
import { emailRequiredResponse } from "@/lib/email-gate";
import { nameForViewer, publicNameOf, shareABooking } from "@/lib/display-name";
import { findUserById, getListingById } from "@/lib/marketplace-store";
import {
  appendMessage,
  guestSessionIdForUser,
  listThread,
  listThreadMerged,
} from "@/lib/host-inbox-store";
import { sanitizeBodyText, sanitizeGuestName, sanitizeOptionalEmail } from "@/lib/host-inbox-sanitize";
import { allowHostInboxPost } from "@/lib/host-inbox-rate-limit";
import { getLang } from "@/lib/i18n/server";
import { translateIncoming } from "@/lib/listing-localize";
import { getSessionUser } from "@/lib/session";
import { notifyHostNewMessage } from "@/lib/push";

const COOKIE = "urb_chat_sess";

type SessionMap = Record<string, string>;

function parseSessions(raw: string | undefined): SessionMap {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as unknown;
    if (typeof o !== "object" || o === null || Array.isArray(o)) return {};
    return o as SessionMap;
  } catch {
    return {};
  }
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id: listingId } = await ctx.params;
  const sessionUser = await getSessionUser();
  const jar = await cookies();
  const map = parseSessions(jar.get(COOKIE)?.value);
  const authSid = sessionUser ? guestSessionIdForUser(sessionUser.id) : null;
  const cookieSid = map[listingId];
  const ids = [...new Set([authSid, cookieSid].filter(Boolean) as string[])];
  const listing = getListingById(listingId);
  const guestId = sessionUser?.id;
  const reveal = Boolean(listing && guestId && shareABooking(listing.hostId, guestId));
  const hostLabel = listing ? nameForViewer(listing.hostId, reveal) || "Anfitrión" : "Anfitrión";
  const lang = chatReadingLang(sessionUser, await getLang(), { as: "guest" });
  const messages = await translateIncoming(listThreadMerged(listingId, ids), "host", lang);
  return NextResponse.json({
    readingLang: lang,
    messages: messages.map((m) => {
      let guestLabel = m.guestName;
      if (m.sender === "host") guestLabel = hostLabel;
      else if (m.guestSessionId.startsWith("gu_")) {
        guestLabel = nameForViewer(m.guestSessionId.slice(3), reveal) || m.guestName;
      }
      return {
        id: m.id,
        sender: m.sender,
        body: m.body,
        original: m.original,
        createdAt: m.createdAt,
        guestLabel,
        attachment: attachmentView(m),
        transcript: m.transcript,
        transcriptOriginal: m.transcriptOriginal,
      };
    }),
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id: listingId } = await ctx.params;
  const listing = getListingById(listingId);
  if (!listing?.published) {
    return NextResponse.json({ error: "Este alojamiento no está disponible." }, { status: 404 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json(
      {
        error:
          "Crea una cuenta gratuita para escribir al anfitrión. Así protegemos a todos del spam y sabemos quién escribe.",
        needsLogin: true,
      },
      { status: 401 }
    );
  }

  if (sessionUser.id !== listing.hostId) {
    const blocked = emailRequiredResponse(sessionUser, "message");
    if (blocked) return blocked;
  }

  const ip = clientIp(req);
  if (!allowHostInboxPost(`guest:${ip}:${listingId}`, 45_000)) {
    return NextResponse.json(
      { error: "Demasiados mensajes seguidos. Espera un momento e intenta de nuevo." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const guestEmail = sanitizeOptionalEmail(body.guestEmail);
  const text = sanitizeBodyText(body.body);
  const reveal = shareABooking(listing.hostId, sessionUser.id);
  const account = findUserById(sessionUser.id);
  const guestName = sanitizeGuestName(
    (reveal ? account?.fullName : account && publicNameOf(account)) || sessionUser.fullName || "Huésped"
  );

  if (!text.length) {
    return NextResponse.json({ error: "Escribe un mensaje." }, { status: 400 });
  }

  const jar = await cookies();
  const map = parseSessions(jar.get(COOKIE)?.value);
  const guestSessionId = guestSessionIdForUser(sessionUser.id);
  map[listingId] = guestSessionId;

  let out = { body: text } as Awaited<ReturnType<typeof translateOutgoing>>;
  // El cliente ya tradujo el borrador con /api/chat/translate: guarda lo que escribió como `original`.
  const original = sanitizeBodyText(body.original);
  if (original && original !== text) {
    if (!chatTranslatorAllowed(sessionUser, { as: "guest" })) {
      return NextResponse.json({ error: CHAT_TRANSLATOR_LOCKED_ERROR, translatorLocked: true }, { status: 403 });
    }
    out = { body: text, original, lang: isChatLang(body.lang) ? body.lang : undefined };
  } else if (isChatTranslateTarget(body.translateTo)) {
    if (!chatTranslatorAllowed(sessionUser, { as: "guest" })) {
      return NextResponse.json({ error: CHAT_TRANSLATOR_LOCKED_ERROR, translatorLocked: true }, { status: 403 });
    }
    out = await translateOutgoing(text, body.translateTo, {
      otherTexts: listThread(listingId, guestSessionId)
        .filter((m) => m.sender === "host" && m.body.trim())
        .map((m) => m.body),
      // Sin respuestas del anfitrión todavía: el idioma en que escribió su anuncio.
      fallbackTexts: [listing.title, listing.description].filter(Boolean),
      cacheKey: `g:${listingId}:${guestSessionId}`,
    });
  }

  const msg = appendMessage({
    listingId,
    hostId: listing.hostId,
    guestSessionId,
    sender: "guest",
    guestName,
    guestEmail,
    body: out.body,
    ...(out.original ? { original: out.original, lang: out.lang } : {}),
  });
  bridgeChatMessage(msg);
  notifyHostNewMessage({ hostId: listing.hostId, listingId, guestSessionId, guestName, body: out.body });

  const res = NextResponse.json({ ok: true, translated: Boolean(out.original), lang: out.lang });
  res.cookies.set(COOKIE, JSON.stringify(map), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  return res;
}
