import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { groupThreads } from "@/lib/host-inbox-store";
import { getListingById } from "@/lib/marketplace-store";

export async function GET() {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const grouped = groupThreads(user.id);
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
      createdAt: string;
      guestName: string;
    }[];
  };

  const threads: ThreadOut[] = [];

  for (const [key, msgs] of grouped.entries()) {
    const colon = key.indexOf(":");
    const listingId = colon === -1 ? key : key.slice(0, colon);
    const guestSessionId = colon === -1 ? "" : key.slice(colon + 1);
    const listing = getListingById(listingId);
    const firstGuest = msgs.find((m) => m.sender === "guest");
    const last = msgs[msgs.length - 1];
    threads.push({
      listingId,
      listingTitle: listing?.title ?? listingId,
      guestSessionId,
      guestName: firstGuest?.guestName ?? "?",
      guestEmail: firstGuest?.guestEmail,
      lastAt: last?.createdAt ?? "",
      messages: msgs.map((m) => ({
        id: m.id,
        sender: m.sender,
        body: m.body,
        createdAt: m.createdAt,
        guestName: m.sender === "guest" ? m.guestName : "",
      })),
    });
  }

  threads.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());

  return NextResponse.json({ threads });
}
