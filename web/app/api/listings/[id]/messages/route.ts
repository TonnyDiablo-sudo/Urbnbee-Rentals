import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { nameForViewer, publicNameOf, shareABooking } from "@/lib/display-name";
import { findUserById, getListingById } from "@/lib/marketplace-store";
import {
  appendMessage,
  guestSessionIdForUser,
  listThreadMerged,
} from "@/lib/host-inbox-store";
import { sanitizeBodyText, sanitizeGuestName, sanitizeOptionalEmail } from "@/lib/host-inbox-sanitize";
import { allowHostInboxPost } from "@/lib/host-inbox-rate-limit";
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
  const messages = listThreadMerged(listingId, ids);
  return NextResponse.json({
    messages: messages.map((m) => {
      let guestLabel = m.guestName;
      if (m.sender === "host") guestLabel = hostLabel;
      else if (m.guestSessionId.startsWith("gu_")) {
        guestLabel = nameForViewer(m.guestSessionId.slice(3), reveal) || m.guestName;
      }
      return { id: m.id, sender: m.sender, body: m.body, createdAt: m.createdAt, guestLabel };
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

  appendMessage({
    listingId,
    hostId: listing.hostId,
    guestSessionId,
    sender: "guest",
    guestName,
    guestEmail,
    body: text,
  });
  notifyHostNewMessage({ hostId: listing.hostId, listingId, guestSessionId, guestName, body: text });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, JSON.stringify(map), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  return res;
}
