import { NextRequest, NextResponse } from "next/server";
import { hostScope } from "@/lib/team-access";
import { memberCoversListing } from "@/lib/team-store";
import { getSessionUser } from "@/lib/session";
import { groupThreads } from "@/lib/host-inbox-store";
import { nameForViewer, shareABooking } from "@/lib/display-name";
import { translateTexts } from "@/lib/content-translate";
import { getLang } from "@/lib/i18n/server";
import { translateIncoming } from "@/lib/listing-localize";
import { getListingById } from "@/lib/marketplace-store";
import { attachmentView } from "@/lib/chat-attachments";
import type { ChatAttachmentView } from "@/lib/host-inbox-types";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  const scope = hostScope(user, req.nextUrl.searchParams.get("host"), "messages");
  if (!scope) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const grouped = groupThreads(scope.hostId);
  type ThreadOut = {
    listingId: string;
    listingTitle: string;
    guestSessionId: string;
    guestName: string;
    guestEmail?: string;
    lastAt: string;
    messages: {
      id: string;
      sender: "guest" | "host";
      body: string;
      original?: string;
      createdAt: string;
      guestName: string;
      attachment?: ChatAttachmentView;
    }[];
  };

  const threads: ThreadOut[] = [];
  const lang = await getLang();
  await translateTexts(
    [...grouped.values()].flatMap((msgs) => msgs.filter((m) => m.sender === "guest").slice(-40).map((m) => m.body)),
    lang,
    { waitMs: 2500 }
  );

  for (const [key, raw] of grouped.entries()) {
    const colon = key.indexOf(":");
    const listingId = colon === -1 ? key : key.slice(0, colon);
    if (scope.member && !memberCoversListing(scope.member, listingId)) continue;
    const msgs = await translateIncoming(raw, "guest", lang, 0);
    const guestSessionId = colon === -1 ? "" : key.slice(colon + 1);
    const listing = getListingById(listingId);
    const firstGuest = msgs.find((m) => m.sender === "guest");
    const last = msgs[msgs.length - 1];
    const guestUserId = guestSessionId.startsWith("gu_") ? guestSessionId.slice(3) : "";
    const reveal = Boolean(guestUserId && shareABooking(scope.hostId, guestUserId));
    const guestName =
      (guestUserId && nameForViewer(guestUserId, reveal)) || firstGuest?.guestName || "?";
    threads.push({
      listingId,
      listingTitle: listing?.title ?? listingId,
      guestSessionId,
      guestName,
      guestEmail: firstGuest?.guestEmail,
      lastAt: last?.createdAt ?? "",
      messages: msgs.map((m) => ({
        id: m.id,
        sender: m.sender,
        body: m.body,
        original: m.original,
        createdAt: m.createdAt,
        guestName: m.sender === "guest" ? guestName : "",
        attachment: attachmentView(m),
      })),
    });
  }

  threads.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());

  return NextResponse.json({ threads });
}
